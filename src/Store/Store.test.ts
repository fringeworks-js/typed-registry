import type { SetOptional } from 'type-fest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ResolverType, StoreEntry } from '../_types';
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

  // --- constructor ---

  describe('constructor', () => {
    it('初期状態でエントリーが空である', () => {
      expect(store.getEntries()).toHaveLength(0);
    });
  });

  // --- set / get ---

  describe('set / get', () => {
    it('登録したエントリーをkeyで取得できる', () => {
      const entry = makeEntry({ key: 'a', value: 'hello', tags: ['x'] });
      store.set(entry);
      expect(store.get('a')).toEqual({ ...entry, tags: ['x'] });
    });

    it('tagsを省略した場合、空配列として保存される', () => {
      store.set(makeEntry({ key: 'b', value: 'world' }));
      expect(store.get('b')?.tags).toEqual([]);
    });

    it('singletonフラグが保持される', () => {
      store.set(makeEntry({ key: 'c', singleton: true }));
      expect(store.get('c')?.singleton).toBe(true);
    });

    it('valueが未設定のエントリーを登録できる', () => {
      store.set(makeEntry({ key: 'd' }));
      expect(store.get('d')).toBeDefined();
      expect(store.get('d')?.value).toBeUndefined();
    });

    it('同じkeyで上書き登録できる', () => {
      store.set(makeEntry({ key: 'e', value: 'first' }));
      store.set(makeEntry({ key: 'e', value: 'second', tags: ['updated'] }));
      expect(store.get('e')?.value).toBe('second');
      expect(store.get('e')?.tags).toEqual(['updated']);
    });

    it('存在しないkeyはundefinedを返す', () => {
      expect(store.get('nonexistent')).toBeUndefined();
    });
  });

  // --- has ---

  describe('has', () => {
    it('登録済みのkeyはtrueを返す', () => {
      store.set(makeEntry({ key: 'f' }));
      expect(store.has('f')).toBe(true);
    });

    it('未登録のkeyはfalseを返す', () => {
      expect(store.has('missing')).toBe(false);
    });
  });

  // --- getEntries ---

  describe('getEntries', () => {
    it('登録した全エントリーを返す', () => {
      store.set(makeEntry({ key: 'g1' }));
      store.set(makeEntry({ key: 'g2' }));
      expect(store.getEntries()).toHaveLength(2);
    });

    it('返り値の配列を操作しても内部状態に影響しない', () => {
      store.set(makeEntry({ key: 'g3' }));
      store.getEntries().pop();
      expect(store.getEntries()).toHaveLength(1);
    });
  });

  // --- getByTag ---

  describe('getByTag', () => {
    beforeEach(() => {
      store.set(makeEntry({ key: 'h1', tags: ['alpha', 'beta'] }));
      store.set(makeEntry({ key: 'h2', tags: ['beta'] }));
      store.set(makeEntry({ key: 'h3', tags: ['gamma'] }));
    });

    it('指定タグを持つエントリーのみ返す', () => {
      const result = store.getByTag('beta');
      expect(result).toHaveLength(2);
      expect(result.map((e) => e.key)).toEqual(
        expect.arrayContaining(['h1', 'h2']),
      );
    });

    it('一致するエントリーがなければ空配列を返す', () => {
      expect(store.getByTag('nonexistent')).toEqual([]);
    });

    it('単一タグのエントリーを正しく絞り込む', () => {
      const result = store.getByTag('gamma');
      expect(result).toHaveLength(1);
      expect(result[0]?.key).toBe('h3');
    });

    it('tagsが空配列のエントリーはいずれのタグ検索にもヒットしない', () => {
      store.set(makeEntry({ key: 'h4', tags: [] }));
      expect(store.getByTag('alpha').map((e) => e.key)).not.toContain('h4');
    });
  });
});
