/// <reference lib="webworker" />

import type { TextlintMessage } from "@textlint/kernel";
/**
 * textlint Linterのインスタンス
 */
import { TextlintKernelDescriptor } from "@textlint/kernel";
import { moduleInterop } from "@textlint/module-interop";
import { createLinter } from "textlint";
import presetJaTechnicalWriting from "textlint-rule-preset-ja-technical-writing";
import type {
  ErrorResponse,
  FixRequest,
  FixResponse,
  LintRequest,
  LintResponse,
  LintResult,
  WorkerRequest,
} from "../lib/types/lint-worker";

let linter: Awaited<ReturnType<typeof createLinter>> | null = null;

/**
 * textlint Linterの初期化
 *
 * Web Worker環境では設定ファイルの自動読み込みができないため、
 * ルールを直接指定してLinterを作成する
 */
function initializeLinter(): void {
  if (linter !== null) {
    return;
  }

  const descriptor = new TextlintKernelDescriptor({
    rules: [
      {
        ruleId: "preset-ja-technical-writing",
        rule: moduleInterop(presetJaTechnicalWriting),
        options: true,
      },
    ],
    plugins: [],
    filterRules: [],
  });

  linter = createLinter({
    descriptor,
  });
}

/**
 * textlint LintMessageからLintResultへの変換
 *
 * @param message - textlintのLintMessage
 * @param text - Lint対象テキスト
 * @returns LintResult
 */
function convertToLintResult({
  message,
  text,
}: {
  message: TextlintMessage;
  text: string;
}): LintResult {
  const [startIndex, endIndex] = message.range;

  // 指摘箇所のスニペットを抽出（前後10文字）
  const snippetStart = Math.max(0, startIndex - 10);
  const snippetEnd = Math.min(text.length, endIndex + 10);
  const snippet = text.slice(snippetStart, snippetEnd);

  return {
    id: crypto.randomUUID(),
    ruleId: message.ruleId,
    message: message.message,
    line: message.line,
    column: message.column,
    startIndex,
    endIndex,
    severity: message.severity === 2 ? "error" : "warning",
    snippet,
    fixable: message.fix !== undefined,
    fixText: message.fix?.text,
  };
}

/**
 * Lintリクエストの処理
 *
 * @param request - Lintリクエスト
 */
async function handleLintRequest(request: LintRequest): Promise<void> {
  try {
    initializeLinter();

    if (!linter) {
      throw new Error("textlint linterが初期化されていません");
    }

    // textlintでLint実行（ダミーファイル名を指定）
    const result = await linter.lintText(request.text, "document.md");

    // LintMessageをLintResultに変換
    const lintResults: LintResult[] = result.messages.map((message) =>
      convertToLintResult({ message, text: request.text }),
    );

    // レスポンス送信
    const response: LintResponse = {
      type: "lint:result",
      requestId: request.requestId,
      results: lintResults,
    };
    self.postMessage(response);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      type: "lint:error",
      requestId: request.requestId,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(errorResponse);
  }
}

/**
 * Fixリクエストの処理
 *
 * @param request - Fixリクエスト
 */
async function handleFixRequest(request: FixRequest): Promise<void> {
  try {
    initializeLinter();

    if (!linter) {
      throw new Error("textlint linterが初期化されていません");
    }

    // textlintでFix実行（ダミーファイル名を指定）
    const result = await linter.fixText(request.text, "document.md");

    // レスポンス送信
    const response: FixResponse = {
      type: "fix:result",
      requestId: request.requestId,
      fixedText: result.output,
    };
    self.postMessage(response);
  } catch (error) {
    const errorResponse: ErrorResponse = {
      type: "fix:error",
      requestId: request.requestId,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(errorResponse);
  }
}

/**
 * メッセージハンドラー
 *
 * Web Workerのメッセージを受信し、Lint/Fixリクエストを処理する
 */
self.onmessage = self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  switch (request.type) {
    case "lint":
      void handleLintRequest(request);
      break;
    case "fix":
      void handleFixRequest(request);
      break;
    default:
      console.error("不明なリクエストタイプです:", request);
  }
};
