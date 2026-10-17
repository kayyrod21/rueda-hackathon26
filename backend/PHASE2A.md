# Phase 2A: operator-only synchronization and preflight

Payments remain disabled. This adds no execution endpoint, transaction construction, signing, transfer refresh, send or broadcast calls. Preflight synchronization updates local wallet chain/cache state; it does not settle or advance RGB transfer state. No live wallet or indexer was used during implementation/testing.

## Endpoint

`POST /payments/requests/{request_id}/preflight`, with separate operator authentication via `X-Payment-Operator-Key` and JSON containing only `approval_digest`. The Phase 1 concierge key cannot authorize this operation. Errors use fixed public codes; responses omit invoices, recipient IDs, credentials, paths, indexer URLs and raw library errors.

Successful responses explicitly include `payments_enabled: false`, `payment_sent: false`, `ready_to_execute: false`, `utxos_reserved: false` and `exact_transaction_fee_verified: false`. A preflight result is a point-in-time policy check, not spend authorization or a transaction feasibility guarantee. It does not change the approval or booking state.

## Required private configuration

No actual configuration values or wallet files are provided. Missing/malformed configuration fails closed before opening the wallet.

| Environment variable | Meaning |
| --- | --- |
| `RUEDA_RGB_NETWORK` | Must be `mutinynet`. |
| `RUEDA_RGB_INDEXER_URL` | HTTPS Esplora base URL; no embedded credentials, query or fragment. Electrum is unsupported in this phase. |
| `RUEDA_MUTINYNET_GENESIS_HASH` | Expected lowercase genesis hash, obtained independently from a trusted Mutinynet reference. |
| `RUEDA_MUTINYNET_CHECKPOINT_HEIGHT` | Nonzero known Mutinynet checkpoint height. |
| `RUEDA_MUTINYNET_CHECKPOINT_HASH` | Independently trusted hash at that height; genesis alone cannot distinguish custom signet networks reliably. |
| `RUEDA_RGB_WALLET_DIR` | Absolute path to an existing private wallet directory compatible with the existing loader. |
| `RUEDA_RGB_ALLOWED_TRANSPORTS` | Nonempty exact endpoint allowlist from Phase 1. |
| `RUEDA_RGB_FEE_RESERVE_SATS` | Positive reserve from 1,000 to 1,000,000 sats. |
| `RUEDA_RGB_MAX_FEE_RATE_SAT_VB` | Operator rate ceiling from 1 to 1,000 sat/vB. |
| `RUEDA_RGB_PREFLIGHT_VBYTES` | Conservative estimated size from 1,000 to 10,000 vbytes, used only for the preflight reserve policy. |

Do not obtain the trusted checkpoint solely from the same unverified indexer being checked. Hash-pin comparison and HTTPS rely on the configured trust source/indexer; they are not independent Bitcoin consensus validation. The existing cached `/wallet/status` route still uses its original default wallet directory; preflight uses the explicitly configured directory. Configure these consistently before live use.

## Checks performed

1. Verify installed official bindings report exactly `rgb-lib 0.3.0b7`.
2. Revalidate approved status/time, exact approval digest, immutable booking snapshot, invoice, asset ID, custom-signet network, integer 1–10 amount, expiry and allowed endpoints.
3. Use bounded GET-only Esplora requests to verify genesis, nonzero checkpoint and tip height. Redirects and environment proxies are disabled. No recipient transport is contacted.
4. Acquire nonblocking thread/process wallet locks shared by application cached-status/readiness and preflight operations. A missing wallet directory is not created. External tools must honor the same lock or remain stopped; this is a cooperative local lock, not protection from arbitrary external wallet processes.
5. Verify wallet configuration is `SIGNET_CUSTOM`, then link **pre-sync cached confirmed wallet history** to the pinned indexer: confirmed transaction IDs, heights and block times must match canonical indexer blocks, and at least one match must have three confirmations. Empty/unconfirmed-only or mismatched history fails closed before `go_online`, which itself can synchronize. This proves consistency of observed wallet history with the configured trusted chain, not possession/validation of a specific signet challenge: `WalletData` exposes no challenge field or wallet checkpoint getter. Actual wallet identity remains unverified until an authorized live check.
6. Reject any nonterminal RGB transfers before/after synchronization instead of refreshing them. **beta.7 `list_transfers(None)` lists only unassigned-asset transfers**; the guard separately checks each asset ID from all four schema lists plus the configured RUEDA ID. Do not substitute newer master-branch API semantics.
7. Call `go_online` with consistency checks enabled, then `sync` with `FULL_SCAN` separately for colored and vanilla keychains. Cached balance/unspent queries then use `skip_sync=True`.
8. Check both settled and spendable RUEDA and Bitcoin funds, the indexer's three-block fee estimate against the configured rate/size/reserve policy, and a conservative extra 1,000-sat output reserve. Require adequate settled RUEDA-bearing colorable UTXOs and a separate allocation-free colorable UTXO with sufficient Bitcoin reserve. Vanilla-only BTC does not satisfy this policy. Do not create or fund missing UTXOs.
9. Inspect allocation statuses without hiding pending entries. Verify source/spare UTXO transactions have at least three confirmations via Esplora transaction status and block-hash-at-height reads, and that each exact outpoint remains unspent via GET-only outspend queries. Verify checkpoint again and pin the observed tip block hash across the check, rejecting both a regressed tip and a same-height reorganization. Chain extension preserving the observed block is permitted.
10. Revalidate the complete approved snapshot again after synchronization, catching expiry or changed configuration during IO.

