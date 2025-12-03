"use client";

import { useMemo } from "react";
import type { LintResult } from "@/client/lib/types/lint-worker";

/**
 * LintResultPanelコンポーネントのプロパティ
 */
type LintResultPanelProps = {
  /** Lint結果配列 */
  lintResults: LintResult[];
  /** 選択中の指摘ID */
  selectedIssueId: string | null;
  /** 指摘選択時のコールバック */
  onIssueSelect: (issueId: string) => void;
  /** 指摘無視時のコールバック */
  onIssueIgnore: (issueId: string) => void;
  /** 無視された指摘のID集合 */
  ignoredIssueIds: Set<string>;
};

/**
 * Lint結果パネルコンポーネント
 * - Lint指摘リストと選択中の指摘詳細を表示
 * - 無視機能を提供
 *
 * @param lintResults - Lint結果配列
 * @param selectedIssueId - 選択中の指摘ID
 * @param onIssueSelect - 指摘選択時のコールバック
 * @param onIssueIgnore - 指摘無視時のコールバック
 * @param ignoredIssueIds - 無視された指摘のID集合
 */
export function LintResultPanel({
  lintResults,
  selectedIssueId,
  onIssueSelect,
  onIssueIgnore: _onIssueIgnore,
  ignoredIssueIds,
}: LintResultPanelProps) {
  // 無視された指摘を除外してフィルタリング
  const filteredResults = useMemo(
    () => lintResults.filter((result) => !ignoredIssueIds.has(result.id)),
    [lintResults, ignoredIssueIds],
  );

  return (
    <div className="flex h-full flex-col" data-testid="lint-result-panel">
      {/* 指摘リスト */}
      <div className="flex-1 overflow-auto">
        {filteredResults.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            指摘はありません
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredResults.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  data-issue-id={result.id}
                  data-severity={result.severity}
                  className={`w-full p-3 text-left transition-colors hover:bg-accent ${
                    selectedIssueId === result.id ? "bg-accent" : ""
                  }`}
                  onClick={() => onIssueSelect(result.id)}
                >
                  <div className="flex items-start gap-2">
                    {/* 重大度アイコン */}
                    <div
                      className={`mt-1 shrink-0 ${
                        result.severity === "error"
                          ? "text-destructive"
                          : "text-orange-500"
                      }`}
                    >
                      {result.severity === "error" ? (
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <title>エラー</title>
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <title>警告</title>
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>

                    {/* 指摘内容 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">
                          行{result.line}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {result.ruleId}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">
                        {result.message}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
