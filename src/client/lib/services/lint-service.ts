import * as v from "valibot";
import type { FixRequest, LintRequest, LintResult } from "../types/lint-worker";
import { WorkerResponseSchema } from "../types/lint-worker";

/**
 * Lint実行リクエストの引数
 */
type RequestLintArgs = {
  /** Lint対象テキスト */
  text: string;
  /** 手動実行フラグ */
  isManual: boolean;
};

/**
 * Fix実行リクエストの引数
 */
type RequestFixArgs = {
  /** Fix対象テキスト */
  text: string;
};

/**
 * LintService
 *
 * Web Workerを使用してtextlintによる文章Lintを実行するサービス
 * - Workerの初期化と通信
 * - requestId管理（最新リクエストのみ有効）
 * - Lint実行とFix実行のAPI提供
 */
export class LintService {
  private worker: Worker;
  private pendingLintRequests: Map<
    string,
    {
      resolve: (results: LintResult[]) => void;
      reject: (error: Error) => void;
    }
  >;
  private pendingFixRequests: Map<
    string,
    {
      resolve: (fixedText: string) => void;
      reject: (error: Error) => void;
    }
  >;
  private debounceTimer: ReturnType<typeof setTimeout> | null;
  private latestRequestId: string | null;

  /**
   * LintServiceのコンストラクタ
   *
   * Web Workerを初期化し、メッセージハンドラを設定する
   */
  constructor() {
    // Web Workerの初期化
    this.worker = new Worker(
      new URL("../../workers/lint-worker.ts", import.meta.url),
      { type: "module" },
    );

    // 保留中のリクエストを管理するMap
    this.pendingLintRequests = new Map();
    this.pendingFixRequests = new Map();

    // debounceタイマー
    this.debounceTimer = null;

    // 最新のrequestId
    this.latestRequestId = null;

    // Workerからのレスポンスを処理
    this.worker.addEventListener("message", (event: MessageEvent) => {
      this.handleWorkerResponse(event.data);
    });
  }

  /**
   * Lint実行リクエストを送信する
   *
   * @param args - Lint実行引数
   * @returns Lint結果のPromise
   */
  requestLint({ text, isManual }: RequestLintArgs): Promise<LintResult[]> {
    const requestId = crypto.randomUUID();

    // 最新のrequestIdを更新
    this.latestRequestId = requestId;

    return new Promise((resolve, reject) => {
      // 古いdebounceタイマーをクリア
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }

      // 手動実行の場合は即座に送信
      if (isManual) {
        this.sendLintRequest({ requestId, text, resolve, reject });
        return;
      }

      // 自動実行の場合は1500msのdebounce
      // TODO: 定数で管理すること
      this.debounceTimer = setTimeout(() => {
        // 最新のrequestIdと一致する場合のみ送信
        if (this.latestRequestId === requestId) {
          this.sendLintRequest({ requestId, text, resolve, reject });
        }
        this.debounceTimer = null;
      }, 1500);
    });
  }

  /**
   * Workerへのリクエスト送信処理
   *
   * @param args - 送信引数
   */
  private sendLintRequest({
    requestId,
    text,
    resolve,
    reject,
  }: {
    requestId: string;
    text: string;
    resolve: (results: LintResult[]) => void;
    reject: (error: Error) => void;
  }): void {
    // リクエストを保留中リストに追加
    this.pendingLintRequests.set(requestId, { resolve, reject });

    // Workerにリクエスト送信
    const request: LintRequest = {
      type: "lint",
      requestId,
      text,
    };

    this.worker.postMessage(request);
  }

  /**
   * Workerからのレスポンスを処理する
   *
   * @param response - Workerレスポンス
   */
  private handleWorkerResponse(
    response: ReturnType<MessageEvent["data"]>,
  ): void {
    // Valibotでレスポンスをパース
    const parsed = v.safeParse(WorkerResponseSchema, response);

    if (!parsed.success) {
      console.error("不正なWorkerレスポンス形式です:", response);
      return;
    }

    const validResponse = parsed.output;
    const { requestId } = validResponse;

    // レスポンスタイプに応じて処理
    if (validResponse.type === "lint:result") {
      const pending = this.pendingLintRequests.get(requestId);
      if (!pending) {
        return;
      }
      this.pendingLintRequests.delete(requestId);
      pending.resolve(validResponse.results);
    } else if (validResponse.type === "fix:result") {
      const pending = this.pendingFixRequests.get(requestId);
      if (!pending) {
        return;
      }
      this.pendingFixRequests.delete(requestId);
      pending.resolve(validResponse.fixedText);
    } else {
      // エラーレスポンスの処理
      const error = new Error(validResponse.error);

      // Lintエラーの場合
      const lintPending = this.pendingLintRequests.get(requestId);
      if (lintPending) {
        this.pendingLintRequests.delete(requestId);
        lintPending.reject(error);
        return;
      }

      // Fixエラーの場合
      const fixPending = this.pendingFixRequests.get(requestId);
      if (fixPending) {
        this.pendingFixRequests.delete(requestId);
        fixPending.reject(error);
      }
    }
  }

  /**
   * Fix実行リクエストを送信する
   *
   * @param args - Fix実行引数
   * @returns 修正後テキストのPromise
   */
  requestFix({ text }: RequestFixArgs): Promise<string> {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // リクエストを保留中リストに追加
      this.pendingFixRequests.set(requestId, { resolve, reject });

      // Workerにリクエスト送信
      const request: FixRequest = {
        type: "fix",
        requestId,
        text,
      };

      this.worker.postMessage(request);
    });
  }

  /**
   * Workerを終了する
   */
  terminate(): void {
    this.worker.terminate();
  }
}
