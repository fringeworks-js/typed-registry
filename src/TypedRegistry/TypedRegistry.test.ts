import type { ResolveSpec } from '../types';
import TypedRegistry from './TypedRegistry';

interface Validator {
  validate(value: unknown): boolean;
}

class Required implements Validator {
  validate(value: unknown) {
    return value != null && value !== '';
  }
}

class MaxLength implements Validator {
  max: number;
  constructor(max: number) {
    this.max = max;
  }
  validate(value: unknown) {
    return String(value).length <= this.max;
  }
}

class Counter implements Validator {
  #count = 0;
  count() {
    return ++this.#count;
  }
  validate() {
    return true;
  }
}

describe('TypedRegistry', () => {
  describe('登録内容', () => {
    test('クラスを渡すとインスタンスを返す', () => {
      const registry = new TypedRegistry({ required: Required });

      expect(registry.getRaw('required')).toBe(Required);
      const result = registry.resolve('required');
      expect(result).toBeInstanceOf(Required);
      expect(result).not.toBe(registry.resolve('required'));
    });

    test('{ class }: args をコンストラクターに渡す', () => {
      const registry = new TypedRegistry({ maxLength: { class: MaxLength } });

      expect(registry.getRaw('maxLength')).toBe(MaxLength);
      const result = registry.resolve('maxLength', { args: [3] });
      expect(result.max).toBe(3);
      expect(result.validate('abcd')).toBe(false);
    });

    test('ES5 形式のクラス（function）も登録できる', () => {
      function Legacy(this: Validator) {
        this.validate = () => true;
      }
      const registry = new TypedRegistry({
        legacy: Legacy as unknown as new () => Validator,
      });

      const result = registry.resolve('legacy');
      expect(result).toBeInstanceOf(Legacy);
      expect(result.validate(1)).toBe(true);
    });

    test('{ factory }: 関数の戻り値を返す', () => {
      const factory = (re: RegExp): Validator => ({
        validate: (value) => re.test(String(value)),
      });
      const registry = new TypedRegistry({ pattern: { factory } });

      expect(registry.getRaw('pattern')).toBe(factory);
      const result = registry.resolve('pattern', { args: [/^\d+$/] });
      expect(result.validate('123')).toBe(true);
      expect(result.validate('abc')).toBe(false);
    });

    test('{ value }: 値をそのまま返す', () => {
      const counter = new Counter();
      const registry = new TypedRegistry({ counter: { value: counter } });

      expect(registry.getRaw('counter')).toBe(counter);
      const result = registry.resolve('counter');
      expect(result).toBe(counter);
      // #private フィールドを持つインスタンスも使える
      expect(result.count()).toBe(1);
    });

    test('{ value }: 関数も値として登録できる', () => {
      const fn = (value: unknown) => value != null;
      const registry = new TypedRegistry({ fn: { value: fn } });

      expect(registry.resolve('fn')).toBe(fn);
    });

    test('{ value, clone: true }: 値のディープコピーを返す', () => {
      const config = { validate: () => true, options: { max: 3 } };
      const registry = new TypedRegistry({
        config: { value: config, clone: true },
      });

      const result = registry.resolve('config');
      expect(result).not.toBe(config);
      expect(result.options).not.toBe(config.options);
      expect(result.options).toEqual(config.options);
    });

    test('{ value, clone: true }: #private フィールドはコピーされない', () => {
      const registry = new TypedRegistry({
        counter: { value: new Counter(), clone: true },
      });

      const result = registry.resolve('counter');
      expect(result).toBeInstanceOf(Counter);
      expect(() => result.count()).toThrow(TypeError);
    });

    test('singleton: 初回に生成したものを返し続ける', () => {
      const registry = new TypedRegistry({
        maxLength: { class: MaxLength, singleton: true },
        short: { factory: () => new MaxLength(5), singleton: true },
      });

      const result1 = registry.resolve('maxLength', { args: [1] });
      const result2 = registry.resolve('maxLength', { args: [2] });
      expect(result2).toBe(result1);
      expect(result2.max).toBe(1);
      expect(registry.resolve('short')).toBe(registry.resolve('short'));
    });

    test('不正な登録内容は例外を投げる', () => {
      expect(
        () =>
          new TypedRegistry({ bad: {} } as unknown as { bad: typeof Required }),
      ).toThrow(
        'Invalid entry for key "bad". Use a class, { class }, { factory } or { value }',
      );
    });

    test('種別を表すプロパティが複数ある登録内容は例外を投げる', () => {
      expect(
        () =>
          new TypedRegistry({
            bad: { class: Required, factory: () => new Required() },
          } as unknown as { bad: typeof Required }),
      ).toThrow(
        'Invalid entry for key "bad". Use only one of { class }, { factory }',
      );
    });

    test('登録後に元の tags の配列を書き換えても影響しない', () => {
      const tags = ['basic'];
      const registry = new TypedRegistry({
        required: { class: Required, tags },
      });

      tags.push('length');
      expect(registry.getRawByTag('length')).toEqual([]);
    });

    test('空の登録内容を渡すと空のレジストリーになる', () => {
      const registry = new TypedRegistry({});
      expect(registry.keys()).toEqual([]);
    });
  });

  describe('id', () => {
    test('options で指定した ID を返す', () => {
      const registry = new TypedRegistry({}, { id: 'validators' });
      expect(registry.id).toBe('validators');
    });
  });

  describe('has / keys', () => {
    test('登録の有無と全てのキーを返す', () => {
      const registry = new TypedRegistry({
        required: Required,
        short: { factory: () => new MaxLength(5) },
      });

      expect(registry.has('required')).toBe(true);
      expect(registry.has('unknown')).toBe(false);
      expect(registry.keys()).toEqual(['required', 'short']);
    });
  });

  describe('resolveSpec', () => {
    const registry = new TypedRegistry({
      required: Required,
      maxLength: MaxLength,
    });

    test('キーと引数の組で取得する', () => {
      expect(registry.resolveSpec({ key: 'required' })).toBeInstanceOf(
        Required,
      );
      expect(registry.resolveSpec({ key: 'maxLength', args: [3] }).max).toBe(3);
    });

    test('設定から組み立てた組の配列を纏めて解決できる', () => {
      const specs: ResolveSpec<{
        required: typeof Required;
        maxLength: typeof MaxLength;
      }>[] = [{ key: 'required' }, { key: 'maxLength', args: [3] }];

      const results = specs.map((spec) => registry.resolveSpec(spec));
      expect(results.map((v) => v.validate('abcd'))).toEqual([true, false]);
    });
  });

  describe('未登録のキー', () => {
    const registry = new TypedRegistry({ required: Required });
    const message = 'No entry registered for key "unknown"';

    test('resolve / resolveSpec / getRaw は例外を投げる', () => {
      expect(() => registry.resolve('unknown' as 'required')).toThrow(message);
      expect(() =>
        registry.resolveSpec({ key: 'unknown' as 'required' }),
      ).toThrow(message);
      expect(() => registry.getRaw('unknown' as 'required')).toThrow(message);
    });

    test('例外のメッセージに ID を含める', () => {
      const registry = new TypedRegistry({}, { id: 'validators' });
      expect(() => registry.getRaw('unknown' as never)).toThrow(
        `${message} in registry "validators"`,
      );
    });
  });

  describe('tags', () => {
    const registry = new TypedRegistry({
      required: { class: Required, tags: ['basic'] },
      maxLength: { class: MaxLength, tags: ['basic', 'length'] },
      short: { factory: () => new MaxLength(5), tags: ['length'] },
      counter: { value: new Counter() },
    });

    test('getRawByTag: タグを持つものをそのまま返す', () => {
      expect(registry.getRawByTag('basic')).toEqual([Required, MaxLength]);
      expect(registry.getRawByTag('none')).toEqual([]);
    });

    test('resolveByTag: タグを持つものを纏めて解決する', () => {
      const result = registry.resolveByTag('length', { args: [2] });
      expect(result).toHaveLength(2);
      expect((result[0] as MaxLength).max).toBe(2);
      expect((result[1] as MaxLength).max).toBe(5);
    });

    test('resolveByTag: singleton のものは resolve と同じものを返す', () => {
      const registry = new TypedRegistry({
        short: {
          factory: () => new MaxLength(5),
          tags: ['length'],
          singleton: true,
        },
      });

      expect(registry.resolveByTag('length')[0]).toBe(
        registry.resolve('short'),
      );
    });
  });

  describe('extend', () => {
    const createParent = () =>
      new TypedRegistry({
        required: { class: Required, tags: ['basic'] },
        maxLength: { class: MaxLength, tags: ['basic'] },
      });

    test('親の登録内容を引き継ぎ、渡した登録内容を追加する', () => {
      const parent = createParent();
      const child = parent.extend({
        short: { factory: () => new MaxLength(5) },
      });

      expect(child.resolve('required')).toBeInstanceOf(Required);
      expect(child.resolve('short').max).toBe(5);
      expect(child.keys()).toEqual(['required', 'maxLength', 'short']);
      expect(parent.has('short')).toBe(false);
    });

    test('親と同じキーは子の中でのみ差し替わる', () => {
      const parent = createParent();
      class MyRequired extends Required {}
      const child = parent.extend({ required: MyRequired });

      expect(child.resolve('required')).toBeInstanceOf(MyRequired);
      expect(parent.resolve('required')).not.toBeInstanceOf(MyRequired);
      // 差し替えたものはキーの順序を保つ
      expect(child.keys()).toEqual(['required', 'maxLength']);
    });

    test('子で差し替えたもののタグは子のものを使う', () => {
      const parent = createParent();
      const child = parent.extend({ required: Required });

      expect(child.getRawByTag('basic')).toEqual([MaxLength]);
      expect(parent.getRawByTag('basic')).toEqual([Required, MaxLength]);
    });

    test('孫レジストリーは親と祖父母の登録内容を引き継ぐ', () => {
      const grandchild = createParent()
        .extend({ short: { factory: () => new MaxLength(5) } })
        .extend({ counter: { value: new Counter() } });

      expect(grandchild.keys()).toEqual([
        'required',
        'maxLength',
        'short',
        'counter',
      ]);
    });

    test('親で singleton として登録したものは親子で共有する', () => {
      const parent = new TypedRegistry({
        short: { factory: () => new MaxLength(5), singleton: true },
      });
      const child = parent.extend({});

      expect(child.resolve('short')).toBe(parent.resolve('short'));
    });

    test('resolveByTag は親と子のものを纏めて解決する', () => {
      const parent = createParent();
      const child = parent.extend({
        short: { factory: () => new MaxLength(5), tags: ['basic'] },
      });

      expect(child.resolveByTag('basic', { args: [1] })).toHaveLength(3);
      expect(parent.resolveByTag('basic', { args: [1] })).toHaveLength(2);
    });

    test('options を指定できる', () => {
      const child = createParent().extend({}, { id: 'child' });
      expect(child.id).toBe('child');
    });
  });
});
