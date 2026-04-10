import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      ".venv/**",
      "data/**",
      "frontend/**",
      "raw_data/**",
      "scripts/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        maplibregl: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }]
    }
  }
];
