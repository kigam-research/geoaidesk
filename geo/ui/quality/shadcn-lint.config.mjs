// shadcn lint (@shadcn/lint, MIT) mapped onto UI guide v2 rules (docs/design/ui-guide.md; ids in geo/ui/ui-rules.json
// quality.shadcnLint.guide). Run by geo/ui/quality/run.mjs from web/ so web/components.json, the @/ aliases and the
// Tailwind theme in web/src/app/globals.css are discovered. Report-only until the switch rule in ui-rules.json is met.
import { plugin as shadcn } from "@shadcn/lint"
import tsParser from "@typescript-eslint/parser"

const note = "UI guide v2: docs/design/ui-guide.md (rule ids in geo/ui/ui-rules.json quality.shadcnLint.guide)."

export default [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { shadcn },
    settings: { shadcn: { note } },
    rules: {
      // V1, S1: colours come from role tokens, never palette utilities or raw values.
      "shadcn/no-raw-colors": "warn",
      // T1, L5, V1: type sizes, spacing and colours on the scale; pane and measure sizes (layout: L2, L6) are exempt.
      "shadcn/no-arbitrary-values": ["warn", { allow: ["layout"] }],
      // V1: inline styles bypass the tokens (data palettes are listed debt).
      "shadcn/no-inline-styles": "warn",
      // B2, S7: a component owns its size, shape and states; pages place it (layout) only.
      "shadcn/no-restyle": ["warn", { allow: ["layout"] }],
      // S1: classes the theme cannot generate (undeclared tokens, typos).
      "shadcn/no-unknown-classes": "warn",
    },
  },
]
