/**
 * ドラフト関連のエラー
 */
export class DraftError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DraftError";
  }
}

/**
 * ストレージ関連のエラー
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * プリセット関連のエラー
 */
export class PresetError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PresetError";
  }
}
