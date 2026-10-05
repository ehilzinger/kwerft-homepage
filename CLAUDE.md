# kwerft.dev — notes for Claude

Marketing site and docs for Kwerft. The product lives in the sibling repo
`../werft` (private); it is the source of truth for every claim here — check
`install/install.sh --help`, `docs/plan.md` and `web/src/pages` before writing
about a feature, and mark anything not in the latest stable release.

- Branding mirrors the console: tokens in `src/styles/tokens.css` (keep in sync
  with werft), fonts self-hosted via @fontsource.
- CSP is `'self'` only (`netlify.toml`): no inline `<script>` or `style=""`
  attributes; Astro bundles component scripts into files.
- Screenshots: `tools/screenshots` builds the real console against a mock API
  (`mock/fixtures.mjs`); demo data must stay fictional (example.com,
  documentation IP ranges, made-up people).
- Release facts (`LATEST`, install URL) live in `src/site.ts`.
