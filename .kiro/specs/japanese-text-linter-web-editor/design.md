# Technical Design Document

## Overview

本機能は、技術記事作成者向けの日本語文章Lint Webエディタ（MVP）を提供する。textlintをブラウザ上でローカル実行し、文法・表記揺れ・冗長表現などの問題を自動検出することで、レビュー前に最低品質ラインを突破させる。

**Users**: 技術記事作成者（個人ブログ、技術メディア寄稿者、社内ドキュメント執筆者）が、執筆時にリアルタイムで文章品質をチェックする。

**Impact**: レビュー工数削減、内容レビューへの集中促進、執筆者の自主的な品質向上を実現する。

### Goals

- ブラウザ上でtextlintをローカル実行し、プライバシーを保護しながら文章品質をチェック
- 指摘箇所のリアルタイム表示とナビゲーションにより、修正作業を効率化
- 安全な自動修正機能により、手作業の負担を削減
- ドラフト自動保存により、作業の継続性を確保
- UIフリーズなしのパフォーマンスを実現（1万文字・指摘200件程度まで）

### Non-Goals

- 履歴管理・差分保存（MVP範囲外、将来拡張で検討）
- チーム運用機能（承認フロー等）
- 生成AIによる修正提案（将来拡張で検討、Requirement 13.3）
- 右ペインでの修正適用UI（MVP範囲外）
- スマートフォン・タブレット対応（ベストエフォート、Requirement 7.4）

---

## Design Document Structure

本設計書は以下のサブドキュメントで構成されています：

### [Architecture](./design/architecture.md)
- アーキテクチャパターン（Layered Architecture）
- 技術スタック（Next.js、React、TypeScript、CodeMirror 6、textlint、Valibot）
- 既存アーキテクチャ分析
- ドメイン境界とコンポーネント配置

### [System Flows](./design/flows.md)
- Lint実行フロー（debounce、requestId管理、IME判定）
- 自動修正（Auto Fix）フロー
- 指摘ナビゲーションフロー
- ドラフト保存・リストアフロー

### [Components and Interfaces](./design/components.md)
- Presentation Layer: EditorPage, EditorPanel, LintResultPanel, ControlBar
- Domain Layer: LintService, DraftService, PresetService
- Infrastructure Layer: LintWorker, LocalStorageAdapter
- 各コンポーネントのインターフェース定義、責務、依存関係

### [Data Models](./design/data-models.md)
- Domain Model（Aggregates、Value Objects、Domain Events）
- Logical Data Model（LintResult、Preset、Error型）
- Physical Data Model（localStorage Key-Value設計）
- Worker Communication Protocol（Request/Response Schemas）

---

## Requirements Traceability

