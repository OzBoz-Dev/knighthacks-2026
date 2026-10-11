<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## solGPU frontend — current draft

### Scope and product status

- This directory is the Next.js frontend. The product requirements are in `../prd.md`; its `/web` references correspond to this existing `frontend-digi/` directory.
- The current draft is an interactive, fixture-backed Explore dashboard, not a live GPU marketplace. Do not describe the entire PRD as implemented.
- Keep exactly three product routes: Explore (`/`), Match (`/match`), and My Reservations (`/reservations`). Match and My Reservations still contain implementation placeholders.
- The Phantom control opens a preview explanation only. It does not connect a wallet, request a signature, reserve hardware, or transfer money. The sidebar devnet panel is an environment label, not an RPC health indicator.
- Live inventory/Databricks integration, the full PRD offers table, selected-GPU benchmark cards and p10–p90 trend band, matching, and on-chain receipt workflows remain future work.

### Commands and verification

Run commands from `frontend-digi/` using npm and the existing `package-lock.json`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with honest unavailable-data states unless fixtures are explicitly enabled |
| `NEXT_PUBLIC_USE_DEV_FIXTURES=1 npm run dev` | Start the populated interactive sample dashboard |
| `npm run dev -- -p 3100` | Use an alternate local port when needed |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Next route types, then run TypeScript without emitting |
| `npm test` | Run pure TypeScript unit tests with Vitest |
| `npm run test:watch` | Watch unit tests |
| `npm run build` | Verify a production build |
| `npm run start` | Serve an existing production build |

- Use command exit statuses directly; do not hide failures with output-filtering pipelines.
- Verification for the compact dashboard draft: lint, typecheck, and 43 tests passed. A production build was declined for this layout and has not been run; earlier Databricks-style builds passed before these layout changes. HTTP smoke checks and browser visual review are still pending. Key theme color pairs were contrast-checked previously (text 15.8:1, secondary 7.6:1, white on filled Lava 5.0:1, Lava text on panels 5.2:1, amber 7.5:1).
- Browser interaction, responsive layout, chart rendering, keyboard focus, and hydration require a real browser check; server-rendered HTML checks do not establish visual correctness.
- The current audit reports five high-severity findings in the existing ESLint dependency chain (`braces` → `micromatch` → `fast-glob` → Next ESLint). Do not run `npm audit fix --force`, downgrade Next.js, or weaken install-script/security controls to suppress them.

### UI and architecture

- Prefer Mantine primitives, not custom replacements for controls, navigation, drawers, or modals. Current dependencies are Mantine core/hooks/charts 9.6.3, Recharts 3.10.1, and Tabler React icons 3.48.0. Keep Mantine package versions aligned.
- Visual direction is a **Databricks-inspired dark theme** (inspiration only — no Databricks logo or implied affiliation): neutral charcoal canvas `#1B1D1F`, sidebar `#141618`, panels `#232629`, elevated `#2C3034`, rules `#3A3F44`, Oat Light text `#F9F7F4`, secondary `#B4B8BC`, 2–6px radii. Accent is Databricks **Lava** (Mantine color `lava`, primary): `lava.5` = `#FF3621` for non-text accents (active-nav edge, sidebar square mark, focus ring, chart line, region bars, card top rule on hover). Filled buttons use `lava.6` `#D42C1B` with white text (white on `#FF3621` fails contrast). Lava *text* (subtle buttons, links) uses `lava.4` `#FF6352` via the overridden `--mantine-color-lava-light-color`; `#FF3621` text on panels is only ~4.2:1.
- Typography: DM Sans (`--font-dm-sans`) and DM Mono (`--font-dm-mono`, weights 400/500 only — never set `fw={600}` on monospace text). The compact Explore preview uses ~24px headline, ~13px model titles, ~23px mono prices, ~11–12px compact metadata; do not reduce text with transforms or hide important values. Match/Reservations retain their larger headings. Numbers use DM Mono and the global `.tabular` class.
- A slim illustrative world map and generic GPU illustration intentionally appear in Explore under the approved compact layout. Both are local `public/illustrations/` SVGs in charcoal/Lava; they are not live coverage or real GPU product photos. Avoid gradients/glows on cards and avoid implying the map contains host data.
- Lava/red is brand-only. Price changes: decreases `green.4`, increases amber `var(--dg-up)` (`#F5A524`), always with arrows and signed text. Keep Alerts neutral gray unless they are real errors. Custom CSS uses `--dg-surface`, `--dg-elevated`, `--dg-rule`, `--dg-accent`, `--dg-up` from `theme.ts`.
- `palette.ts` contains server-safe raw colors. `theme.ts` constructs the Mantine theme; do not import its client-dependent theme construction into server layouts.
- `app/layout.tsx` stays a Server Component for fonts, metadata, and dark HTML setup. `app/providers.tsx` supplies the client Mantine provider. Preserve matching forced-dark settings to avoid flashes/hydration differences.
- `components/layout/app-shell.tsx` owns the shared left sidebar, URL-based active links, narrow-width navigation control, and one main-content landmark. Preserve the skip link and accessible navigation.
- `app/page.tsx` loads gated fixtures on the server and passes serializable data to `components/explore/explore-dashboard.tsx`. Explore owns its toolbar and local filter/expansion/drawer state; do not put this state in the shared shell.
- `components/explore/` page order: one-row toolbar (flexible search plus a right-aligned index and secondary Phantom preview button) → slim `MarketHeading` map banner (source and illustrative 24-hour window clearly marked) → one-row compact filters and sort → four initial "Featured hardware" offer cards → full-width bottom expand/collapse bar → four equal "Market overview" cards (history, region, availability, changes) → offer-record Drawer. `explore.module.css` has a named `explore` inline-size container: four columns when the content pane is wide enough (~760px), two/one below that. Mantine handles controls and `Collapse` uses `expanded`, `keepMounted={false}`, and reduced-motion awareness.
- GPU cards use a small generic thumbnail plus provider, model, per-GPU VRAM/count, region, whole-offer hourly quote, verified-host/reliability text and a Details action. Full specs remain in the "Offer record" Drawer; it must not imitate a reservation receipt or verification result.
- `components/shared/` contains reusable loading/empty/error states, provenance badges, and timestamps. The older `components/development/sample-market-preview.tsx` is no longer used by Explore.
- Mantine compound components such as `Table.Thead` and `AppShell.Navbar` require a client boundary. For a component without polymorphic link props, use its `renderRoot` API rather than forcing an unsupported `href` prop.
- `app/globals.css` declares `@layer theme, base, mantine, components, utilities;`. Import core's `styles.layer.css` before charts' `styles.layer.css`; never also import their unlayered `styles.css`. Preserve reduced-motion and focus behavior.
- In `next.config.ts`, apply the Tailwind Turbopack loader only to `app/globals.css`. A broad `*.css` rule empties CSS Module class maps.
- Keep filter controls as direct children of `.filterBar`. A Mantine Group around them forms one grid item and stacks the controls.
- Do not add remote map/image dependencies or remove provenance labeling when styling the illustrative map and thumbnails.

