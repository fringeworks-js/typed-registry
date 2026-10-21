import type { ResolveOptions } from '../types';

/**
 * リゾルバー種別
 *
 * - instance: クラスからインスタンスを生成して返す
 * - factory: 関数の戻り値を返す
 * - reference: 値をそのまま返す
 * - clone: 値のコピーを返す
 */
export type ResolverType = 'instance' | 'factory' | 'reference' | 'clone';

/**
 * 保存されたエントリー
 */
export type StoreEntry = {
  /**
   * キー
   */
  key: string;

  /**
   * 登録した要素
   */
  raw: unknown;

  /**
   * 種別
   */
  type: ResolverType;

  /**
   * タグ
   */
  tags: readonly string[];

  /**
   * シングルトン
   */
  singleton?: boolean;

  /**
   * シングルトン用の値
   */
  value?: unknown;
};

/**
 * 値の解決関数
 */
export type ResolverFunction = (
  entry: StoreEntry,
  options: ResolveOptions,
) => unknown;
