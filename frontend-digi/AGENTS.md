<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## digiGPU frontend — current draft

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
- Verification for the sidebar-dashboard draft: lint, typecheck, 42 tests, and production builds passed. HTTP smoke checks passed for all three routes, local illustration assets, and four initial development cards. A build/start with the fixture flag set still omitted sample data in production.
- Browser interaction, responsive layout, chart rendering, keyboard focus, and hydration require a real browser check; server-rendered HTML checks do not establish visual correctness.
- The current audit reports five high-severity findings in the existing ESLint dependency chain (`braces` → `micromatch` → `fast-glob` → Next ESLint). Do not run `npm audit fix --force`, downgrade Next.js, or weaken install-script/security controls to suppress them.

### UI and architecture

- Prefer Mantine primitives, not custom replacements for controls, navigation, drawers, or modals. Current dependencies are Mantine core/hooks/charts 9.6.3, Recharts 3.10.1, and Tabler React icons 3.48.0. Keep Mantine package versions aligned.
- The design is forced dark with clean black/charcoal surfaces, cyan accents, subtle borders, and Geist typography. Use semantic teal/red for price changes; do not rely on color alone.
- `palette.ts` contains server-safe raw colors. `theme.ts` constructs the Mantine theme; do not import its client-dependent theme construction into server layouts.
- `app/layout.tsx` stays a Server Component for fonts, metadata, and dark HTML setup. `app/providers.tsx` supplies the client Mantine provider. Preserve matching forced-dark settings to avoid flashes/hydration differences.
- `components/layout/app-shell.tsx` owns the shared left sidebar, URL-based active links, narrow-width navigation control, and one main-content landmark. Preserve the skip link and accessible navigation.
- `app/page.tsx` loads gated fixtures on the server and passes serializable data to `components/explore/explore-dashboard.tsx`. Explore owns its toolbar and local filter/expansion/drawer state; do not put this state in the shared shell.
- `components/explore/` contains the toolbar, map hero, filters, model cards, details drawer, and four overview panels. `explore.module.css` handles limited composition/responsive styling; Mantine handles the controls.
- `components/shared/` contains reusable loading/empty/error states, provenance badges, and timestamps. The older `components/development/sample-market-preview.tsx` is no longer used by Explore.
- Mantine compound components such as `Table.Thead` and `AppShell.Navbar` require a client boundary. For a component without polymorphic link props, use its `renderRoot` API rather than forcing an unsupported `href` prop.
- `app/globals.css` declares `@layer theme, base, mantine, components, utilities;`. Import core's `styles.layer.css` before charts' `styles.layer.css`; never also import their unlayered `styles.css`. Preserve reduced-motion and focus behavior.
- The local SVGs in `public/illustrations/` are generic illustrations, not GPU product photography or real host locations. Do not add remote map/image dependencies just to replace them.

### Explore behavior

- `lib/explore/types.ts` defines frontend-only dashboard types; `lib/explore/selectors.ts` contains pure filtering, representative selection, sorting, and preview metrics.
- Search is case-insensitive across GPU model and region. Filters include model, minimum total VRAM, region, maximum hourly price, minimum reliability, and verified-only. Vast.ai is the sole provider, not an interactive multi-provider choice.
- Select the cheapest eligible offer for each distinct model after filtering; break equal-price ties by offer ID. Sorting then applies to those representatives, not every listing in the market.
- Default Featured order starts with H100 SXM, A100 PCIe, RTX 4090, and L40S. Popular/Featured means curated presentation, not measured demand.
- Show four model cards initially. Expand reveals all matching models; collapse returns to four. Filter changes reset expansion. Offer details open in a Drawer, not a fourth product route.
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
