"use client";

import { StorageError } from "@/client/lib/types/errors";
import { err, ok, type Result } from "@/client/lib/types/result";

/**
 * LocalStorageAdapter - localStorage操作の抽象化
 */
export class LocalStorageAdapter {
  /**
   * localStorage利用可否をチェック
   */
  private isAvailable(): boolean {
    try {
      const testKey = "__test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 値を設定
   *
   * @param params - パラメータ
   * @param params.key - ストレージキー
   * @param params.value - 保存する値
   * @returns 成功時はok()、失敗時はStorageErrorを含むerr()
   */
  setItem({
    key,
    value,
  }: {
    key: string;
    value: string;
  }): Result<void, StorageError> {
    if (!this.isAvailable()) {
      return err(
        new StorageError("localStorageが利用できません", {
          cause: "unavailable",
        }),
      );
    }

    try {
      localStorage.setItem(key, value);
      return ok(undefined);
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        return err(
          new StorageError("localStorageの容量を超過しました", {
            cause: error,
          }),
        );
      }
      return err(
        new StorageError("localStorageへの保存に失敗しました", {
          cause: error,
        }),
      );
    }
  }

  /**
   * 値を取得
   *
   * @param key - ストレージキー
   * @returns 成功時は値を含むok()、キーが存在しない場合はnullを含むok()、失敗時はStorageErrorを含むerr()
   */
  getItem({ key }: { key: string }): Result<string | null, StorageError> {
    if (!this.isAvailable()) {
      return err(
        new StorageError("localStorageが利用できません", {
          cause: "unavailable",
        }),
      );
    }

    try {
      const value = localStorage.getItem(key);
      return ok(value);
    } catch (error) {
      return err(
        new StorageError("localStorageからの取得に失敗しました", {
          cause: error,
        }),
      );
    }
  }

  /**
   * 値を削除
   *
   * @param key - ストレージキー
   * @returns 成功時はok()、失敗時はStorageErrorを含むerr()
   */
  removeItem({ key }: { key: string }): Result<void, StorageError> {
    if (!this.isAvailable()) {
      return err(
        new StorageError("localStorageが利用できません", {
          cause: "unavailable",
        }),
      );
    }

    try {
      localStorage.removeItem(key);
      return ok(undefined);
    } catch (error) {
      return err(
        new StorageError("localStorageからの削除に失敗しました", {
          cause: error,
        }),
      );
    }
  }

  /**
   * すべてのキーをクリア
   *
   * @returns 成功時はok()、失敗時はStorageErrorを含むerr()
   */
  clear(): Result<void, StorageError> {
    if (!this.isAvailable()) {
      return err(
        new StorageError("localStorageが利用できません", {
          cause: "unavailable",
        }),
      );
    }

    try {
      localStorage.clear();
      return ok(undefined);
    } catch (error) {
      return err(
        new StorageError("localStorageのクリアに失敗しました", {
          cause: error,
        }),
      );
    }
  }
}
