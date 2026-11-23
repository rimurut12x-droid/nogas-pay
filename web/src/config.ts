import { defineChain, type Address, type Hex } from "viem";

export const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://rpc.xlayer.tech";
export const RELAYER_URL = import.meta.env.VITE_RELAYER_URL ?? "http://localhost:8787";
export const BENSIN = (import.meta.env.VITE_BENSIN_ADDRESS ?? "") as Address;
/** Dev/demo only: a local key used instead of an injected wallet (anvil fork). Never set in production. */
export const DEV_KEY = (import.meta.env.VITE_DEV_KEY ?? "") as Hex;
export const EXPLORER_TX = "https://www.oklink.com/xlayer/tx/";

export const xlayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/xlayer" } },
});
