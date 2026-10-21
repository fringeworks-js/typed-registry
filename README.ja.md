# @fringeworks/typed-registry

`@fringeworks/typed-registry` は、同じインターフェイスを持つクラスを型安全なレジストリーで纏めて管理するための、誰かにとっては便利なライブラリです。
ライブラリの作成者が実装をキーで提供すれば、ライブラリの利用者は個々のクラスを知らなくてもキーで利用でき、さらに子レジストリーに独自の実装を追加することもできます。

**[English README is available here](./README.md)**

## 特徴

- **キーで取得**: 個々のクラスを import しなくても、キーでインスタンスを取得できます。
- **型推論**: キー・戻り値の型・コンストラクター引数の型が登録内容から推論されます。型定義を書く必要はありません。
- **子レジストリー**: 親の登録内容を引き継いだ子レジストリーで、親に影響を与えずに追加・差し替えができます。
- **イミュータブル**: 登録内容は作成時に渡し、作成後は変更できません。
- **クラス・ファクトリー関数・値**: クラス、ファクトリー関数、値を同じキーの集まりの中に登録できます。

## インストール

```sh
npm install @fringeworks/typed-registry
```

## 使い方

以下ではバリデーションライブラリを例にします。

### レジストリーの作成

コンストラクターに登録内容を渡します。

```ts
import { TypedRegistry } from '@fringeworks/typed-registry';

export const validators = new TypedRegistry({
  required: Required,
  maxLength: MaxLength,
});
```

### 取得

キー・戻り値・`args` には登録内容に応じた型が付きます。

```ts
validators.resolve('required'); // Required
validators.resolve('maxLength', { args: [10] }); // MaxLength

validators.resolve('requierd'); // 型エラー: 存在しないキー
validators.resolve('maxLength'); // 型エラー: args が必須
validators.resolve('maxLength', { args: ['10'] }); // 型エラー: args の型違い
```

### 拡張

`extend` で登録内容を追加した子レジストリーを作成します。

```ts
const myValidators = validators.extend({ zipCode: ZipCode });

myValidators.resolve('zipCode'); // ZipCode
myValidators.resolve('required'); // Required（親から引き継ぐ）
```

## 登録内容

登録内容の1件は以下のいずれかです。

| 登録内容                           | `resolve` が返すもの                            |
| ---------------------------------- | ----------------------------------------------- |
| `SomeClass`                        | 新しいインスタンス（`args` → コンストラクター） |
| `{ class: SomeClass, ...options }` | 同上（オプションを指定する場合）                |
| `{ factory: fn, ...options }`      | 関数の戻り値（`args` → 関数）                   |
| `{ value: v, ...options }`         | 値そのもの（またはディープコピー）              |

```ts
const validators = new TypedRegistry({
  required: Required,
  maxLength: { class: MaxLength, tags: ['length'] },
  pattern: { factory: (re: RegExp) => new Pattern(re) },
  notEmpty: { value: { validate: (value: unknown) => value !== '' } },
});

validators.resolve('pattern', { args: [/^\d+$/] }); // Pattern
```

素の関数はクラスとして扱います。ファクトリー関数は `{ factory }` で登録してください（そうでない場合は型エラーになります）。
ファクトリー関数の引数には型注釈が必要です（推論の元になるものが無いため）。

### オプション

`{ class }` / `{ factory }`

| オプション   | 型                  | 説明                                                                                 |
| ------------ | ------------------- | ------------------------------------------------------------------------------------ |
| `tags?`      | `readonly string[]` | `resolveByTag` / `getRawByTag` で使用するタグ                                        |
| `singleton?` | `boolean`           | 初回に返したものを返し続ける。2回目以降の `resolve` で渡された `args` は使用されない |

`{ value }`

| オプション | 型                  | 説明                                                                 |
| ---------- | ------------------- | -------------------------------------------------------------------- |
| `tags?`    | `readonly string[]` | `resolveByTag` / `getRawByTag` で使用するタグ                        |
| `clone?`   | `boolean`           | `resolve` の度にディープコピーを返す。未指定の場合は値をそのまま返す |

