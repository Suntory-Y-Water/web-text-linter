# Data Models

## Domain Model

**Aggregates and Transactional Boundaries**:
- **Draft Aggregate**: ドラフトテキスト + 無視情報 + プリセット選択
  - トランザクション境界: localStorage操作単位
  - 一貫性: 単一キーで全文上書き、無視情報は別キーで管理
- **Lint Result Aggregate**: Lint結果配列
  - トランザクション境界: Worker通信単位
  - 一貫性: requestIdで最新結果のみ保持

**Entities, Value Objects, Domain Events**:
- **Entity**: なし（MVPでは永続的な識別子を持つエンティティなし）
- **Value Object**: `LintResult`, `Preset`, `DraftError`, `StorageError`
- **Domain Events**: `LintCompleted`, `FixApplied`, `DraftSaved`

**Business Rules & Invariants**:
- Lint結果は最新のrequestIdのみ有効
- ドラフトは常に1本のみ管理
- 無視された指摘はリストから除外されるが、Lint結果には含まれる

---

## Logical Data Model

**Structure Definition**:

### LintResult
Lint指摘の単位

```typescript
type LintResult = {
  id: string;              // 一意なID（UUID）
  ruleId: string;          // textlintのruleId（例: "ja-technical-writing/max-ten"）
  message: string;         // 指摘メッセージ
  line: number;            // 行番号（1-indexed）
  column: number;          // 列番号（1-indexed）
  startIndex: number;      // UTF-16開始位置
  endIndex: number;        // UTF-16終了位置
  severity: "error" | "warning"; // 重大度
  snippet: string;         // 対象文の抜粋
  fixable: boolean;        // 自動修正可能フラグ
  fixText?: string;        // 修正後テキスト（任意）
};
```

**Validation Rules** (Valibot):
- `id`: 非空文字列
- `ruleId`: 非空文字列
- `message`: 非空文字列
- `line`: 1以上の整数
- `column`: 1以上の整数
- `startIndex`: 0以上の整数、`startIndex < endIndex`を保証
- `endIndex`: 0以上の整数
- `severity`: `"error" | "warning"`のみ許可
- `snippet`: 非空文字列
- `fixable`: boolean
- `fixText`: 任意の文字列（`fixable === true`の場合のみ存在推奨）

### Preset
textlintルールセット

```typescript
type Preset = {
  id: string;              // プリセットID（例: "technical-article"）
  name: string;            // 表示名（例: "技術記事"）
  description: string;     // 説明
  rules: Record<string, unknown>; // textlintルール設定
};
```

**MVP固定値**:
```typescript
const TECHNICAL_ARTICLE_PRESET: Preset = {
  id: "technical-article",
  name: "技術記事",
  description: "技術記事向けのtextlintルールセット",
  rules: {
    "preset-ja-technical-writing": true,
  },
};
```

### DraftError / StorageError

```typescript
type DraftError =
  | { type: "quota_exceeded"; message: string }
  | { type: "storage_unavailable"; message: string };

type StorageError =
  | { type: "quota_exceeded"; message: string }
  | { type: "storage_unavailable"; message: string };
```

---

## Physical Data Model

### localStorage (Key-Value Store)

**Key design patterns**:

| Key | Value Type | Description | Example |
|-----|-----------|-------------|---------|
| `jlwe:currentDraftText` | string | ドラフトテキスト全文 | `"本日は晴天なり..."` |
| `jlwe:ignoredIssueIds` | JSON string | 無視された指摘ID集合 | `'["uuid1","uuid2"]'` |
| `jlwe:currentPresetId` | string | 選択中のプリセットID | `"technical-article"` |

**Storage Operations**:
- **Read**: `localStorage.getItem(key)`
- **Write**: `localStorage.setItem(key, value)`
- **Delete**: `localStorage.removeItem(key)`
- **Clear All**: `localStorage.clear()`（ドラフトクリア時）

**Capacity Constraints**:
- localStorage容量制限: 約5-10MB（ブラウザ依存）
- MVP段階ではテキスト全文保存のため、長大テキスト（数万文字以上）は警告表示

**TTL and compaction strategies**: なし（手動削除のみ）

---

## Data Contracts & Integration

### Worker Communication Protocol

**Request/Response Schemas**:

#### Lint Request
```typescript
type LintRequest = {
  type: "lint";
  requestId: string;      // UUID
  text: string;           // Lint対象テキスト
};
```

#### Lint Response
```typescript
type LintResponse = {
  type: "lint:result";
  requestId: string;
  results: LintResult[];
};
```

#### Fix Request
```typescript
type FixRequest = {
  type: "fix";
  requestId: string;
  text: string;
};
```

#### Fix Response
```typescript
type FixResponse = {
  type: "fix:result";
  requestId: string;
  fixedText: string;
};
```

#### Error Response
```typescript
type ErrorResponse = {
  type: "lint:error" | "fix:error";
  requestId: string;
  error: string;
};
```

**Union Type**:
```typescript
type WorkerRequest = LintRequest | FixRequest;
type WorkerResponse = LintResponse | FixResponse | ErrorResponse;
```

**Validation Rules**:
- Valibotスキーマで`LintResult[]`をバリデーション
- `type`フィールドでメッセージ識別
- `requestId`で非同期リクエスト管理

**Serialization Format**: JSON（postMessage、localStorage）

---

## Schema Versioning Strategy

MVP段階ではバージョニングなし。将来的に以下を検討：

- **localStorage Schema Version**: キー`jlwe:schemaVersion`で管理
- **Worker Message Version**: messageに`version`フィールド追加
- **Migration Strategy**: ページロード時にスキーマバージョンチェック、必要に応じてマイグレーション実行
