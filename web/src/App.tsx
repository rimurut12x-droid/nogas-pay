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

  const fmt = (v: bigint) => Number(formatUnits(v, t.decimals)).toLocaleString("en-US", { maximumFractionDigits: 6 });
  const showSummary = !!quote && quote.allow && parsed > 0n;
  const hint = problem && address && parsed > 0n ? problem : "";

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <svg viewBox="0 0 32 32" className="brand__mark" aria-hidden="true">
            <path d="M5 23a11 11 0 1 1 22 0" />
            <path d="M16 23 9.5 13.5" className="brand__needle" />
          </svg>
          <span>NoGas Pay</span>
        </div>
        <div className="nav__right">
          <span className="pill"><span className="pill__dot" />X Layer</span>
          {address && <span className="pill pill--wallet">{address.slice(0, 6)}…{address.slice(-4)}</span>}
        </div>
      </nav>

      <header className="hero">
        <div className="hero__copy">
          <h1>Out of gas? Move your stablecoins anyway.</h1>
          <p className="hero__lead">
            Sign once. NoGas Pay covers the OKB gas on X Layer and takes a small fee from the token you send.
          </p>
          <ul className="hero__points">
            <li>One signature, no approvals</li>
            <li>Zero OKB needed</li>
            <li>Rules frozen on-chain</li>
          </ul>
        </div>
        <div className="tank">
          <Gauge okb={okb} />
          {!address && (
            <button className="btn btn--primary" onClick={onConnect}>Connect wallet</button>
          )}
        </div>
      </header>

      <section className="panel" aria-label="NoGas Pay">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === "send"} onClick={() => setMode("send")}>Send</button>
          <button role="tab" aria-selected={mode === "fill"} onClick={() => setMode("fill")}>Fill up</button>
        </div>
        <p className="panel__lead">
          {mode === "send"
            ? "Send USDT0, USDC or USDG to anyone, even with an empty gas tank."
            : `Turn up to ${REFUEL_MAX} of a stablecoin into OKB in your own wallet, so you never run dry again.`}
        </p>

        <fieldset className="tokens">
          <legend>Pay with</legend>
          {(Object.keys(TOKENS) as TokenKey[]).map((k) => (
            <label key={k} className={`token${k === token ? " token--on" : ""}`}>
              <input type="radio" name="token" value={k} checked={k === token} onChange={() => setToken(k)} />
              <span className="token__name">{k}</span>
              <span className="token__bal">
                {address ? Number(formatUnits(balances[k], TOKENS[k].decimals)).toFixed(2) : "–"}
              </span>
            </label>
          ))}
        </fieldset>

        <label className="amount">
          <span className="amount__label">Amount</span>
          <span className="amount__row">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} placeholder="0" inputMode="decimal" aria-label="Amount" />
            <span className="amount__unit">{token}</span>
          </span>
        </label>

        {mode === "send" && (
          <label className="field">
            <span>Recipient</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" />
          </label>
        )}

        {showSummary && (
          <dl className="summary">
            <div><dt>You send</dt><dd>{fmt(parsed + quote!.fee)} {token}</dd></div>
            <div>
              <dt>Fee</dt>
              <dd>{quote!.tier === 0 ? <span className="free">Free, first send</span> : `${fmt(quote!.fee)} ${token}`}</dd>
            </div>
            <div>
              <dt>{mode === "send" ? "They receive" : "You receive"}</dt>
              <dd>{mode === "send" ? `${fmt(parsed)} ${token}` : `≥ ${Number(formatUnits(quote!.minOkbOut, 18)).toFixed(5)} OKB`}</dd>
            </div>
            <div><dt>Gas paid by you</dt><dd>0 OKB</dd></div>
          </dl>
        )}

        {hint && <p className="hint" aria-live="polite">{hint}</p>}

        <button className="btn btn--primary btn--wide" disabled={!!problem || status.kind === "working"} onClick={onSign}>
          {status.kind === "working" ? status.text : mode === "send" ? "Sign and send" : "Sign and fill up"}
        </button>

        {(status.kind === "done" || status.kind === "error") && (
          <p className={`status status--${status.kind}`} role="status">
            {status.text}{" "}
            {status.kind === "done" && (
              <a href={EXPLORER_TX + status.tx} target="_blank" rel="noreferrer">View transaction</a>
            )}
          </p>
        )}
      </section>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol>
          <li><strong>Sign</strong><span>Approve one message in your wallet. It can only pay this exact request.</span></li>
          <li><strong>Satpam checks</strong><span>A TapeOut circuit on X Layer decides if the request is sponsored and its fee.</span></li>
          <li><strong>Done</strong><span>NoGas Pay pays the OKB gas and settles everything in one transaction.</span></li>
        </ol>
      </section>

      <section className="rules" aria-labelledby="rules-title">
        <div>
          <h2 id="rules-title">Rules frozen on-chain</h2>
          <p>
            Satpam is circuit #1 on processor {" "}
            <a href="https://www.oklink.com/xlayer/address/0x64De6eA63Eb3AFe65E4026BF03911cb7aAa6e43f" target="_blank" rel="noreferrer">0x64De…e43f</a>.
            Its 26 NAND gates can't be changed, and the contract checks their hash.
          </p>
        </div>
        <table>
          <tbody>
            <tr><th>First send up to $10</th><td>Free</td></tr>
            <tr><th>Up to $1,000</th><td>$0.02</td></tr>
            <tr><th>Up to $10,000</th><td>$0.10</td></tr>
            <tr><th>Fill up</th><td>Up to $10, $0.02</td></tr>
            <tr><th>Per wallet</th><td>10 a day</td></tr>
          </tbody>
        </table>
      </section>

      <footer className="foot">
        <span>NoGas Pay on X Layer</span>
        <a href="https://github.com/rimurut12x-droid/nogas-pay" target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>
    </div>
  );
}
