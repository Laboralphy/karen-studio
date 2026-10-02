import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import vue from '@vitejs/plugin-vue';

const alias = {
    '@fairy': resolve(__dirname, 'src/engine'),
    '@fairy-core': resolve(__dirname, 'src/core'),
    '@runtime': resolve(__dirname, 'src/runtime'),
    '@project': resolve(__dirname, 'src/project'),
    '@blocks': resolve(__dirname, 'src/blocks'),
    '@renderer': resolve(__dirname, 'src/renderer/src'),
};

export default defineConfig({
    main: {},
    preload: {},
    renderer: {
        resolve: { alias },
        plugins: [vue()],
    },
});
