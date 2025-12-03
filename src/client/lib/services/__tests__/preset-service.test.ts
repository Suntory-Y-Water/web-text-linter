import { beforeEach, describe, expect, it, vi } from "bun:test";
import { LocalStorageAdapter } from "../../adapters/local-storage-adapter";
import { TECHNICAL_ARTICLE_PRESET } from "../../types/preset";
import { PresetService } from "../preset-service";

describe("PresetService", () => {
  let storage: LocalStorageAdapter;
  let service: PresetService;

  beforeEach(() => {
    // localStorageをモック
    const storageData: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => storageData[key] ?? null,
      setItem: (key: string, value: string) => {
        storageData[key] = value;
      },
      removeItem: (key: string) => {
        delete storageData[key];
      },
      clear: () => {
        // biome-ignore lint/suspicious/useIterableCallbackReturn: テストファイルのため問題なし
        Object.keys(storageData).forEach((key) => delete storageData[key]);
      },
      length: 0,
      key: () => null,
    };

    storage = new LocalStorageAdapter();
    service = new PresetService({ storage });
  });

  describe("getAvailablePresets", () => {
    it("MVP段階では技術記事プリセットのみを返す", async () => {
      const result = await service.getAvailablePresets();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual(TECHNICAL_ARTICLE_PRESET);
      }
    });
  });

  describe("getCurrentPreset", () => {
    it("初回アクセス時はデフォルトプリセット（技術記事）を返す", async () => {
      const result = await service.getCurrentPreset();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(TECHNICAL_ARTICLE_PRESET);
      }
    });

    it("保存されたプリセットIDが存在する場合、そのプリセットを返す", async () => {
      // 事前にプリセットIDを保存
      localStorage.setItem("jlwe:currentPresetId", "technical-article");

      const result = await service.getCurrentPreset();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(TECHNICAL_ARTICLE_PRESET);
      }
    });

    it("保存されたプリセットIDが無効な場合、デフォルトプリセットを返す", async () => {
      // 無効なプリセットIDを保存
      localStorage.setItem("jlwe:currentPresetId", "invalid-preset-id");

      const result = await service.getCurrentPreset();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(TECHNICAL_ARTICLE_PRESET);
      }
    });
  });

  describe("setCurrentPreset", () => {
    it("有効なプリセットIDを設定できる", async () => {
      const result = await service.setCurrentPreset({
        presetId: "technical-article",
      });

      expect(result.success).toBe(true);

      // localStorageに保存されていることを確認
      const saved = localStorage.getItem("jlwe:currentPresetId");
      expect(saved).toBe("technical-article");
    });

    it("無効なプリセットIDの場合、PresetErrorを返す", async () => {
      const result = await service.setCurrentPreset({
        presetId: "invalid-preset-id",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe("PresetError");
        expect(result.error.message).toContain("無効なプリセットID");
      }
    });

    it("localStorage保存失敗時、PresetErrorを返す", async () => {
      // localStorageのsetItemが失敗する状況をシミュレート
      const setItemSpy = vi.spyOn(global.localStorage, "setItem");
      setItemSpy.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      const result = await service.setCurrentPreset({
        presetId: "technical-article",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.name).toBe("PresetError");
      }

      // モックを復元
      setItemSpy.mockRestore();
    });
  });
});
