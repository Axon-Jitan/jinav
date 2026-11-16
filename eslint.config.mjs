import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import imports from "eslint-plugin-import-x";
export default ts.config(
  { ignores: ["dist/**", "out/**", "node_modules/**", "resources/**"] },
  ...ts.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks, "import-x": imports },
    settings: { "import-x/resolver": { typescript: true } },
    rules: {
      ...hooks.configs.recommended.rules,
      "import-x/no-cycle": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": "error",
    },
  },
);
