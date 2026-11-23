# X Layer TapeOut Accelerate — NoGas Pay submission

Answers for the Google Form (https://forms.gle/EoDNbxQ65dev1wFd9). Fill the public URL, repository and
video link once they exist.

## Project name
NoGas Pay

## One-line description
Send stablecoins on X Layer with an empty gas tank: sign once, NoGas Pay covers the OKB gas and takes a small
fee from the token you send. A TapeOut circuit decides which requests are sponsored.

## The problem
Almost everyone who uses crypto has hit this: you hold USDT, you want to send it, and the wallet says you
need the chain's gas token first. Getting a few cents of OKB means buying it on an exchange and
withdrawing, or bridging, often paying more in fees and time than the transfer itself. New users from
exchanges, P2P traders and people paid in stablecoins hit it most.

## The product
- **Send**: send USDT0, USDC or USDG to anyone with zero OKB. One signature, no approval, no gas.
- **Fill up**: turn up to $10 of a stablecoin into native OKB in your own wallet, so you never run dry again.
- Works with any EVM wallet (OKX Wallet, MetaMask, Rabby). The fee is shown before you sign.

## How TapeOut is used
- The **security circuit** is a combinational TapeOut circuit (26 NAND gates, 6 inputs, 3 outputs) on our own
  processor "Bensin" (BNSN, our working name) on X Layer.
  - Processor: `0x64De6eA63Eb3AFe65E4026BF03911cb7aAa6e43f`, circuit id `1`
  - Netlist keccak256: `0x49d19ee729f56bb21d632bfa9a1319c5110e184a10a3d979ee9d8ddec3adab6a`
- Every quote and every relay calls the circuit with `eval`. Its inputs are the amount bucket, the
  wallet's requests today, whether it's a fill up, and whether it's the wallet's first use. Its outputs
  are *allow* and the *fee tier*.
- The NoGas Pay contract (`0x067FC6bb277777D9AA81AF392F8F81163999aDEE`) pins the processor, circuit id
  and netlist hash at deployment and refuses to deploy against any other circuit. The sponsorship rules
  cannot be changed quietly by the operator: anyone can read the netlist and re-run it.
- Rules in the circuit: refuse above $10,000 or after 10 requests per wallet per day; fill up only up to
  $10; first small send free; $0.02 normal; $0.10 above $1,000.
- The circuit was generated in Python, checked against the TAP-02 reference evaluator for all 64
  inputs, and checked again on-chain (fork test calls the live processor's `eval` for all 64 inputs).

## Target users and how we reach them
- Holders of stablecoins on X Layer who don't hold OKB: people withdrawing USDT from exchanges, P2P
  traders, freelancers paid in stablecoins.
- Southeast Asia first (Indonesia), where stablecoin P2P use is high and "gas habis" is a daily
  annoyance. Reach: shareable send links, crypto communities and Telegram groups, wallet integrations.
- dApps that want "gasless" sends for their own users can call the same contract through the relayer.

## Revenue model and why users pay
- A fee per sponsored transaction ($0.02 normal, $0.10 for large sends). Gas on X Layer costs a fraction
  of a cent, so almost all of the fee is margin.
- Fill ups pay the same per-request fee; the swapped OKB goes to the user in full.
- The first small send is free to bring users in.
- Users pay because the alternative (buying OKB elsewhere and withdrawing or bridging) costs more and
  takes minutes; they come back because every stablecoin wallet runs out of gas again.

## What was built during the event
Everything in the repository: circuit, contract, fork tests, relayer, web app and the mainnet
deployment (23 Nov 2026).

## Roadmap
More tokens, more chains (BNB Chain first, where the founder hit the problem), a send-by-link flow, and an
API for dApps.

## Links
- App: https://nogas-pay.vercel.app
- Repository: https://github.com/rimurut12x-droid/nogas-pay
- Demo video: https://youtu.be/elFSask67tQ
