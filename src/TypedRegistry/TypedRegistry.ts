import type { Merge } from 'type-fest';
import resolveEntry from '../_internal/resolveEntry';
import Store from '../_internal/Store';
import type { StoreEntry } from '../_internal/types';
import type {
  RegistryEntries,
  RegistryEntry,
  RegistryKey,
  RegistryRaw,
  RegistryValue,
  ResolveOptions,
  ResolveRestArgs,
  ResolveSpec,
  Resolved,
} from '../types';
import type { TypedRegistryOptions } from './types';

/**
 * 同じインターフェイスを持つクラス等を纏めて管理するレジストリー
 *
 * 登録内容は作成時に渡し、作成後は変更できない。
 * 追加・差し替えは extend で子レジストリーを作成して行う。
 *
 * @typeParam E 登録内容。コンストラクターに渡した登録内容から推論される
 * @typeParam Base 取得されるものが共通して持つインターフェイス。
 * レジストリーを受け取る関数等で、取得したものを Base として扱いたい場合に指定する
 */
export default class TypedRegistry<
  // 登録内容が無い状態を表すため、空のオブジェクト型にする
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  E extends RegistryEntries = {},
  Base = RegistryValue<E>,
> {
  /**
   * ID
   */
  private _id?: string;

  /**
   * Store
   */
  private _store: Store;

  /**
   * コンストラクター
   * @param entries 登録内容
   * @param options
   */
  constructor(entries: E, options?: TypedRegistryOptions) {
    this._id = options?.id;
    this._store = new Store();
    this._setEntries(entries);
  }

  /**
   * ID
   */
  get id(): string | undefined {
    return this._id;
  }

  /**
   * 子レジストリーを作成する
   * 子レジストリーは親の登録内容を引き継ぎ、渡した登録内容を追加する
   * 親と同じキーを渡した場合は、子の中でのみ差し替わる
   * Base は引き継がない。Base を引き継ぐと、Base を指定した型で受け取る際の型の比較が成り立たなくなるため
   * @param entries 追加・差し替える登録内容
   * @param options
   * @returns
   */
  extend<E2 extends RegistryEntries>(
    entries: E2,
    options?: TypedRegistryOptions,
  ): TypedRegistry<Merge<E, E2>> {
    // 親の Store を引き継ぐため、空で作成してから Store を差し替える
    const child = new TypedRegistry({} as Merge<E, E2>, options);
    child._store = new Store(this._store);
    child._setEntries(entries);
    return child;
  }

  /**
   * キーが登録されているかを確認する
   * @param key キー
   * @returns
   */
  has(key: string): key is RegistryKey<E> {
    return this._store.has(key);
  }

  /**
   * 登録されている全てのキーを取得する
   * @returns
   */
  keys(): RegistryKey<E>[] {
    return this._store.getEntries().map((entry) => entry.key as RegistryKey<E>);
  }

  /**
   * 登録したもの（クラス・関数・値）をそのまま取得する
   * 登録されていないキーの場合は例外を投げる
   * @param key キー
   * @returns
   */
  getRaw<K extends RegistryKey<E>>(key: K): RegistryRaw<E, K> {
    return this._getEntry(key).raw as RegistryRaw<E, K>;
  }

  /**
   * タグで登録したもの（クラス・関数・値）をそのまま取得する
   * @param tag タグ
   * @returns
   */
  getRawByTag(tag: string): RegistryRaw<E>[] {
    return this._store
      .getByTag(tag)
      .map((entry) => entry.raw as RegistryRaw<E>);
  }

  /**
   * キーに対応するものを取得する
   * 登録されていないキーの場合は例外を投げる
   * @param key キー
   * @param options 取得オプション。必須の引数がある場合は args の指定が必須
   * @returns
   */
  resolve<K extends RegistryKey<E>>(
    key: K,
    ...[options]: ResolveRestArgs<E, K>
  ): Resolved<Base, E, K> {
    return resolveEntry(this._getEntry(key), options) as Resolved<Base, E, K>;
  }

  /**
   * キーと引数の組に対応するものを取得する
   * 設定等から組み立てたキーと引数をそのまま渡す場合に使う
   * 登録されていないキーの場合は例外を投げる
   * @param spec キーと引数の組
   * @returns
   */
  resolveSpec<S extends ResolveSpec<E>>(spec: S): Resolved<Base, E, S['key']> {
    return resolveEntry(this._getEntry(spec.key), {
      args: spec.args,
    }) as Resolved<Base, E, S['key']>;
  }

  /**
   * タグに対応するものを纏めて取得する
   * 全てのエントリーに同じ args を渡す
   * @param tag タグ
   * @param options 取得オプション
   * @returns
   */
  resolveByTag(tag: string, options: ResolveOptions = {}): Base[] {
    return this._store
      .getByTag(tag)
      .map((entry) => resolveEntry(entry, options)) as Base[];
  }

  /**
   * 登録内容を Store に設定する
   * @param entries
   */
  private _setEntries(entries: RegistryEntries) {
    for (const [key, entry] of Object.entries(entries)) {
      this._store.set(_toStoreEntry(key, entry));
    }
  }

  /**
   * エントリーを取得する
   * 登録されていないキーの場合は例外を投げる
   * @param key
   * @returns
   */
  private _getEntry(key: string): StoreEntry {
    const entry = this._store.get(key);
    if (!entry) {
      const registry = this._id ? ` in registry "${this._id}"` : '';
      throw new Error(`No entry registered for key "${key}"${registry}`);
    }
    return entry;
  }
}

/**
 * 登録内容の種別を表すプロパティ
 */
const ENTRY_KINDS = ['class', 'factory', 'value'] as const;

/**
 * 登録内容の1件を Store に保存する形式に変換する
 * @param key
 * @param entry
 * @returns
 */
function _toStoreEntry(
  key: string,
  entry: RegistryEntry,
): Omit<StoreEntry, 'tags'> & { tags?: readonly string[] } {
  if (typeof entry === 'function') {
    return { key, raw: entry, type: 'instance' };
  }
  if (entry != null && typeof entry === 'object') {
    // 種別を表すプロパティが複数ある場合は、どれを使うか決められないため不正とする
    const kinds = ENTRY_KINDS.filter((kind) => kind in entry);
    if (kinds.length > 1) {
      throw new Error(
        `Invalid entry for key "${key}". Use only one of ${kinds.map((kind) => `{ ${kind} }`).join(', ')}`,
      );
    }
    if ('class' in entry) {
      const { class: raw, tags, singleton } = entry;
      return { key, raw, type: 'instance', tags, singleton };
    }
    if ('factory' in entry) {
      const { factory: raw, tags, singleton } = entry;
      return { key, raw, type: 'factory', tags, singleton };
    }
    if ('value' in entry) {
      const { value: raw, tags, clone } = entry;
      return { key, raw, type: clone ? 'clone' : 'reference', tags };
    }
  }
  throw new Error(
    `Invalid entry for key "${key}". Use a class, { class }, { factory } or { value }`,
  );
}
