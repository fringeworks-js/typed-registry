# @fringeworks/typed-registry

`@fringeworks/typed-registry` は 同じインターフェイスを持つクラスを型安全なレジストリーで纏めて管理するための、誰かにとっては便利なライブラリです。
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

| オプション  | 型         | 説明                                                                                 |
| ----------- | ---------- | ------------------------------------------------------------------------------------ |
| `tags`      | `string[]` | `resolveByTag` / `getRawByTag` で使用するタグ                                        |
| `singleton` | `boolean`  | 初回に返したものを返し続ける。2回目以降の `resolve` で渡された `args` は使用されない |

`{ value }`

| オプション | 型         | 説明                                                                 |
| ---------- | ---------- | -------------------------------------------------------------------- |
| `tags`     | `string[]` | `resolveByTag` / `getRawByTag` で使用するタグ                        |
| `clone`    | `boolean`  | `resolve` の度にディープコピーを返す。未指定の場合は値をそのまま返す |

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

### コンストラクター

`new TypedRegistry(entries, options?)`

| オプション | 型       | 説明                                          |
| ---------- | -------- | --------------------------------------------- |
| `id`       | `string` | レジストリーの ID。例外のメッセージに含まれる |

### メンバー

| メンバー                      | 説明                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `resolve(key, options?)`      | キーに対応するインスタンス・値を返す。登録されていないキーの場合は例外を投げる           |
| `resolveSpec({ key, args })`  | キーと `args` を組で渡す `resolve`                                                       |
| `resolveByTag(tag, options?)` | タグを持つ全てのエントリーのインスタンス・値を返す。全てのエントリーに同じ `args` を渡す |
| `has(key)`                    | キーが登録されているかを返す                                                             |
| `keys()`                      | 登録されている全てのキーを返す                                                           |
| `getRaw(key)`                 | 登録したクラス・関数・値をそのまま返す。登録されていないキーの場合は例外を投げる         |
| `getRawByTag(tag)`            | タグを持つ登録したクラス・関数・値をそのまま返す                                         |
| `extend(entries, options?)`   | 登録内容を追加した子レジストリーを作成する                                               |
| `id`                          | レジストリーの ID                                                                        |

## 型

| 型                       | 説明                                                                |
| ------------------------ | ------------------------------------------------------------------- |
| `TypedRegistry<E, Base>` | レジストリー。`Base` を指定すると取得したものを `Base` として扱える |
| `RegistryEntries<Base>`  | 登録内容。`E` の制約や、`satisfies` での確認に使う                  |
| `RegistryEntriesOf<R>`   | レジストリーの登録内容                                              |
| `ResolveSpec<E>`         | キー毎の `{ key, args }` の組の union                               |
| `RegistryKey<E>`         | キー                                                                |
| `ResolveArgs<E, K>`      | キーに対応する `args`                                               |
| `Resolved<Base, E, K>`   | キーに対応する `resolve` の戻り値                                   |
| `RegistryRaw<E, K>`      | キーに対応する、登録したクラス・関数・値                            |
| `RegistryValue<E>`       | 取得される全てのものの union                                        |
| `TypedRegistryOptions`   | コンストラクターと `extend` のオプション                            |

## ライセンス

MIT
