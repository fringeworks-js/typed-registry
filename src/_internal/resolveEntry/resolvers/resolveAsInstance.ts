import type { ResolveOptions } from '../../../types';
import type { StoreEntry } from '../../types';

/**
 * クラスからインスタンスを生成して返す
 * @param entry
 * @param options
 * @returns
 */
export default function resolveAsInstance(
  entry: StoreEntry,
  options: ResolveOptions,
): unknown {
  const args = options.args || [];
  return new (entry.raw as new (...args: unknown[]) => unknown)(...args);
}
