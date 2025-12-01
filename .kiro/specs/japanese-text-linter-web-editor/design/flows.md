# System Flows

## Lint実行フロー

```mermaid
sequenceDiagram
    participant User
    participant EditorPanel
    participant LintService
    participant LintWorker
    participant textlint
    participant LintResultPanel

    User->>EditorPanel: テキスト入力
    EditorPanel->>LintService: debounce (1500ms)
    LintService->>LintService: requestId生成
    LintService->>LintWorker: postMessage({type: "lint", requestId, text})

    alt IME変換中または入力中
        LintService-->>LintService: 自動Lint実行しない
    end

    LintWorker->>textlint: lint(text)
    textlint-->>LintWorker: LintMessage[]
    LintWorker->>LintWorker: LintResult[]に変換
    LintWorker->>LintService: postMessage({type: "lint:result", requestId, results})

    alt 新しいLintリクエストが存在
        LintService-->>LintService: 古いrequestId無視
    end

    LintService->>EditorPanel: ハイライト更新 (decorations)
    LintService->>LintResultPanel: 指摘リスト更新
    LintService->>DraftService: debounced save (localStorage)
```

**Key Decisions**:
- debounce 1500ms: Requirement 1.3（入力停止から1500ms経過で自動Lint）
- requestIdパターン: Requirement 1.5（最新の入力状態に対する結果のみ採用）
- IME判定: `isComposing`フラグでIME変換中の自動Lint抑制（Requirement 1.4）

---

## 自動修正（Auto Fix）フロー

```mermaid
sequenceDiagram
    participant User
    participant ControlBar
    participant LintService
    participant LintWorker
    participant textlint
    participant EditorPanel

    User->>ControlBar: 自動修正ボタン押下
    ControlBar->>LintService: requestFix()
    LintService->>LintWorker: postMessage({type: "fix", requestId, text})
    LintWorker->>textlint: fix(text)
    textlint-->>LintWorker: {output: string, messages: LintMessage[]}
    LintWorker->>LintService: postMessage({type: "fix:result", requestId, fixedText})
    LintService->>EditorPanel: エディタ全文更新
    LintService->>LintService: 再Lint実行
```

**Key Decisions**:
- fix APIの使用: textlint公式のfix機能を信頼（Requirement 3.7）
- 全文更新: カーソル位置のズレを許容（MVP段階、将来的にdiff適用検討）
- 自動Lint時はFix実行しない: Requirement 3.8（カーソル位置のズレによる編集妨害防止）

---

## 指摘ナビゲーションフロー

```mermaid
stateDiagram-v2
    [*] --> LintComplete
    LintComplete --> IssueSelected: ユーザーがリスト項目クリック
    IssueSelected --> EditorScrolled: エディタスクロール
    EditorScrolled --> EditorHighlighted: 該当範囲強調表示
    EditorHighlighted --> DetailDisplayed: 詳細パネル表示
    DetailDisplayed --> IssueSelected: 別の指摘クリック
    DetailDisplayed --> [*]: 再Lint実行
```

**Key Decisions**:
- startIndex/endIndexベースのスクロール: UTF-16コード単位でCodeMirrorの位置計算と整合（Requirement 2.6）
- 選択状態リセット: 再Lint完了時に選択・強調解除（Requirement 2.5）

---

## ドラフト保存・リストアフロー

```mermaid
sequenceDiagram
    participant User
    participant EditorPage
    participant DraftService
    participant LocalStorageAdapter

    Note over EditorPage,LocalStorageAdapter: ページロード時
    EditorPage->>DraftService: loadDraft()
    DraftService->>LocalStorageAdapter: getItem("jlwe:currentDraftText")
    LocalStorageAdapter-->>DraftService: ドラフトテキスト or null
    DraftService-->>EditorPage: Result<string, DraftError>
    EditorPage->>EditorPanel: 初期テキスト設定

    Note over User,LocalStorageAdapter: Lint完了後
    LintService->>DraftService: saveDraft(text) [debounced]
    DraftService->>LocalStorageAdapter: setItem("jlwe:currentDraftText", text)
    alt 容量超過
        LocalStorageAdapter-->>DraftService: Err(quota_exceeded)
        DraftService-->>EditorPage: エラー通知
    else 成功
        LocalStorageAdapter-->>DraftService: Ok(void)
    end

    Note over User,LocalStorageAdapter: ドラフトクリア
    User->>ControlBar: クリアボタン押下
    ControlBar->>DraftService: clearDraft()
    DraftService->>LocalStorageAdapter: removeItem("jlwe:currentDraftText")
    DraftService->>LocalStorageAdapter: removeItem("jlwe:ignoredIssueIds")
    DraftService-->>EditorPage: エディタ初期化
```

**Key Decisions**:
- debounce: 1000ms待機、3000ms最大待機（Lint完了時のみ保存）
- 単一キー: `jlwe:currentDraftText`のみ使用（MVP段階）
- 容量制限エラー: ユーザーに警告表示、ドラフトクリア促進（Requirement 10.3）
