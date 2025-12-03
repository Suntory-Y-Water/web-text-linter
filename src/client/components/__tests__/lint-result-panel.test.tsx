import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { LintResult } from "@/client/lib/types/lint-worker";
import { LintResultPanel } from "../lint-result-panel";

describe("LintResultPanel", () => {
  const mockLintResults: LintResult[] = [
    {
      id: "issue-1",
      ruleId: "ja-technical-writing/max-ten",
      message: '一つの文で"、"を4つ以上使用しています',
      line: 1,
      column: 1,
      startIndex: 0,
      endIndex: 20,
      severity: "error",
      snippet: "テスト文章テスト文章テスト",
      fixable: false,
    },
    {
      id: "issue-2",
      ruleId: "ja-technical-writing/no-mix-dearu-desumasu",
      message: "敬体と常体が混在しています",
      line: 2,
      column: 5,
      startIndex: 25,
      endIndex: 35,
      severity: "warning",
      snippet: "混在している文章",
      fixable: true,
    },
  ];

  it("指摘リストを表示する", () => {
    const handleIssueSelect = mock(() => {});
    const handleIssueIgnore = mock(() => {});

    render(
      <LintResultPanel
        lintResults={mockLintResults}
        selectedIssueId={null}
        onIssueSelect={handleIssueSelect}
        onIssueIgnore={handleIssueIgnore}
        ignoredIssueIds={new Set()}
      />,
    );

    // 指摘リストが表示されることを確認
    expect(screen.getByText(/一つの文で/)).not.toBeNull();
    expect(screen.getByText(/敬体と常体が混在/)).not.toBeNull();
  });

  it("各指摘に行番号とルールIDを表示する", () => {
    const handleIssueSelect = mock(() => {});
    const handleIssueIgnore = mock(() => {});

    render(
      <LintResultPanel
        lintResults={mockLintResults}
        selectedIssueId={null}
        onIssueSelect={handleIssueSelect}
        onIssueIgnore={handleIssueIgnore}
        ignoredIssueIds={new Set()}
      />,
    );

    // 行番号が表示されることを確認
    expect(screen.getByText(/行1/)).not.toBeNull();
    expect(screen.getByText(/行2/)).not.toBeNull();

    // ルールIDが表示されることを確認
    expect(screen.getByText(/max-ten/)).not.toBeNull();
    expect(screen.getByText(/no-mix-dearu-desumasu/)).not.toBeNull();
  });

  it("重大度を視覚的に区別する", () => {
    const handleIssueSelect = mock(() => {});
    const handleIssueIgnore = mock(() => {});

    const { container } = render(
      <LintResultPanel
        lintResults={mockLintResults}
        selectedIssueId={null}
        onIssueSelect={handleIssueSelect}
        onIssueIgnore={handleIssueIgnore}
        ignoredIssueIds={new Set()}
      />,
    );

    // エラーとワーニングのスタイルクラスが存在することを確認
    const errorItem = container.querySelector('[data-severity="error"]');
    const warningItem = container.querySelector('[data-severity="warning"]');

    expect(errorItem).not.toBeNull();
    expect(warningItem).not.toBeNull();
  });

  it("指摘をクリックしたらonIssueSelectが呼ばれる", () => {
    const handleIssueSelect = mock(() => {});
    const handleIssueIgnore = mock(() => {});

    const { container } = render(
      <LintResultPanel
        lintResults={mockLintResults}
        selectedIssueId={null}
        onIssueSelect={handleIssueSelect}
        onIssueIgnore={handleIssueIgnore}
        ignoredIssueIds={new Set()}
      />,
    );

    // 最初の指摘をクリック
    const firstIssue = container.querySelector('[data-issue-id="issue-1"]');
    expect(firstIssue).not.toBeNull();

    if (firstIssue) {
      fireEvent.click(firstIssue);
    }

    // onIssueSelectが呼ばれることを確認
    expect(handleIssueSelect).toHaveBeenCalledTimes(1);
    expect(handleIssueSelect).toHaveBeenCalledWith("issue-1");
  });

  it("無視された指摘をフィルタリングする", () => {
    const handleIssueSelect = mock(() => {});
    const handleIssueIgnore = mock(() => {});
    const ignoredIssueIds = new Set(["issue-1"]);

    render(
      <LintResultPanel
        lintResults={mockLintResults}
        selectedIssueId={null}
        onIssueSelect={handleIssueSelect}
        onIssueIgnore={handleIssueIgnore}
        ignoredIssueIds={ignoredIssueIds}
      />,
    );

    // 無視された指摘が表示されないことを確認
    expect(screen.queryByText(/一つの文で/)).toBeNull();

    // 無視されていない指摘は表示されることを確認
    expect(screen.getByText(/敬体と常体が混在/)).not.toBeNull();
  });

  it("指摘が0件の場合はメッセージを表示する", () => {
    const handleIssueSelect = mock(() => {});
    const handleIssueIgnore = mock(() => {});

    render(
      <LintResultPanel
        lintResults={[]}
        selectedIssueId={null}
        onIssueSelect={handleIssueSelect}
        onIssueIgnore={handleIssueIgnore}
        ignoredIssueIds={new Set()}
      />,
    );

    // 空メッセージが表示されることを確認
    expect(screen.getByText(/指摘はありません/)).not.toBeNull();
  });
});
