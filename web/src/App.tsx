import { useCallback, useEffect, useState } from "react";
import { formatUnits, isAddress, parseAbi, parseUnits, toHex, type Address, type Hex, type WalletClient } from "viem";
import { TOKENS } from "../../relayer/src/tokens";
import type { Intent } from "../../relayer/src/intent";
import { getQuote, submit, type Quote } from "./api";
import { BENSIN, EXPLORER_TX, xlayer } from "./config";
import { Gauge } from "./Gauge";
import { buildAuthorization, splitSig } from "./sign";
import { connect, publicClient } from "./wallet";

type Mode = "send" | "fill";
type TokenKey = keyof typeof TOKENS;
type Status = { kind: "idle" } | { kind: "working"; text: string } | { kind: "done"; text: string; tx: Hex } | { kind: "error"; text: string };

const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const REFUEL_MAX = 10;

export default function App() {
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [okb, setOkb] = useState<number | null>(null);
  const [balances, setBalances] = useState<Record<TokenKey, bigint>>({ USDT0: 0n, USDC: 0n, USDG: 0n });
  const [mode, setMode] = useState<Mode>("send");
  const [token, setToken] = useState<TokenKey>("USDT0");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const t = TOKENS[token];
  const parsed = (() => {
    try {
      return amount ? parseUnits(amount, t.decimals) : 0n;
    } catch {
      return 0n;
    }
  })();

  const refresh = useCallback(async (who: Address) => {
    const [native, ...toks] = await Promise.all([
      publicClient.getBalance({ address: who }),
      ...(Object.keys(TOKENS) as TokenKey[]).map((k) =>
        publicClient.readContract({ address: TOKENS[k].address, abi: erc20, functionName: "balanceOf", args: [who] }),
      ),
    ]);
    setOkb(Number(formatUnits(native, 18)));
    const keys = Object.keys(TOKENS) as TokenKey[];
    setBalances(Object.fromEntries(keys.map((k, i) => [k, toks[i]])) as Record<TokenKey, bigint>);
  }, []);

  async function onConnect() {
    try {
      const c = await connect();
      setWallet(c.wallet);
      setAddress(c.address);
      await refresh(c.address);
    } catch (e: any) {
      setStatus({ kind: "error", text: e?.shortMessage ?? e?.message ?? "Couldn't connect the wallet." });
    }
  }

  // A finished or failed request belongs to the form it came from.
  useEffect(() => {
    setStatus((s) => (s.kind === "working" ? s : { kind: "idle" }));
  }, [mode, token]);

  // Quote whenever the request changes.
  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    if (!address || parsed === 0n) return;
    const action = mode === "fill" ? 1 : 0;
    const id = setTimeout(() => {
      getQuote(address, t.address, parsed, action)
        .then(setQuote)
        .catch((e) => setQuoteError(e.message));
    }, 350);
    return () => clearTimeout(id);
  }, [address, token, parsed, mode]);

  const recipient = mode === "fill" ? address : (to.trim() as Address);
  const problem = (() => {
    if (!address) return "Connect a wallet first.";
    if (parsed === 0n) return "Enter an amount.";
    if (mode === "send" && !isAddress(to.trim())) return "Recipient address isn't valid.";
    if (mode === "fill" && parsed > parseUnits(String(REFUEL_MAX), t.decimals)) return `Fill up is limited to ${REFUEL_MAX} ${token}.`;
    if (quoteError) return quoteError;
    if (!quote) return "Getting the fee…";
    if (!quote.allow) return "This request is over NoGas Pay's limits (amount or today's count).";
    if (parsed + quote.fee > balances[token]) return `Not enough ${token} for amount plus fee.`;
    return "";
  })();

  async function onSign() {
    if (!wallet || !address || !quote || problem) return;
    const action = mode === "fill" ? 1 : 0;
    const intent: Intent = {
      token: t.address,
      from: address,
      to: recipient as Address,
      amount: parsed,
      fee: quote.fee,
      action,
      minOkbOut: quote.minOkbOut,
      validBefore: quote.validBefore,
      salt: toHex(crypto.getRandomValues(new Uint8Array(32))),
    };
    try {
      setStatus({ kind: "working", text: "Waiting for your signature…" });
      const td = buildAuthorization(t, intent, BENSIN, xlayer.id);
      const sig = await wallet.signTypedData({ account: wallet.account ?? address, ...td });
      const { v, r, s } = splitSig(sig);
      setStatus({ kind: "working", text: "NoGas Pay is paying the gas…" });
      const tx = await submit(intent, v, r, s);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      await refresh(address);
      setAmount("");
      setStatus({ kind: "done", text: mode === "fill" ? "Filled up. Your tank has OKB now." : `Sent ${formatUnits(parsed, t.decimals)} ${token}.`, tx });
    } catch (e: any) {
      setStatus({ kind: "error", text: e?.shortMessage ?? e?.message ?? "The request didn't go through. Nothing was taken." });
    }
  }

  const feeText = quote
    ? quote.tier === 0
      ? "Your first send is free."
      : `Fee ${formatUnits(quote.fee, t.decimals)} ${token}, paid from this token. No OKB needed.`
    : "";

  return (
    <main className="page">
      <header className="intro">
        <h1>Out of gas? Move your stablecoins anyway.</h1>
        <p>Sign once. NoGas Pay covers the OKB gas on X Layer and takes a small fee from the token you're sending.</p>
      </header>

      <section className="tank">
        <Gauge okb={okb} />
        {address ? (
          <p className="tank__who">{address.slice(0, 6)}…{address.slice(-4)} on X Layer</p>
        ) : (
          <button className="btn btn--primary" onClick={onConnect}>Connect wallet</button>
        )}
      </section>

      <section className="panel" aria-label="NoGas Pay">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === "send"} onClick={() => setMode("send")}>Send</button>
          <button role="tab" aria-selected={mode === "fill"} onClick={() => setMode("fill")}>Fill up</button>
        </div>
        <p className="panel__lead">
          {mode === "send"
            ? "Send USDT0, USDC or USDG to anyone, even with zero OKB."
            : `Turn up to ${REFUEL_MAX} of a stablecoin into OKB in your own wallet, so you never run dry again.`}
        </p>

        <fieldset className="tokens">
          <legend>Token</legend>
          {(Object.keys(TOKENS) as TokenKey[]).map((k) => (
            <label key={k} className={`chip${k === token ? " chip--on" : ""}`}>
              <input type="radio" name="token" value={k} checked={k === token} onChange={() => setToken(k)} />
              {k}
              {address && <span className="chip__bal">{Number(formatUnits(balances[k], TOKENS[k].decimals)).toFixed(2)}</span>}
            </label>
          ))}
        </fieldset>

        {mode === "send" && (
          <label className="field">
            <span>Recipient</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" />
          </label>
        )}

        <label className="field">
          <span>Amount</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} placeholder="0.00" inputMode="decimal" />
        </label>

        <p className="fee" aria-live="polite">{problem && address && parsed > 0n ? problem : feeText}</p>

        <button className="btn btn--primary btn--wide" disabled={!!problem || status.kind === "working"} onClick={onSign}>
          {mode === "send" ? "Sign and send" : "Sign and fill up"}
        </button>

        {status.kind !== "idle" && (
          <p className={`status status--${status.kind}`} role="status">
            {status.text}{" "}
            {status.kind === "done" && (
              <a href={EXPLORER_TX + status.tx} target="_blank" rel="noreferrer">View transaction</a>
            )}
          </p>
        )}
      </section>

      <footer className="foot">
        <p>
          Every request passes Satpam, a TapeOut circuit on X Layer that decides whether NoGas Pay sponsors it and at which fee.
          The rules are frozen on-chain: first small send free, $0.02 normal, $0.10 above $1,000, up to 10 per wallet per day.
        </p>
      </footer>
    </main>
  );
}
