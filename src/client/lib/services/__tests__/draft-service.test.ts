import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { LocalStorageAdapter } from "../../adapters/local-storage-adapter";
import { DraftService } from "../draft-service";

describe("DraftService", () => {
  let draftService: DraftService;
  let localStorageAdapter: LocalStorageAdapter;

  beforeEach(() => {
    // localStorageをモック
    const storage: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        // biome-ignore lint/suspicious/useIterableCallbackReturn: テストファイルのため問題なし
        Object.keys(storage).forEach((key) => delete storage[key]);
      },
      length: 0,
      key: () => null,
    };

    localStorageAdapter = new LocalStorageAdapter();
    draftService = new DraftService({ storage: localStorageAdapter });
  });

  afterEach(() => {
    // テスト後のクリーンアップ
  });

  describe("saveDraft", () => {
    it("テキストを正常に保存できること", async () => {
      const text = "テスト用のドラフトテキスト";

      const result = await draftService.saveDraft({ text });

      expect(result.success).toBe(true);
    });

    it("debounce処理により複数回の保存要求を1回にまとめること", async () => {
      const setItemSpy = vi.spyOn(localStorageAdapter, "setItem");

      // 短時間に複数回保存を試みる
      void draftService.saveDraft({ text: "テキスト1" });
      void draftService.saveDraft({ text: "テキスト2" });
      void draftService.saveDraft({ text: "テキスト3" });

      // debounce待機時間(1000ms)よりやや長く待つ
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // 最後の呼び出しのみが保存されること
      expect(setItemSpy).toHaveBeenCalledTimes(1);
      expect(setItemSpy).toHaveBeenCalledWith({
        key: "jlwe:currentDraftText",
        value: "テキスト3",
      });
    });

    it("最大待機時間(3000ms)を超えた場合は強制的に保存すること", async () => {
      const setItemSpy = vi.spyOn(localStorageAdapter, "setItem");

      // 最初の保存
      void draftService.saveDraft({ text: "テキスト1" });

      // 2900ms待機後に追加保存（最大待機時間内）
      await new Promise((resolve) => setTimeout(resolve, 2900));
      void draftService.saveDraft({ text: "テキスト2" });

      // さらに200ms待機（最大待機時間超過）
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 最大待機時間により強制保存されること
      expect(setItemSpy).toHaveBeenCalledTimes(1);
    });

    it("空文字列の保存も許容すること", async () => {
      const result = await draftService.saveDraft({ text: "" });

      expect(result.success).toBe(true);

      const loadResult = await draftService.loadDraft();
      if (loadResult.success) {
        expect(loadResult.value).toBe("");
      }
    });
  });

  describe("loadDraft", () => {
    it("保存されたドラフトを正常に読み込めること", async () => {
      const text = "保存されたテキスト";
      await draftService.saveDraft({ text });

      // debounce待機
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await draftService.loadDraft();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(text);
      }
    });

    it("ドラフトが存在しない場合はnullを返すこと", async () => {
      const result = await draftService.loadDraft();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("clearDraft", () => {
    it("ドラフトと無視情報を削除できること", async () => {
      // ドラフトと無視情報を保存
      await draftService.saveDraft({ text: "テスト" });
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // 無視情報を手動で設定
      localStorageAdapter.setItem({
        key: "jlwe:ignoredIssueIds",
        value: JSON.stringify(["issue1", "issue2"]),
      });

      const result = await draftService.clearDraft();

      expect(result.success).toBe(true);

      // ドラフトが削除されていること
      const loadResult = await draftService.loadDraft();
      if (loadResult.success) {
        expect(loadResult.value).toBeNull();
      }

      // 無視情報も削除されていること
      const ignoreResult = localStorageAdapter.getItem({
        key: "jlwe:ignoredIssueIds",
      });
      if (ignoreResult.success) {
        expect(ignoreResult.value).toBeNull();
      }
    });

    it("ドラフトが存在しない場合でもエラーにならないこと", async () => {
      const result = await draftService.clearDraft();

      expect(result.success).toBe(true);
    });
  });

  describe("エラーハンドリング", () => {
    it("localStorage容量超過時にDraftErrorを返すこと", async () => {
      // setItemが容量超過エラーを返すようにモック
      vi.spyOn(localStorageAdapter, "setItem").mockReturnValue({
        success: false,
        error: new Error("localStorageの容量を超過しました"),
      });

      const result = await draftService.saveDraft({ text: "テキスト" });
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe("DraftError");
      }
    });

    it("localStorage利用不可時にDraftErrorを返すこと", async () => {
      // getItemが利用不可エラーを返すようにモック
      vi.spyOn(localStorageAdapter, "getItem").mockReturnValue({
        success: false,
        error: new Error("localStorageが利用できません"),
      });

      const result = await draftService.loadDraft();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe("DraftError");
      }
    });
  });
});
