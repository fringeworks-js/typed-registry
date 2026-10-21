import type { IsUnion } from 'type-fest';
import type TypedRegistry from './TypedRegistry';

/**
 * 任意のクラス
 */
type AnyClass = new (...args: never) => unknown;

/**
 * 任意の関数
 */
type AnyFunction = (...args: never) => unknown;

/**
 * クラスとファクトリー関数の登録に共通するオプション
 */
type InstanceEntryOptions = {
  /**
   * タグ
   */
  tags?: readonly string[];

  /**
   * シングルトン
   * 初回に返したものと同じものを返し続ける
   * 2回目以降の resolve で渡された args は使用されない
   */
  singleton?: boolean;
};

/**
 * クラスの登録（オプションを指定する場合）
 * resolve 時にはインスタンスを生成して返す
 */
export type ClassEntry<C extends AnyClass = AnyClass> = InstanceEntryOptions & {
  /**
   * クラス
   */
  class: C;
};

/**
 * ファクトリー関数の登録
 * resolve 時には関数の戻り値を返す
 */
export type FactoryEntry<F extends AnyFunction = AnyFunction> =
  InstanceEntryOptions & {
    /**
     * ファクトリー関数
     */
    factory: F;
  };

/**
 * 値の登録
 * resolve 時には値をそのまま（clone: true の場合はコピーを）返す
 */
export type ValueEntry<V = unknown> = {
  /**
   * 値
   */
  value: V;

  /**
   * resolve の度に値のディープコピーを返す
   * 未指定の場合は登録した値をそのまま返す
   */
  clone?: boolean;

  /**
   * タグ
   */
  tags?: readonly string[];
};

/**
 * 登録内容の1件
 *
 * - クラス: そのまま渡す。オプションを指定する場合は { class }
 * - ファクトリー関数: { factory }
 * - 値: { value }
 */
export type RegistryEntry<Base = unknown> =
  | (new (...args: never) => Base)
  | ClassEntry<new (...args: never) => Base>
  | FactoryEntry<(...args: never) => Base>
  | ValueEntry<Base>;

/**
 * 登録内容（キーと登録内容の1件のオブジェクト）
 *
 * Base を指定すると、取得されるものが Base を満たすことを確認できる
 *
 * @example
 * const entries = {
 *   required: Required,
 *   maxLength: { class: MaxLength, tags: ['length'] },
 * } satisfies RegistryEntries<Validator>;
 */
export type RegistryEntries<Base = unknown> = Record<
  string,
  RegistryEntry<Base>
>;

/**
 * レジストリーの登録内容の型
 *
 * @example
 * type ValidatorSpec = ResolveSpec<RegistryEntriesOf<typeof validators>>;
 */
export type RegistryEntriesOf<R> =
  R extends TypedRegistry<infer E, infer _Base> ? E : never;

/**
 * 登録内容から取得可能なキー
 */
export type RegistryKey<E> = keyof E & string;

/**
 * 登録内容の1件から、登録したもの（クラス・関数・値）の型
 */
type RawOf<X> = X extends AnyClass
  ? X
  : X extends { class: infer C }
    ? C
    : X extends { factory: infer F }
      ? F
      : X extends { value: infer V }
        ? V
        : never;

/**
 * 登録内容の1件から、取得されるものの型
 */
type OutputOf<X> = X extends new (...args: never) => infer I
  ? I
  : X extends { class: new (...args: never) => infer I }
    ? I
    : X extends { factory: (...args: never) => infer R }
      ? R
      : X extends { value: infer V }
        ? V
        : never;

/**
 * 登録内容の1件から、resolve に渡す引数の型
 */
type ArgsOf<X> = X extends new (...args: infer A) => unknown
  ? A
  : X extends { class: new (...args: infer A) => unknown }
    ? A
    : X extends { factory: (...args: infer A) => unknown }
      ? A
      : [];

/**
 * キーに対応する、登録したもの（クラス・関数・値）の型
 */
export type RegistryRaw<E, K extends keyof E = keyof E> = RawOf<E[K]>;

/**
 * 登録内容から取得されるものの型（全てのキーの union）
 */
export type RegistryValue<E> = OutputOf<E[keyof E]>;

/**
 * resolve の戻り値
 *
 * - クラス: インスタンス
 * - ファクトリー関数: 関数の戻り値
 * - 値: 値そのもの
 *
 * Base を満たさないものは never になる
 */
export type Resolved<Base, E, K extends keyof E> =
  // キーが union の場合はキー毎に解決する
  K extends unknown ? AsBase<Base, OutputOf<E[K]>> : never;

/**
 * Base を満たすものだけを残す
 * E がジェネリックな場合も、戻り値を Base として扱えるようにする
 */
type AsBase<Base, T> = T extends Base ? T : never;

/**
 * resolve に渡す引数
 *
 * - クラス: コンストラクターの引数
 * - ファクトリー関数: 関数の引数
 * - 値: なし
 */
export type ResolveArgs<E, K extends keyof E> = ArgsOf<E[K]>;

/**
 * 取得処理のオプション
 */
export type ResolveOptions<Args extends unknown[] = unknown[]> = {
  /**
   * コンストラクターまたは関数の引数
   */
  args?: Args;
};

/**
 * resolve の options 部分の引数
 *
 * - 必須の引数がある場合は options と args を必須にする
 * - キーが union の場合は、どのキーも必須の引数を持たない場合だけ受け付ける。
 *   実行時のキーに合う args を型で保証できないため。必須の引数を持つキーを含む場合は resolveSpec を使う
 */
export type ResolveRestArgs<E, K extends keyof E> =
  IsUnion<K> extends true
    ? true extends HasRequiredArgs<E, K>
      ? [options: never]
      : [options?: ResolveOptions<ResolveArgs<E, K>>]
    : HasRequiredArgs<E, K> extends true
      ? [options: Required<ResolveOptions<ResolveArgs<E, K>>>]
      : [options?: ResolveOptions<ResolveArgs<E, K>>];

/**
 * キーに対応するものが必須の引数を持つか
 * キーが union の場合はキー毎に判定する
 */
type HasRequiredArgs<E, K extends keyof E> = K extends unknown
  ? [] extends ResolveArgs<E, K>
    ? false
    : true
  : never;

/**
 * resolveSpec に渡す、キーと引数の組
 *
 * キー毎の組の union になるため、設定等から組み立てたものをそのまま渡せる。
 * 必須の引数がある場合は args が必須になる。
 *
 * @example
 * // { key: 'required'; args?: [] } | { key: 'maxLength'; args: [max: number] }
 * type ValidatorSpec = ResolveSpec<typeof entries>;
 */
export type ResolveSpec<E> = {
  [K in RegistryKey<E>]: [] extends ResolveArgs<E, K>
    ? { key: K; args?: ResolveArgs<E, K> }
    : { key: K; args: ResolveArgs<E, K> };
}[RegistryKey<E>];
