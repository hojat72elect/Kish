import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: ["node_modules/**", "dist/**", "coverage/**"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-shadow": "error",
            "@typescript-eslint/only-throw-error": "error",
            "@typescript-eslint/no-unused-vars": ["error", {argsIgnorePattern: "^_"}],
            "@typescript-eslint/no-empty-object-type": ["error", {allowInterfaces: "always"}],
        },
    },
];
