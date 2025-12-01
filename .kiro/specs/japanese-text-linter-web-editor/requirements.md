# Requirements Document

## Introduction

本ドキュメントは、日本語文章Lint Webエディタ（MVP）の要件定義を記述する。

### 背景と目的

技術記事やドキュメント作成において、文法・表記揺れ・冗長表現などの「内容レビュー以前の指摘」が多発しており、レビュー工数が膨らみ、本来確認すべき内容の正確性への集中を阻害している。

本製品は、レビューに回す前に最低品質ラインを自動で突破させることを狙いとし、「問題を見つける面」と「問題を直す面」を完全に分離した文章品質保証ツールとして設計する。

### 製品コンセプト

翻訳アプリの操作直感 × textlint の品質ゲート

- 左側：入力エディタ（編集に集中）
- 右側：指摘ナビパネル（問題一覧と詳細）

### スコープ

本MVPでは、以下の機能を提供する：

- Webブラウザ上でtextlintをローカル実行
- 指摘箇所のリアルタイム表示とナビゲーション
- 自動修正機能（安全な範囲）
- ドラフト保存（ブラウザのlocalStorage）

以下の機能はMVPの範囲外とする：

- 履歴管理・差分保存
- チーム運用機能（承認フロー等）
- 生成AIによる修正提案
- 右ペインでの修正適用UI

## Requirements

### Requirement 1: Lint実行

**Objective:** 技術記事作成者として、ブラウザ上でtextlintを実行し、文章品質をチェックできるようにすることで、レビュー前に最低品質ラインを突破する

#### Acceptance Criteria

1. When ユーザーがエディタページにアクセスしたとき、the Web Editorシステム shall CodeMirrorベースのエディタを表示する
2. When ユーザーが「Lint実行」ボタンを押下したとき、the Web Editorシステム shall 最新のテキストをWeb Workerに送信し、textlintを実行する
3. When 入力が停止してから1500ms経過したとき、the Web Editorシステム shall 自動的にLintを実行する
4. When IME変換中または入力中のとき、the Web Editorシステム shall 自動Lintを実行しない
5. When 新しいLintリクエストが送信されたとき、the Web Editorシステム shall 未完了の古いリクエストをキャンセルまたは無視し、最新の入力状態に対する結果のみを採用する
6. The Web Editorシステム shall Web Worker内でtextlintを実行し、メインスレッドでのUI処理をブロックしない
7. The Web Editorシステム shall textlint実行結果として、各指摘のruleId、message、line、column、startIndex、endIndex、severity、snippet、fixableを含むLintResult配列を返す

### Requirement 2: 指摘表示とナビゲーション

**Objective:** 技術記事作成者として、文章の問題箇所を瞬時に把握し、該当箇所へ素早く移動できるようにすることで、修正作業を効率化する

#### Acceptance Criteria

1. When Lint結果を受信したとき、the Web Editorシステム shall 右側の指摘パネルに全指摘をリスト表示する
2. When 指摘リストに表示するとき、the Web Editorシステム shall 各指摘について、行番号、ルールID、メッセージ、重大度を含む情報を表示する
3. When ユーザーが指摘アイテムをクリックしたとき、the Web Editorシステム shall エディタ内の該当行へスクロールし、該当範囲を強調表示する
4. When Lint結果を受信したとき、the Web Editorシステム shall エディタ内の全指摘箇所にハイライト装飾（下線・背景色等）を付与する
5. When 再Lint実行が完了したとき、the Web Editorシステム shall 選択状態と強調表示をリセットする
6. The Web Editorシステム shall startIndexとendIndexをUTF-16コード単位ベースで扱い、CodeMirrorの位置計算と整合させる

### Requirement 3: 自動修正（Auto Fix）

**Objective:** 技術記事作成者として、安全に自動修正可能な指摘を一括で修正することで、手作業の負担を削減する

#### Acceptance Criteria

1. When textlintが指摘に対してfix情報を付与したとき、the Web Editorシステム shall その指摘をfixable: trueとしてマークする
2. When fixableな指摘が1件以上存在するとき、the Web Editorシステム shall 自動修正ボタンを有効化する
3. When fixableな指摘が0件のとき、the Web Editorシステム shall 自動修正ボタンを無効化する
4. When ユーザーが自動修正ボタンを押下したとき、the Web Editorシステム shall Web Workerに対してtextlintのfix APIを用いた処理を依頼する
5. When fix処理が完了したとき、the Web Editorシステム shall 戻り値のテキストでエディタ内容を全文更新する
6. When エディタ内容を更新した後、the Web Editorシステム shall 再度Lintを実行し、指摘リストとハイライトを再描画する
7. The Web Editorシステム shall ルールIDベースでfixの安全性を判断せず、textlintが付与したfix情報のみを信頼して適用する
8. When 自動Lint実行時、the Web Editorシステム shall 自動修正（Fix）を実行しない（カーソル位置のズレによる編集妨害を防ぐため）

