import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/demo.ts', 'src/tester.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'node14'
});