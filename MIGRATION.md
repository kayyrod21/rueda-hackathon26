# Vite → Next.js migration

## Outcome

The homepage now uses Next.js 16.3.5 App Router, strict TypeScript, React, and Tailwind 4.1.12. The server page/layout compose the existing interactive sections without changing their ordering, translations, imagery, utility classes, or layout. The homepage, robots.txt, and sitemap.xml prerender statically. No future product routes, APIs, payments, database, or AI integration were added.

A per-homepage i18n instance avoids mutable server language state. Existing language switching and concierge state remain client-side; existing motion/translation-dependent sections are explicit client boundaries. Public copy is included in generated HTML, and a noscript style reveals the existing entrance animations when JavaScript is disabled. The document language updates on EN/ES switching.

Public contact values live in `src/app/lib/siteConfig.ts`. The current email and WhatsApp placeholder remain unchanged. Server-only `SITE_URL` controls the metadata origin; no future domain or email was invented. Metadata includes title, description, canonical, Open Graph, and the existing mark as the browser icon.

## Application and backup

Verified sources were applied to `/Users/kayleerodriguez/Desktop/Rueda` on branch `codex/nextjs-migration`. No commit, push, or deployment was made. The affected original files and pre-migration Git status are backed up at `/Users/kayleerodriguez/Documents/ChatGPT/QVAC/rueda-migration-backup`. Source hashes were checked before application and the applied files were verified byte-for-byte against the tested copy. Existing uncommitted EN/ES and header/footer changes were preserved.

Dependencies were installed and all build/browser checks ran in the isolated workspace, avoiding changes to the original repository's tracked `node_modules`. Before running from Desktop/Rueda itself, run `npm ci` and `npm run build`; its existing dependency directory still contains the old Vite install. The running local review preview uses the verified isolated copy at `http://127.0.0.1:3000`.

## Visual validation

Baseline: the actual local Vite source, including its uncommitted header/footer/translation changes, served from an isolated copy. The local mobile design was the source of truth. The public deployment could not be fetched through the web reader; visual parity claims are against local Vite, not an independently checked production deployment.

Chrome screenshots at 390×844 and 1440×1000 were compared after loading fonts/images and scrolling through all entrance animations:

- Mobile document height: 9,173 px before and after; no horizontal overflow.
- Desktop document height: 7,035 px before and after; no horizontal overflow.
- Every captured heading has identical text and bounding-box coordinates.
- Mean absolute color-channel difference: 0.00165/255 mobile, 0.02112/255 desktop. No mobile channel differs by more than 8/255; 9 desktop channels do. These are negligible rendering differences, not layout changes.
- All 13 rendered image elements loaded at each viewport. All five public brand/payment files are byte-identical to the original assets.
- Visually inspected mobile hero/header, Executive section, footer/full logo, and desktop composition.
- No material visual differences found at these sizes. Other browsers and intermediate widths were not exhaustively screenshot-tested.

Native image elements and the existing fallback component remain intentionally unchanged to preserve intrinsic sizing, remote URLs, image crops, and error behavior. No assets were regenerated, redrawn, recolored, replaced, or deleted.

## Behavioral validation

Validated at mobile and desktop widths: EN/ES switching, language attribute, anchor navigation, mobile menu dismissal, concierge opening/Escape dismissal, Executive detail opening and handoff to the existing concierge, and absence of browser runtime/hydration errors. Mobile Bitcoin disclosure expands and collapses. No API requests or booking submissions were made.

JavaScript-disabled validation confirms visible public headings and HTML copy. Canonical, Open Graph, robots, and sitemap are generated. All requested build/type checks pass. Dependency audit reports zero vulnerabilities after removing unused React Router and updating three affected transitive dependencies.

## Files added

- `.gitignore`, `next-env.d.ts`, `next.config.ts`, `tsconfig.json`, `vercel.json`
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `src/app/robots.ts`, `src/app/sitemap.ts`
- `src/app/components/HomeProviders.tsx`, `src/app/components/HomeControls.tsx`
- `src/app/lib/siteConfig.ts`, `src/app/lib/siteUrl.ts`
- `MIGRATION.md`