### Requirement 4: ドラフト管理

**Objective:** 技術記事作成者として、編集中の文章をブラウザに保存し、再訪時に復元できるようにすることで、作業の継続性を確保する

#### Acceptance Criteria

1. When Lint実行が完了したとき、the Web Editorシステム shall エディタ全文をlocalStorageの単一キー（例: `jlwe:currentDraftText`）に上書き保存する
2. When ユーザーがエディタページにアクセスしたとき、the Web Editorシステム shall localStorageにドラフトが存在すれば、その内容をエディタに復元する
3. When localStorageにドラフトが存在しないとき、the Web Editorシステム shall 空のエディタ状態で表示する
4. When ユーザーが「ドラフトをクリア」操作を実行したとき、the Web Editorシステム shall localStorageの該当キーを削除し、エディタを初期状態に戻す
5. The Web Editorシステム shall 差分保存を行わず、常に全文を上書き保存する
6. The Web Editorシステム shall ドラフトを常に1本のみ管理する（複数ドラフト管理はMVP範囲外）

### Requirement 5: プリセット管理

**Objective:** 技術記事作成者として、用途に応じたLintルールプリセットを選択できるようにすることで、適切な品質基準を適用する

#### Acceptance Criteria

1. The Web Editorシステム shall MVP段階では「技術記事」プリセットのみを提供する
2. When ユーザーがエディタページにアクセスしたとき、the Web Editorシステム shall デフォルトで「技術記事」プリセットを適用する
3. The Web Editorシステム shall プリセット選択UIを表示するが、MVP段階では選択肢は1つのみとする
4. The Web Editorシステム shall 将来的に複数プリセットに拡張可能な設計とする

### Requirement 6: セキュリティとプライバシー

**Objective:** 技術記事作成者として、入力した文章がサーバーや外部サービスに送信されないことを保証することで、機密情報を含む文章も安心して編集できるようにする

#### Acceptance Criteria

1. The Web Editorシステム shall ユーザーが入力した文章内容をサーバー側や外部サービスへ送信・保存しない
2. The Web Editorシステム shall Next.jsのAPI RouteやRoute Handlerを用いて文章内容を受け取る処理を実装しない
3. The Web Editorシステム shall すべてのLint処理をクライアントサイド（Web Worker含む）で完結させる
4. If アクセス解析やエラー監視を導入する場合、the Web Editorシステム shall 文章本文をログやイベントに含めず、ページ名やボタン押下回数などのメタ情報のみを送信する
5. The Web Editorシステム shall ドラフトをlocalStorageに保存し、同一ブラウザ・同一端末においてのみ復元できるようにする

### Requirement 7: パフォーマンス

**Objective:** 技術記事作成者として、長文を編集する際もUIがフリーズせず快適に操作できるようにすることで、作業効率を維持する

#### Acceptance Criteria

1. The Web Editorシステム shall textlintをWeb Worker上で実行し、UIのフリーズを防ぐ
2. While Lint実行中のとき、the Web Editorシステム shall 入力・スクロールなどの操作が途切れないこと
3. The Web Editorシステム shall PC（一般的なノートPCクラス）において、1万文字・指摘200件程度までのテキストで体感できるフリーズや顕著な入力遅延が発生しないこと
4. The Web Editorシステム shall スマートフォン・タブレットでの動作をベストエフォートとし、性能要件の対象外とする
5. If Lint対象テキストが長大（例: 数万文字以上）になる場合、the Web Editorシステム shall 警告表示または対象範囲の限定などの制御を設ける
6. If ハイライト処理が重くなる場合、the Web Editorシステム shall 将来的に「画面内およびその前後数十行のみをハイライト対象とする」ウィンドウイング方式への切り替えを検討対象とする（申し送り事項）

### Requirement 8: ルールセット管理

**Objective:** 管理者として、textlintのルール設定をリポジトリで一元管理し、デプロイによって反映できるようにすることで、品質基準の一貫性を確保する

#### Acceptance Criteria

