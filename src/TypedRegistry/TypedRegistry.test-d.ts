import type { RegistryEntries, RegistryEntriesOf, ResolveSpec } from '../types';
import TypedRegistry from './TypedRegistry';

interface Validator {
  validate(value: unknown): boolean;
}

declare class Required implements Validator {
  validate(value: unknown): boolean;
}

declare class MaxLength implements Validator {
  max: number;
  constructor(max: number, message?: string);
  validate(value: unknown): boolean;
}

declare class ZipCode implements Validator {
  validate(value: unknown): boolean;
}

declare class NotAValidator {
  foo(): void;
}

/**
 * ライブラリ作成者が提供するレジストリー
 */
const validators = new TypedRegistry({
  required: Required,
  maxLength: { class: MaxLength, tags: ['length'] },
  pattern: {
    factory: (re: RegExp): Validator => ({
      validate: (value) => re.test(String(value)),
    }),
  },
  notEmpty: { value: { validate: (value: unknown) => value !== '' } },
});

describe('登録内容からの推論', () => {
  test('キー', () => {
    expectTypeOf(validators.keys()).toEqualTypeOf<
      ('required' | 'maxLength' | 'pattern' | 'notEmpty')[]
    >();
    // @ts-expect-error タイプミス
    validators.resolve('requierd');
  });

  test('resolve はキーに対応する型を返す', () => {
    expectTypeOf(validators.resolve('required')).toEqualTypeOf<Required>();
    expectTypeOf(
      validators.resolve('maxLength', { args: [10] }),
    ).toEqualTypeOf<MaxLength>();
    expectTypeOf(
      validators.resolve('pattern', { args: [/a/] }),
    ).toEqualTypeOf<Validator>();
    expectTypeOf(validators.resolve('notEmpty')).toEqualTypeOf<{
      validate: (value: unknown) => boolean;
    }>();
  });

  test('resolve の args', () => {
    validators.resolve('maxLength', { args: [10, 'too long'] });
    // @ts-expect-error 引数の型違い
    validators.resolve('maxLength', { args: ['10'] });
    // @ts-expect-error 必須の引数がある場合は options を省略できない
    validators.resolve('maxLength');
    // @ts-expect-error 必須の引数がある場合は args を省略できない
    validators.resolve('maxLength', {});
    // @ts-expect-error 値に args は渡せない
    validators.resolve('notEmpty', { args: [1] });
  });

  test('resolve のキーが union の場合は、どのキーも必須の引数を持たない場合だけ受け付ける', () => {
    const safeKey = 'required' as 'required' | 'notEmpty';
    expectTypeOf(validators.resolve(safeKey)).toEqualTypeOf<
      Required | { validate: (value: unknown) => boolean }
    >();

    const unsafeKey = 'required' as 'required' | 'maxLength';
    // @ts-expect-error 必須の引数を持つキーを含む
    validators.resolve(unsafeKey);
    // @ts-expect-error 実行時のキーに合う args を保証できない
    validators.resolve(unsafeKey, { args: [] });
  });

  test('getRaw は登録したものの型を返す', () => {
    expectTypeOf(validators.getRaw('required')).toEqualTypeOf<
      typeof Required
    >();
    expectTypeOf(validators.getRaw('maxLength')).toEqualTypeOf<
      typeof MaxLength
    >();
    expectTypeOf(validators.getRaw('pattern')).toEqualTypeOf<
      (re: RegExp) => Validator
    >();
  });

  test('resolveByTag は全ての取得されるものの union を返す', () => {
    expectTypeOf(validators.resolveByTag('length')).toEqualTypeOf<
      (
        Required | MaxLength | Validator | { validate: (v: unknown) => boolean }
      )[]
    >();
  });

  test('has で絞り込める', () => {
    const key: string = 'required';
    if (validators.has(key)) {
      expectTypeOf(key).toEqualTypeOf<
        'required' | 'maxLength' | 'pattern' | 'notEmpty'
      >();
    }
  });
});

