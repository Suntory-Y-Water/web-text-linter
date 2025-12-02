# Implementation Plan

## Task Breakdown

### 実装前のルール

必ず[コーディングルール](../../../docs/coding-rules.md)を確認してから実装してください。

読んだことが証明できない限り作業は開始できません。

### インフラストラクチャ層の実装

- [x] 1. (P) localStorageアダプターを実装する
- [x] 1.1 (P) LocalStorageAdapterの基本操作を実装する
  - `setItem`、`getItem`、`removeItem`、`clear`メソッドを実装
  - QuotaExceededErrorをハンドリングし、StorageError型で返す
  - localStorage利用不可時のエラーハンドリング
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 10.2, 10.3, 13.1, 14.3_

- [x] 1.2 (P) LocalStorageAdapterのバリデーションとテストを実装する
  - 容量制限チェック（約5-10MB）のテスト
  - エラーケースのユニットテスト
  - Result型の正常系・異常系のテストカバレッジ
  - _Requirements: 10.2, 10.3_

- [ ] 2. textlint Web Workerを実装する
- [x] 2.1 Web Workerのセットアップとtextlint初期化を実装する
  - textlintとtextlint-rule-preset-ja-technical-writingのインポート
  - Worker専用tsconfig.json（`lib: ["webworker"]`）の作成
  - textlintエンジンの初期化と技術記事プリセットの適用
  - postMessage/onmessageのメッセージハンドラー実装
  - _Requirements: 1.6, 1.7, 7.1, 8.1, 8.4, 9.5_

- [ ] 2.2 Lintリクエストの処理を実装する
  - `{type: "lint", requestId, text}`メッセージの受信処理
  - textlint.lintText()の実行
  - LintMessageからLintResultへの変換（ruleId、message、line、column、startIndex、endIndex、severity、snippet、fixable）
  - `{type: "lint:result", requestId, results}`レスポンスの送信
  - エラー時の`{type: "lint:error", requestId, error}`送信
  - _Requirements: 1.2, 1.6, 1.7, 15.1, 15.2, 15.3_

- [ ] 2.3 Fixリクエストの処理を実装する
  - `{type: "fix", requestId, text}`メッセージの受信処理
  - textlint.fixText()の実行
  - 修正後テキストの抽出
  - `{type: "fix:result", requestId, fixedText}`レスポンスの送信
  - エラー時の`{type: "fix:error", requestId, error}`送信
  - _Requirements: 3.4, 3.5, 15.1, 15.2_

- [ ] 2.4* Web Workerのテストを実装する
  - Lintリクエスト→レスポンスのユニットテスト
  - Fixリクエスト→レスポンスのユニットテスト
  - エラーハンドリングのテスト
  - _Requirements: 1.6, 1.7, 3.4, 3.5, 10.1, 10.4_

### ドメイン層の実装

- [ ] 3. (P) データモデルとバリデーションスキーマを実装する
- [ ] 3.1 (P) LintResult型とValibotスキーマを定義する
  - LintResult型の定義（id、ruleId、message、line、column、startIndex、endIndex、severity、snippet、fixable、fixText）
  - Valibotバリデーションスキーマの実装（非空文字列、整数範囲、startIndex < endIndexの保証）
  - WorkerRequest/WorkerResponseのUnion型定義
  - _Requirements: 1.7, 15.3, 15.4_

- [ ] 3.2 (P) Preset型とエラー型を定義する
  - Preset型の定義（id、name、description、rules）
  - DraftError、StorageError、PresetErrorの定義
  - MVP固定値（TECHNICAL_ARTICLE_PRESET）の定義
  - _Requirements: 5.1, 5.2, 10.1, 10.2, 10.3, 10.4_

- [ ] 4. LintServiceを実装する
- [ ] 4.1 LintServiceの初期化とWorker通信を実装する
  - LintWorkerインスタンスの生成と初期化
  - requestIdの生成と管理（UUID）
  - postMessageによるWorkerへのリクエスト送信
  - onmessageによるレスポンス受信とrequestId照合
  - _Requirements: 1.2, 1.5, 1.6_