## Files removed

Only after the Next replacement built and rendered successfully:

- `vite.config.ts`
- `index.html`
- `src/main.tsx`
- `src/vite-env.d.ts`
- `src/app/App.tsx` (replaced by the server page and homepage interaction provider)

## Files modified

- `package.json`, `package-lock.json`: Next scripts/dependencies; remove Vite tooling and unused React Router; keep existing UI dependencies and React 18.3.1.
- `postcss.config.mjs`: Tailwind's Next-compatible PostCSS integration, same Tailwind version.
- `.env.example`: optional canonical origin and renamed existing public browser-key variable.
- `.claude/launch.json`: default development port becomes 3000.
- `README.md`: run/build/environment/deployment instructions.
- `src/app/i18n/index.ts`: create isolated, synchronously initialized instances with the existing EN/ES resources.
- `src/app/lib/constants.ts`: retain the existing export backed by central contact config.
- `src/app/lib/location/locationProvider.ts`: replace Vite environment access with Next-compatible access; existing optional integration remains unconfigured.
- `src/app/lib/concierge/generateConciergeSummary.ts`: add the previously missing `TierAvailabilityChip` type import found by strict checking.
- `src/app/components/Footer.tsx`: client boundary and centralized contact email.
- `src/app/components/{Header,Hero,ServiceIntents,MedellinSpotlight,HowItWorks,WhyRueda,ServiceCards,PaymentMethods,AISection}.tsx`: explicit client-boundary directive only; existing markup, styles, and behavior preserved.

## Intentionally deferred debt

- The original Git repository tracks `node_modules`, `dist`, and `.env.local`. These are not removed or bulk-cleaned by this migration. The environment file was not copied into the validation workspace or exposed in output. `.gitignore` prevents new generated files from being added but does not untrack existing files.
- Existing WhatsApp URL is the generic `https://wa.me`; the hero WhatsApp button has no action. Legal links are placeholders. Existing email is provisional. These retain their original behavior/content.
- The existing concierge contains English-only copy despite the bilingual homepage. It remains unchanged.
- Existing UI scaffolding/dependencies and domain-specific prototype logic remain; no unrelated cleanup or feature expansion.
- Images and Inter font still depend on their original external hosts.
- Existing animation/translation-heavy sections remain client components, but Next prerenders their public HTML. Further bundle reduction is a separate checkpoint.

## Exact successful validation commands

Run from the isolated migration workspace at `/Users/kayleerodriguez/Documents/ChatGPT/QVAC/rueda-next`:

```sh
npm install
npm update lodash tar baseline-browser-mapping
npm run build
npm run typecheck
npm run start -- --hostname 127.0.0.1 --port 3000
node validation/capture.cjs http://127.0.0.1:5173 baseline
node validation/capture.cjs http://127.0.0.1:3000 next
node validation/interaction.cjs
```

Baseline server command, from `/private/tmp/rueda-vite-baseline`:

```sh
./node_modules/.bin/vite --configLoader runner --host 127.0.0.1 --port 5173
```

The baseline copy changes only its development configuration to resolve its absolute source path and use a temporary Vite cache. No baseline UI source changes were made. Browser scripts use the bundled Playwright runtime and installed Chrome; they and screenshots are review artifacts kept in the validation workspace, not production dependencies.

The initial Turbopack build encountered a local process/port permission restriction. The successful build script is `next build --webpack`; development likewise uses `next dev --webpack`.

## Vercel readiness and next checkpoint

Ready for a Vercel preview deployment from a clean dependency install. `vercel.json` explicitly selects Next.js, `npm run build`, and `.next`, replacing any Vite assumptions. Node 22 LTS is recommended. No secrets are needed. Keep the optional Places key blank for migration review. No deployment or Git push was performed.

Next checkpoint: review a Vercel preview on a physical mobile device and approve migration parity before starting any homepage restructuring or new product work.