| Requirement | Summary | Components | Document Reference |
|-------------|---------|------------|--------------------|
| 1.1 | CodeMirrorエディタ表示 | EditorPanel | [components.md](./design/components.md#editorpanel) |
| 1.2, 1.3 | 手動・自動Lint実行 | LintService, ControlBar | [flows.md](./design/flows.md#lint実行フロー) |
| 1.4 | IME変換中は自動Lint停止 | LintService | [flows.md](./design/flows.md#lint実行フロー) |
| 1.5 | 最新リクエストのみ採用 | LintService | [flows.md](./design/flows.md#lint実行フロー) |
| 1.6 | Web WorkerでUI非ブロック | LintWorker | [components.md](./design/components.md#lintworker) |
| 1.7 | Lint結果の返却 | LintWorker, LintResult型 | [data-models.md](./design/data-models.md#lintresult) |
| 2.1-2.6 | 指摘表示とナビゲーション | LintResultPanel, EditorPanel | [flows.md](./design/flows.md#指摘ナビゲーションフロー) |
| 3.1-3.8 | 自動修正 | LintService, ControlBar | [flows.md](./design/flows.md#自動修正auto-fixフロー) |
| 4.1-4.6 | ドラフト管理 | DraftService, LocalStorageAdapter | [flows.md](./design/flows.md#ドラフト保存リストアフロー) |
| 5.1-5.4 | プリセット管理 | PresetService | [components.md](./design/components.md#presetservice) |
| 6.1-6.5 | セキュリティとプライバシー | 全コンポーネント | [本ドキュメント](#security-considerations) |
| 7.1-7.6 | パフォーマンス | LintWorker, EditorPanel | [本ドキュメント](#performance--scalability) |
| 8.1-8.5 | ルールセット管理 | textlint設定ファイル | [architecture.md](./design/architecture.md#technology-stack) |
| 9.1-9.5 | ホスティングとアーキテクチャ | Next.js, Vercel | [architecture.md](./design/architecture.md) |
| 10.1-10.4 | エラーハンドリング | 全Serviceコンポーネント | [本ドキュメント](#error-handling) |
| 11.1-11.5 | UIレイアウトと操作性 | EditorPage, 全Presentationコンポーネント | [components.md](./design/components.md) |
| 12.1-12.3 | 多タブ挙動 | LocalStorageAdapter | [components.md](./design/components.md#localstorageadapter) |
| 13.1-13.4 | 将来拡張への配慮 | LocalStorageAdapter, PresetService | [components.md](./design/components.md) |
| 14.1-14.5 | 指摘の無視機能 | LintResultPanel, LocalStorageAdapter | [components.md](./design/components.md#lintresultpanel) |
| 15.1-15.4 | データ構造とインターフェース仕様 | 全コンポーネント | [data-models.md](./design/data-models.md) |
| 16.1-16.3 | 成功指標（KPI） | - | [本ドキュメント](#success-metrics) |

---

## Error Handling

### Error Strategy

- **User Errors**: 無効な操作（空テキストのLint等）は無視、UIで適切なフィードバック
- **System Errors**: Web Worker失敗、localStorage容量超過は明示的にエラーハンドリング
- **Business Logic Errors**: Lint失敗は前回結果を保持、エラーメッセージをUI表示

### Error Categories and Responses

**User Errors**:
- 無効な操作 → UIで適切なフィードバック（例: ボタン無効化）

**System Errors (5xx equivalent)**:
- **Web Worker失敗** → エラーメッセージ表示、前回Lint結果を保持（Requirement 10.1）
- **localStorage容量超過** → 警告表示、ドラフトクリア促進（Requirement 10.3）
- **textlintルール読み込み失敗** → デフォルトルールセットで続行、エラーログ記録（Requirement 10.4）

**Business Logic Errors**:
- **Lint失敗** → 前回結果を保持、エラーメッセージをUI表示（Requirement 10.1）
- **Fix失敗** → エディタ内容は変更せず、エラーメッセージをUI表示

### Monitoring

- エラー発生時はconsole.errorでログ記録
- MVP段階ではエラー監視ツール未導入、将来的にSentryなど検討
- Requirement 6.4: 文章本文をログに含めない

---

## Testing Strategy

### Unit Tests

- `LintService.requestLint()`: requestId管理、IME判定、debounce
- `DraftService.saveDraft()`: debounce、localStorage容量超過
- `LocalStorageAdapter.setItem()`: QuotaExceededErrorハンドリング
- `LintWorker`: textlint LintMessageからLintResultへの変換
- Valibotスキーマ: LintResult型のバリデーション

### Integration Tests

- EditorPage: Lint実行 → LintResultPanel表示 → 指摘選択 → EditorPanelスクロール
- ControlBar: 自動修正ボタン → LintService.requestFix() → エディタ全文更新 → 再Lint
- DraftService: ドラフト保存 → ページリロード → ドラフトリストア

### E2E Tests

- ユーザーがテキスト入力 → 1500ms待機 → 自動Lint実行 → 指摘表示
- ユーザーが指摘クリック → エディタスクロール → 該当範囲強調
- ユーザーが自動修正ボタン押下 → テキスト修正 → 再Lint実行

### Performance Tests

- 1万文字・指摘200件のテキストでLint実行時間 < 3秒
- ハイライト描画時間 < 500ms
- ドラフト保存時間 < 100ms
- Web Worker起動時間 < 1秒

---

## Security Considerations

### Privacy-First Design

- **Requirement 6.1**: ユーザー入力文章はサーバーや外部サービスに送信しない
- **Requirement 6.2**: Next.js API RouteやRoute Handlerで文章内容を受け取らない
- **Requirement 6.3**: すべてのLint処理はクライアントサイド（Web Worker含む）で完結
- **Requirement 6.4**: アクセス解析やエラー監視で文章本文をログに含めない
- **Requirement 6.5**: ドラフトはlocalStorageに保存、同一ブラウザ・同一端末でのみ復元

### Data Protection

- localStorageは同一オリジンのみアクセス可能（ブラウザの同一オリジンポリシー）
- textlintルールはクライアント側にバンドル、外部通信なし
- CSP（Content Security Policy）でインラインスクリプト禁止、XSS対策

---

## Performance & Scalability

### Target Metrics

- **Requirement 7.3**: PC（一般的なノートPCクラス）で1万文字・指摘200件程度まで体感できるフリーズや顕著な入力遅延なし
- **Requirement 7.2**: Lint実行中もUIブロックなし
- **Requirement 7.5**: 長大テキスト（数万文字以上）は警告表示または対象範囲限定

### Optimization Techniques

- **Web Worker**: textlintをメインスレッド外で実行（Requirement 1.6, 7.1）
- **Debounce**: 自動Lint（1500ms）、ドラフト保存（1000ms待機、3000ms最大待機）
- **React.memo**: LintResultPanel、EditorPanel
- **useMemo**: Lint結果のフィルタリング（無視された指摘除外）
- **CodeMirror RangeSet**: 効率的なハイライト管理

### Scaling Approaches

- MVP段階ではスケーリング不要（クライアントサイド完結）
- 将来的にCDN最適化（Vercel Edge）、バンドルサイズ削減

---

## Success Metrics

### KPI Definition (Requirement 16)

- **指摘0件でレビューに上がる初稿の割合**: 品質向上の指標
- **レビュー工数削減**: 定量的または定性的評価
- **継続利用率**: 週次/月次アクティブユーザー

### Measurement Strategy

- MVP段階では手動収集・評価
- 自動計測機能は将来拡張として検討
- Requirement 6（セキュリティとプライバシー）の制約を遵守し、文章内容を含まないメタ情報のみを対象

---

## Migration Strategy

MVP段階では既存システムからの移行なし。将来的な拡張（複数ドラフト管理、生成AI連携）は別フェーズで実施。

---

## Supporting References

- [Research & Design Decisions](./research.md) - 詳細な調査結果、技術選定の根拠、アーキテクチャパターン評価
- [Requirements Document](./requirements.md) - 完全な要件定義
