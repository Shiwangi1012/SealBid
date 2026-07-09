# Build Log — On-chain Sealed-Bid Auction

> All decisions, changes, and notes recorded chronologically.

---

## Task 1: Cargo Workspace Setup
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- Created `contracts/` directory with a single Cargo workspace containing 3 members: `auction`, `vault`, `refund`
- Used `resolver = "2"` for Cargo 2021 edition feature resolution
- Pinned `soroban-sdk = "22.0.0"` with `testutils` feature for compatibility with Stellar CLI 27 / testnet
- Added release profile with `opt-level = "z"`, `lto = true`, `panic = "abort"` — standard Soroban optimizations for smallest wasm output
**Files created/modified**:
- `contracts/Cargo.toml`
- `contracts/auction/Cargo.toml`
- `contracts/vault/Cargo.toml`
- `contracts/refund/Cargo.toml`

---

## Task 2: AuctionContract
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- Implemented `initialize`, `commit`, `reveal`, `finalize`, `claim_refund`, `get_state`, `get_winner`
- Phase logic uses `env.ledger().timestamp()` (Unix seconds) against `bidding_deadline` and `reveal_deadline` stored in instance storage — this is trustless deadline enforcement via Soroban ledger time
- Commitment scheme: `sha256(amount_u64_le_bytes ++ salt_bytes_32)` — exactly mirrors the client-side `computeCommitment()` in the frontend
- `commit()` pulls XLM into the contract via `token::Client::transfer()` using the native token contract ID (stored during `initialize`)
- `claim_refund()` zeros out deposit before transferring — re-entrancy guard
- Bidder list stored in instance storage as `Vec<Address>` for `finalize()` to iterate
- Tie-break: first bidder with the highest amount wins (deterministic, fair for auctions)
- Events emitted on `reveal` (symbol "reveal", bidder address, amount) and `finalize`
**Files created/modified**:
- `contracts/auction/src/lib.rs`

---

## Task 3: TimeLockVaultContract
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- Implements `initialize(auction_contract)` and `release(auction_contract, to, amount)`
- Only the stored auction contract address can call `release` — enforced via `require_auth()` on the passed `auction_contract` arg and cross-check against stored value
- Uses `token::Client` for XLM transfer out
**Files created/modified**:
- `contracts/vault/src/lib.rs`

---

## Task 4: RefundDistributorContract
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- Implements `initialize(auction_contract)` and `batch_refund(losers: Vec<Address>)`
- Only callable by the stored auction contract address
- Loops over losers and calls native token transfer for each — gas-efficient bulk refund path
**Files created/modified**:
- `contracts/refund/src/lib.rs`

---

## Task 5: Build All Contracts
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- Ran `cargo build --target wasm32-unknown-unknown --release` in `contracts/`
- All 3 wasm files produced: `auction.wasm` (5895 bytes), `vault.wasm` (1863 bytes), `refund.wasm` (2002 bytes)
- Compact sizes confirm dead-code elimination and LTO are working
**Files created/modified**:
- `contracts/target/wasm32-unknown-unknown/release/auction.wasm`
- `contracts/target/wasm32-unknown-unknown/release/vault.wasm`
- `contracts/target/wasm32-unknown-unknown/release/refund.wasm`

---

## Task 6: Deploy Contracts to Testnet
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- Deployed all 3 contracts using `stellar contract deploy` with identity `deployer` on `testnet`
- Deployer account funded via `stellar keys fund deployer --network testnet`
- Also fetched the native XLM token contract ID from testnet for use in `initialize`
- Stored all IDs in `.env` as VITE_ prefixed vars for Vite frontend access
**Files created/modified**:
- `.env`

