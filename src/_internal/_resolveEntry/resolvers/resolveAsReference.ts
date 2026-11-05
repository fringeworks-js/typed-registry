import type { StoreEntry } from '../../_types';

/**
 * 値をそのまま返す
 * @param entry
 * @returns
 */
export default function resolveAsReference(entry: StoreEntry): unknown {
  return entry.raw;
}
