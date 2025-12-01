# Research & Design Decisions

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: `japanese-text-linter-web-editor`
- **Discovery Scope**: 新機能（greenfield）- 完全なDiscoveryプロセス実施
- **Key Findings**:
  - textlintはWeb Workerで実行可能であり、@textlint/script-compilerによりブラウザ最適化されたバンドルを生成できる
  - CodeMirror 6はReact/Next.jsと統合可能だが、SSRの制約によりdynamic importが必要
  - Valibotがバンドルサイズ最適化に最適（Zodと比較して90%削減）
  - localStorage auto-saveはdebounceパターン（1000ms待機、3000ms最大待機）が一般的

## Research Log

### textlintのブラウザ実行とWeb Worker統合

- **Context**: Requirement 1（Lint実行）とRequirement 7（パフォーマンス）を実現するため、textlintをWeb Worker上で実行する方法を調査
- **Sources Consulted**:
  - [textlint/editor - GitHub](https://github.com/textlint/editor)
  - [ブラウザ上でtextlintをサクッと試せる環境を作ってみた - DevelopersIO](https://dev.classmethod.jp/articles/textlint_on_browser/)
  - [textlint Documentation](https://textlint.org/docs/)
- **Findings**:
  - textlint/editorプロジェクトが公式にブラウザ実行をサポート
  - @textlint/script-compilerがtextlint + textlintrcをWeb Workerとしてコンパイル
  - @textlint/kernelがブラウザや非Node.js環境向けの低レベルAPIを提供
  - Web Workerは別スレッドでスクリプトを実行し、メインスレッドをブロックしない
  - textlint-worker.jsとして最適化されたバンドルをダウンロードする構成が一般的
- **Implications**:
  - Web Worker専用のtsconfig.jsonが必要（lib配列に"webworker"を含める）
  - postMessageパターンでメイン↔Worker間の通信を実装
  - textlintルールのバンドルサイズ最適化が重要（初回ロード時間に影響）

### CodeMirror 6とReact/Next.js統合

- **Context**: Requirement 1（Lint実行）とRequirement 11（UIレイアウトと操作性）のエディタコンポーネント実装
- **Sources Consulted**:
  - [How to use CodeMirror in Nextjs - Ahmad Rosid](https://ahmadrosid.com/blog/codemirror-with-nextjs)
  - [CodeMirror 6 React Wrapper - Stack Overflow](https://stackoverflow.com/questions/64265010/codemirror-6-react-wrapper)
  - [CodeMirror API Reference](https://codemirror.net/docs/ref/)
- **Findings**:
  - CodeMirror 6は`EditorView`（UIコンポーネント）と`EditorState`（不変データ構造）で構成
  - React統合はuseRefとuseEffectでエディタインスタンスを管理
  - Next.jsではSSRの制約により「ReferenceError: navigator is not defined」エラーが発生
  - dynamic importで`ssr: false`を指定してクライアントサイドのみで読み込む必要がある
  - decorations（ハイライト）は`RangeSet`と`StateField`を使用して実装
  - エディタの状態更新は`EditorState.update()`メソッドとトランザクションで行う
- **Implications**:
  - エディタコンポーネントは`"use client"`ディレクティブが必須
  - dynamic importパターンを採用: `const CodeMirrorEditor = dynamic(() => import('./CodeMirrorEditor'), { ssr: false })`
  - ハイライト実装にはカスタムExtensionの作成が必要

### Web Worker postMessageの型安全性

- **Context**: Requirement 15（データ構造とインターフェース仕様）のWorker通信プロトコル設計
- **Sources Consulted**:
  - [How do I strongly type a TypeScript web worker file with postMessage - Stack Overflow](https://stackoverflow.com/questions/48950248/how-do-i-strongly-type-a-typescript-web-worker-file-with-postmessage)
  - [Worker: postMessage() method - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)
  - [Using Web Workers in Typescript React - Medium](https://medium.com/@hamzazaheer721/using-web-workers-in-typescript-react-8d2926a33154)
- **Findings**:
  - TypeScriptはWindow.postMessageを想定するため、Web Worker専用のtsconfig.jsonが必要
  - genericsでinput/output型を指定する方法が一般的: `postMessage<K, T>()`
  - postMessageは単一オブジェクトのみ送信可能（複数値はarray化）
  - onmessageとonerrorイベントハンドラーで通信とエラー処理を実装
  - ArrayBufferなどの大容量データはcloneではなくtransferで効率化可能
  - Worker終了後はterminateでリソース解放が必要
- **Implications**:
  - メッセージ型定義は共有interface（例: `shared-types.ts`）で管理
  - requestIdパターンで非同期リクエストの順序制御を実装
  - Zodまたはバリデーションライブラリでランタイム型検証を追加

### localStorage auto-saveとdebounceパターン

- **Context**: Requirement 4（ドラフト管理）の自動保存実装
- **Sources Consulted**:
  - [How can i implement debounced auto save on input change in React - Stack Overflow](https://stackoverflow.com/questions/55964381/how-can-i-implement-debounced-auto-save-on-input-change-in-react)
  - [redux-localstorage-debounce - npm](https://www.npmjs.com/package/redux-localstorage-debounce)
  - [Autosave with React Hooks - Synthace](https://www.synthace.com/blog/autosave-with-react-hooks)
- **Findings**:
  - debounceにより連続変更を遅延させ、保存頻度を削減（パフォーマンス向上）
  - 一般的な設定: 1000ms待機、3000ms最大待機（maxWait）
  - React HooksではuseCallbackでmemoize + lodash/debounceを使用
  - Google Docsのような自動保存体験を提供
  - localStorageへの保存は同期処理のため、debounceで頻度制御が重要
- **Implications**:
  - Lint実行完了時にdebounced saveを呼び出す設計（Requirement 4.1）
  - useCallbackとuseMemoでdebounce関数を最適化
  - localStorage容量制限エラーハンドリングが必要（Requirement 10.3）

### TypeScriptバリデーションライブラリ比較（Zod vs Valibot vs ArkType）

- **Context**: Requirement 15（データ構造とインターフェース仕様）のスキーマバリデーション選定
- **Sources Consulted**:
  - [Zod vs. Valibot: Which Validation Library is Right for Your TypeScript Project - DEV Community](https://dev.to/sheraz4194/zod-vs-valibot-which-validation-library-is-right-for-your-typescript-project-303d)
  - [Why Use ArkType Instead of Zod - Medium](https://medium.com/@ruverd/why-use-arktype-instead-of-zod-08c401fd4f6f)
  - [Comparison | Valibot](https://valibot.dev/guides/comparison/)
- **Findings**:
  - **バンドルサイズ**: Valibotが最小（1.37 kB）、Zodは13.5 kB（90%削減）
  - **パフォーマンス**: ArkTypeが最速（Zodの2-4倍）、ValibotはZodの約2倍
  - **エコシステム**: Zodが最大（78ライブラリが統合）
  - **Standard Schema**: Zod、Valibot、ArkType全てが対応
  - **推奨**: 小〜中規模スキーマはZod、大規模・複雑スキーマはValibot
- **Implications**:
  - MVP段階ではバンドルサイズ最適化を優先し**Valibotを採用**
  - LintResult型のバリデーションに使用（Requirement 15.4）
  - 将来的にZodへの移行も可能（Standard Schema準拠のため）

### textlint ja-technical-writingルールセット

- **Context**: Requirement 5（プリセット管理）とRequirement 8（ルールセット管理）の技術記事プリセット設計
- **Sources Consulted**:
  - [textlint-rule-preset-ja-technical-writing - GitHub](https://github.com/textlint-ja/textlint-rule-preset-ja-technical-writing)
  - [textlint-rule-preset-ja-technical-writing - npm](https://www.npmjs.com/package/textlint-rule-preset-ja-technical-writing)
- **Findings**:
  - 技術記事向けの公式プリセットが存在（週間6,547ダウンロード）
  - 主要ルール:
    - 文字数制限（デフォルト100文字、推奨90文字）
    - 読点制限（デフォルト3つまで）
    - 連続漢字制限（デフォルト6文字まで）
    - 文体統一（です/ます vs である）
    - 数字表記統一（算用数字 vs 漢数字）
  - .textlintrc.jsonで設定: `{ "rules": { "preset-ja-technical-writing": true } }`
  - ルール単位でカスタマイズ可能
- **Implications**:
  - MVP段階では`preset-ja-technical-writing`をそのまま採用
  - リポジトリ内の.textlintrc.jsonで一元管理（Requirement 8.1）
  - 過度に厳しいルールは無効化する方針（実用性優先、Requirement 8.5）

### Next.jsクライアントサイド専用ページとVercelデプロイ

- **Context**: Requirement 9（ホスティングとアーキテクチャ）のデプロイ構成
- **Sources Consulted**:
  - [Next.js: Server-side Rendering vs. Static Generation - Vercel](https://vercel.com/blog/nextjs-server-side-rendering-vs-static-generation)
  - [Next.js on Vercel - Vercel](https://vercel.com/frameworks/nextjs)
  - [Guides: Static Exports | Next.js](https://nextjs.org/docs/pages/building-your-application/deploying/static-exports)
- **Findings**:
  - Static Generation + Client-side Fetchingパターンで静的HTML生成とクライアント側データ取得を両立
  - Vercelデプロイ時、静的アセット（JS/CSS/画像/フォント）はCDNから自動配信
  - Static Exportモード（`output: 'export'`）でoutフォルダに静的サイト生成
  - クライアントサイド専用ページは`"use client"`ディレクティブで明示
- **Implications**:
  - ランディングページはSSG、エディタページはクライアント専用ページとして実装（Requirement 9.2, 9.3）
  - next.config.tsでStatic Export設定は不要（デフォルトのSSG + Client Rendering）
  - Vercel単一プロジェクトで完結（追加バックエンド不要、Requirement 9.4）

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Layered (Presentation-Domain-Infrastructure) | UIコンポーネント、ドメインロジック（Lint処理）、インフラ（Worker/localStorage）を分離 | シンプル、MVPに最適、既存Next.js構造に適合 | ドメインロジックが薄い場合はオーバーエンジニアリングのリスク | MVP段階で採用（将来的にClean Architectureへ拡張可能） |
| Clean Architecture (Hexagonal) | ポート/アダプターで外部依存（textlint、localStorage）を抽象化 | テスタビリティ高、将来のAPI連携に有利 | MVP段階では不要な複雑性、初期開発コスト増 | 将来拡張（生成AI連携、Requirement 13.3）で検討 |
| Component-Based (Atomic Design) | UI層のみをAtom/Molecule/Organism/Templateで構造化 | UI再利用性高、デザインシステム構築に有利 | ドメインロジックの配置が不明確 | UI層の一部で採用（エディタ、指摘パネル、コントロール） |

## Design Decisions

### Decision: バリデーションライブラリにValibotを採用

- **Context**: Requirement 15.4でLintResult型のバリデーションが必要。バンドルサイズ最適化を優先する必要がある。
- **Alternatives Considered**:
  1. **Zod** - エコシステムが最大、ドキュメント豊富、コミュニティサポート強力
  2. **Valibot** - バンドルサイズ最小（Zodの1/10）、パフォーマンスZodの2倍
  3. **ArkType** - パフォーマンス最速（Zodの2-4倍）、TypeScript-first設計
- **Selected Approach**: **Valibot**
- **Rationale**:
  - MVP段階ではバンドルサイズ最適化が最優先（Requirement 8.4: 初回ロードのバンドルサイズ抑制）
  - 1.37 kBで機能要件を満たす（Zodの13.5 kBと比較して90%削減）
  - Standard Schema準拠のため、将来的にZodへの移行も可能
  - パフォーマンスもZodの約2倍で、Requirement 7（パフォーマンス）に適合
- **Trade-offs**:
  - **Benefits**: バンドルサイズ最小、高速、Standard Schema準拠
  - **Compromises**: エコシステムはZodより小規模、学習リソース少ない
- **Follow-up**: 実装時にValibot v1のAPI安定性を確認

### Decision: textlintをWeb Worker上で実行

- **Context**: Requirement 1.6とRequirement 7.1で、textlintをメインスレッドで実行せず、UIフリーズを防ぐ必要がある。
- **Alternatives Considered**:
  1. **メインスレッドで実行** - シンプルだが、長文Lintで固まる
  2. **Web Worker** - 別スレッドで実行、UI影響なし
  3. **Service Worker** - オフライン動作可能だが、複雑性増
- **Selected Approach**: **Web Worker**
- **Rationale**:
  - textlint/editorプロジェクトの実績あり
  - @textlint/script-compilerでブラウザ最適化されたバンドル生成可能
  - postMessageパターンでメイン↔Worker間の通信が明確
  - Service Workerは不要（オフライン動作はMVP範囲外）
- **Trade-offs**:
  - **Benefits**: UIフリーズ防止、パフォーマンス向上、textlint公式サポート
  - **Compromises**: Worker専用tsconfig.json必要、postMessage通信の型安全性に工夫必要
- **Follow-up**: Worker起動時間とメッセージングオーバーヘッドを実装後に計測

### Decision: CodeMirror 6のdynamic importパターン

- **Context**: Requirement 1.1でCodeMirrorベースのエディタが必要。Next.jsのSSR制約を回避する必要がある。
- **Alternatives Considered**:
  1. **通常のimport** - SSRエラー「navigator is not defined」発生
  2. **dynamic import with ssr: false** - クライアントサイドのみで読み込み
  3. **useEffect内で動的読み込み** - 複雑性増、型安全性低下
- **Selected Approach**: **dynamic import with ssr: false**
- **Rationale**:
  - Next.js公式パターン
  - 型安全性を維持しつつSSR制約を回避
  - コンポーネント分離で再利用性向上
- **Trade-offs**:
  - **Benefits**: SSRエラー回避、型安全、Next.js公式サポート
  - **Compromises**: 初回レンダリング時にローディング状態表示が必要
- **Follow-up**: CodeMirror拡張機能（syntax highlighting、decorations）の読み込みタイミング最適化

### Decision: localStorage単一キー方式のドラフト管理

- **Context**: Requirement 4でドラフト管理が必要。MVP段階では複数ドラフト管理は範囲外。
- **Alternatives Considered**:
  1. **単一キー（`jlwe:currentDraftText`）** - シンプル、MVP要件を満たす
  2. **複数キー（タイムスタンプ付き）** - 履歴管理可能だが、MVP範囲外
  3. **IndexedDB** - 大容量データ対応だが、複雑性増
- **Selected Approach**: **単一キー**
- **Rationale**:
  - Requirement 4.5: 差分保存なし、常に全文上書き
  - Requirement 4.6: ドラフト1本のみ管理
  - シンプルで保守性高、MVP要件を満たす
- **Trade-offs**:
  - **Benefits**: 実装シンプル、容量制限明確（約5-10MB）、MVP要件満たす
  - **Compromises**: 履歴管理不可、複数タブ競合（Last Write Wins、Requirement 12.1）
- **Follow-up**: Requirement 13.1の抽象化（ラップ）により、将来的に複数ドラフト管理へ移行可能

### Decision: 指摘の無視情報をlocalStorageで管理

- **Context**: Requirement 14で指摘の無視機能が必要。永続化方式を決定する必要がある。
- **Alternatives Considered**:
  1. **localStorage** - シンプル、ドラフトと同一ストレージ
  2. **エディタ内コメント（例: `<!-- textlint-disable -->`）** - textlint公式パターンだが、文章本体に影響
  3. **IndexedDB** - 複雑性増、MVP範囲外
- **Selected Approach**: **localStorage**
- **Rationale**:
  - Requirement 14.3: localStorageまたはエディタ内コメント等で永続化
  - エディタ内コメントは文章本体に影響するため、MVP段階では不適切
  - localStorageはドラフトと同一ストレージで一貫性保持
- **Trade-offs**:
  - **Benefits**: シンプル、ドラフトと一貫性、文章本体に影響なし
  - **Compromises**: エクスポート時に無視情報が含まれない（将来拡張で対応）
- **Follow-up**: 無視情報のデータ構造（`Map<string, boolean>`等）を実装時に決定

## Risks & Mitigations

- **Risk 1: textlintバンドルサイズが大きく初回ロード時間が長い**
  - Mitigation: @textlint/script-compilerで最適化、必要最小限のルールのみバンドル（Requirement 8.4）
- **Risk 2: 長文（数万文字以上）でLint処理が遅延**
  - Mitigation: Requirement 7.5の警告表示、将来的にウィンドウイング方式導入検討（Requirement 7.6）
- **Risk 3: localStorage容量制限到達によるドラフト保存失敗**
  - Mitigation: Requirement 10.3のエラーハンドリング、ドラフトクリア促進
- **Risk 4: CodeMirror decorationsのパフォーマンス劣化（大量指摘時）**
  - Mitigation: RangeSetの効率的な使用、将来的にウィンドウイング方式導入検討
- **Risk 5: Web Worker起動時間がLint初回実行を遅延**
  - Mitigation: Worker事前初期化（ページロード時）、初回Lint時のローディングUI表示

## References

### textlint & Web Worker
- [textlint/editor - GitHub](https://github.com/textlint/editor)
- [ブラウザ上でtextlintをサクッと試せる環境を作ってみた - DevelopersIO](https://dev.classmethod.jp/articles/textlint_on_browser/)
- [textlint Documentation](https://textlint.org/docs/)
- [Worker: postMessage() method - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage)

### CodeMirror 6
- [How to use CodeMirror in Nextjs - Ahmad Rosid](https://ahmadrosid.com/blog/codemirror-with-nextjs)
- [CodeMirror 6 React Wrapper - Stack Overflow](https://stackoverflow.com/questions/64265010/codemirror-6-react-wrapper)
- [CodeMirror API Reference](https://codemirror.net/docs/ref/)

### TypeScript Validation Libraries
- [Zod vs. Valibot: Which Validation Library is Right for Your TypeScript Project - DEV Community](https://dev.to/sheraz4194/zod-vs-valibot-which-validation-library-is-right-for-your-typescript-project-303d)
- [Why Use ArkType Instead of Zod - Medium](https://medium.com/@ruverd/why-use-arktype-instead-of-zod-08c401fd4f6f)
- [Comparison | Valibot](https://valibot.dev/guides/comparison/)

### textlint Rules
- [textlint-rule-preset-ja-technical-writing - GitHub](https://github.com/textlint-ja/textlint-rule-preset-ja-technical-writing)
- [textlint-rule-preset-ja-technical-writing - npm](https://www.npmjs.com/package/textlint-rule-preset-ja-technical-writing)

### Next.js & Vercel
- [Next.js: Server-side Rendering vs. Static Generation - Vercel](https://vercel.com/blog/nextjs-server-side-rendering-vs-static-generation)
- [Next.js on Vercel - Vercel](https://vercel.com/frameworks/nextjs)
- [Guides: Static Exports | Next.js](https://nextjs.org/docs/pages/building-your-application/deploying/static-exports)

### Auto-save & Debounce
- [How can i implement debounced auto save on input change in React - Stack Overflow](https://stackoverflow.com/questions/55964381/how-can-i-implement-debounced-auto-save-on-input-change-in-react)
- [Autosave with React Hooks - Synthace](https://www.synthace.com/blog/autosave-with-react-hooks)
