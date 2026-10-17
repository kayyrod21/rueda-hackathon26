# Build-period Phase 1: offline payment approval

These changes follow the declared pre-hackathon baseline; they do not change its historical inventory.

Payments remain disabled. No execution endpoint, synchronization, refresh, send or broadcast flow is implemented. Importing modules does not construct wallets or read wallet recovery files. Existing explicit cached-status inspection remains available to the operator; it was not invoked during implementation/tests.

## Request contract

- Concierge-authenticated `POST /payments/requests`: JSON fields `booking_id` and `invoice`. Bare `recipient_id` inputs are no longer accepted. Extra fields are rejected.
- Booking must already be operator-approved, unpaid, denominated in RUEDA, and have an integer amount from 1 through 10. Amount comes from the booking, not client input.
- Official `rgb_lib.Invoice(invoice).invoice_data()` and `RecipientInfo(...).recipient_type()` perform offline parsing. Version/signatures were checked against installed `rgb-lib 0.3.0b7` before implementation.
- Require the configured asset ID, custom signet network, NIA-compatible fungible assignment, exact booking amount, blinded beneficiary, explicit future expiry, supported assignment name and no unknown query parameters.
- Configure `RUEDA_RGB_ALLOWED_TRANSPORTS` privately as comma-separated exact `rpc://` or `rpcs://` endpoint URLs. The default empty allowlist rejects all invoices. No transport is contacted. Network parsing identifies custom signet, not Mutinynet's specific genesis/indexer; chain synchronization and identification remain Phase 2 work.
- Response includes `approval_digest`, binding request ID, booking ID/snapshot, full invoice, recipient, asset ID, ticker, network and amount. It does not echo invoice/recipient or authentication values. The authorized operator must independently review the exact proposed invoice and booking before submitting its digest.
- Operator-authenticated `POST /payments/requests/{request_id}/approve`: JSON field `approval_digest`; no extra fields. Revalidates the stored invoice, expiry, allowed endpoints, booking snapshot, configured asset/network and digest under a SQLite write transaction. Approval alone never sends.

## Persistence and limitations

The new `payment_requests_v1` table enforces unique bookings, invoices and recipient IDs. Legacy `payment_requests` rows are neither migrated nor eligible for approval. Database triggers freeze payment details and associated bookings, prevent deletion/replay, and permit one pending-to-approved transition. There is no cancellation/replacement API in Phase 1; future changes require a deliberate migration and renewed approval. The database remains private and ignored.

Digests detect mismatches; they are not signatures and do not defend against a privileged attacker rewriting the database and application together. Operator credentials remain separate from concierge credentials; missing/empty key configuration fails closed. Do not enable request/header/body logging or expose the development backend publicly.

## Offline tests

From the repository root, use the existing environment containing the verified official bindings:

```sh
PYTHONPATH=backend /path/to/existing/venv/bin/python -B -m unittest discover -s backend/tests -v
```

Tests use temporary SQLite/authentication fixtures, a public upstream blinded-recipient fixture and fake wallets. They forbid live wallet construction/recovery-path access. The test invoice is not a payment recipient and must never be used for sending. No dependencies were installed.

Strict final RGB v0.11.1 compatibility remains unresolved: official rgb-lib 0.3.0b7 uses 0.11.1-rc.11 dependencies. No alternate implementation or dependency upgrade is introduced. Sync, transfer status tracking, sending and runtime wallet validation remain outside Phase 1.
