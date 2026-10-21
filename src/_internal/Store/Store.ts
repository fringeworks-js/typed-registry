import type { SetOptional } from 'type-fest';
import type { StoreEntry } from '../types';

/**
 * エントリーを保持するためのクラス
 *
 * 親の Store を指定した場合は、作成時点の親のエントリーを引き継ぐ。
 * レジストリーはイミュータブルで親が変わることは無いため、親を参照し続けずにコピーする。
 * エントリーのオブジェクトは親と共有するため、singleton の値も親子で共有される
 */
export default class Store {
  /**
   * エントリー
   */
  private _entries: Map<string, StoreEntry>;

  /**
   * コンストラクター
   * @param parent 親の Store
   */
  constructor(parent?: Store) {
    this._entries = new Map(parent?._entries);
  }

  /**
   * 要素の登録
   * 同じキーの要素がある場合は置き換える（キーの順序は保つ）
   * @param entry 登録する要素
   */
  set(entry: SetOptional<StoreEntry, 'tags'>) {
    const { tags = [], ...rest } = entry;
    // 呼び出し元の配列を書き換えても影響しないよう、コピーして保持する
    this._entries.set(entry.key, { tags: [...tags], ...rest });
  }

  /**
   * 要素の取得
   * @param key キー
   */
  get(key: string): StoreEntry | undefined {
    return this._entries.get(key);
  }

  /**
   * 要素の有無を確認
   * @param key キー
   */
  has(key: string): boolean {
    return this._entries.has(key);
  }

  /**
   * 登録されている全ての要素を取得
   */
  getEntries(): StoreEntry[] {
    return Array.from(this._entries.values());
  }

  /**
   * タグで要素を取得
   * @param tag タグ
   */
  getByTag(tag: string): StoreEntry[] {
    return this.getEntries().filter((entry) => entry.tags.includes(tag));
  }
}