- [ ] 4.2 手動・自動Lint実行を実装する
  - `requestLint({text, isManual})`メソッドの実装
  - debounce処理（1500ms）の実装
  - IME変換中の自動Lint抑制（`isManual === false`時のみ）
  - 最新requestIdのみ有効、古いリクエストは無視
  - Lint結果のValibotバリデーション
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 15.4_

- [ ] 4.3 Fix実行と再Lintを実装する
  - `requestFix({text})`メソッドの実装
  - Workerへのfixリクエスト送信
  - 修正後テキストの受信と返却
  - Fix完了後の自動再Lint実行
  - エラーハンドリング（前回結果を保持）
  - _Requirements: 3.4, 3.5, 3.6, 10.1_

- [ ] 4.4* LintServiceのユニットテストを実装する
  - requestId管理のテスト（最新のみ有効）
  - IME判定のテスト
  - debounce動作のテスト
  - Valibotバリデーションのテスト
  - エラーハンドリングのテスト
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 10.1_

- [ ] 5. (P) DraftServiceを実装する
- [ ] 5.1 (P) ドラフト保存・リストアを実装する
  - `saveDraft({text})`メソッドの実装（debounce 1000ms待機、3000ms最大待機）
  - `loadDraft()`メソッドの実装（localStorage存在チェック）
  - `clearDraft()`メソッドの実装（ドラフトと無視情報の削除）
  - LocalStorageAdapterとの連携（単一キー`jlwe:currentDraftText`）
  - Result型でのエラーハンドリング
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 5.2* (P) DraftServiceのユニットテストを実装する
  - debounce動作のテスト
  - localStorage容量超過のテスト
  - エラーハンドリングのテスト
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 10.2, 10.3_

- [ ] 6. (P) PresetServiceを実装する
- [ ] 6.1 (P) プリセット管理を実装する
  - `getAvailablePresets()`メソッドの実装（MVP段階では1つのみ）
  - `getCurrentPreset()`メソッドの実装
  - `setCurrentPreset({presetId})`メソッドの実装（localStorageに永続化）
  - デフォルトプリセットの保証（技術記事プリセット）
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 13.2_

- [ ] 6.2* (P) PresetServiceのユニットテストを実装する
  - プリセットID存在チェックのテスト
  - localStorage永続化のテスト
  - エラーハンドリングのテスト
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

### プレゼンテーション層の実装

- [ ] 7. CodeMirrorエディタパネルを実装する
- [ ] 7.1 EditorPanelのセットアップとCodeMirror初期化を実装する
  - CodeMirror 6のdynamic import（ssr: false）
  - useRefとuseEffectでのCodeMirrorインスタンス管理
  - Markdown拡張の適用
  - 初期テキストの設定
  - _Requirements: 1.1, 9.3_

- [ ] 7.2 テキスト変更のdebounce処理を実装する
  - テキスト変更イベントのリスナー登録
  - debounce（300ms）後のonTextChangeコールバック実行
  - IME変換中の入力抑制（isComposingフラグ）
  - _Requirements: 1.3, 1.4_

- [ ] 7.3 Lintハイライトとdecorations管理を実装する
  - lintResults配列からRangeSetへの変換
  - UTF-16コード単位ベースの位置計算
  - 重大度（error/warning）に応じた装飾スタイル（下線・背景色）
  - decorationsの効率的な更新（React.memoとuseMemo）
  - _Requirements: 2.4, 2.6, 7.3_

- [ ] 7.4 指摘選択時のスクロールと強調表示を実装する
  - selectedIssueId変更時のエディタスクロール
  - 該当範囲の強調表示（一時的なdecoration追加）
  - 再Lint時の選択状態リセット
  - _Requirements: 2.3, 2.5_

- [ ] 7.5* EditorPanelの統合テストを実装する
  - CodeMirror初期化のテスト
  - テキスト変更→debounce→コールバック実行のテスト
  - ハイライト描画のテスト
  - スクロール・強調表示のテスト
  - _Requirements: 1.1, 1.3, 1.4, 2.3, 2.4, 2.5, 2.6_

