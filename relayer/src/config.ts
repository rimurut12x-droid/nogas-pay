import { defineChain, type Address, type Hex } from "viem";

export const RPC_URL = process.env.RPC_URL ?? "https://rpc.xlayer.tech";
export const xlayer = defineChain({
  id: Number(process.env.CHAIN_ID ?? 196),
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

export const BENSIN = (process.env.BENSIN_ADDRESS ?? "") as Address;
export const RELAYER_KEY = (process.env.RELAYER_KEY ?? "") as Hex;
export const PORT = Number(process.env.PORT ?? 8787);
export const POOL_WOKB_USDG: Address = "0x5d7E3Ad08B0C52e460787677B0632Cd024Df437C";

export const bensinAbi = [
  {
    type: "function",
    name: "quoteTier",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "action", type: "uint8" },
    ],
    outputs: [
      { name: "allow", type: "bool" },
      { name: "tier", type: "uint8" },
      { name: "minFee", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "relay",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "it",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "fee", type: "uint256" },
          { name: "action", type: "uint8" },
          { name: "minOkbOut", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "salt", type: "bytes32" },
        ],
      },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [{ name: "okbOut", type: "uint256" }],
  },
] as const;

export const poolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
] as const;