## Verified installed API

Signatures were inspected directly before implementation:

- `Wallet.go_online(online_options: OnlineOptions)`
- `Wallet.sync(online: Online, options: SyncOptions)`
- `Wallet.get_wallet_data()`
- `Wallet.list_transfers(asset_id: Optional[str])`: exact equality filter; `None` means no assigned asset, not all assets.
- `Wallet.list_assets(filter_asset_schemas: List[AssetSchema])`
- `Wallet.list_transactions(online: Optional[Online], skip_sync: bool)`
- `Wallet.get_asset_balance(asset_id: str)`
- `Wallet.get_btc_balance(online: Optional[Online], skip_sync: bool)`
- `Wallet.list_unspents(online: Optional[Online], settled_only: bool, skip_sync: bool)`
- `Wallet.get_fee_estimation(online: Online, blocks: int)`
- `OnlineOptions(indexer_url=..., skip_consistency_check=..., vanilla_sync_lookback=...)`
- `SyncOptions(keychain=..., strategy=...)` with `SyncKeychain.COLORED()`, `SyncKeychain.VANILLA(lookback)` and `SyncStrategy.FULL_SCAN`.

The official local **0.3.0-beta.7 tag**, rather than adjacent newer master, was inspected. `go_online(skip_consistency_check=False)` performs consistency checks that themselves full-scan both keychains. The subsequent explicit `sync` calls also update local chain/cache state. These audited paths do not construct/sign/broadcast transactions or invoke RGB transfer refresh. `get_fee_estimation` is a network read; `get_btc_balance` and `list_unspents` skip additional synchronization only when `skip_sync=True`. `settled_only` filters RGB allocations, not Bitcoin confirmations. No `refresh` call is used.

## Tests and remaining limitations

Run all isolated tests from the repository root:

```sh
PYTHONPATH=backend /path/to/existing/venv/bin/python -B -m unittest discover -s backend/tests -v
```

Tests inject fake wallets/indexer responses and temporary SQLite/authentication/lock files; real wallet construction and network IO are blocked. HTTP authentication is exercised in-process through ASGI without installing a client package.

A live synchronization remains untested and was not requested. Approved trusted pins, a compatible HTTPS Esplora endpoint, wallet configuration and adequate UTXOs/funds are still required. Sync can fail or take time according to the installed library's indexer behavior. No automatic retry or background transfer worker is introduced.

Fee/UTXO checks deliberately avoid transaction construction. The configured size allowance cannot prove exact fee adequacy or native coin-selection success; Phase 2B must independently recheck all conditions. Existing pending transfers require separate operator review. Final RGB v0.11.1 compatibility remains unresolved because the retained official 0.3.0b7 release uses 0.11.1-rc.11 dependencies. No alternative RGB implementation or dependency upgrade is introduced.


## Focused audit corrections

Fixed the beta.7 `list_transfers(None)` filtering mismatch, missing pre-sync wallet-history binding and the same-height reorganization gap. Tests cover asset-specific pending transfers, absent/mismatched wallet anchors, exactly three versus two confirmations, indexer failures and same-height reorgs.

The spare colorable UTXO, colorable-only Bitcoin reserve, three-confirmation minimum, zero-pending-transfer rule and large size allowance remain intentionally conservative Phase 2A policy. They can reject wallets that rgb-lib could validly spend from (for example, sufficient BTC on the selected RGB source with no separately funded spare). These are not universal RGB protocol requirements. No policy relaxation or transaction-construction experiment was included in this audit.
