import * as v from "valibot";

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
 * LintResult型のValibotバリデーションスキーマ
 * - 非空文字列の保証
 * - 整数範囲の保証（line, column, startIndex, endIndex >= 0）
 * - startIndex < endIndexの保証
 */
export const LintResultSchema = v.pipe(
  v.object({
    id: v.pipe(
      v.string(),
      v.minLength(1, "idは非空文字列である必要があります"),
    ),
    ruleId: v.pipe(
      v.string(),
      v.minLength(1, "ruleIdは非空文字列である必要があります"),
    ),
    message: v.pipe(
      v.string(),
      v.minLength(1, "messageは非空文字列である必要があります"),
    ),
    line: v.pipe(
      v.number(),
      v.integer("lineは整数である必要があります"),
      v.minValue(1, "lineは1以上である必要があります"),
    ),
    column: v.pipe(
      v.number(),
      v.integer("columnは整数である必要があります"),
      v.minValue(1, "columnは1以上である必要があります"),
    ),
    startIndex: v.pipe(
      v.number(),
      v.integer("startIndexは整数である必要があります"),
      v.minValue(0, "startIndexは0以上である必要があります"),
    ),
    endIndex: v.pipe(
      v.number(),
      v.integer("endIndexは整数である必要があります"),
      v.minValue(0, "endIndexは0以上である必要があります"),
    ),
    severity: v.picklist(
      ["error", "warning"],
      "severityは'error'または'warning'である必要があります",
    ),
    snippet: v.pipe(
      v.string(),
      v.minLength(1, "snippetは非空文字列である必要があります"),
    ),
    fixable: v.boolean(),
    fixText: v.optional(v.string()),
  }),
  v.check(
    (data) => data.startIndex < data.endIndex,
    "startIndexはendIndexより小さい必要があります",
  ),
);

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

/**
 * WorkerResponseのValibotスキーマ
 */
const LintResponseSchema = v.object({
  type: v.literal("lint:result"),
  requestId: v.string(),
  results: v.array(LintResultSchema),
});

const FixResponseSchema = v.object({
  type: v.literal("fix:result"),
  requestId: v.string(),
  fixedText: v.string(),
});

const ErrorResponseSchema = v.object({
  type: v.union([v.literal("lint:error"), v.literal("fix:error")]),
  requestId: v.string(),
  error: v.string(),
});

export const WorkerResponseSchema = v.union([
  LintResponseSchema,
  FixResponseSchema,
  ErrorResponseSchema,
]);