1. The Web Editorシステム shall textlintのルール設定（有効/無効、しきい値等）をリポジトリ内の設定ファイルとして管理する
2. When ルール設定を変更する場合、the Web Editorシステム shall リポジトリを更新しデプロイすることで反映する
3. The Web Editorシステム shall 一般ユーザーがルールを直接変更できるUIを提供しない
4. The Web Editorシステム shall 使用するルールを最小限に絞り、初回ロード時のバンドルサイズを抑制する
5. The Web Editorシステム shall 過度に厳しいルールを避け、実用性を優先する

### Requirement 9: ホスティングとアーキテクチャ

**Objective:** 開発チームとして、シンプルな構成でデプロイ・運用を可能にすることで、保守コストを削減する

#### Acceptance Criteria

1. The Web Editorシステム shall Next.jsをフレームワークとして採用する
2. The Web Editorシステム shall ランディングページ、プライバシーポリシー、利用規約などの静的ページをSSG（Static Site Generation）で生成する
3. The Web Editorシステム shall 文章Lintエディタ本体をNext.js上の「クライアントサイド専用ページ」として実装する
4. The Web Editorシステム shall Vercel上の単一プロジェクトとして運用し、追加のサーバーコンポーネントや別バックエンドを持たない
5. The Web Editorシステム shall textlint本体および利用するルール群をフロントエンドバンドルとしてクライアント側に配布する

### Requirement 10: 例外処理とエラーハンドリング

**Objective:** 技術記事作成者として、Lint実行やドラフト保存が失敗した場合でも適切なフィードバックを受け取り、作業を継続できるようにする

#### Acceptance Criteria

1. If Web Worker内でLint実行が失敗した場合、the Web Editorシステム shall エラーメッセージを表示し、前回のLint結果を保持する
2. If localStorageへの保存が失敗した場合、the Web Editorシステム shall ユーザーに通知し、編集内容は保持されたままとする
3. If localStorageの容量制限に達した場合、the Web Editorシステム shall 警告を表示し、ドラフトのクリアを促す
4. If textlintルールの読み込みが失敗した場合、the Web Editorシステム shall デフォルトのルールセットでLintを実行し、エラーをログに記録する

### Requirement 11: UIレイアウトと操作性

**Objective:** 技術記事作成者として、直感的なUIで文章編集とLint結果確認を並行して行えるようにすることで、作業効率を最大化する

#### Acceptance Criteria

1. The Web Editorシステム shall 画面を左右2ペインに分割し、左側にエディタ、右側に指摘パネルを配置する
2. The Web Editorシステム shall 画面上部に「プリセット選択」「Lint実行」「自動Lint切替」のコントロールを配置する
3. The Web Editorシステム shall 指摘パネルを「指摘リスト」と「選択中の指摘詳細」の2セクションで構成する
4. When ユーザーが指摘リストで指摘を選択したとき、the Web Editorシステム shall 詳細セクションに該当指摘の完全な情報（行番号、ルールID、対象文、メッセージ）を表示する
5. The Web Editorシステム shall 指摘の重大度（error/warning）に応じて視覚的に区別する（色・アイコン等）

#### UI Mock（参考設計）

```
┌──────────────────────────────────────────────────────────────┐
│ プリセット: 技術記事 [▼]              Lint実行 [手動] [自動OFF] │
└──────────────────────────────────────────────────────────────┘

┌───────────────────────────────┬───────────────────────────────┐
│ 左：入力エディタ                │  右：指摘パネル                 │
│───────────────────────────────│───────────────────────────────│
│  …文章を編集…                   │  ▼ 指摘リスト                   │
│  該当箇所に赤波線等のハイライト  │  ┌─────────────────────────────┐ │
│                                │  │ 行124: 一つの文で"、"を4つ以上 │ │
│                                │  │        使用しています           │ │
│                                │  │        (max-ten)               │ │
│                                │  └─────────────────────────────┘ │
│                                │                                   │
│                                │  ▼ 選択中の指摘詳細                │
│                                │  ┌─────────────────────────────┐ │
│                                │  │ 行: 124                      │ │
│                                │  │ ルール: ja-technical-writing │ │
│                                │  │         /max-ten             │ │
│                                │  │ 対象文:                      │ │
│                                │  │   Serena はSkillディレクトリ…│ │
│                                │  └─────────────────────────────┘ │
│                                │                                   │
│  ※ 右の指摘をクリック = 左が該当行へスクロールし強調             │
└───────────────────────────────┴───────────────────────────────┘
```

**情報動線:**
1. 右で問題を把握する → 2. クリックで左へジャンプ → 3. 左で修正 → 4. 右で確認

### Requirement 12: 多タブ挙動

