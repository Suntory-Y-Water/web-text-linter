import type { LocalStorageAdapter } from "../adapters/local-storage-adapter";
import { PresetError } from "../types/errors";
import { type Preset, TECHNICAL_ARTICLE_PRESET } from "../types/preset";
import type { Result } from "../types/result";
import { err, ok } from "../types/result";

/**
 * プリセット管理サービス
 *
 * Lintルールのプリセットを管理する。
 * MVP段階では技術記事プリセットのみを提供し、
 * 将来的な拡張を想定した設計とする。
 */
export class PresetService {
  private readonly storage: LocalStorageAdapter;
  private readonly presetKey = "jlwe:currentPresetId";
  private readonly availablePresets: Preset[] = [TECHNICAL_ARTICLE_PRESET];

  /**
   * PresetServiceを初期化
   *
   * @param params - パラメータ
   * @param params.storage - LocalStorageAdapterインスタンス
   */
  constructor({ storage }: { storage: LocalStorageAdapter }) {
    this.storage = storage;
  }

  /**
   * 利用可能なプリセット一覧を取得
   *
   * MVP段階では技術記事プリセットのみを返す。
   *
   * @returns 成功時はプリセット配列を含むok()
   */
  async getAvailablePresets(): Promise<Result<Preset[], PresetError>> {
    return ok([...this.availablePresets]);
  }

  /**
   * 現在のプリセットを取得
   *
   * localStorageに保存されたプリセットIDを読み込み、
   * 該当するプリセットを返す。
   * 保存されたIDが無効または存在しない場合は、
   * デフォルトプリセット（技術記事）を返す。
   *
   * @returns 成功時はプリセットを含むok()、失敗時はPresetErrorを含むerr()
   */
  async getCurrentPreset(): Promise<Result<Preset, PresetError>> {
    const result = this.storage.getItem({ key: this.presetKey });

    if (!result.success) {
      // localStorage読み込み失敗時はデフォルトプリセットを返す
      return ok(TECHNICAL_ARTICLE_PRESET);
    }

    const presetId = result.value;

    // プリセットIDが存在しない場合はデフォルトを返す
    if (presetId === null) {
      return ok(TECHNICAL_ARTICLE_PRESET);
    }

    // プリセットIDに該当するプリセットを検索
    const preset = this.availablePresets.find((p) => p.id === presetId);

    // 該当するプリセットがない場合はデフォルトを返す
    if (preset === undefined) {
      return ok(TECHNICAL_ARTICLE_PRESET);
    }

    return ok(preset);
  }

  /**
   * 現在のプリセットを設定
   *
   * 指定されたプリセットIDを検証し、
   * 有効な場合はlocalStorageに保存する。
   *
   * @param params - パラメータ
   * @param params.presetId - 設定するプリセットID
   * @returns 成功時はok()、失敗時はPresetErrorを含むerr()
   */
  async setCurrentPreset({
    presetId,
  }: {
    presetId: string;
  }): Promise<Result<void, PresetError>> {
    // プリセットIDの存在チェック
    const preset = this.availablePresets.find((p) => p.id === presetId);

    if (preset === undefined) {
      return err(
        new PresetError(`無効なプリセットID: ${presetId}`, {
          cause: "invalid_preset_id",
        }),
      );
    }

    // localStorageに保存
    const result = this.storage.setItem({
      key: this.presetKey,
      value: presetId,
    });

    if (!result.success) {
      return err(
        new PresetError("プリセットの保存に失敗しました", {
          cause: result.error,
        }),
      );
    }

    return ok(undefined);
  }
}
