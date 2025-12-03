"use client";

import { markdown } from "@codemirror/lang-markdown";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useMemo, useRef } from "react";
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
 * Lintハイライトの更新エフェクト
 */
const setLintHighlightsEffect = StateEffect.define<LintResult[]>();

/**
 * 選択された指摘の強調表示エフェクト
 */
const setSelectedIssueEffect = StateEffect.define<string | null>();

/**
 * Lintハイライトの状態管理フィールド
 * - lintResults配列からDecorationSetを生成
 * - UTF-16コード単位ベースの位置計算
 * - 重大度に応じた装飾スタイル適用
 */
const lintHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    // ドキュメント変更時はデコレーションを更新
    decorations = decorations.map(transaction.changes);

    // Lintハイライト更新エフェクトを検出
    for (const effect of transaction.effects) {
      if (effect.is(setLintHighlightsEffect)) {
        const lintResults = effect.value;
        const marks: { from: number; to: number; value: Decoration }[] = [];

        for (const result of lintResults) {
          // UTF-16コード単位ベースの位置をCodeMirrorのpos（UTF-16ベース）に変換
          const from = result.startIndex;
          const to = result.endIndex;

          // ドキュメントの範囲内に収める
          const docLength = transaction.state.doc.length;
          if (from >= docLength || to > docLength || from >= to) {
            continue;
          }

          // 重大度に応じた装飾クラスを適用
          const severityClass =
            result.severity === "error" ? "cm-lint-error" : "cm-lint-warning";

          const mark = Decoration.mark({
            class: severityClass,
            attributes: {
              "data-lint-id": result.id,
              "data-lint-message": result.message,
            },
          });

          marks.push({ from, to, value: mark });
        }

        decorations = Decoration.set(marks);
      }
    }

    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * 選択された指摘の強調表示フィールド
 * - selectedIssueIdに基づいて一時的な強調表示を追加
 * - 再Lint時（lintResults更新時）にリセット
 */
const selectedIssueField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    // ドキュメント変更時はデコレーションを更新
    decorations = decorations.map(transaction.changes);

    // 選択された指摘の強調表示エフェクトを検出
    for (const effect of transaction.effects) {
      if (effect.is(setSelectedIssueEffect)) {
        const selectedIssueId = effect.value;
        if (!selectedIssueId) {
          decorations = Decoration.none;
          continue;
        }

        // 既存のLintハイライトから該当箇所を探す
        const lintHighlights = transaction.state.field(lintHighlightField);
        const marks: { from: number; to: number; value: Decoration }[] = [];

        lintHighlights.between(0, transaction.state.doc.length, (from, to) => {
          const deco = lintHighlights.iter(from);
          if (
            deco.value &&
            deco.value.spec.attributes?.["data-lint-id"] === selectedIssueId
          ) {
            const mark = Decoration.mark({
              class: "cm-selected-issue",
              attributes: {
                "data-selected-issue-id": selectedIssueId,
              },
            });
            marks.push({ from, to, value: mark });
          }
        });

        decorations = Decoration.set(marks);
      }

      // Lintハイライト更新時は選択状態をリセット
      if (effect.is(setLintHighlightsEffect)) {
        decorations = Decoration.none;
      }
    }

    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

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
  lintResults,
  selectedIssueId,
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
        lintHighlightField,
        selectedIssueField,
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

  // Lintハイライトの更新（useMemoで最適化）
  const memoizedLintResults = useMemo(() => lintResults, [lintResults]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // lintResults配列からCodeMirrorのdecorationを生成して適用
    view.dispatch({
      effects: setLintHighlightsEffect.of(memoizedLintResults),
    });
  }, [memoizedLintResults]);

  // 選択された指摘へのスクロールと強調表示
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selectedIssueId) return;

    // 該当箇所を探してスクロール
    const lintResult = lintResults.find((r) => r.id === selectedIssueId);
    if (!lintResult) return;

    const { startIndex, endIndex } = lintResult;
    const docLength = view.state.doc.length;

    // ドキュメントの範囲内に収める
    if (
      startIndex >= docLength ||
      endIndex > docLength ||
      startIndex >= endIndex
    ) {
      return;
    }

    // スクロールと強調表示を適用
    view.dispatch({
      effects: setSelectedIssueEffect.of(selectedIssueId),
      scrollIntoView: true,
    });

    // 該当箇所にスクロール
    view.dispatch({
      selection: { anchor: startIndex, head: endIndex },
      scrollIntoView: true,
    });
  }, [selectedIssueId, lintResults]);

  return (
    <div
      ref={editorRef}
      className="h-full w-full overflow-auto"
      data-testid="editor-panel"
    />
  );
}