**Objective:** 技術記事作成者として、複数タブで編集した場合の挙動を理解し、データ損失のリスクを認識する

#### Acceptance Criteria

1. When 同一ブラウザの複数タブで同一ページを開いた場合、the Web Editorシステム shall 最後に保存したタブの内容が有効になる（Last Write Wins）
2. The Web Editorシステム shall MVP段階では、複数タブ同時編集による競合を許容範囲のリスクとして扱う
3. The Web Editorシステム shall 明示的なタブ間同期や競合解決ロジックを実装しない

### Requirement 13: 将来拡張への配慮

**Objective:** 開発チームとして、MVP完成後に追加機能を実装しやすい設計を維持することで、将来の機能拡張コストを削減する

#### Acceptance Criteria

1. The Web Editorシステム shall localStorage利用箇所を抽象化（ラップ）し、将来的に複数ドラフト管理へ移行しやすくする
2. The Web Editorシステム shall 複数プリセット追加を想定し、プリセット管理ロジックを拡張可能な設計とする
3. The Web Editorシステム shall ローカル完結モードを維持しつつ、将来的に生成AI連携（例: Vertex AI）を追加できる設計とする
4. The Web Editorシステム shall 画面左側に将来「過去の履歴タブ（ドラフト一覧）」を追加できるレイアウト構造を考慮する

### Requirement 14: 指摘の無視機能

**Objective:** 技術記事作成者として、誤検知や意図的な表現を個別に無視できるようにすることで、不要な指摘に煩わされずに執筆を継続する

#### Acceptance Criteria

1. When ユーザーが指摘アイテムに対して「無視」操作を実行したとき、the Web Editorシステム shall その指摘を表示リストから除外する
2. The Web Editorシステム shall 指摘の無視を「個別インスタンス単位」で管理し、ルール全体の有効/無効は切り替えない
3. When 無視された指摘があるとき、the Web Editorシステム shall その情報をlocalStorageまたはエディタ内コメント等で永続化する（具体的な実装方式は設計フェーズで決定）
4. When ドラフトをクリアしたとき、the Web Editorシステム shall 無視情報も合わせて削除する
5. The Web Editorシステム shall MVP段階では「無視リストの表示・管理UI」は提供しない（将来拡張として検討）

### Requirement 15: データ構造とインターフェース仕様

**Objective:** 開発チームとして、Web Workerとメインスレッド間の通信プロトコルとデータ構造を明確に定義することで、実装の一貫性と保守性を確保する

#### Acceptance Criteria

1. The Web Editorシステム shall メイン→Worker の Lint依頼メッセージを以下の構造で送信する：`{ type: "lint", requestId: string, text: string }`
2. The Web Editorシステム shall Worker→メイン の Lint結果メッセージを以下の構造で送信する：`{ type: "lint:result", requestId: string, results: LintResult[] }`
3. The Web Editorシステム shall LintResult型を以下のプロパティで定義する：
   - `id: string` - UI側が参照する一意なID
   - `ruleId: string` - textlintのruleId（例: "ja-technical-writing/ja-no-mixed-period"）
   - `message: string` - 指摘内容
   - `line: number` - 行番号
   - `column: number` - 列番号
   - `startIndex: number` - UTF-16コード単位ベースのインデックス
   - `endIndex: number` - UTF-16コード単位ベースのインデックス
   - `severity: "error" | "warning"` - 重大度
   - `snippet: string` - 問題箇所の抜粋
   - `fixable: boolean` - fix情報の有無からメイン側で算出
   - `fixText?: string` - fix適用後のテキスト（必要に応じて保持）
4. The Web Editorシステム shall LintResult型のバリデーションにZod、ArkType、ValiBot等のスキーマバリデーションライブラリを使用する（具体的なライブラリは設計フェーズで選定）

### Requirement 16: 成功指標（KPI）

**Objective:** プロダクトオーナーとして、製品の成功を測定可能な指標で評価することで、継続的な改善の方向性を明確にする

#### Acceptance Criteria

1. The Web Editorシステム shall 以下の成功指標を測定対象とする：
   - 指摘0件でレビューに上がる初稿の割合
   - レビュー工数削減の定量的または定性的評価
   - 継続利用率（週次/月次アクティブユーザー）
2. The Web Editorシステム shall MVP段階では、これらの指標を手動で収集・評価する（自動計測機能は将来拡張として検討）
3. The Web Editorシステム shall 指標収集時も Requirement 6（セキュリティとプライバシー）の制約を遵守し、文章内容を含まないメタ情報のみを対象とする
