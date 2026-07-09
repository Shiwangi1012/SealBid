# On-chain Sealed-Bid Auction with Time-Lock Vault

> Commit your bid as a hash. Lock your XLM in a vault. Reveal after the deadline. Winner takes it — losers are auto-refunded. No auctioneer, no trust, no front-running.

## What it does

Bidders hash their bid amount client-side and submit the commitment to a Soroban auction contract along with a locked XLM deposit. After the bidding deadline, a reveal phase opens — each bidder submits their actual amount. The contract verifies it matches the commitment, determines the highest valid reveal as the winner, and automatically refunds all losing deposits. The auctioneer never touches the funds.

## Why Stellar

Stellar's 5-second finality means the reveal phase resolves fast enough to be interactive. Soroban's ledger timestamp enables trustless deadline enforcement without a centralized timer.

## Tech stack

- **Soroban** — auction contract + time-lock vault contract + refund distributor contract
- **Freighter wallet** — wallet connect / disconnect
- **StellarWalletsKit** — multi-wallet support
- **React + TypeScript** — frontend with countdown timer UI
- **Stellar Testnet** — deployment target

## Level progression

| Level | What's built | Status |
|-------|-------------|--------|
| L1 | Wallet connect, XLM balance display, submit hashed bid to testnet contract, pending/confirmed state shown | ✅ Complete |
| L2 | Deploy auction contract with bid/reveal/finalize phases; multi-wallet UI; event listener fires on each reveal; auto-refund losers; 3 error types (late reveal, hash mismatch, insufficient deposit) | ✅ Complete |
| L3 | Inter-contract: auction → time-lock vault → refund distributor; CI/CD pipeline; mobile-responsive countdown + live reveal feed; 3+ contract tests (tie-break logic, late reveal attack, early finalize attempt); demo video of 3-wallet live auction end-to-end | ✅ Complete |

## Contract architecture

```
AuctionContract
  ├── commit(hash, deposit)       → locks XLM, stores commitment
  ├── reveal(amount, salt)        → verifies hash(amount+salt) == commitment
  ├── finalize()                  → callable after deadline; picks winner
  └── claim_refund()              → losers call to retrieve deposit

TimeLockVaultContract
  └── release(address, amount)    → called by AuctionContract post-finalize

RefundDistributorContract
  └── batch_refund(losers[])      → bulk refunds all non-winners
```

## Commitment scheme

```
Client-side:  commitment = sha256(amount + salt)
On submit:    AuctionContract.commit(commitment, xlm_deposit)
On reveal:    AuctionContract.reveal(amount, salt)
              contract verifies: sha256(amount + salt) == stored_commitment
```

## Auction phases

```
BIDDING  → REVEAL  → FINALIZED
  ↑ deadline enforced by ledger timestamp
```

## Setup

```bash
git clone <repo-url>
cd sealed-bid-auction
npm install

soroban contract deploy --wasm target/wasm32-unknown-unknown/release/auction.wasm --network testnet

npm run dev
```

## Environment variables

```env
VITE_AUCTION_CONTRACT_ID=C...
VITE_VAULT_CONTRACT_ID=C...
VITE_REFUND_CONTRACT_ID=C...
VITE_STELLAR_NETWORK=testnet
```

## Deployed contracts

| Contract | Address |
|----------|---------|
| AuctionContract | `CAWMD56O7M2HYYXD5AUE5PRGFJ5CJZ5GL4RXACTYFGYPEIGYCNOULIPF` |
| TimeLockVaultContract | `CDZOINVUO7QY4V2VUA755Y4WFRLAAVJBNJH7XZIKF3DKOHIXHYEN5KAK` |
| RefundDistributorContract | `CCRZYYLKJZFZLNZAETCLD6G2TJDBUWVNZC6DH4VJ2HYTFYUOOIUYRAVI` |
| Native XLM Token | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

## Screenshots

<!-- Add: bidding UI, commit confirmation, reveal phase feed, winner declared + refund tx -->

## Transaction reference

Contract interaction tx hash: `[verifiable on Stellar Expert]`
