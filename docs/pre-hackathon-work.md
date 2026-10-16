# Pre-hackathon work baseline

Project and team: **Rueda Mobility**. Members: **Kaylee, Tony, Sebastian** (GitHub usernames pending).

This declaration inventories existing work completed before **October 17, 2026** for Agentic Dollars on Bitcoin. The mandatory baseline deadline is **October 16, 2026, 23:00 CEST (21:00 UTC)**. Local preparation alone is not evidence of timely public submission.

## Source provenance

- Existing frontend repository: `kayyrod21/rueda-mobility`.
- Branch inspected: `feature/rgb-payment-integration`.
- Frontend baseline commit: `ef0bf878e951ed6172736a8baaf0ed1bbee984ab` (local Git records October 13, 2026).
- Backend: pre-existing local `rueda-payment-api` source, previously outside Git. Copied by explicit filename allowlist on October 16, 2026; no backend Git history existed to preserve.
- Local filesystem timestamps and source inspection are not independent proof of authorship or completion dates. No runtime behavior was tested during preparation.

## Existing frontend work

Next.js/React/TypeScript application, English/Spanish strings, branding, service and executive-pricing UI, concierge modal/chat, market and service recommendation helpers, optional Google Places provider, location handling, site metadata and existing Vercel configuration. The local chat proxy validates input, reads a server-only API key and forwards requests to loopback FastAPI. It is disabled in production.

## Existing backend source inventory

| File | Pre-existing responsibility |
| --- | --- |
| `main.py` | FastAPI health, local wallet-status, quote, booking, chat and payment-request endpoints. |
| `approval.py` | Demo booking approval model and creation. |
| `booking_store.py` | SQLite demo booking persistence and approval. |
| `conversation.py` | In-memory bilingual conversation state, trip confirmation and payment preferences. |
| `extraction.py` | Deterministic trip-field and language extraction. |
| `trip_dates.py` | Date/time parsing and validation. |
| `trip_details.py` | Trip data and required-field checks. |
| `pricing.py` | Fixed RUEDA demo quotes. |
| `payment_auth.py` | Separate API and operator key-file authentication. |
| `payment_store.py` | SQLite pending payment requests and operator approval, without sending. |
| `rgb_payments.py` | Disabled-payment readiness helper for local cached RGB balances. |
| `qvac_welcome.py` | Experimental local model welcome helper, unused by active chat. |

All twelve files were copied unchanged. No recovery files, databases, credential files, wallet directories, virtual environments or backups were copied.

## Simulated, incomplete and known limitations

- No real RGB sending, settlement tracking, payment checkout or driver dispatch. Approval only changes demo state.
- Chat returns no booking and does not invoke the persistent booking/payment-request flow. Sessions disappear on restart.
- QVAC/Qwen active integration remains planned; current active extraction is deterministic.
- Local RGB status reads a wallet cache without blockchain synchronization. The existing private path and test-asset configuration are not portable setup.
- Fixed demo quotes are 10/5/15 RUEDA for airport/city/executive; the payment-request limit is 10, so executive requests are rejected.
- `main.py` registers `/quote` three times.
- Payment-request creation lacks a database uniqueness constraint on `booking_id`; duplicate-request handling does not guarantee one request per booking.
- Missing private key files cause authentication setup failures. No backend dependency lock or automated test suite was supplied.
- Exact required RGB v0.11.1 compatibility remains unverified: observed bindings are `rgb-lib 0.3.0b7`; the adjacent official RGB-Tools source uses `0.11.1-rc.11` dependencies. Retain only official `rgb-protocol`/`RGB-Tools` dependencies and verify compatibility before claiming compliance.

## Local preparation changes

Added the reviewed source under `backend/`, replaced the root README with a clear baseline declaration/setup/status document, added this inventory and strengthened root ignore rules. Frontend source, package files and Vercel configuration were left unchanged. No behavior fixes were included.

## Remaining publication risks

Credential material was detected in Git history at `.env.local` and in `dist/assets/index-DM_BSjVx.js`. Generated bundles and OS artifacts are already tracked; ignore rules do not untrack them. Historical third-party `node_modules/` files were excluded from the earlier project-secret scan. The audit is not an exhaustive certification.

The approved strategy is a new, separate source-only repository using the audited 134-file allowlist, without importing any original Git metadata or history. Generated artifacts and private runtime files are excluded. The new repository starts on `main` with one local baseline commit after inventory, ignore, symlink and credential checks. Original source and Git history remain unchanged. No push or publication is authorized or performed. Previous credential exposure still requires remediation before public release.
