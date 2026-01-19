import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: ["dist/**", "node_modules/**"]
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.jquery, // Adding jquery just in case
            },
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off",
            "no-undef": "off", // Legacy frontend often uses globals
            "no-case-declarations": "off",
            "no-empty": "warn"
        },
    },
];
