import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@fairy': resolve(__dirname, 'src/engine'),
            '@fairy-core': resolve(__dirname, 'src/core'),
            '@runtime': resolve(__dirname, 'src/runtime'),
            '@project': resolve(__dirname, 'src/project'),
            '@blocks': resolve(__dirname, 'src/blocks'),
        },
    },
    test: {
        environment: 'happy-dom',
        include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    },
});
