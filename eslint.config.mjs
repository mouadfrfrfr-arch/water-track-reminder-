import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import localRules from "./tools/eslint-rules/no-empty-handler.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { local: localRules },
    rules: {
      "local/no-empty-handler": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tools/**",
    "playwright-report/**",
    "test-results/**",
    // Android Capacitor scaffold — Gradle-built assets and the
    // bridge JS are not our source.
    "android/**",
  ]),
]);

export default eslintConfig;
