/**
 * textlint Lint結果の型定義
 */
export type LintResult = {
  /** 一意なID（UUID） */
  id: string;
  /** textlintのruleId（例: "ja-technical-writing/max-ten"） */
  ruleId: string;
  /** 指摘メッセージ */
  message: string;
  /** 行番号（1-indexed） */
  line: number;
  /** 列番号（1-indexed） */
  column: number;
  /** UTF-16開始位置 */
  startIndex: number;
  /** UTF-16終了位置 */
  endIndex: number;
  /** 重大度 */
  severity: "error" | "warning";
  /** 対象文の抜粋 */
  snippet: string;
  /** 自動修正可能フラグ */
  fixable: boolean;
  /** 修正後テキスト（任意） */
  fixText?: string;
};

/**
 * Web Worker通信プロトコル
 */

/** Lint実行リクエスト */
export type LintRequest = {
  type: "lint";
  requestId: string;
  text: string;
};

/** Lint実行レスポンス */
export type LintResponse = {
  type: "lint:result";
  requestId: string;
  results: LintResult[];
};

/** Fix実行リクエスト */
export type FixRequest = {
  type: "fix";
  requestId: string;
  text: string;
};

/** Fix実行レスポンス */
export type FixResponse = {
  type: "fix:result";
  requestId: string;
  fixedText: string;
};

/** エラーレスポンス */
export type ErrorResponse = {
  type: "lint:error" | "fix:error";
  requestId: string;
  error: string;
};

/** Workerリクエストの型 */
export type WorkerRequest = LintRequest | FixRequest;

/** Workerレスポンスの型 */
export type WorkerResponse = LintResponse | FixResponse | ErrorResponse;
