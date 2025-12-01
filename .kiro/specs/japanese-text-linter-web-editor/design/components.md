# Components and Interfaces

## Component Summary

| Component | Domain/Layer | Intent | Req Coverage | Key Dependencies (P0/P1) | Contracts |
|-----------|--------------|--------|--------------|--------------------------|-----------|
| EditorPage | Presentation | エディタページ全体のレイアウトと状態管理 | 11.1, 11.2 | LintService (P0), DraftService (P0), PresetService (P1) | State |
| EditorPanel | Presentation | CodeMirrorエディタとハイライト管理 | 1.1, 2.4, 2.6 | CodeMirror 6 (P0) | Service |
| LintResultPanel | Presentation | 指摘リストと詳細表示 | 2.1, 2.2, 2.3, 11.3, 11.4, 14.1-14.5 | - | Event |
| ControlBar | Presentation | Lint実行・自動修正・プリセット選択 | 11.2, 3.2, 3.3 | LintService (P0), PresetService (P1) | Event |
| LintService | Domain | Lint実行制御、Worker通信、状態管理 | 1.2-1.7, 3.4-3.6 | LintWorker (P0) | Service |
| DraftService | Domain | ドラフト自動保存とリストア | 4.1-4.6 | LocalStorageAdapter (P0) | Service |
| PresetService | Domain | プリセット管理 | 5.1-5.4 | LocalStorageAdapter (P1) | Service |
| LintWorker | Infrastructure | textlintのWeb Worker実行環境 | 1.6, 1.7, 7.1, 7.2 | textlint (P0), textlint-rule-preset-ja-technical-writing (P0) | API, Event |
| LocalStorageAdapter | Infrastructure | localStorage操作の抽象化 | 4.1-4.6, 13.1, 14.3 | - | Service |

---

## Presentation Layer

### EditorPage

| Field | Detail |
|-------|--------|
| Intent | エディタページ全体のレイアウト、Lint状態、ドラフト状態の管理 |
| Requirements | 11.1, 11.2 |

**Responsibilities & Constraints**
- 左右2ペイン（EditorPanel / LintResultPanel）のレイアウト管理
- ControlBarの配置と全体的なUI構成
- Lint状態（実行中、エラー、完了）の管理
- ドラフトの初期ロードとページ間遷移の制御
- Domain layerのServiceインスタンス生成と子コンポーネントへの伝播

**Dependencies**
- Outbound: LintService - Lint実行制御 (P0)
- Outbound: DraftService - ドラフト管理 (P0)
- Outbound: PresetService - プリセット管理 (P1)
- Inbound: EditorPanel, LintResultPanel, ControlBar - 子コンポーネント (P0)

**Contracts**: State [x]

#### State Management

- **State model**:
  - `lintResults: LintResult[]` - 最新のLint結果
  - `isLinting: boolean` - Lint実行中フラグ
  - `selectedIssueId: string | null` - 選択中の指摘ID
  - `editorText: string` - エディタの現在テキスト
  - `currentPreset: string` - 選択中のプリセットID
  - `ignoredIssueIds: Set<string>` - 無視された指摘のID集合
- **Persistence & consistency**: ドラフトはDraftService経由でlocalStorageに永続化、Lint結果は揮発性（ページリロードで破棄）
- **Concurrency strategy**: Single-threaded React state、Lint Worker通信はrequestIdで制御

**Implementation Notes**
- **Integration**: `"use client"`ディレクティブ必須（CodeMirror、localStorageを使用）
- **Validation**: LintResult配列はValibotでスキーマバリデーション
- **Risks**: 大量指摘時（200件超）のstate更新パフォーマンス劣化 → useMemoで最適化

---

### EditorPanel

| Field | Detail |
|-------|--------|
| Intent | CodeMirror 6ベースのテキストエディタとLintハイライトの管理 |
| Requirements | 1.1, 2.4, 2.6 |

**Responsibilities & Constraints**
- CodeMirror 6インスタンスの初期化と管理（useRef + useEffect）
- テキスト変更時のdebounced callback実行
- Lint結果に基づくdecorations（ハイライト）の適用
- 指摘選択時のスクロールと該当範囲の強調表示
- UTF-16コード単位ベースの位置計算とCodeMirrorのpos変換

**Dependencies**
- External: CodeMirror 6 - エディタコア (P0)
  - パッケージ: `codemirror`, `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`
  - 最新安定版使用、dynamic import (ssr: false) で読み込み