**Contract IDs**:
| Contract | ID |
|---|---|
| AuctionContract | `CAWMD56O7M2HYYXD5AUE5PRGFJ5CJZ5GL4RXACTYFGYPEIGYCNOULIPF` |
| TimeLockVaultContract | `CDZOINVUO7QY4V2VUA755Y4WFRLAAVJBNJH7XZIKF3DKOHIXHYEN5KAK` |
| RefundDistributorContract | `CCRZYYLKJZFZLNZAETCLD6G2TJDBUWVNZC6DH4VJ2HYTFYUOOIUYRAVI` |
| Native Token | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

---

## Task 7: Initialize AuctionContract on Testnet
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- Called `initialize` with admin = deployer address, native_token = native token contract ID
- `bidding_deadline` = Unix timestamp ~1 hour from deploy time
- `reveal_deadline` = Unix timestamp ~2 hours from deploy time
- `AuctionStatus.tsx` uses these same Unix timestamps for the countdown timer
**Notes**:
- Bidding deadline: 1752245546 (Unix)
- Reveal deadline: 1752249146 (Unix)

---

## Task 8: React + TypeScript + Vite Scaffold
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- Used `npm create vite@latest . -- --template react-ts` for standard React/TS/Vite scaffold
- Chose Vite 6 + React 18 for fast HMR and modern bundling
- Added `buffer` polyfill dependency — required by `@stellar/stellar-sdk` in browser environments
**Files created/modified**:
- `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/vite-env.d.ts`

---

## Task 9: Frontend Dependencies
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `@stellar/stellar-sdk@^13.1.0` — official Stellar JS SDK with Soroban RPC support
- `@creit.tech/stellar-wallets-kit@^1.7.0` — multi-wallet abstraction for Freighter, xBull, Albedo, Ledger, etc.
- `buffer@^6.0.3` — browser polyfill required by stellar-sdk

---

## Task 10: Wallet Connection (L1)
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `useWallet.ts` wraps `StellarWalletsKit` — chosen over direct Freighter API to support L2 multi-wallet requirement from the start
- `openModal()` presents all available wallet options (Freighter, xBull, Albedo, etc.) — satisfies L2 multi-wallet requirement
- `signTx()` uses `kit.signTransaction()` with correct network passphrase for testnet
- Wallet state kept in React state; kit instance in a `useRef` to survive re-renders
**Files created/modified**:
- `src/hooks/useWallet.ts`
- `src/components/WalletButton.tsx`

---

## Task 11: XLM Balance Display (L1)
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `useBalance.ts` fetches from Horizon testnet `/accounts/{address}` REST API — no Soroban RPC needed for native balance
- Polls on tick increment; `refresh()` exposed so callers can trigger after transactions
- Balance formatted to 2 decimal places; shown inline in `WalletButton` as `GXXXX…YYYY · 10.00 XLM`
**Files created/modified**:
- `src/hooks/useBalance.ts`

---

## Task 12: Bid Commitment (L1/L2)
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `commitment.ts`: `generateSalt()` uses `crypto.getRandomValues()` — browser-native CSPRNG, no library needed
- `computeCommitment()` uses `crypto.subtle.digest('SHA-256', ...)` — Web Crypto API, matches contract's `env.crypto().sha256()`
- Amount encoded as `u64` little-endian bytes (8 bytes) then concatenated with 32-byte salt — exact match to contract
- Amount expressed in XLM on the UI, converted to stroops (×1e7) for both commitment and deposit args
- `saveBidSecrets()` / `loadBidSecrets()` use `localStorage` so salt survives page refresh
- `BidForm.tsx` auto-fills from saved secrets, shows salt as copyable text, "New Salt" button for fresh bids
**Files created/modified**:
- `src/utils/commitment.ts`
- `src/components/BidForm.tsx`

---

## Task 13: Contract Call Infrastructure
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `contractCall.ts` provides typed wrappers: `callCommit`, `callReveal`, `callFinalize`, `callClaimRefund`, `getAuctionState`
- Generic `invokeContract()` handles: build tx → simulate (get footprint) → `assembleTransaction` → sign via wallet → send → poll until confirmed
- Used `SorobanRpc.Server` from `@stellar/stellar-sdk` — official Soroban RPC client
- Polling: 20 retries × 3s = 60s max wait — reasonable for testnet 5-second finality
- `ContractError` class carries both a user-friendly message and the raw error string
- `ERROR_MAP` maps known Rust `panic!()` strings to human-readable messages (covers all 3 required L2 error types)
**Files created/modified**:
- `src/utils/contractCall.ts`

