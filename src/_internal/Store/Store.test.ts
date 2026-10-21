import type { SetOptional } from 'type-fest';
import type { ResolverType, StoreEntry } from '../types';
import Store from './Store';

// テスト用のダミー値
const mockRaw = {};
const mockType: ResolverType = 'reference';

const makeEntry = (
  overrides: Partial<StoreEntry> & { key: string },
): SetOptional<StoreEntry, 'tags'> => ({
  raw: mockRaw,
  type: mockType,
  ...overrides,
});

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  describe('constructor', () => {
    test('初期状態でエントリーが空である', () => {
      expect(store.getEntries()).toHaveLength(0);
    });
  });

  describe('set / get', () => {
    test('登録したエントリーをkeyで取得できる', () => {
      const entry = makeEntry({ key: 'a', value: 'hello', tags: ['x'] });
      store.set(entry);
      expect(store.get('a')).toEqual({ ...entry, tags: ['x'] });
    });

    test('tagsを省略した場合、空配列として保存される', () => {
      store.set(makeEntry({ key: 'b', value: 'world' }));
      expect(store.get('b')?.tags).toEqual([]);
    });

    test('singletonフラグが保持される', () => {
      store.set(makeEntry({ key: 'c', singleton: true }));
      expect(store.get('c')?.singleton).toBe(true);
    });

    test('valueが未設定のエントリーを登録できる', () => {
      store.set(makeEntry({ key: 'd' }));
      expect(store.get('d')).toBeDefined();
      expect(store.get('d')?.value).toBeUndefined();
    });

    test('同じkeyで上書き登録できる', () => {
      store.set(makeEntry({ key: 'e', value: 'first' }));
      store.set(makeEntry({ key: 'e', value: 'second', tags: ['updated'] }));
      expect(store.get('e')?.value).toBe('second');
      expect(store.get('e')?.tags).toEqual(['updated']);
    });

    test('存在しないkeyはundefinedを返す', () => {
      expect(store.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has', () => {
    test('登録済みのkeyはtrueを返す', () => {
      store.set(makeEntry({ key: 'f' }));
      expect(store.has('f')).toBe(true);
    });

    test('未登録のkeyはfalseを返す', () => {
      expect(store.has('missing')).toBe(false);
    });
  });

  describe('getEntries', () => {
    test('登録した全エントリーを返す', () => {
      store.set(makeEntry({ key: 'g1' }));
      store.set(makeEntry({ key: 'g2' }));
      expect(store.getEntries()).toHaveLength(2);
    });

    test('返り値の配列を操作しても内部状態に影響しない', () => {
      store.set(makeEntry({ key: 'g3' }));
      store.getEntries().pop();
      expect(store.getEntries()).toHaveLength(1);
    });
  });

  describe('getByTag', () => {
    beforeEach(() => {
      store.set(makeEntry({ key: 'h1', tags: ['alpha', 'beta'] }));
      store.set(makeEntry({ key: 'h2', tags: ['beta'] }));
      store.set(makeEntry({ key: 'h3', tags: ['gamma'] }));
    });

    test('指定タグを持つエントリーのみ返す', () => {
      const result = store.getByTag('beta');
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.key)).toEqual(
        expect.arrayContaining(['h1', 'h2']),
      );
    });

    test('一致するエントリーがなければ空配列を返す', () => {
      expect(store.getByTag('nonexistent')).toEqual([]);
    });

    test('単一タグのエントリーを正しく絞り込む', () => {
      const result = store.getByTag('gamma');
      expect(result).toHaveLength(1);
      expect(result[0]?.key).toBe('h3');
    });

    test('tagsが空配列のエントリーはいずれのタグ検索にもヒットしない', () => {
      store.set(makeEntry({ key: 'h4', tags: [] }));
      expect(store.getByTag('alpha').map((e) => e.key)).not.toContain('h4');
    });
  });

  describe('親の Store', () => {
    let parent: Store;

    beforeEach(() => {
      parent = new Store();
      parent.set(makeEntry({ key: 'p1', tags: ['alpha'] }));
      parent.set(makeEntry({ key: 'p2', tags: ['alpha'] }));
    });

    test('作成時点の親のエントリーを引き継ぐ', () => {
      const child = new Store(parent);
      expect(child.has('p1')).toBe(true);
      expect(child.get('p1')).toBe(parent.get('p1'));
      expect(child.getEntries().map((e) => e.key)).toEqual(['p1', 'p2']);
    });

    test('子で登録したものは親に影響しない', () => {
      const child = new Store(parent);
      child.set(makeEntry({ key: 'c1' }));
      expect(child.has('c1')).toBe(true);
      expect(parent.has('c1')).toBe(false);
    });

    test('親と同じキーは子の中でのみ置き換わり、キーの順序を保つ', () => {
      const child = new Store(parent);
      child.set(makeEntry({ key: 'p1', tags: [] }));
      expect(child.getEntries().map((e) => e.key)).toEqual(['p1', 'p2']);
      expect(child.getByTag('alpha').map((e) => e.key)).toEqual(['p2']);
      expect(parent.getByTag('alpha').map((e) => e.key)).toEqual(['p1', 'p2']);
    });
  });
});
