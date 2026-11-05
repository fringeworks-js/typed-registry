import type { ResolveOptions } from '../../types';
import type { StoreEntry } from '../_types';
import resolvers from './resolvers';

/**
 * エントリーを解決する
 *
 * singleton のエントリーは、初回に解決したものをエントリーに保持して返し続ける
 * @param entry
 * @param options
 * @returns
 */
export default function resolveEntry(
  entry: StoreEntry,
  options: ResolveOptions = {},
): unknown {
  if (entry.singleton && 'value' in entry) {
    return entry.value;
  }

  const value = resolvers[entry.type](entry, options);
  if (entry.singleton) {
    entry.value = value;
  }
  return value;
}