- Inbound: EditorPage - 親コンポーネント (P0)

**Contracts**: Service [x]

#### Service Interface

```typescript
type EditorPanelProps = {
  initialText: string;
  lintResults: LintResult[];
  selectedIssueId: string | null;
  onTextChange: (text: string) => void;
  onIssueSelect: (issueId: string) => void;
  ignoredIssueIds: Set<string>;
}
```

- **Preconditions**:
  - `initialText`: 初期表示テキスト（空文字列可）
  - `lintResults`: Valibotでバリデーション済み
  - `ignoredIssueIds`: 無視された指摘のID集合
- **Postconditions**:
  - `onTextChange`: debounce後（300ms）にテキスト変更を通知
  - `onIssueSelect`: 指摘クリック時にissueIdを通知
- **Invariants**:
  - CodeMirrorインスタンスはuseRef管理、再レンダリング時も保持
  - decorationsはlintResults変更時のみ再適用

**Implementation Notes**
- **Integration**: dynamic import `const CodeMirrorEditor = dynamic(() => import('./CodeMirrorEditor'), { ssr: false })`
- **Validation**: startIndex/endIndexのUTF-16境界チェック（サロゲートペア考慮）
- **Risks**: 大量ハイライト時のパフォーマンス劣化 → RangeSet効率化、将来的にウィンドウイング方式検討

---

### LintResultPanel

| Field | Detail |
|-------|--------|
| Intent | Lint指摘リストと選択中の指摘詳細を表示、無視機能を提供 |
| Requirements | 2.1, 2.2, 2.3, 11.3, 11.4, 14.1-14.5 |

**Responsibilities & Constraints**
- Lint結果のリスト表示（行番号、ルールID、メッセージ、重大度）
- 指摘アイテムのクリックイベント処理
- 選択中の指摘詳細（完全メッセージ、対象文、行番号）の表示
- 重大度（error/warning）の視覚的区別（色・アイコン）
- 指摘の無視機能（個別インスタンス単位）

**Dependencies**
- Inbound: EditorPage - 親コンポーネント (P0)

**Contracts**: Event [x]

#### Event Contract

- **Published events**: なし
- **Subscribed events**:
  - `onIssueSelect(issueId: string)`: 指摘アイテムクリック時
  - `onIssueIgnore(issueId: string)`: 指摘無視ボタンクリック時
- **Ordering / delivery guarantees**: 同期イベント、順序保証あり

```typescript
type LintResultPanelProps = {
  lintResults: LintResult[];
  selectedIssueId: string | null;
  onIssueSelect: (issueId: string) => void;
  onIssueIgnore: (issueId: string) => void;
  ignoredIssueIds: Set<string>;
}
```

**Implementation Notes**
- **Integration**: 無視された指摘はリストから除外（`lintResults.filter(r => !ignoredIssueIds.has(r.id))`）
- **Validation**: lintResultsのバリデーション済み前提
- **Risks**: 指摘200件超でスクロール性能劣化 → React.memo + virtualized list検討

---

### ControlBar

| Field | Detail |
|-------|--------|
| Intent | Lint実行・自動修正・プリセット選択のコントロール |
| Requirements | 11.2, 3.2, 3.3 |

**Responsibilities & Constraints**
- 手動Lint実行ボタン
- 自動Lint ON/OFFトグル
- 自動修正ボタン（fixableな指摘がある場合のみ有効化）
- プリセット選択ドロップダウン（MVP段階では「技術記事」のみ）
- ドラフトクリアボタン

**Dependencies**
- Outbound: LintService - Lint実行、Fix実行 (P0)
- Outbound: PresetService - プリセット管理 (P1)
- Inbound: EditorPage - 親コンポーネント (P0)

**Contracts**: Event [x]

#### Event Contract

```typescript
type ControlBarProps = {
  isLinting: boolean;
  isAutoLintEnabled: boolean;
  fixableCount: number;
  currentPreset: string;
  onManualLint: () => void;
  onToggleAutoLint: (enabled: boolean) => void;
  onAutoFix: () => void;
  onPresetChange: (presetId: string) => void;
  onClearDraft: () => void;
}
```

**Implementation Notes**
- **Integration**: fixableCountは`lintResults.filter(r => r.fixable).length`で算出
- **Validation**: MVP段階ではプリセットは1つのみ、将来拡張で複数対応
- **Risks**: なし

---

## Domain Layer

### LintService

