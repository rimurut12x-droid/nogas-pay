import { loadFont } from "@remotion/google-fonts/Geist";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export const font = fontFamily;

/** Same palette as the live app (web/src/styles.css). */
export const c = {
  bg: "#0b1f3a",
  deep: "#071629",
  azure: "#2f80ed",
  text: "#f8fafc",
  muted: "#a9bcd6",
  dim: "#7d93b2",
  coral: "#ff6f61",
  empty: "#b3313a",
  ok: "#3ddc97",
  line: "rgba(248,250,252,0.12)",
  glass: "rgba(255,255,255,0.05)",
};

export const FPS = 30;

/** One entry per scene: voiceover file, its length in seconds, the scene length and the caption text. */
export const scenes = [
  { vo: "vo/s1.mp3", voSec: 10.84, sec: 12, text: "You have twenty dollars of USDT on X Layer. You want to send it. And your wallet says… not enough gas. Zero OKB. Everyone in crypto has been here." },
  { vo: "vo/s2.mp3", voSec: 9.95, sec: 11, text: "The usual fix? Buy OKB on an exchange, withdraw it, wait… and pay more in fees than the transfer itself. Just to move your own money." },
  { vo: "vo/s3.mp3", voSec: 8.75, sec: 10, text: "This is NoGas Pay. Send stablecoins on X Layer with an empty gas tank. The gauge shows your OKB. Empty. And that's fine." },
  { vo: "vo/s4.mp3", voSec: 16.59, sec: 18, text: "Pick USDT, USDC or USDG. Enter the amount and the recipient. You sign once. No approval, no gas. NoGas Pay submits the transaction, pays the OKB, and takes a small fee from the token you send. And your first send is free." },
  { vo: "vo/s5.mp3", voSec: 10.03, sec: 11.5, text: "This is a real send on X Layer mainnet. One USDC, from a wallet holding zero OKB. Our relayer paid the gas: less than a tenth of a cent." },
  { vo: "vo/s6.mp3", voSec: 7.63, sec: 9, text: "And Fill up turns a couple of dollars of stablecoin into native OKB, right in your own wallet. So you never run dry again." },
  { vo: "vo/s7.mp3", voSec: 20.11, sec: 21.5, text: "Who gets sponsored isn't decided by a server. Every request is checked by a security circuit on TapeOut: twenty-six NAND gates, on X Layer. It caps the amount, limits requests per day, and picks the fee tier. Our contract pins the circuit's hash, so the rules can't be changed quietly. Anyone can read them, and run them again." },
  { vo: "vo/s8.mp3", voSec: 13.32, sec: 14.5, text: "Two cents per send. Gas on X Layer costs a fraction of a cent, so almost all of it is margin. Next: more tokens, BNB Chain, and an API, so any app can offer gasless sends." },
  { vo: "vo/s9.mp3", voSec: 7.81, sec: 10, text: "NoGas Pay. Send stablecoins. Skip the gas. Live now, at nogas-pay.vercel.app." },
] as const;

export const VO_DELAY = 0.5; // seconds of silence before each scene's voiceover
export const TOTAL_FRAMES = scenes.reduce((n, s) => n + Math.round(s.sec * FPS), 0);
