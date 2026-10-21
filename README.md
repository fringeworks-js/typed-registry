# @fringeworks/typed-registry

`@fringeworks/typed-registry` is a library some will find handy, for managing classes that share the same interface in a type-safe registry.
Library authors provide their implementations under keys, and library users can use them by key without knowing the individual classes — and can add their own implementations in a child registry.

**[日本語のREADMEはこちら](./README.ja.md)**

## Features

- **Resolve by key**: Obtain an instance by key without importing the individual class.
- **Type inference**: Keys, return types and constructor arguments are inferred from the entries. No type definitions are needed.
- **Child registries**: Add or replace entries in a child registry that inherits the parent's entries, without affecting the parent.
- **Immutable**: Entries are passed on creation and cannot be changed afterwards.
- **Classes, factories and values**: Register classes, factory functions or values under the same set of keys.

## Installation

```sh
npm install @fringeworks/typed-registry
```

## Usage

The examples below use a validation library as an example.

### Creating a registry

Pass the entries to the constructor.

```ts
import { TypedRegistry } from '@fringeworks/typed-registry';

export const validators = new TypedRegistry({
  required: Required,
  maxLength: MaxLength,
});
```

### Resolving

Keys, return types and `args` are typed according to the entries.

```ts
validators.resolve('required'); // Required
validators.resolve('maxLength', { args: [10] }); // MaxLength

validators.resolve('requierd'); // Type error: unknown key
validators.resolve('maxLength'); // Type error: args is required
validators.resolve('maxLength', { args: ['10'] }); // Type error: args type mismatch
```

### Extending

`extend` creates a child registry with additional entries.

```ts
const myValidators = validators.extend({ zipCode: ZipCode });

myValidators.resolve('zipCode'); // ZipCode
myValidators.resolve('required'); // Required (inherited from the parent)
```

## Entries

Each entry is one of the following.

| Entry                              | `resolve` returns                        |
| ---------------------------------- | ---------------------------------------- |
| `SomeClass`                        | A new instance (`args` → constructor)    |
| `{ class: SomeClass, ...options }` | Same as above, with options              |
| `{ factory: fn, ...options }`      | The return value (`args` → the function) |
| `{ value: v, ...options }`         | The value itself (or a deep copy)        |

```ts
const validators = new TypedRegistry({
  required: Required,
  maxLength: { class: MaxLength, tags: ['length'] },
  pattern: { factory: (re: RegExp) => new Pattern(re) },
  notEmpty: { value: { validate: (value: unknown) => value !== '' } },
});

validators.resolve('pattern', { args: [/^\d+$/] }); // Pattern
```

A plain function is treated as a class. Register a factory function with `{ factory }` (otherwise it is a type error).
The parameters of a factory function need type annotations, since there is nothing else to infer them from.

### Options

`{ class }` / `{ factory }`

| Option       | Type                | Description                                                                                         |
| ------------ | ------------------- | --------------------------------------------------------------------------------------------------- |
| `tags?`      | `readonly string[]` | Tags used by `resolveByTag` / `getRawByTag`                                                         |
| `singleton?` | `boolean`           | Return the first resolved value every time. `args` passed to the second and later calls are ignored |

`{ value }`

| Option   | Type                | Description                                                          |
| -------- | ------------------- | -------------------------------------------------------------------- |
| `tags?`  | `readonly string[]` | Tags used by `resolveByTag` / `getRawByTag`                          |
| `clone?` | `boolean`           | Return a deep copy each time. By default the value is returned as is |

