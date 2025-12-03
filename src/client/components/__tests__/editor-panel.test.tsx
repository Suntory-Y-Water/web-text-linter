import { afterEach, beforeEach, describe, expect, it } from "bun:test";
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
});
