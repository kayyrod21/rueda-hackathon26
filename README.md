# Rueda Mobility

Bilingual, concierge-first mobility prototype, initially focused on Medellín.

**Team:** Rueda Mobility  
**Members:** Kaylee, Tony, Sebastian — GitHub usernames pending.  
**Hackathon:** Agentic Dollars on Bitcoin  
**Mandatory baseline deadline:** October 16, 2026, at 23:00 CEST (21:00 UTC).

## Pre-hackathon work declaration

The frontend and backend source described in [the baseline inventory](docs/pre-hackathon-work.md) existed before **October 17, 2026**. This submission includes pre-existing work; it was not all created during the hackathon. The existing frontend baseline is commit `ef0bf878e951ed6172736a8baaf0ed1bbee984ab`; the backend was previously outside Git. Repository organization and these declarations were prepared locally on October 16, 2026.

This local preparation does not establish that a public baseline was submitted by the deadline. Publication and verification of public access remain pending.

## Technology stack

- Next.js, React and TypeScript frontend; existing Vercel configuration.
- FastAPI/Pydantic backend with SQLite for local demo bookings and payment requests.
- QVAC/Qwen integration **planned**. An experimental local model welcome helper exists, but the active chat flow uses deterministic Python extraction and conversation rules.
- **Target: RGB Protocol on Bitcoin v0.11.1 via official RGB-Tools rgb-lib.** Only the official `github.com/rgb-protocol` and `github.com/RGB-Tools` stack is in scope. Exact v0.11.1 compatibility is not yet verified: installed Python bindings report `rgb-lib 0.3.0b7`, while the adjacent official RGB-Tools source pins RGB dependencies to `0.11.1-rc.11`. These are observed versions, not a validated dependency lock. No alternative RGB implementation is used or proposed.

## Current feature status

| Area | Baseline status |
| --- | --- |
| Frontend | Implemented bilingual UI, service presentation, concierge modal, market/pricing helpers and optional Google Places integration; live provider behavior depends on configuration. |
| Local concierge | Implemented frontend proxy to FastAPI, API-key authentication, bilingual trip extraction, date clarification, itinerary confirmation and payment-preference collection. |
| Booking demo | Implemented SQLite quote/booking creation and separate operator approval endpoints. Chat does not create a booking or dispatch a driver. |
| Payment-request demo | Implemented pending-request creation and operator approval; no transfer is initiated. |
| Pricing | Fixed RUEDA demo amounts; not a live fare or dollar settlement quote. |
| RGB wallet status | Existing code can inspect a separately configured local wallet cache; blockchain synchronization is not performed. Wallets and recovery material are excluded. |
| QVAC/Qwen | Planned active integration; experimental helper is not called by the active chat endpoint. |
| Real payments | Incomplete/disabled: no RGB sending, invoice checkout, settlement tracking, traditional payment processing or driver dispatch. |
| Production concierge | Disabled: the Next.js chat route returns HTTP 503 in production. |

Code inspection establishes implementation presence, not a successful runtime or end-to-end payment test. See the baseline document for known limitations.

## Repository layout

- `src/`, `public/`: existing frontend source and assets.
- `backend/`: reviewed Python application source only; no runtime data or wallets.
- `docs/pre-hackathon-work.md`: pre-existing source inventory and limitations.
- `vercel.json`: existing frontend deployment configuration, unchanged.

## Local setup requirements

Use Node.js 20.9 or later and a Python version compatible with FastAPI and the selected official RGB-Tools Python bindings (existing source uses Python 3.10+ syntax). The backend does not yet have a validated dependency manifest/lockfile. Required third-party imports include `fastapi`, `pydantic`, `uvicorn` and `rgb_lib`; confirm official binding provenance and v0.11.1 compatibility before installing or running it.

Frontend setup, when authorized:

```sh
npm ci
npm run dev
```

The repository root is the frontend working directory. Existing scripts also provide `npm run typecheck` and `npm run build`. No installs or builds were performed during baseline preparation.

For the backend, use a private virtual environment and run from `backend/` so the existing flat Python imports resolve. Once dependencies and private authentication configuration are prepared, the intended development command is `uvicorn main:app --host 127.0.0.1 --port 8000`. Do not expose the local demo publicly. Database files may be created by booking/payment-request operations and must remain ignored.

Configuration requirements (names only; no credentials are supplied):

- Frontend: `SITE_URL`; optional `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for browser Places access; server-only `RUEDA_QVAC_API_KEY` for the local chat proxy. Keep actual values in ignored `.env.local`. A browser Maps key requires appropriate origin/API restrictions.
- Backend: private `backend/.payment_api_key` and `backend/.payment_operator_key` files. The frontend server key must match the backend API key; operator authorization uses a separate key. These files are not included and must not be committed.
- Experimental model helper: expects a local OpenAI-compatible endpoint at `127.0.0.1:11434`; QVAC/Qwen provisioning and validation remain pending.
- Wallet status code retains a pre-existing hardcoded private wallet path. **Do not call wallet routes or configure live wallets as part of this baseline preparation.** No wallet is required for the deterministic chat flow, although `rgb_lib` is imported at backend startup.

## Publication safety

This is a new, separate source-only repository prepared from an audited 134-file allowlist. It does not import the original repository’s Git metadata or history. Generated bundles, credentials, wallets, databases, backups and caches are excluded. The original frontend and its history remain unchanged. This repository starts on `main` with one local baseline commit; it has not been pushed or published.

The original repository audit found credential exposure in `.env.local` and `dist/assets/index-DM_BSjVx.js`; neither file is included here. A clean repository does not remediate previous exposure: affected credentials still require remediation. Before the local baseline commit, the copied inventory, ignore rules, symlinks and absence of known local credential values were checked. This is a bounded source audit, not an exhaustive security certification.
