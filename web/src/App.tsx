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
    // A quote is valid for 10 minutes; re-quote right before signing so an open tab never signs a stale one.
    let fresh: Quote;
    try {
      setStatus({ kind: "working", text: "Checking the fee…" });
      fresh = await getQuote(address, t.address, parsed, action);
    } catch (e: any) {
      setStatus({ kind: "error", text: e?.message ?? "Couldn't get the fee. Try again." });
      return;
    }
    setQuote(fresh);
    if (!fresh.allow || fresh.fee > quote.fee || parsed + fresh.fee > balances[token]) {
      setStatus({ kind: "error", text: "The fee changed. Check the summary and press the button again." });
      return;
    }
    const intent: Intent = {
      token: t.address,
      from: address,
      to: recipient as Address,
      amount: parsed,
      fee: fresh.fee,
      action,
      minOkbOut: fresh.minOkbOut,
      validBefore: fresh.validBefore,
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
      <div className="bg" aria-hidden="true">
        <div className="bg__grid" />
        <div className="bg__glow bg__glow--a" />
        <div className="bg__glow bg__glow--b" />
      </div>

      <nav className="nav">
        <a className="brand" href="#top">
          <svg viewBox="0 0 32 32" className="brand__mark" aria-hidden="true">
            <path d="M5 23a11 11 0 1 1 22 0" />
            <path d="M16 23 9.5 13.5" className="brand__needle" />
          </svg>
          <span>NoGas Pay</span>
        </a>
        <div className="nav__links">
          <a href="#how">How it works</a>
          <a href="#rules">Fees</a>
          <a href="https://github.com/rimurut12x-droid/nogas-pay" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div className="nav__right">
          {address ? (
            <span className="pill pill--wallet"><span className="pill__dot" />{address.slice(0, 6)}…{address.slice(-4)}</span>
          ) : (
            <button className="btn btn--primary btn--sm" onClick={onConnect}>Connect wallet</button>
          )}
        </div>
      </nav>

      <main id="top">
        <header className="hero">
          <span className="badge"><span className="pill__dot" />Live on X Layer mainnet</span>
          <h1>Send stablecoins.<br />Skip the gas.</h1>
          <p className="hero__lead">
            Move USDT0, USDC and USDG with zero OKB in your wallet. One signature, and we cover the gas.
          </p>
        </header>

        <section className="stage">
          <div className="orb orb--usdt" aria-hidden="true">₮</div>
          <div className="orb orb--usdc" aria-hidden="true">$</div>
          <div className="orb orb--okb" aria-hidden="true">OKB</div>
          <div className="orb orb--usdg" aria-hidden="true">G</div>

          <section className="panel" aria-label="NoGas Pay">
            <div className="panel__head">
              <div className="tabs" role="tablist">
                <button role="tab" aria-selected={mode === "send"} onClick={() => setMode("send")}>Send</button>
                <button role="tab" aria-selected={mode === "fill"} onClick={() => setMode("fill")}>Fill up</button>
              </div>
              <div className="tank" title="Your OKB gas tank">
                <Gauge okb={okb} />
              </div>
            </div>

            <fieldset className="tokens">
              <legend>Pay with</legend>
              {(Object.keys(TOKENS) as TokenKey[]).map((k) => (
                <label key={k} className={`token${k === token ? " token--on" : ""}`}>
                  <input type="radio" name="token" value={k} checked={k === token} onChange={() => setToken(k)} />
                  <span className={`token__icon token__icon--${k.toLowerCase()}`} aria-hidden="true">
                    {k === "USDT0" ? "₮" : k === "USDC" ? "$" : "G"}
                  </span>
                  <span className="token__text">
                    <span className="token__name">{k}</span>
                    <span className="token__bal">
                      {address ? Number(formatUnits(balances[k], TOKENS[k].decimals)).toFixed(2) : "–"}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <label className="amount">
              <span className="amount__label">{mode === "send" ? "You send" : "You fill up with"}</span>
              <span className="amount__row">
                <input value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} placeholder="0" inputMode="decimal" aria-label="Amount" />
                <span className="amount__unit">{token}</span>
              </span>
            </label>

            {mode === "send" && (
              <label className="field">
                <span>To</span>
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient address 0x…" spellCheck={false} autoComplete="off" />
              </label>
            )}

            {showSummary && (
              <dl className="summary">
                <div><dt>Total from your wallet</dt><dd>{fmt(parsed + quote!.fee)} {token}</dd></div>
                <div>
                  <dt>Fee</dt>
                  <dd>{quote!.tier === 0 ? <span className="free">Free, your first send</span> : `${fmt(quote!.fee)} ${token}`}</dd>
                </div>
                <div>
                  <dt>{mode === "send" ? "They receive" : "You receive"}</dt>
                  <dd>{mode === "send" ? `${fmt(parsed)} ${token}` : `≥ ${Number(formatUnits(quote!.minOkbOut, 18)).toFixed(5)} OKB`}</dd>
                </div>
                <div><dt>Gas you pay</dt><dd>0 OKB</dd></div>
              </dl>
            )}

            {hint && <p className="hint" aria-live="polite">{hint}</p>}

            {address ? (
              <button className="btn btn--primary btn--wide" disabled={!!problem || status.kind === "working"} onClick={onSign}>
                {status.kind === "working" ? status.text : mode === "send" ? "Sign and send" : "Sign and fill up"}
              </button>
            ) : (
              <button className="btn btn--primary btn--wide" onClick={onConnect}>Connect wallet</button>
            )}

            {(status.kind === "done" || status.kind === "error") && (
              <p className={`status status--${status.kind}`} role="status">
                {status.text}{" "}
                {status.kind === "done" && (
                  <a href={EXPLORER_TX + status.tx} target="_blank" rel="noreferrer">View transaction</a>
                )}
              </p>
            )}
          </section>
        </section>

        <section className="facts" aria-label="At a glance">
          <div><strong>0 OKB</strong><span>gas needed in your wallet</span></div>
          <div><strong>$0.02</strong><span>fee for most sends</span></div>
          <div><strong>1 tx</strong><span>signed once, settled at once</span></div>
          <div><strong>26 gates</strong><span>of on-chain rules you can verify</span></div>
        </section>

        <section className="features">
          <article>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h12M12 6l6 6-6 6" /></svg>
            <h3>Send with an empty tank</h3>
            <p>Your stablecoins move even when your wallet holds no OKB. The fee comes out of the token you send.</p>
          </article>
          <article>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20V9l6-5 6 5v11M10 20v-6h4v6" /></svg>
            <h3>Fill up in one tap</h3>
            <p>Turn a few dollars of stablecoin into OKB in your own wallet, so you never get stuck again.</p>
          </article>
          <article>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6l-7-3Z" /></svg>
            <h3>Signed for one request</h3>
            <p>Your signature pays this exact transfer and nothing else. No approvals left behind.</p>
          </article>
        </section>

        <section className="how" id="how" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <ol>
            <li><strong>Sign</strong><span>Approve one message in your wallet. It can only pay this exact request.</span></li>
            <li><strong>Security checks</strong><span>A TapeOut circuit on X Layer decides if the request is sponsored and its fee.</span></li>
            <li><strong>Done</strong><span>NoGas Pay pays the OKB gas and settles everything in one transaction.</span></li>
          </ol>
        </section>

        <section className="rules" id="rules" aria-labelledby="rules-title">
          <div>
            <h2 id="rules-title">Fees and limits, frozen on‑chain</h2>
            <p>
              The security circuit is #1 on processor{" "}
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
      </main>

      <footer className="foot">
        <span>NoGas Pay, built on X Layer with TapeOut</span>
        <a href="https://github.com/rimurut12x-droid/nogas-pay" target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>
    </div>
  );
}
