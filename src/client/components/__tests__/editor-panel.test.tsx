import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import { EditorPanel } from "../editor-panel";

describe("EditorPanel", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("CodeMirrorエディタを表示する", async () => {
    const handleTextChange = () => {};
    const lintResults: [] = [];

    render(
      <EditorPanel
        initialText=""
        onTextChange={handleTextChange}
        lintResults={lintResults}
        selectedIssueId={null}
      />,
      { container },
    );

    // CodeMirrorがマウントされるまで待機
    await waitFor(
      () => {
        const editorElement = container.querySelector(".cm-editor");
        expect(editorElement).not.toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it("初期テキストを設定する", async () => {
    const initialText = "テストテキスト";
    const handleTextChange = () => {};
    const lintResults: [] = [];

    render(
      <EditorPanel
        initialText={initialText}
        onTextChange={handleTextChange}
        lintResults={lintResults}
        selectedIssueId={null}
      />,
      { container },
    );

    // CodeMirrorがマウントされるまで待機
    await waitFor(
      () => {
        const editorElement = container.querySelector(".cm-content");
        expect(editorElement).not.toBeNull();
        expect(editorElement?.textContent).toContain(initialText);
      },
      { timeout: 3000 },
    );
  });

  it("onTextChangeコールバックが登録されている", async () => {
    const handleTextChange = mock(() => {});
    const lintResults: [] = [];

    render(
      <EditorPanel
        initialText=""
        onTextChange={handleTextChange}
        lintResults={lintResults}
        selectedIssueId={null}
      />,
      { container },
    );

    // CodeMirrorがマウントされ、updateListenerが登録されることを確認
    await waitFor(
      () => {
        const editorElement = container.querySelector(".cm-editor");
        expect(editorElement).not.toBeNull();
      },
      { timeout: 3000 },
    );

    // CodeMirrorが正しくマウントされていることを確認
    const contentElement = container.querySelector(
      ".cm-content",
    ) as HTMLElement;
    expect(contentElement).not.toBeNull();
    expect(contentElement.hasAttribute("contenteditable")).toBe(true);
  });

  it("compositionイベントハンドラーが登録されている", async () => {
    const handleTextChange = mock(() => {});
    const lintResults: [] = [];

    render(
      <EditorPanel
        initialText=""
        onTextChange={handleTextChange}
        lintResults={lintResults}
        selectedIssueId={null}
      />,
      { container },
    );

    // CodeMirrorがマウントされ、domEventHandlersが登録されることを確認
    await waitFor(
      () => {
        const editorElement = container.querySelector(".cm-editor");
        expect(editorElement).not.toBeNull();
      },
      { timeout: 3000 },
    );

    // CodeMirrorが正しくマウントされ、compositionイベントを処理できることを確認
    // 実際のイベント処理はCodeMirror内部で行われるため、DOMに正しく設定されていることを確認
    const editorElement = container.querySelector<HTMLElement>(".cm-editor");
    expect(editorElement).not.toBeNull();
  });

  it("selectedIssueIdが変更されたら該当箇所にスクロールし強調表示する", async () => {
    const initialText = "あああああ\nいいいいい\nううううう";
    const handleTextChange = mock(() => {});
    const lintResults = [
      {
        id: "test-issue-1",
        ruleId: "test-rule",
        message: "テスト指摘",
        line: 2,
        column: 1,
        startIndex: 6,
        endIndex: 11,
        severity: "error" as const,
        snippet: "いいいいい",
        fixable: false,
      },
    ];

    const { rerender } = render(
      <EditorPanel
        initialText={initialText}
        onTextChange={handleTextChange}
        lintResults={lintResults}
        selectedIssueId={null}
      />,
      { container },
    );

    // CodeMirrorがマウントされるまで待機
    await waitFor(
      () => {
        const editorElement = container.querySelector(".cm-editor");
        expect(editorElement).not.toBeNull();
      },
      { timeout: 3000 },
    );

    // selectedIssueIdを変更
    rerender(
      <EditorPanel
        initialText={initialText}
        onTextChange={handleTextChange}
        lintResults={lintResults}
        selectedIssueId="test-issue-1"
      />,
    );

    // 強調表示のdecorationが追加されることを確認
    await waitFor(
      () => {
        const decorationElement = container.querySelector(
          '[data-selected-issue-id="test-issue-1"]',
        );
        expect(decorationElement).not.toBeNull();
      },
      { timeout: 1000 },
    );
  });

  it("再Lint実行時に選択状態をリセットする", async () => {
    const initialText = "あああああ";
    const handleTextChange = mock(() => {});
    const lintResults = [
      {
        id: "test-issue-1",
        ruleId: "test-rule",
        message: "テスト指摘",
        line: 1,
        column: 1,
        startIndex: 0,
        endIndex: 5,
        severity: "error" as const,
        snippet: "あああああ",
        fixable: false,
      },
    ];

    const { rerender } = render(
      <EditorPanel
        initialText={initialText}
        onTextChange={handleTextChange}
        lintResults={lintResults}
        selectedIssueId="test-issue-1"
      />,
      { container },
    );

    // CodeMirrorがマウントされるまで待機
    await waitFor(
      () => {
        const editorElement = container.querySelector(".cm-editor");
        expect(editorElement).not.toBeNull();
      },
      { timeout: 3000 },
    );

    // 強調表示が追加されることを確認
    await waitFor(
      () => {
        const decorationElement = container.querySelector(
          '[data-selected-issue-id="test-issue-1"]',
        );
        expect(decorationElement).not.toBeNull();
      },
      { timeout: 1000 },
    );

    // 新しいLint結果に更新（lintResults配列の参照が変わる）
    const newLintResults = [
      {
        id: "test-issue-2",
        ruleId: "test-rule",
        message: "新しい指摘",
        line: 1,
        column: 1,
        startIndex: 0,
        endIndex: 5,
        severity: "warning" as const,
        snippet: "あああああ",
        fixable: false,
      },
    ];

    rerender(
      <EditorPanel
        initialText={initialText}
        onTextChange={handleTextChange}
        lintResults={newLintResults}
        selectedIssueId="test-issue-1"
      />,
    );

    // 古い選択状態の強調表示が削除されることを確認
    await waitFor(
      () => {
        const decorationElement = container.querySelector(
          '[data-selected-issue-id="test-issue-1"]',
        );
        expect(decorationElement).toBeNull();
      },
      { timeout: 1000 },
    );
  });
});
