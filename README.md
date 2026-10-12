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

| Option      | Type       | Description                                                                                         |
| ----------- | ---------- | --------------------------------------------------------------------------------------------------- |
| `tags`      | `string[]` | Tags used by `resolveByTag` / `getRawByTag`                                                         |
| `singleton` | `boolean`  | Return the first resolved value every time. `args` passed to the second and later calls are ignored |

`{ value }`

| Option  | Type       | Description                                                          |
| ------- | ---------- | -------------------------------------------------------------------- |
| `tags`  | `string[]` | Tags used by `resolveByTag` / `getRawByTag`                          |
| `clone` | `boolean`  | Return a deep copy each time. By default the value is returned as is |

## Child registries

- The child can use everything in the parent. Since registries are immutable, the parent never changes.
- An entry with an existing key replaces it only in the child.
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

### Constructor

`new TypedRegistry(entries, options?)`

| Option | Type     | Description                                       |
| ------ | -------- | ------------------------------------------------- |
| `id`   | `string` | ID of the registry. Included in the error message |

### Members

| Member                        | Description                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `resolve(key, options?)`      | Returns the instance / value for the key. Throws if the key is not registered                 |
| `resolveSpec({ key, args })`  | Same as `resolve`, with the key and `args` as a pair                                          |
| `resolveByTag(tag, options?)` | Returns the instances / values for all entries with the tag. The same `args` is passed to all |
| `has(key)`                    | Returns whether the key is registered                                                         |
| `keys()`                      | Returns all registered keys                                                                   |
| `getRaw(key)`                 | Returns the registered class / function / value as is. Throws if the key is not registered    |
| `getRawByTag(tag)`            | Returns the registered classes / functions / values with the tag as is                        |
| `extend(entries, options?)`   | Creates a child registry with additional entries                                              |
| `id`                          | ID of the registry                                                                            |

## Types

| Type                     | Description                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ |
| `TypedRegistry<E, Base>` | The registry. Specify `Base` to use resolved values as `Base`                  |
| `RegistryEntries<Base>`  | Entries. Use it as the constraint of `E`, or with `satisfies` to check entries |
| `RegistryEntriesOf<R>`   | Entries of a registry                                                          |
| `ResolveSpec<E>`         | Union of `{ key, args }` pairs for each key                                    |
| `RegistryKey<E>`         | Keys                                                                           |
| `ResolveArgs<E, K>`      | `args` for the key                                                             |
| `Resolved<Base, E, K>`   | Return type of `resolve` for the key                                           |
| `RegistryRaw<E, K>`      | Registered class / function / value for the key                                |
| `RegistryValue<E>`       | Union of all resolved values                                                   |
| `TypedRegistryOptions`   | Options of the constructor and `extend`                                        |

## License

MIT