---

## Task 14: Reveal Form (L2)
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `RevealForm.tsx` pre-fills amount + salt from localStorage (saved during bid)
- Validates salt length (64 hex chars = 32 bytes) before sending
- Shows specific helper text for "hash mismatch" and "reveal phase" errors
**Files created/modified**:
- `src/components/RevealForm.tsx`

---

## Task 15: Finalize + Refund UI (L2)
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `AuctionStatus.tsx` polls `get_state()` every 10s to keep phase badge current
- Countdown timer ticks every second using `setInterval`; shows the relevant deadline (bidding vs reveal) based on current phase
- "Finalize Auction" button only appears when `revealLeft.expired && phase !== 'Finalized'` — prevents premature finalize attempts
- "Claim Refund" button only shown when finalized
- Hardcoded Unix deadline timestamps match what was used in `initialize` — in production these would come from contract storage via a `get_deadlines()` call
**Files created/modified**:
- `src/components/AuctionStatus.tsx`

---

## Task 16: Event Listener + Live Feed (L2)
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `useAuctionEvents.ts` polls `server.getEvents()` every 8s — Soroban RPC polling approach (no WebSocket needed)
- Filters by `contractIds: [AUCTION_ID]` and checks `topic[0]` is Symbol "reveal"
- Deduplication via `seenIds` ref set — no duplicate events in feed
- `RevealFeed.tsx` shows a scrollable list with bidder address (truncated), amount, and time
**Files created/modified**:
- `src/hooks/useAuctionEvents.ts`
- `src/components/RevealFeed.tsx`

---

## Task 17: Error Handling (L2)
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- Three required error types handled with user-friendly messages:
  1. **Late reveal** — "not in reveal phase" → "Reveal phase has not started or has ended"
  2. **Hash mismatch** — "hash mismatch" → "Hash mismatch — your amount or salt does not match the commitment" + extra help text in RevealForm
  3. **Insufficient deposit** — "deposit must be positive" → "Deposit must be greater than zero"
- Additional errors covered: already committed, no commitment, already finalized, winner/refund edge cases

---

## Task 18: Multi-wallet Support (L2)
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `allowAllModules()` passed to `StellarWalletsKit` — includes Freighter, xBull, Albedo, Ledger, WalletConnect, etc.
- `kit.openModal()` presents all detected wallets — user selects from the list
- No additional code needed beyond the `useWallet.ts` hook

---

## Task 19: App Composition + Mobile Responsive Styling (L3)
**Status**: Completed  
**Date**: 2025-06-07  
**Decisions**:
- `App.tsx` composes all components with phase-aware rendering: BidForm shown only during Bidding, RevealForm only during Reveal
- Dark theme with CSS custom properties — single `index.css` file, no CSS framework dependencies
- Mobile breakpoint at 600px: reduced font sizes, stacked layout for reveal feed items, smaller countdown digits
- Countdown timer is visually prominent (large tabular numerals) — meets L3 "prominent countdown" requirement
- RevealFeed has a max-height with scroll — meets L3 "live reveal feed scrollable" requirement
**Files created/modified**:
- `src/App.tsx`
- `src/index.css`

---

## Build Verification
**Status**: Passed  
**Date**: 2025-06-07  
**Result**:
- `npm run build` — ✅ 520 modules transformed, 0 TypeScript errors, 0 build errors
- Output: `dist/assets/index-BX7UHHPK.js` (1607 KB / 465 KB gzipped), `dist/assets/index-C9hNeajm.css` (4 KB)
- Chunk size warning is advisory only — caused by `@creit.tech/stellar-wallets-kit` bundling many wallet adapters
