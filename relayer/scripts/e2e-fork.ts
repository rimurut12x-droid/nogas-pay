// End-to-end on the local anvil fork: a wallet with 0 OKB sends USDT0 and refuels through the HTTP relayer.
import { createPublicClient, createTestClient, http, parseAbi, toHex, type Address } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { intentNonce, receiveWithAuthorizationTypes, type Intent } from "../src/intent";
import { TOKENS } from "../src/tokens";

const A = "http://127.0.0.1:8545";
const RELAYER = "http://127.0.0.1:8787";
const BENSIN = process.env.BENSIN_ADDRESS as Address;
const POOL_USDT0 = "0x0cBe0dBE1400e57f371a38BD3b9bC80F7C3676dA";
const erc20 = parseAbi(["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const pub = createPublicClient({ transport: http(A) });
const test = createTestClient({ mode: "anvil", transport: http(A) });
const user = privateKeyToAccount(generatePrivateKey());
const bob = privateKeyToAccount(generatePrivateKey()).address;
const t = TOKENS.USDT0;

const post = async (path: string, body: unknown) => {
  const r = await fetch(RELAYER + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${j.error}`);
  return j;
};

async function run(to: Address, amount: bigint, action: number) {
  const q = await post("/quote", { user: user.address, token: t.address, amount, action });
  if (!q.allow) throw new Error("denied");
  const it: Intent = {
    token: t.address, from: user.address, to, amount, fee: BigInt(q.fee), action,
    minOkbOut: BigInt(q.minOkbOut), validBefore: BigInt(q.validBefore), salt: toHex(crypto.getRandomValues(new Uint8Array(32))),
  };
  const sig = await user.signTypedData({
    domain: { name: t.name, version: t.version, chainId: 196, verifyingContract: t.address },
    types: receiveWithAuthorizationTypes, primaryType: "ReceiveWithAuthorization",
    message: { from: user.address, to: BENSIN, value: amount + it.fee, validAfter: 0n, validBefore: it.validBefore, nonce: intentNonce(it, 196n, BENSIN) },
  });
  const r = BigInt(sig.slice(0, 66)); const s = BigInt("0x" + sig.slice(66, 130)); const v = parseInt(sig.slice(130, 132), 16);
  const { txHash } = await post("/relay", { intent: it, v, r: toHex(r, { size: 32 }), s: toHex(s, { size: 32 }) });
  const rc = await pub.waitForTransactionReceipt({ hash: txHash });
  return { tier: q.tier, fee: it.fee, status: rc.status };
}

await test.impersonateAccount({ address: POOL_USDT0 });
await test.setBalance({ address: POOL_USDT0, value: 10n ** 18n });
const { createWalletClient } = await import("viem");
await createWalletClient({ account: POOL_USDT0, transport: http(A) }).writeContract({ address: t.address, abi: erc20, functionName: "transfer", args: [user.address, 100_000_000n], chain: null });
console.log("user OKB before:", await pub.getBalance({ address: user.address }));
console.log("send 5 USDT0 (first time):", await run(bob, 5_000_000n, 0));
console.log("send 20 USDT0:", await run(bob, 20_000_000n, 0));
console.log("refuel 2 USDT0:", await run(user.address, 2_000_000n, 1));
console.log("bob USDT0:", await pub.readContract({ address: t.address, abi: erc20, functionName: "balanceOf", args: [bob] }));
console.log("user OKB after:", await pub.getBalance({ address: user.address }));
