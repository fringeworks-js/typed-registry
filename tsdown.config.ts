import createExternalOptionFunction from '@fringeworks/dev/createExternalOptionFunction';
import distPackage from '@fringeworks/rollup-plugin-dist-package';
import copy from 'rollup-plugin-copy';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.test-d.{ts,tsx}',
    '!src/**/*.d.{ts,tsx}',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  unbundle: true,
  sourcemap: false,
  clean: true,
  outDir: 'dist',
  minify: false,
  inputOptions: {
    external: createExternalOptionFunction(),
  },
  outputOptions: {
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  plugins: [
    distPackage({
      content: {
        main: './index.cjs',
        module: './index.mjs',
        exports: {
          '.': {
            import: './index.mjs',
            require: './index.cjs',
          },
          './TypedRegistry': {
            import: './TypedRegistry/index.mjs',
            require: './TypedRegistry/index.cjs',
          },
          './types': {
            import: './types.mjs',
            require: './types.cjs',
          },
        },
      },
      resolveWorkspaceDeps: true,
      range: '^',
    }),
    copy({
      targets: [
        {
          src: ['LICENSE', 'README.md', 'README.ja.md'],
          dest: 'dist',
        },
      ],
    }),
  ],
});
