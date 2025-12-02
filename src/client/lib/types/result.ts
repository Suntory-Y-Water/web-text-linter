/**
 * Result型 - 成功または失敗を表すUnion型
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * 成功のResultを作成
 */
export function ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * 失敗のResultを作成
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}
