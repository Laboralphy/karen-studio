import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier/flat';

export default tseslint.config(
    { ignores: ['out/**', 'dist/**', 'node_modules/**'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.vue'],
        languageOptions: { parserOptions: { parser: tseslint.parser } },
    },
    {
        rules: {
            // Inutile avec TypeScript, qui vérifie déjà les identifiants (DOM, Node…).
            'no-undef': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    // La mise en forme relève de Prettier : on coupe les règles de style qui le contredisent.
    prettier,
    {
        // Les tests utilisent des scripts sans pause (générateurs sans yield) volontairement.
        files: ['tests/**/*.ts'],
        rules: { 'require-yield': 'off' },
    }
);