### Explore behavior

- `lib/explore/types.ts` defines frontend-only dashboard types; `lib/explore/selectors.ts` contains pure filtering, representative selection, sorting, and preview metrics.
- Search is case-insensitive across GPU model and region. Filters include model, minimum VRAM per GPU (#36), region, maximum hourly price, minimum reliability, and verified-only. Vast.ai is the sole provider, not an interactive multi-provider choice.
- Select the cheapest eligible offer for each distinct model after filtering; break equal-price ties by offer ID. Sorting then applies to those representatives, not every listing in the market.
- Default Featured order starts with H100 SXM, A100 PCIe, RTX 4090, and L40S. "Featured hardware" means curated presentation, not measured demand; do not label cards "Popular".
- Show four model cards initially. The full-width bar below them reveals the additional rows and switches to "Show fewer models" when expanded; the extra cards are removed from focus order when collapsed. Filter changes reset expansion. If four or fewer models match, hide the bar. Offer details open in a Drawer, not a fourth product route.
- Filters affect cards only. The Global GPU Index and Market Overview remain scoped to the full preview market. Model/region overview shortcuts replace card filters and return focus to the card-section heading.
- Multi-GPU prices are whole-offer hourly quotes. Keep per-GPU VRAM and total VRAM distinct.

### Sample data and metric semantics

- `lib/data/dev-mode.ts` requires both `NODE_ENV=development` and `NEXT_PUBLIC_USE_DEV_FIXTURES=1` before dynamically importing `lib/data/dev-fixtures.ts`. Preserve both checks. Production must not load synthetic samples even if the public flag is set.
- Current fixtures contain 15 listings across eight models and a fixed illustrative 24-hour history. Never relabel these values as live inventory, actual last-24-hour prices, real saved snapshots, or Databricks results.
- `lib/data/provenance.ts` is separate from domain types. Retain visible sample labels; unknown provenance is never live. Do not replace original capture times with fetch time or the current clock.
- The sample index is the equal-weight mean of model-median single-GPU hourly quotes for a fixed model basket. Its current value matches the final chart point. Missing basket models produce unavailable points, not a silently different basket.
- Regional prices are median single-GPU RTX 4090 quotes. Availability counts listings, not physical GPU count, utilization, or demand.
- Recent changes compare single-GPU median prices for the same model and region against the sample reference snapshot, sorted by absolute change. Missing or zero previous prices produce unavailable changes, not Infinity or invented zeroes.
- `lib/format.ts` owns price/VRAM/percentage/timestamp formatting. Keep zero distinct from missing data and timestamps explicitly UTC. Percentage callers must pass `ratio` or `percent`; sample reliability is explicitly `ratio`, not proof of future backend units.
- Keep chart heights stable, sample timestamps deterministic, and client/server props consistent. Do not disable SSR for the whole dashboard to conceal hydration problems.

### API and future integration boundaries

- `lib/api/types.ts` mirrors frozen PRD §8 types; do not alter them without team approval. Keep new preview-only fields out of those domain types.
- `lib/api/client.ts` is the HTTP boundary and uses `NEXT_PUBLIC_API_URL`. Responses remain `unknown` unless a caller supplies a validating `decode` function. Handle errors at this boundary; never silently retry mutations or substitute synthetic data after a network error.
- The current dashboard does not call that client. Live response envelopes, source metadata, reliability units, index methodology, and reservation request/verification shapes still require backend agreement.
- `NEXT_PUBLIC_*` settings are public/build-time values. Never put Vast.ai keys, Databricks tokens, or other secrets in browser code or committed environment files.
- Client-side preview calculations are not the production Databricks pipeline. Do not present the sample index definition as an approved live market benchmark.
- Keep pure helper/test imports in `lib/` relative so Vitest runs without extra alias configuration. Extend selector tests when changing filtering, ordering, or metric semantics.