| Field | Detail |
|-------|--------|
| Intent | Lint実行の制御、Web Worker通信、Lint結果の管理 |
| Requirements | 1.2-1.7, 3.4-3.6 |

**Responsibilities & Constraints**
- 手動/自動Lint実行のトリガー
- Web WorkerへのLint/Fixリクエスト送信（postMessage）
- requestIdによる非同期リクエストの管理
- IME変換中の自動Lint抑制
- Lint結果のバリデーションと状態管理
- Fix実行後の再Lint

**Dependencies**
- Outbound: LintWorker - textlint実行 (P0)
- Inbound: EditorPage, ControlBar - 親コンポーネント (P0)

**Contracts**: Service [x]

#### Service Interface

```typescript
type LintServicetype = {
  requestLint(params: {text: string; isManual: boolean}): Promise<void>;
  requestFix(params: {text: string}): Promise<string>;
  cancelPendingRequests(): void;
  getCurrentResults(): LintResult[];
}

type LintResult = {
  id: string;
  ruleId: string;
  message: string;
  line: number;
  column: number;
  startIndex: number;
  endIndex: number;
  severity: "error" | "warning";
  snippet: string;
  fixable: boolean;
  fixText?: string;
};
```

- **Preconditions**:
  - `params.text`: 非nullの文字列
  - `params.isManual`: 手動実行時はIME判定をスキップ
- **Postconditions**:
  - `requestLint`: Lint完了後、状態を更新（エラー時はthrow）
  - `requestFix`: Fix適用後のテキストを返し、再Lintを実行（エラー時はthrow）
- **Invariants**:
  - 最新のrequestIdのみ有効、古いリクエストは無視
  - Lint結果はValibotでバリデーション済み

**Implementation Notes**
- **Integration**: Web Workerの初期化はページロード時に実行（初回Lint時の遅延回避）
- **Validation**: Valibotスキーマで`LintResult[]`をバリデーション
- **Risks**: Worker起動時間が初回Lint遅延の原因 → 事前初期化で緩和

---

### DraftService

| Field | Detail |
|-------|--------|
| Intent | ドラフトの自動保存とリストア、localStorageとの通信 |
| Requirements | 4.1-4.6 |

**Responsibilities & Constraints**
- Lint実行完了時のdebounced save（1000ms待機、3000ms最大待機）
- ページロード時のドラフトリストア
- ドラフトクリア操作の処理
- localStorage容量制限エラーのハンドリング

**Dependencies**
- Outbound: LocalStorageAdapter - localStorage操作 (P0)
- Inbound: EditorPage - 親コンポーネント (P0)

**Contracts**: Service [x]

#### Service Interface

```typescript
type DraftServicetype = {
  saveDraft(params: {text: string}): Result<void, DraftError>;
  loadDraft(): Result<string, DraftError>;
  clearDraft(): Result<void, DraftError>;
}

type DraftError =
  | { type: "quota_exceeded"; message: string }
  | { type: "storage_unavailable"; message: string };
```

- **Preconditions**: localStorageが利用可能
- **Postconditions**:
  - `saveDraft`: debounce後にlocalStorageに保存、成功時はOk、失敗時はErr
  - `loadDraft`: localStorage存在時はドラフトテキスト、不在時は空文字列
- **Invariants**: 単一キー`jlwe:currentDraftText`のみ使用、全文上書き

**Implementation Notes**
- **Integration**: useCallbackとlodash/debounceでdebounce実装
- **Validation**: localStorage容量制限（約5-10MB）超過時はErr返却、ユーザーに通知
- **Risks**: 複数タブ同時編集でLast Write Wins（Requirement 12.1）

---

### PresetService

| Field | Detail |
|-------|--------|
| Intent | textlintプリセットの管理と切り替え |
| Requirements | 5.1-5.4 |

**Responsibilities & Constraints**
- MVP段階では「技術記事」プリセットのみ提供
- 将来的な複数プリセット拡張を想定した設計
- プリセット選択状態のlocalStorage永続化

**Dependencies**
- Outbound: LocalStorageAdapter - localStorage操作 (P1)
- Inbound: EditorPage, ControlBar - 親コンポーネント (P1)

**Contracts**: Service [x]

#### Service Interface

```typescript
type PresetServicetype = {
  getAvailablePresets(): Preset[];
  getCurrentPreset(): Preset;
  setCurrentPreset(params: {presetId: string}): Result<void, PresetError>;
}

type Preset = {
  id: string;
  name: string;
  description: string;
  rules: Record<string, unknown>;
};

type PresetError = { type: "preset_not_found"; presetId: string };
```

