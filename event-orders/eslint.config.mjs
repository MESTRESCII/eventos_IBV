import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disables ESLint rules that conflict with Prettier — must come last.
  eslintConfigPrettier,
  // Override default ignores of eslint-config-next.
  // ".open-next/**" é saída de build (bundle do Cloudflare Workers), não código-fonte:
  // sem ignorá-la, `npm run lint` reporta centenas de erros de código gerado.
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
]);

export default eslintConfig;