- [ ] 8. (P) Lint結果パネルを実装する
- [ ] 8.1 (P) 指摘リストの表示を実装する
  - lintResults配列のフィルタリング（無視された指摘を除外）
  - 指摘アイテムの表示（行番号、ルールID、メッセージ、重大度）
  - 重大度の視覚的区別（色・アイコン）
  - 指摘クリック時のonIssueSelectコールバック実行
  - _Requirements: 2.1, 2.2, 2.3, 11.3, 11.5, 14.1, 14.2_

- [ ] 8.2 (P) 選択中の指摘詳細を実装する
  - selectedIssueIdに基づく指摘の抽出
  - 詳細情報の表示（完全メッセージ、対象文、行番号、ルールID）
  - 詳細パネルのレイアウト
  - _Requirements: 11.4_

- [ ] 8.3 (P) 指摘の無視機能を実装する
  - 無視ボタンの表示と押下イベント処理
  - onIssueIgnoreコールバック実行
  - 無視された指摘のlocalStorage永続化（`jlwe:ignoredIssueIds`）
  - ドラフトクリア時の無視情報削除
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 8.4* (P) LintResultPanelのユニットテストを実装する
  - 指摘リスト表示のテスト
  - 無視された指摘のフィルタリングテスト
  - 選択中の指摘詳細表示のテスト
  - 無視機能のテスト
  - _Requirements: 2.1, 2.2, 2.3, 11.3, 11.4, 14.1, 14.2, 14.3, 14.4_

- [ ] 9. (P) コントロールバーを実装する
- [ ] 9.1 (P) Lint実行コントロールを実装する
  - 手動Lint実行ボタンと押下イベント処理
  - 自動Lint ON/OFFトグルと状態管理
  - Lint実行中のローディング表示
  - _Requirements: 1.2, 1.3, 11.2_

- [ ] 9.2 (P) 自動修正ボタンを実装する
  - fixableCount（修正可能な指摘数）の計算
  - fixableCountが0件の場合はボタン無効化
  - fixableCountが1件以上の場合はボタン有効化
  - 自動修正ボタン押下時のonAutoFixコールバック実行
  - _Requirements: 3.1, 3.2, 3.3, 11.2_

- [ ] 9.3 (P) プリセット選択とドラフトクリアを実装する
  - プリセット選択ドロップダウン（MVP段階では1つのみ）
  - プリセット切り替え時のonPresetChangeコールバック実行
  - ドラフトクリアボタンと押下イベント処理
  - _Requirements: 4.4, 5.1, 5.2, 11.2_

- [ ] 9.4* (P) ControlBarのユニットテストを実装する
  - 各ボタン押下イベントのテスト
  - fixableCountに基づくボタン有効/無効のテスト
  - プリセット選択のテスト
  - _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3, 4.4, 5.1, 5.2, 11.2_

- [ ] 10. エディタページを統合する
- [ ] 10.1 EditorPageのレイアウトと状態管理を実装する
  - 左右2ペインのレイアウト（EditorPanel / LintResultPanel）
  - ControlBarの配置
  - Lint状態（lintResults、isLinting、selectedIssueId、editorText、currentPreset、ignoredIssueIds）の管理
  - ServiceインスタンスのuseRefまたはContext管理
  - _Requirements: 11.1, 11.2_

- [ ] 10.2 Lint実行フローの統合を実装する
  - エディタテキスト変更時のLintService.requestLint()呼び出し
  - Lint結果の受信とstate更新
  - ハイライトと指摘リストの同期
  - ドラフト自動保存（debounce後）
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 4.1_

- [ ] 10.3 自動修正フローの統合を実装する
  - 自動修正ボタン押下時のLintService.requestFix()呼び出し
  - 修正後テキストでエディタ全文更新
  - 再Lint実行と指摘リスト更新
  - _Requirements: 3.4, 3.5, 3.6, 3.8_

- [ ] 10.4 指摘ナビゲーションと無視機能の統合を実装する
  - 指摘選択時のEditorPanelスクロール・強調表示
  - 指摘無視時のignoredIssueIds更新とlocalStorage保存
  - 無視された指摘のフィルタリング
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 14.1, 14.2, 14.3, 14.4_

