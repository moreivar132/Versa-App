const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    {
        ignores: ["node_modules/**", "coverage/**", "legacy/**"]
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },
        rules: {
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^(next|_)$", "varsIgnorePattern": "^_" }],
            "no-console": "off",
            "no-useless-escape": "off",
            "no-case-declarations": "off",
            "no-prototype-builtins": "off"
        },
    },
];