`clone: true` makes deep copies with [klona](https://github.com/lukeed/klona) (`klona/full`), with the following limitations.

- A class instance is copied with its prototype and own properties. `#private` fields are not copied, so calling a method that uses them throws a `TypeError`
- Functions are not copied; the same function is referenced

## Child registries

- The child can use everything in the parent. Since registries are immutable, the parent never changes.
- An entry with an existing key replaces it only in the child.The child registry does not inherit `Base`. A child registry created with `extend` inside a function that receives a registry cannot be used as `Base`. Extend the registry on the user side before passing it.
- `has` / `keys` / `resolveByTag` include the parent's entries.
- An entry with `singleton: true` in the parent returns the same instance in the parent and the children.

## For library authors

### Constraining entries to an interface

Entries are not constrained by default. To check that all built-in entries satisfy the common interface, use `satisfies RegistryEntries<Base>`.

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

### Receiving a registry

How to provide the features built on the registry (functions, classes, builders, etc.) is up to you.
When your code receives a registry, specify the common interface as the second type argument of `TypedRegistry`, so that resolved values can be used as that interface.
To accept the users' child registries, make the receiving side generic over the entries.

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

`ResolveSpec<E>` is the union of `{ key, args }` pairs for each key, and `resolveSpec` accepts it as is.
Settings are type checked according to the registry passed.

```ts
const validate = createValidate(validators.extend({ zipCode: ZipCode }));

validate({ zip: [{ key: 'required' }, { key: 'zipCode' }] }, data);
validate({ name: [{ key: 'maxLength' }] }, data); // Type error: args is required
```

A registry containing something that does not satisfy the interface is a type error where it is passed.

If users are not expected to extend the registry, you can receive it with the concrete type (`typeof validators`).

> **Note**: A default value for a generic parameter (`registry: TypedRegistry<E, Validator> = validators`) is a type error in TypeScript. Use overloads instead.

### Settings without types

For settings without types such as JSON, check the key with `has` and give the type yourself.

```ts
if (validators.has(json.key)) {
  validators.resolveSpec(
    json as ResolveSpec<RegistryEntriesOf<typeof validators>>,
  );
}
```

### Bundle size

A registry resolves entries by string keys, so bundlers cannot remove unused entries from a registry.
To let users bundle only what they use, export the entries individually and let users create the registry.

```ts
// my-validation/entries
export const required = { required: Required };
export const maxLength = { maxLength: MaxLength };

// User
import { maxLength, required } from 'my-validation/entries';
const validators = new TypedRegistry({ ...required, ...maxLength });
```

When also providing a preset registry with all entries, put it in a separate module, or add `/*#__PURE__*/` to `new TypedRegistry(...)`.

## API

### `TypedRegistry<E, Base>`

| Method                           | Description                                                      |
| -------------------------------- | ---------------------------------------------------------------- |
| `constructor(entries, options?)` | Creates a registry with the entries                              |
| `resolve(key, options?)`         | Returns the instance / value for the key                         |
| `resolveSpec(spec)`              | Returns the instance / value for a pair of the key and `args`    |
| `resolveByTag(tag, options?)`    | Returns the instances / values for all entries with the tag      |
| `has(key)`                       | Returns whether the key is registered                            |
| `keys()`                         | Returns all registered keys                                      |
| `getRaw(key)`                    | Returns the registered class / function / value as is            |
| `getRawByTag(tag)`               | Returns the registered classes / functions / values with the tag |
| `extend(entries, options?)`      | Creates a child registry with added or replaced entries          |

| Property | Type                  | Description        |
| -------- | --------------------- | ------------------ |
| `id`     | `string \| undefined` | ID of the registry |

#### `constructor`

```ts
constructor(entries: E, options?: TypedRegistryOptions)
```

Creates a registry with the entries. The entries cannot be changed after creation.\
Throws if an entry is invalid (it has none or more than one of `class` / `factory` / `value`).

| Parameter  | Type                   | Description       |
| ---------- | ---------------------- | ----------------- |
| `entries`  | `E`                    | Entries           |
| `options?` | `TypedRegistryOptions` | The options below |

| Option | Type     | Description                                       |
| ------ | -------- | ------------------------------------------------- |
| `id?`  | `string` | ID of the registry. Included in the error message |

#### `resolve`

```ts
resolve<K extends RegistryKey<E>>(
  key: K,
  ...[options]: ResolveRestArgs<E, K>
): Resolved<Base, E, K>
```

Returns the instance / value for the key. Throws if the key is not registered.\
If there are required arguments, `options` and `args` cannot be omitted.\
A union of keys is accepted only when none of the keys has required arguments, since the types cannot guarantee that `args` matches the key at runtime. Use `resolveSpec` when the union includes a key with required arguments.

| Parameter  | Type                   | Description       |
| ---------- | ---------------------- | ----------------- |
| `key`      | `K`                    | Key               |
| `options?` | `ResolveOptions<Args>` | The options below |

| Option  | Type   | Description                                                                   |
| ------- | ------ | ----------------------------------------------------------------------------- |
| `args?` | `Args` | Arguments for the constructor or the factory function. Not allowed for values |

#### `resolveSpec`

```ts
resolveSpec<S extends ResolveSpec<E>>(spec: S): Resolved<Base, E, S['key']>
```

Returns the instance / value for a pair of the key and `args` (`{ key, args }`). Throws if the key is not registered.\
Use it to pass a key and arguments built from settings as they are.

#### `resolveByTag`

```ts
resolveByTag(tag: string, options?: ResolveOptions): Base[]
```

Returns the instances / values for all entries with the tag, in registration order. The same `args` is passed to all entries.

#### `has`

```ts
has(key: string): key is RegistryKey<E>
```

Returns whether the key is registered. When `true`, `key` is narrowed to the key type of the registry.

#### `keys`

```ts
keys(): RegistryKey<E>[]
```

Returns all registered keys in registration order.

#### `getRaw`

```ts
getRaw<K extends RegistryKey<E>>(key: K): RegistryRaw<E, K>
```

Returns the registered class / function / value as is. Throws if the key is not registered.

#### `getRawByTag`

```ts
getRawByTag(tag: string): RegistryRaw<E>[]
```

Returns the registered classes / functions / values with the tag as is, in registration order.

#### `extend`

```ts
extend<E2 extends RegistryEntries>(
  entries: E2,
  options?: TypedRegistryOptions,
): TypedRegistry<Merge<E, E2>>
```

Creates a child registry that inherits the parent's entries and adds the given entries. An entry with an existing key replaces it only in the child.

| Parameter  | Type                   | Description                                                 |
| ---------- | ---------------------- | ----------------------------------------------------------- |
| `entries`  | `E2`                   | Entries to add or replace                                   |
| `options?` | `TypedRegistryOptions` | Same options as the constructor (independent of the parent) |

### Types

| Type                    | Description                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| `RegistryEntries<Base>` | Entries. Use it as the constraint of `E`, or with `satisfies` to check entries |
| `RegistryEntry<Base>`   | A single entry                                                                 |
| `ClassEntry<C>`         | A class entry (`{ class }`)                                                    |
| `FactoryEntry<F>`       | A factory function entry (`{ factory }`)                                       |
| `ValueEntry<V>`         | A value entry (`{ value }`)                                                    |
| `RegistryEntriesOf<R>`  | Entries of a registry                                                          |
| `ResolveSpec<E>`        | Union of `{ key, args }` pairs for each key                                    |
| `RegistryKey<E>`        | Keys                                                                           |
| `ResolveArgs<E, K>`     | `args` for the key                                                             |
| `ResolveOptions<Args>`  | Options of `resolve` / `resolveByTag`                                          |
| `ResolveRestArgs<E, K>` | The `options` part of the parameters of `resolve`                              |
| `Resolved<Base, E, K>`  | Return type of `resolve` for the key                                           |
| `RegistryRaw<E, K>`     | Registered class / function / value for the key                                |
| `RegistryValue<E>`      | Union of all resolved values                                                   |
| `TypedRegistryOptions`  | Options of the constructor and `extend`                                        |

Specify `Base` of `TypedRegistry<E, Base>` to use resolved values as `Base` (see "[Receiving a registry](#receiving-a-registry)").

## License

MIT
