import type { ResolveOptions } from '../../../types';
import type { StoreEntry } from '../../_types';

/**
 * 関数の戻り値を返す
 * @param entry
 * @param options
 * @returns
 */
export default function resolveAsFactory(
  entry: StoreEntry,
  options: ResolveOptions,
): unknown {
  const args = options.args || [];
  return (entry.raw as (...args: unknown[]) => unknown)(...args);
}
