import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// for things like indention and K&R braces we would need the plugin prettier
const eslintConfig = defineConfig([
  ...nextVitals, // this is for the nextjs core web vitals
  ...nextTs, // this is for the nextjs typescript
  {
    files: ["src/app/testeslint.tsx"],
    languageOptions: { // necessary for typescript
      parserOptions: {
        projectService: true, // this is for telling typescript to use the tsconfig.json
        tsconfigRootDir: import.meta.dirname, // this is the root directory of the tsconfig.json
      },
    },
    rules: {
      semi: "error", // Semicolons are mandatory
      "@typescript-eslint/no-unused-vars": "error", // Unused variables are forbidden
      "@typescript-eslint/no-explicit-any": "error", // Any is forbidden
      "@typescript-eslint/explicit-function-return-type": "error", // Explicit return types are mandatory
      "eqeqeq": ["error", "always"], // Enforce strict equality
      "no-console": ["warn", { allow: ["warn", "error"] }], // Warn on console.log
      "@typescript-eslint/await-thenable": "error", // Await only Promise
      "@typescript-eslint/no-floating-promises": "error", // Handle all Promises
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variableLike",
          format: ["camelCase"],
        },
        {
          selector: "function",
          format: ["camelCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
        },
        // Classes, React components, Types 
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "interface",
          format: ["PascalCase"],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