`clone: true` のディープコピーには [klona](https://github.com/lukeed/klona)（`klona/full`）を使います。次の制約があります。

- クラスのインスタンスは、プロトタイプと自身のプロパティをコピーします。`#private` のフィールドはコピーされないため、それを使うメソッドを呼ぶと `TypeError` になります
- 関数はコピーせず、同じものを参照します

## 子レジストリー

- 子からは親の登録内容を全て利用できます。レジストリーはイミュータブルなので、親が変わることはありません。
- 既存のキーを渡すと、子の中でのみ差し替わります。
- `has` / `keys` / `resolveByTag` は親の登録内容も含みます。
- 親で `singleton: true` として登録したものは、親と子で同じインスタンスを返します。

## ライブラリの作成者向け

### 登録内容をインターフェイスで制約する

登録内容はデフォルトでは制約されません。組み込みの登録内容が全て共通のインターフェイスを満たすことを確認したい場合は `satisfies RegistryEntries<Base>` を使います。

```ts
import {
  TypedRegistry,
  type RegistryEntries,
} from '@fringeworks/typed-registry';

export const validators = new TypedRegistry({
  required: Required,
  maxLength: MaxLength,
} satisfies RegistryEntries<Validator>);
```

### レジストリーを受け取る

レジストリーを使った機能（関数・クラス・ビルダー等）をどのように提供するかは自由です。
レジストリーを受け取る場合は、`TypedRegistry` の2つ目の型引数に共通のインターフェイスを指定すると、取得したものをそのインターフェイスとして扱えます。
利用者の子レジストリーを受け取れるよう、受け取る側は登録内容についてジェネリックにします。

```ts
import type {
  RegistryEntries,
  ResolveSpec,
  TypedRegistry,
} from '@fringeworks/typed-registry';

export type Schema<E> = Record<string, ResolveSpec<E>[]>;

export function createValidate<E extends RegistryEntries>(
  registry: TypedRegistry<E, Validator>,
) {
  return (schema: Schema<E>, data: Record<string, unknown>) =>
    Object.entries(schema).every(([field, specs]) =>
      specs.every((spec) => registry.resolveSpec(spec).validate(data[field])),
    );
}
```

`ResolveSpec<E>` はキー毎の `{ key, args }` の組の union で、そのまま `resolveSpec` に渡せます。
設定は渡されたレジストリーに応じて型チェックされます。

```ts
const validate = createValidate(validators.extend({ zipCode: ZipCode }));

validate({ zip: [{ key: 'required' }, { key: 'zipCode' }] }, data);
validate({ name: [{ key: 'maxLength' }] }, data); // 型エラー: args が必須
```

インターフェイスを満たさないものを含むレジストリーは、渡した箇所で型エラーになります。

利用者による拡張を想定しない場合は、具体的な型（`typeof validators`）で受け取っても構いません。

> **注意**: ジェネリックな引数に既定値を指定する（`registry: TypedRegistry<E, Validator> = validators`）と TypeScript の制約で型エラーになります。オーバーロードで書き分けてください。

### 型の無い設定

JSON 等の型の無い設定は、`has` でキーを確認してから型を与えてください。

```ts
if (validators.has(json.key)) {
  validators.resolveSpec(
    json as ResolveSpec<RegistryEntriesOf<typeof validators>>,
  );
}
```

### バンドルサイズ

レジストリーは文字列のキーで取得するため、バンドラーは使われていない登録内容をレジストリーから取り除けません。
利用者が使うものだけをバンドルできるようにするには、登録内容を個別に export し、利用者にレジストリーを作成してもらいます。

```ts
// my-validation/entries
export const required = { required: Required };
export const maxLength = { maxLength: MaxLength };

// 利用者
import { maxLength, required } from 'my-validation/entries';
const validators = new TypedRegistry({ ...required, ...maxLength });
```

全ての登録内容を含むプリセットのレジストリーも提供する場合は、別のモジュールに分けるか、`new TypedRegistry(...)` に `/*#__PURE__*/` を付けてください。

## API

### `TypedRegistry<E, Base>`

| メソッド                         | 説明                                               |
| -------------------------------- | -------------------------------------------------- |
| `constructor(entries, options?)` | 登録内容を渡してレジストリーを作成する             |
| `resolve(key, options?)`         | キーに対応するインスタンス・値を返す               |
| `resolveSpec(spec)`              | キーと `args` の組に対応するインスタンス・値を返す |
| `resolveByTag(tag, options?)`    | タグを持つ全てのエントリーのインスタンス・値を返す |
| `has(key)`                       | キーが登録されているかを返す                       |
| `keys()`                         | 登録されている全てのキーを返す                     |
| `getRaw(key)`                    | 登録したクラス・関数・値をそのまま返す             |
| `getRawByTag(tag)`               | タグを持つ登録したクラス・関数・値をそのまま返す   |
| `extend(entries, options?)`      | 登録内容を追加・差し替えた子レジストリーを作成する |

| プロパティ | 型                    | 説明              |
| ---------- | --------------------- | ----------------- |
| `id`       | `string \| undefined` | レジストリーの ID |

#### `constructor`

```ts
constructor(entries: E, options?: TypedRegistryOptions)
```

登録内容を渡してレジストリーを作成します。登録内容は作成後に変更できません。\
登録内容が不正な場合（種別を表す `class` / `factory` / `value` が無い、または複数ある場合）は例外を投げます。

| 引数       | 型                     | 説明             |
| ---------- | ---------------------- | ---------------- |
| `entries`  | `E`                    | 登録内容         |
| `options?` | `TypedRegistryOptions` | 下記のオプション |

| オプション | 型       | 説明                                          |
| ---------- | -------- | --------------------------------------------- |
| `id?`      | `string` | レジストリーの ID。例外のメッセージに含まれる |

#### `resolve`

```ts
resolve<K extends RegistryKey<E>>(
  key: K,
  ...[options]: ResolveRestArgs<E, K>
): Resolved<Base, E, K>
```

キーに対応するインスタンス・値を返します。登録されていないキーの場合は例外を投げます。\
必須の引数がある場合は、`options` と `args` を省略できません。\
キーが union の場合は、どのキーも必須の引数を持たない場合だけ受け付けます。実行時のキーに合う `args` を型で保証できないためです。必須の引数を持つキーを含む場合は `resolveSpec` を使ってください。

| 引数       | 型                     | 説明             |
| ---------- | ---------------------- | ---------------- |
| `key`      | `K`                    | キー             |
| `options?` | `ResolveOptions<Args>` | 下記のオプション |

| オプション | 型     | 説明                                                         |
| ---------- | ------ | ------------------------------------------------------------ |
| `args?`    | `Args` | コンストラクターまたはファクトリー関数の引数。値には渡せない |

#### `resolveSpec`

```ts
resolveSpec<S extends ResolveSpec<E>>(spec: S): Resolved<Base, E, S['key']>
```

キーと `args` の組（`{ key, args }`）に対応するインスタンス・値を返します。登録されていないキーの場合は例外を投げます。\
設定などから組み立てたキーと引数をそのまま渡す場合に使います。

#### `resolveByTag`

```ts
resolveByTag(tag: string, options?: ResolveOptions): Base[]
```

タグを持つ全てのエントリーのインスタンス・値を、登録順に返します。全てのエントリーに同じ `args` を渡します。

#### `has`

```ts
has(key: string): key is RegistryKey<E>
```

キーが登録されているかを返します。`true` の場合、`key` はレジストリーのキーの型に絞り込まれます。

#### `keys`

```ts
keys(): RegistryKey<E>[]
```

登録されている全てのキーを、登録順に返します。

#### `getRaw`

```ts
getRaw<K extends RegistryKey<E>>(key: K): RegistryRaw<E, K>
```

登録したクラス・関数・値をそのまま返します。登録されていないキーの場合は例外を投げます。

#### `getRawByTag`

```ts
getRawByTag(tag: string): RegistryRaw<E>[]
```

タグを持つ登録したクラス・関数・値を、登録順にそのまま返します。

#### `extend`

```ts
extend<E2 extends RegistryEntries>(
  entries: E2,
  options?: TypedRegistryOptions,
): TypedRegistry<Merge<E, E2>>
```

親の登録内容を引き継ぎ、渡した登録内容を追加した子レジストリーを作成します。親と同じキーを渡した場合は、子の中でのみ差し替わります。子レジストリーは `Base` を引き継ぎません。レジストリーを受け取る関数の中で `extend` した子レジストリーは、`Base` として扱えません。拡張は、レジストリーを渡す前に利用者側で行ってください。

| 引数       | 型                     | 説明                                         |
| ---------- | ---------------------- | -------------------------------------------- |
| `entries`  | `E2`                   | 追加・差し替える登録内容                     |
| `options?` | `TypedRegistryOptions` | コンストラクターと同じオプション（親とは別） |

### 型

| 型                      | 説明                                               |
| ----------------------- | -------------------------------------------------- |
| `RegistryEntries<Base>` | 登録内容。`E` の制約や、`satisfies` での確認に使う |
| `RegistryEntry<Base>`   | 登録内容の1件                                      |
| `ClassEntry<C>`         | クラスの登録（`{ class }`）                        |
| `FactoryEntry<F>`       | ファクトリー関数の登録（`{ factory }`）            |
| `ValueEntry<V>`         | 値の登録（`{ value }`）                            |
| `RegistryEntriesOf<R>`  | レジストリーの登録内容                             |
| `ResolveSpec<E>`        | キー毎の `{ key, args }` の組の union              |
| `RegistryKey<E>`        | キー                                               |
| `ResolveArgs<E, K>`     | キーに対応する `args`                              |
| `ResolveOptions<Args>`  | `resolve` / `resolveByTag` のオプション            |
| `ResolveRestArgs<E, K>` | `resolve` の `options` 部分の引数                  |
| `Resolved<Base, E, K>`  | キーに対応する `resolve` の戻り値                  |
| `RegistryRaw<E, K>`     | キーに対応する、登録したクラス・関数・値           |
| `RegistryValue<E>`      | 取得される全てのものの union                       |
| `TypedRegistryOptions`  | コンストラクターと `extend` のオプション           |

`TypedRegistry<E, Base>` の `Base` を指定すると、取得したものを `Base` として扱えます（「[レジストリーを受け取る](#レジストリーを受け取る)」を参照）。

## ライセンス

MIT
