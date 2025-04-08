import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/demo.ts', 'src/main.ts', 'src/runner.ts', 'src/worker.ts', 'src/cli.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    target: 'node14',
    shims: true,
    cjsInterop: true,
    esbuildOptions(options) {
        options.mainFields = ['module', 'main'];
    },
});