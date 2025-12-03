import type { LocalStorageAdapter } from "../adapters/local-storage-adapter";
import { DraftError } from "../types/errors";
import type { Result } from "../types/result";
import { err, ok } from "../types/result";

/**
 * ドラフト管理サービス
 *
 * ブラウザのlocalStorageを使用してドラフトテキストを管理する。
 * debounce処理により保存頻度を制御し、パフォーマンスを最適化する。
 */
export class DraftService {
  private readonly storage: LocalStorageAdapter;
  private readonly draftKey = "jlwe:currentDraftText";
  private readonly ignoredIssuesKey = "jlwe:ignoredIssueIds";

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSaveText: string | null = null;

  /**
   * DraftServiceを初期化
   *
   * @param params - パラメータ
   * @param params.storage - LocalStorageAdapterインスタンス
   */
  constructor({ storage }: { storage: LocalStorageAdapter }) {
    this.storage = storage;
  }

  /**
   * ドラフトを保存
   *
   * debounce処理により、1000ms待機後に保存を実行する。
   * 最大待機時間は3000msで、それを超えると強制的に保存する。
   *
   * @param params - パラメータ
   * @param params.text - 保存するテキスト
   * @returns 成功時はok()、失敗時はDraftErrorを含むerr()
   */
  async saveDraft({
    text,
  }: {
    text: string;
  }): Promise<Result<void, DraftError>> {
    this.pendingSaveText = text;

    // 既存のタイマーをクリア
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }

    // 最大待機タイマーが未設定の場合は設定
    if (this.maxWaitTimer === null) {
      this.maxWaitTimer = setTimeout(() => {
        this.executeSave();
      }, 3000);
    }

    // debounceタイマーを設定
    return new Promise((resolve) => {
      this.saveTimer = setTimeout(() => {
        const result = this.executeSave();
        resolve(result);
      }, 1000);
    });
  }

  /**
   * 保存処理を実行
   *
   * @returns 成功時はok()、失敗時はDraftErrorを含むerr()
   */
  private executeSave(): Result<void, DraftError> {
    // タイマーをクリア
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.maxWaitTimer !== null) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }

    if (this.pendingSaveText === null) {
      return ok(undefined);
    }

    const text = this.pendingSaveText;
    this.pendingSaveText = null;

    const result = this.storage.setItem({ key: this.draftKey, value: text });

    if (!result.success) {
      return err(
        new DraftError("ドラフトの保存に失敗しました", { cause: result.error }),
      );
    }

    return ok(undefined);
  }

  /**
   * ドラフトを読み込み
   *
   * @returns 成功時はテキストまたはnullを含むok()、失敗時はDraftErrorを含むerr()
   */
  async loadDraft(): Promise<Result<string | null, DraftError>> {
    const result = this.storage.getItem({ key: this.draftKey });

    if (!result.success) {
      return err(
        new DraftError("ドラフトの読み込みに失敗しました", {
          cause: result.error,
        }),
      );
    }

    return ok(result.value);
  }

  /**
   * ドラフトと無視情報をクリア
   *
   * @returns 成功時はok()、失敗時はDraftErrorを含むerr()
   */
  async clearDraft(): Promise<Result<void, DraftError>> {
    const draftResult = this.storage.removeItem({ key: this.draftKey });
    const ignoreResult = this.storage.removeItem({
      key: this.ignoredIssuesKey,
    });

    if (!draftResult.success) {
      return err(
        new DraftError("ドラフトの削除に失敗しました", {
          cause: draftResult.error,
        }),
      );
    }

    if (!ignoreResult.success) {
      return err(
        new DraftError("無視情報の削除に失敗しました", {
          cause: ignoreResult.error,
        }),
      );
    }

    return ok(undefined);
  }
}