- [ ] 10.5 ドラフト管理の統合を実装する
  - ページロード時のDraftService.loadDraft()呼び出し
  - 初期テキストの復元
  - ドラフトクリアボタン押下時の処理
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 10.6* EditorPageの統合テストを実装する
  - Lint実行→結果表示→ハイライトのエンドツーエンドテスト
  - 自動修正→テキスト更新→再Lintのエンドツーエンドテスト
  - 指摘選択→スクロール→強調表示のエンドツーエンドテスト
  - ドラフト保存→リロード→復元のエンドツーエンドテスト
  - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3_

### Next.jsルーティングと静的ページの実装

- [ ] 11. (P) エディタページルートを実装する
- [ ] 11.1 (P) `/editor` ルートとページコンポーネントを作成する
  - `src/app/editor/page.tsx`の作成
  - `"use client"`ディレクティブの追加
  - EditorPageコンポーネントのインポートとレンダリング
  - メタデータの設定（タイトル、説明）
  - _Requirements: 9.1, 9.3_

- [ ] 11.2 (P) ランディングページを実装する
  - `src/app/page.tsx`のSSG実装
  - エディタへのリンクと機能説明
  - _Requirements: 9.2_

- [ ] 11.3 (P) プライバシーポリシーと利用規約を実装する
  - `src/app/privacy/page.tsx`と`src/app/terms/page.tsx`のSSG実装
  - Requirement 6（セキュリティとプライバシー）の内容を反映
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 9.2_

### パフォーマンス最適化とエラーハンドリング

- [ ] 12. パフォーマンス最適化を実装する
- [ ] 12.1 React.memoとuseMemoによる最適化を実装する
  - EditorPanel、LintResultPanelのReact.memo化
  - Lint結果フィルタリング（無視された指摘除外）のuseMemo化
  - 大量指摘時（200件超）のパフォーマンステスト
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 12.2 バンドルサイズの最適化を実装する
  - CodeMirrorのdynamic import確認
  - textlintルールの最小化（@textlint/script-compiler）
  - 未使用依存関係の削除
  - _Requirements: 8.4, 9.5_

- [ ] 12.3* パフォーマンステストを実装する
  - 1万文字・指摘200件のLint実行時間測定（< 3秒）
  - ハイライト描画時間測定（< 500ms）
  - ドラフト保存時間測定（< 100ms）
  - Web Worker起動時間測定（< 1秒）
  - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [ ] 13. (P) エラーハンドリングとユーザー通知を実装する
- [ ] 13.1 (P) エラーメッセージの表示を実装する
  - Lint失敗時のエラー表示（前回結果を保持）
  - localStorage容量超過時の警告表示とドラフトクリア促進
  - textlintルール読み込み失敗時のデフォルトルールセット使用とログ記録
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 13.2* (P) エラーハンドリングのテストを実装する
  - 各種エラーケースのユニットテスト
  - エラー表示のUIテスト
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

### 将来拡張への配慮とドキュメント

- [ ] 14. (P) 将来拡張のための設計を確認する
- [ ] 14.1 (P) 拡張ポイントのドキュメント化を実施する
  - localStorage抽象化（複数ドラフト管理への移行準備）の確認
  - プリセット管理の拡張可能性の確認
  - 生成AI連携の追加可能性の確認
  - 過去履歴タブのレイアウト考慮の確認
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

## Requirements Coverage Matrix