describe('登録内容の書き方', () => {
  test('ファクトリー関数は { factory } で登録する', () => {
    // @ts-expect-error 素の関数はクラスとして扱うため登録できない
    new TypedRegistry({ fn: () => new Required() });
  });

  test('値は関数でもよい', () => {
    type ValidateFn = (value: unknown) => boolean;
    const fns = new TypedRegistry({
      isString: { value: ((v) => typeof v === 'string') as ValidateFn },
    });
    expectTypeOf(fns.resolve('isString')).toEqualTypeOf<ValidateFn>();
  });

  test('satisfies で Base を満たすことを確認できる', () => {
    new TypedRegistry({
      required: Required,
      maxLength: { class: MaxLength },
    } satisfies RegistryEntries<Validator>);

    new TypedRegistry({
      // @ts-expect-error Validator を満たさない
      bad: NotAValidator,
    } satisfies RegistryEntries<Validator>);
  });

  test('tags には readonly の配列を渡せる', () => {
    const tags = ['basic'] as const;
    new TypedRegistry({ required: { class: Required, tags } });
  });

  test('登録内容は省略できない', () => {
    // @ts-expect-error 登録内容は必須
    new TypedRegistry();
  });

  test('型引数に Base を指定して登録内容を渡すことはできない', () => {
    // @ts-expect-error 型引数の1つ目は登録内容
    new TypedRegistry<Validator>({ required: Required });
  });
});

describe('extend', () => {
  const mine = validators.extend({ zipCode: ZipCode });

  test('親のキーと追加したキーを持つ', () => {
    expectTypeOf(mine.keys()).toEqualTypeOf<
      ('required' | 'maxLength' | 'pattern' | 'notEmpty' | 'zipCode')[]
    >();
    expectTypeOf(mine.resolve('zipCode')).toEqualTypeOf<ZipCode>();
    expectTypeOf(
      mine.resolve('maxLength', { args: [1] }),
    ).toEqualTypeOf<MaxLength>();
    // @ts-expect-error 親には追加したキーが無い
    validators.resolve('zipCode');
  });

  test('既存のキーの型を差し替えられる', () => {
    const replaced = validators.extend({ required: ZipCode });
    expectTypeOf(replaced.resolve('required')).toEqualTypeOf<ZipCode>();
  });
});

describe('レジストリーを受け取る仕組み（ライブラリ作成者）', () => {
  type Schema<E> = Record<string, ResolveSpec<E>[]>;

  /**
   * 登録内容についてジェネリックにし、Base を指定して受け取る
   */
  const createValidate =
    <E extends RegistryEntries>(registry: TypedRegistry<E, Validator>) =>
    (schema: Schema<E>, data: Record<string, unknown>): boolean =>
      Object.entries(schema).every(([field, specs]) =>
        specs.every((spec) =>
          // E がジェネリックでも戻り値は Validator として扱える
          registry.resolveSpec(spec).validate(data[field]),
        ),
      );

  test('作成者のレジストリーを渡せる', () => {
    const validate = createValidate(validators);
    validate({ name: [{ key: 'maxLength', args: [10] }] }, {});
    // @ts-expect-error 必須の args の省略
    validate({ name: [{ key: 'maxLength' }] }, {});
    // @ts-expect-error args の型違い
    validate({ name: [{ key: 'maxLength', args: ['10'] }] }, {});
    // @ts-expect-error 存在しないキー
    validate({ name: [{ key: 'zipCode' }] }, {});
  });

  test('利用者の子レジストリーを渡せる', () => {
    const validate = createValidate(validators.extend({ zipCode: ZipCode }));
    validate(
      {
        zip: [{ key: 'required' }, { key: 'zipCode' }],
        name: [{ key: 'maxLength', args: [10] }],
      },
      {},
    );
  });

  test('Base を満たさないものを含むレジストリーは渡せない', () => {
    const bad = validators.extend({ bad: NotAValidator });
    // @ts-expect-error Validator を満たさない
    createValidate(bad);
  });

  test('具体的な型で受け取る場合（拡張を想定しない場合）', () => {
    const validate = (registry: typeof validators, value: unknown) =>
      registry.resolve('required').validate(value);
    validate(validators, '');
  });

  test('ResolveSpec はキー毎の組の union', () => {
    expectTypeOf<
      ResolveSpec<{ required: typeof Required; maxLength: typeof MaxLength }>
    >().toEqualTypeOf<
      | { key: 'required'; args?: [] }
      | { key: 'maxLength'; args: [max: number, message?: string] }
    >();
  });

  test('resolveSpec の戻り値はキーに対応する型', () => {
    expectTypeOf(
      validators.resolveSpec({ key: 'maxLength', args: [1] }),
    ).toEqualTypeOf<MaxLength>();
  });

  test('型の無い設定は has で確認してから型を与える', () => {
    const json: { key: string; args?: unknown[] } = { key: 'required' };
    if (validators.has(json.key)) {
      validators.resolveSpec(
        json as ResolveSpec<RegistryEntriesOf<typeof validators>>,
      );
    }
  });
});