- **Preconditions**: MVP段階では1つのプリセットのみ
- **Postconditions**: プリセット切り替え後、Web Workerに新しいルール設定を通知
- **Invariants**: デフォルトプリセットは常に存在

**Implementation Notes**
- **Integration**: MVP段階ではハードコード、将来的に設定ファイル読み込み対応
- **Validation**: プリセットIDの存在チェック
- **Risks**: なし

---

## Infrastructure Layer

### LintWorker

| Field | Detail |
|-------|--------|
| Intent | textlintをWeb Worker上で実行し、Lint/Fix結果を返す |
| Requirements | 1.6, 1.7, 7.1, 7.2 |

**Responsibilities & Constraints**
- textlint初期化（ルール読み込み、設定適用）
- Lintリクエストの受信と処理
- Fixリクエストの受信と処理
- textlint LintMessageからLintResultへの変換
- エラーハンドリングと親スレッドへの通知

**Dependencies**
- External: textlint - Lintエンジン (P0)
  - パッケージ: `textlint`, `@textlint/kernel`
  - @textlint/script-compilerでWeb Worker最適化されたバンドル生成
- External: textlint-rule-preset-ja-technical-writing - 技術記事ルールセット (P0)
  - 最新安定版使用
- Inbound: LintService - 親スレッド (P0)

**Contracts**: API [x], Event [x]

#### API Contract

| Method | Endpoint | Request | Response | Errors |
|--------|----------|---------|----------|--------|
| Lint | Worker.postMessage | `{type: "lint", requestId: string, text: string}` | `{type: "lint:result", requestId: string, results: LintResult[]}` | `{type: "lint:error", requestId: string, error: string}` |
| Fix | Worker.postMessage | `{type: "fix", requestId: string, text: string}` | `{type: "fix:result", requestId: string, fixedText: string}` | `{type: "fix:error", requestId: string, error: string}` |

#### Event Contract

- **Published events**:
  - `lint:result`: Lint完了時にLintResult[]を送信
  - `lint:error`: Lint失敗時にエラーメッセージを送信
  - `fix:result`: Fix完了時に修正後テキストを送信
  - `fix:error`: Fix失敗時にエラーメッセージを送信
- **Subscribed events**:
  - `lint`: Lintリクエスト受信
  - `fix`: Fixリクエスト受信
- **Ordering / delivery guarantees**: postMessageの順序保証、requestIdで識別

**Implementation Notes**
- **Integration**: Web Worker専用tsconfig.json（`lib: ["webworker"]`）が必要
- **Validation**: textlint LintMessageのfixプロパティ存在チェックで`fixable`を判定
- **Risks**: textlintバンドルサイズが大きく初回ロード遅延 → @textlint/script-compilerで最小化

---

### LocalStorageAdapter

| Field | Detail |
|-------|--------|
| Intent | localStorage操作の抽象化、将来的な複数ドラフト管理への拡張性確保 |
| Requirements | 4.1-4.6, 13.1, 14.3 |

**Responsibilities & Constraints**
- localStorageへの読み書き操作
- キーの管理（ドラフト、無視情報、プリセット選択）
- 容量制限エラーのハンドリング
- 将来的な複数ドラフト管理への拡張性

**Dependencies**
- Inbound: DraftService, PresetService - ドメイン層サービス (P0)

**Contracts**: Service [x]

#### Service Interface

```typescript
type LocalStorageAdaptertype = {
  setItem(params: {key: string; value: string}): Result<void, StorageError>;
  getItem(params: {key: string}): Result<string | null, StorageError>;
  removeItem(params: {key: string}): Result<void, StorageError>;
  clear(): Result<void, StorageError>;
}

type StorageError =
  | { type: "quota_exceeded"; message: string }
  | { type: "storage_unavailable"; message: string };
```

- **Preconditions**: localStorageが利用可能
- **Postconditions**:
  - `setItem`: 成功時はOk、容量超過時はErr
  - `getItem`: キー存在時は値、不在時はnull
- **Invariants**: MVP段階では単一キー`jlwe:currentDraftText`のみ使用

**Implementation Notes**
- **Integration**: try-catchでQuotaExceededErrorをハンドリング
- **Validation**: 容量制限チェック（約5-10MB）
- **Risks**: 複数タブでLast Write Wins（Requirement 12.1）
