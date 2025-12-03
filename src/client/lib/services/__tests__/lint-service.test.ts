import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type {
  ErrorResponse,
  FixResponse,
  LintRequest,
  LintResponse,
} from "../../types/lint-worker";
import { LintService } from "../lint-service";

/**
 * LintServiceのユニットテスト
 *
 * テスト対象:
 * - Worker初期化
 * - requestId生成と管理
 * - postMessageによるリクエスト送信
 * - onmessageによるレスポンス受信とrequestId照合
 */
describe("LintService", () => {
  let lintService: LintService;
  let mockWorker: {
    postMessage: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  };
  let originalWorker: typeof Worker;

  beforeEach(() => {
    // 元のWorkerを保存
    originalWorker = global.Worker;

    // Mock Worker
    mockWorker = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      terminate: vi.fn(),
    };

    // Workerコンストラクタのモック
    // @ts-expect-error - テストのためにWorkerをモック
    global.Worker = vi.fn(() => mockWorker);

    lintService = new LintService();
  });

  afterEach(() => {
    // Workerを元に戻す
    global.Worker = originalWorker;
  });

  describe("初期化とWorker通信", () => {
    it("Workerインスタンスが生成されること", () => {
      // Workerが呼び出されたことを確認（モック関数の呼び出し回数チェック）
      expect(global.Worker).toHaveBeenCalled();
    });

    it("requestLintがWorkerにメッセージを送信すること", async () => {
      const text = "テストテキスト";

      // Lintリクエストを送信（結果は待たない）
      const resultPromise = lintService.requestLint({ text, isManual: true });

      // Worker.postMessageが呼ばれたことを確認
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);

      const calls = mockWorker.postMessage.mock.calls;
      const sentMessage = calls[0][0] as LintRequest;
      expect(sentMessage.type).toBe("lint");
      expect(sentMessage.text).toBe(text);
      expect(sentMessage.requestId).toBeDefined();
      expect(typeof sentMessage.requestId).toBe("string");

      // Workerからのレスポンスをシミュレート
      const response: LintResponse = {
        type: "lint:result",
        requestId: sentMessage.requestId,
        results: [],
      };

      // addEventListener の messageハンドラを取得して実行
      const addEventListenerCalls = mockWorker.addEventListener.mock.calls;
      const messageHandlerCall = addEventListenerCalls.find(
        (call: unknown[]) => call[0] === "message",
      );

      if (!messageHandlerCall) {
        throw new Error("messageハンドラが登録されていません");
      }

      const messageHandler = messageHandlerCall[1] as (
        event: MessageEvent,
      ) => void;
      messageHandler({ data: response } as MessageEvent);

      // Promiseが解決されることを確認
      const result = await resultPromise;
      expect(result).toEqual([]);
    });

    it("requestIdが一致しないレスポンスは無視されること", async () => {
      const text = "テストテキスト";

      // Lintリクエストを送信
      const resultPromise = lintService.requestLint({ text, isManual: true });

      const calls = mockWorker.postMessage.mock.calls;
      const sentMessage = calls[0][0] as LintRequest;

      // 異なるrequestIdのレスポンスをシミュレート
      const wrongResponse: LintResponse = {
        type: "lint:result",
        requestId: "wrong-request-id",
        results: [],
      };

      const addEventListenerCalls = mockWorker.addEventListener.mock.calls;
      const messageHandlerCall = addEventListenerCalls.find(
        (call: unknown[]) => call[0] === "message",
      );

      if (!messageHandlerCall) {
        throw new Error("messageハンドラが登録されていません");
      }

      const messageHandler = messageHandlerCall[1] as (
        event: MessageEvent,
      ) => void;
      messageHandler({ data: wrongResponse } as MessageEvent);

      // 正しいrequestIdのレスポンスを送信
      const correctResponse: LintResponse = {
        type: "lint:result",
        requestId: sentMessage.requestId,
        results: [
          {
            id: "test-id",
            ruleId: "test-rule",
            message: "テストメッセージ",
            line: 1,
            column: 1,
            startIndex: 0,
            endIndex: 5,
            severity: "warning",
            snippet: "テスト",
            fixable: false,
          },
        ],
      };

      messageHandler({ data: correctResponse } as MessageEvent);

      // 正しいレスポンスのみが処理されること
      const result = await resultPromise;
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe("テストメッセージ");
    });

    it("エラーレスポンスが例外としてスローされること", async () => {
      const text = "テストテキスト";

      const resultPromise = lintService.requestLint({ text, isManual: true });

      const calls = mockWorker.postMessage.mock.calls;
      const sentMessage = calls[0][0] as LintRequest;

      // エラーレスポンスをシミュレート
      const errorResponse: ErrorResponse = {
        type: "lint:error",
        requestId: sentMessage.requestId,
        error: "Lint実行エラー",
      };

      const addEventListenerCalls = mockWorker.addEventListener.mock.calls;
      const messageHandlerCall = addEventListenerCalls.find(
        (call: unknown[]) => call[0] === "message",
      );

      if (!messageHandlerCall) {
        throw new Error("messageハンドラが登録されていません");
      }

      const messageHandler = messageHandlerCall[1] as (
        event: MessageEvent,
      ) => void;
      messageHandler({ data: errorResponse } as MessageEvent);

      // エラーが例外としてスローされること
      await expect(resultPromise).rejects.toThrow("Lint実行エラー");
    });
  });

  describe("Fix実行", () => {
    it("requestFixがWorkerにFixリクエストを送信すること", async () => {
      const text = "テストテキスト";

      // Fixリクエストを送信
      const resultPromise = lintService.requestFix({ text });

      // Worker.postMessageが呼ばれたことを確認
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);

      const calls = mockWorker.postMessage.mock.calls;
      const sentMessage = calls[0][0];
      expect(sentMessage).toBeDefined();
      expect(sentMessage.type).toBe("fix");
      expect(sentMessage.text).toBe(text);
      expect(sentMessage.requestId).toBeDefined();
      expect(typeof sentMessage.requestId).toBe("string");

      // Workerからのレスポンスをシミュレート
      const response: FixResponse = {
        type: "fix:result",
        requestId: sentMessage.requestId,
        fixedText: "修正済みテキスト",
      };

      // addEventListener の messageハンドラを取得して実行
      const addEventListenerCalls = mockWorker.addEventListener.mock.calls;
      const messageHandlerCall = addEventListenerCalls.find(
        (call) => call[0] === "message",
      );

      if (!messageHandlerCall) {
        throw new Error("messageハンドラが登録されていません");
      }

      const messageHandler = messageHandlerCall[1];
      messageHandler({ data: response });

      // Promiseが解決されることを確認
      const result = await resultPromise;
      expect(result).toBe("修正済みテキスト");
    });

    it("requestFixでエラーレスポンスが例外としてスローされること", async () => {
      const text = "テストテキスト";

      const resultPromise = lintService.requestFix({ text });

      const calls = mockWorker.postMessage.mock.calls;
      const sentMessage = calls[0][0];

      // エラーレスポンスをシミュレート
      const errorResponse: ErrorResponse = {
        type: "fix:error",
        requestId: sentMessage.requestId,
        error: "Fix実行エラー",
      };

      const addEventListenerCalls = mockWorker.addEventListener.mock.calls;
      const messageHandlerCall = addEventListenerCalls.find(
        (call) => call[0] === "message",
      );

      if (!messageHandlerCall) {
        throw new Error("messageハンドラが登録されていません");
      }

      const messageHandler = messageHandlerCall[1];
      messageHandler({ data: errorResponse });

      // エラーが例外としてスローされること
      await expect(resultPromise).rejects.toThrow("Fix実行エラー");
    });
  });
});
