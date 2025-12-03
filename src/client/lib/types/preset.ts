/**
 * Lintプリセットの型定義
 */
export type Preset = {
  /** プリセットID */
  id: string;
  /** プリセット名 */
  name: string;
  /** プリセットの説明 */
  description: string;
  /** 適用されるルールの設定 */
  rules: Record<string, unknown>;
};

/**
 * 技術記事プリセット（MVP固定値）
 */
export const TECHNICAL_ARTICLE_PRESET: Preset = {
  id: "technical-article",
  name: "技術記事",
  description: "技術記事・ドキュメント作成向けのLintルール",
  rules: {
    "preset-ja-technical-writing": true,
  },
};
