import type { Reply } from "../relayer/src/handlers.js";

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (c: number) => Res; setHeader: (k: string, v: string) => void; send: (b: string) => void };

/** Adapts a transport-independent handler to a Vercel Node function. */
export function wrap(handler: (body: any, ip: string) => Promise<Reply>) {
  return async (req: Req, res: Res) => {
    res.setHeader("content-type", "application/json");
    if (req.method !== "POST") return res.status(405).send(JSON.stringify({ error: "use POST" }));
    const fwd = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd ?? "?").split(",")[0].trim();
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
      const r = await handler(body, ip);
      const { toJson } = await import("../relayer/src/handlers.js");
      return res.status(r.status).send(toJson(r.body));
    } catch (e: any) {
      return res.status(400).send(JSON.stringify({ error: e?.shortMessage ?? e?.message ?? "error" }));
    }
  };
}
