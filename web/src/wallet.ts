import { createPublicClient, createWalletClient, custom, http, type Address, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DEV_KEY, RPC_URL, xlayer } from "./config";

export const publicClient = createPublicClient({ chain: xlayer, transport: http(RPC_URL) });

declare global {
  interface Window {
    ethereum?: any;
  }
}

export async function connect(): Promise<{ wallet: WalletClient; address: Address }> {
  if (DEV_KEY) {
    const account = privateKeyToAccount(DEV_KEY);
    return { wallet: createWalletClient({ account, chain: xlayer, transport: http(RPC_URL) }), address: account.address };
  }
  if (!window.ethereum) throw new Error("No wallet found. Install OKX Wallet, MetaMask or Rabby, then reload.");
  const wallet = createWalletClient({ chain: xlayer, transport: custom(window.ethereum) });
  const [address] = await wallet.requestAddresses();
  try {
    await wallet.switchChain({ id: xlayer.id });
  } catch {
    await wallet.addChain({ chain: xlayer });
  }
  return { wallet, address };
}
