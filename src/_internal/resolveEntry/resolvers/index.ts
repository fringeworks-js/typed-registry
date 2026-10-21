import type { ResolverFunction, ResolverType } from '../../types';
import resolveAsClone from './resolveAsClone';
import resolveAsFactory from './resolveAsFactory';
import resolveAsInstance from './resolveAsInstance';
import resolveAsReference from './resolveAsReference';

/**
 * 種別ごとの解決関数
 */
const resolvers: Readonly<Record<ResolverType, ResolverFunction>> = {
  instance: resolveAsInstance,
  factory: resolveAsFactory,
  reference: resolveAsReference,
  clone: resolveAsClone,
};

export default resolvers;
