import { CONSTANTS, PRIVATE, TEST_FILE } from '@fringeworks/dev/constants';
import generateIndexFiles from '@fringeworks/dev/generateIndexFiles';

generateIndexFiles({
  exclude: [
    CONSTANTS,
    PRIVATE,
    TEST_FILE,
    {
      valueType: 'dirname',
      conditions: 'Resolver',
    },
    {
      valueType: 'dirname',
      conditions: 'resolvers',
    },
    {
      valueType: 'name',
      conditions: 'Resolver',
    },
    {
      valueType: 'dirname',
      conditions: 'Store',
    },
    {
      valueType: 'name',
      conditions: 'Store',
    },
  ],
});
