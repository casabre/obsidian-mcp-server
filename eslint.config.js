import tseslint from "typescript-eslint";

export default tseslint.config(
  // Generated output, deps and tool artifacts are never linted.
  { ignores: ["build/**", "coverage/**", "node_modules/**", ".codegraph/**"] },
  {
    files: ["src/**/*.ts"],
    extends: [...tseslint.configs.recommended],
    rules: {
      // The MCP SDK's tool/handler generics force `any` at a few boundaries;
      // keep it visible as a warning rather than failing the build.
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow intentionally unused args/vars/caught errors prefixed with `_`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  }
);
