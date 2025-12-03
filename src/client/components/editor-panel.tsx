"use client";

import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { LintResult } from "@/client/lib/types/lint-worker";

/**
 * EditorPanelコンポーネントのプロパティ
 */
type EditorPanelProps = {
  /** 初期テキスト */
  initialText: string;
  /** テキスト変更時のコールバック */
  onTextChange: (params: { text: string; isComposing: boolean }) => void;
  /** Lint結果 */
  lintResults: LintResult[];
  /** 選択中の指摘ID */
  selectedIssueId: string | null;
};

/**
 * CodeMirrorエディタパネルコンポーネント
 * - CodeMirror 6を使用した高機能テキストエディタ
 * - Markdown拡張を適用
 * - Lint結果のハイライト表示
 * - 指摘箇所へのスクロールと強調表示
 *
 * @param initialText - 初期テキスト
 * @param onTextChange - テキスト変更時のコールバック
 * @param lintResults - Lint結果配列
 * @param selectedIssueId - 選択中の指摘ID
 */
export function EditorPanel({
  initialText,
  onTextChange,
  lintResults: _lintResults, // タスク7.3で使用予定
  selectedIssueId: _selectedIssueId, // タスク7.4で使用予定
}: EditorPanelProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isComposingRef = useRef(false);
  const onTextChangeRef = useRef(onTextChange);

  // onTextChangeの最新値を保持
  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  }, [onTextChange]);

  // CodeMirrorの初期化
  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: initialText,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString();
            onTextChangeRef.current({
              text,
              isComposing: isComposingRef.current,
            });
          }
        }),
        // IME変換中の判定
        EditorView.domEventHandlers({
          compositionstart: () => {
            isComposingRef.current = true;
          },
          compositionend: () => {
            isComposingRef.current = false;
          },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [initialText]); // initialTextが変更されたら再初期化

  return (
    <div
      ref={editorRef}
      className="h-full w-full overflow-auto"
      data-testid="editor-panel"
    />
  );
}
