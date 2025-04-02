import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/demo.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'node14',
    bundle: true,
    esbuildOptions(options) {
        options.supported = {
            // 启用 import 和 require 的互操作性
            'dynamic-import': true,
            'import-meta': true,
        };
    },
});