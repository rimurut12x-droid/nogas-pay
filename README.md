# NoGas Pay — send stablecoins with an empty gas tank

NoGas Pay lets a wallet with **0 OKB** send USDT0, USDC or USDG on X Layer, or turn a few dollars of
stablecoin into OKB ("fill up"), with a single signature. NoGas Pay covers the gas and takes a small fee
from the token being sent. Every request is checked by a **security circuit** on TapeOut whose rules are
frozen on-chain.

## Mainnet (X Layer, chain 196)

| What | Address |
|---|---|
| NoGas Pay contract (`Bensin`) | `0x067FC6bb277777D9AA81AF392F8F81163999aDEE` |
| TapeOut processor "Bensin" (BNSN, the project's working name) | `0x64De6eA63Eb3AFe65E4026BF03911cb7aAa6e43f` |
| Security circuit id | `1` (6 inputs, 3 outputs, 26 NAND gates) |
| Security circuit netlist keccak256 | `0x49d19ee729f56bb21d632bfa9a1319c5110e184a10a3d979ee9d8ddec3adab6a` |
| Relayer / treasury | `0xcA67fC3BD9b659250EC20C6E190Eed6d57F3F1d9` |

## How it works

1. The app asks the relayer for a quote; the contract's `quoteTier` asks the security circuit (`eval`).
2. The user signs one EIP-3009 `ReceiveWithAuthorization` for amount + fee, payable only to Bensin,
   whose nonce is `keccak256(chainid, bensin, intent)`, so the signature is valid for that exact intent.
3. Anyone (normally the relayer) calls `Bensin.relay`. The contract checks the circuit's verdict and
   the fee, pulls the tokens, pays the recipient (send) or swaps to native OKB via Uniswap v3 (fill up),
   and sends the fee to the treasury, all in one transaction.

Security rules (frozen in the netlist): over $10,000 or more than 10 requests per wallet per day are
refused; fill up only up to $10; first small send is free; $0.02 normally; $0.10 above $1,000.

## Repository

- `circuit/` security circuit generator (`satpam.py`), TAP-02 reference evaluator, full truth-table tests
- `contracts/` Foundry: `Bensin.sol`, unit tests, X Layer fork tests, `script/Deploy.s.sol`
- `relayer/` TypeScript quote/relay service (viem)
- `web/` Vite + React app
- `scripts/dev-fork.sh` local anvil fork with everything deployed

## Run the tests

```bash
python3 -m unittest circuit/test_satpam.py
cd contracts && forge test
cd relayer && npm test
cd web && npm test
```

## Hosting (Vercel)

One Vercel project from this repository: the web app is static (`web/dist`) and the relayer runs as two
serverless functions (`api/quote.ts`, `api/relay.ts`). Set these environment variables in Vercel:

| Variable | Value |
|---|---|
| `RELAYER_KEY` | the relayer's private key (from your local `.env`; keep it secret) |
| `NOGAS_CONTRACT` | `0x067FC6bb277777D9AA81AF392F8F81163999aDEE` |
| `RPC_URL` | `https://rpc.xlayer.tech` |

The web build reads `web/.env.production` (relayer at `/api`, mainnet addresses).