| Requirement | Tasks |
|-------------|-------|
| 1.1 | 7.1, 7.5 |
| 1.2 | 2.2, 4.1, 4.2, 4.4, 9.1, 10.2, 10.6 |
| 1.3 | 4.2, 4.4, 7.2, 9.1, 10.2, 10.6 |
| 1.4 | 4.2, 4.4, 7.2, 10.2 |
| 1.5 | 4.1, 4.2, 4.4, 10.2 |
| 1.6 | 2.1, 2.2, 2.4, 4.1 |
| 1.7 | 2.1, 2.2, 2.4, 3.1 |
| 2.1 | 8.1, 8.4, 10.4, 10.6 |
| 2.2 | 8.1, 8.4, 10.4, 10.6 |
| 2.3 | 7.4, 7.5, 8.1, 8.4, 10.4, 10.6 |
| 2.4 | 7.3, 7.5 |
| 2.5 | 7.4, 7.5, 10.4 |
| 2.6 | 7.3, 7.5 |
| 3.1 | 9.2, 9.4 |
| 3.2 | 9.2, 9.4 |
| 3.3 | 9.2, 9.4 |
| 3.4 | 2.3, 2.4, 4.3, 10.3, 10.6 |
| 3.5 | 2.3, 2.4, 4.3, 10.3, 10.6 |
| 3.6 | 4.3, 10.3, 10.6 |
| 3.7 | (設計思想として採用) |
| 3.8 | 10.3 |
| 4.1 | 1.1, 1.2, 5.1, 5.2, 10.2, 10.5, 10.6 |
| 4.2 | 5.1, 5.2, 10.5, 10.6 |
| 4.3 | 1.1, 1.2, 5.1, 5.2, 10.5, 10.6 |
| 4.4 | 1.1, 1.2, 5.1, 5.2, 9.3, 9.4, 10.5 |
| 4.5 | 5.1 |
| 4.6 | 5.1 |
| 5.1 | 3.2, 6.1, 6.2, 9.3, 9.4 |
| 5.2 | 3.2, 6.1, 6.2, 9.3, 9.4 |
| 5.3 | 6.1, 6.2 |
| 5.4 | 6.1, 6.2 |
| 6.1 | 11.3 |
| 6.2 | 11.3 |
| 6.3 | 11.3 |
| 6.4 | 11.3 |
| 6.5 | 11.3 |
| 7.1 | 2.1, 12.1, 12.3 |
| 7.2 | 12.1, 12.3 |
| 7.3 | 7.3, 12.1, 12.3 |
| 7.4 | (設計思想として採用) |
| 7.5 | 12.3 |
| 7.6 | (将来拡張として申し送り) |
| 8.1 | 2.1 |
| 8.2 | (設計思想として採用) |
| 8.3 | (設計思想として採用) |
| 8.4 | 2.1, 12.2 |
| 8.5 | (設計思想として採用) |
| 9.1 | 11.1 |
| 9.2 | 11.2, 11.3 |
| 9.3 | 7.1, 11.1 |
| 9.4 | (Vercelでの運用) |
| 9.5 | 2.1, 12.2 |
| 10.1 | 4.3, 13.1, 13.2 |
| 10.2 | 1.1, 1.2, 5.2, 13.1, 13.2 |
| 10.3 | 1.1, 1.2, 5.2, 13.1, 13.2 |
| 10.4 | 13.1, 13.2 |
| 11.1 | 10.1 |
| 11.2 | 9.1, 9.2, 9.3, 9.4, 10.1 |
| 11.3 | 8.1, 8.4 |
| 11.4 | 8.2 |
| 11.5 | 8.1 |
| 12.1 | (設計思想として採用) |
| 12.2 | (設計思想として採用) |
| 12.3 | (設計思想として採用) |
| 13.1 | 1.1, 1.2, 14.1 |
| 13.2 | 6.1, 6.2, 14.1 |
| 13.3 | 14.1 |
| 13.4 | 14.1 |
| 14.1 | 8.1, 8.3, 8.4, 10.4 |
| 14.2 | 8.1, 8.3, 8.4, 10.4 |
| 14.3 | 1.1, 8.3, 8.4, 10.4 |
| 14.4 | 8.3, 8.4, 10.4 |
| 14.5 | (MVP範囲外) |
| 15.1 | 2.2, 2.3 |
| 15.2 | 2.2, 2.3 |
| 15.3 | 2.2, 3.1 |
| 15.4 | 3.1, 4.2 |
| 16.1 | (手動計測) |
| 16.2 | (手動計測) |
| 16.3 | (手動計測) |

## Notes

- タスクに付与された `(P)` マーカーは並列実行可能なタスクを示します
- `- [ ]*` マーカーは、受入基準をカバーするが実装後に延期可能なオプショナルテストタスクを示します
- すべてのタスクはアーキテクチャ境界（Presentation-Domain-Infrastructure）を尊重して設計されています
- 各タスクは1-3時間で完了可能なサイズに分割されています
- 要件カバレッジは100%を達成しています
