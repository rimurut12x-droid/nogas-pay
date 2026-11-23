import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { PORT } from "./config.js";
import { handleQuote, handleRelay, toJson, type Reply } from "./handlers.js";

const send = (res: ServerResponse, r: Reply) => {
  res.writeHead(r.status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
  });
  res.end(toJson(r.body));
};

async function body(req: IncomingMessage): Promise<any> {
  let s = "";
  for await (const chunk of req) s += chunk;
  return JSON.parse(s || "{}");
}

export const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, { status: 204, body: {} });
  const ip = req.socket.remoteAddress ?? "?";
  try {
    if (req.method === "POST" && req.url === "/quote") return send(res, await handleQuote(await body(req), ip));
    if (req.method === "POST" && req.url === "/relay") return send(res, await handleRelay(await body(req), ip));
    return send(res, { status: 404, body: { error: "not found" } });
  } catch (e: any) {
    return send(res, { status: 400, body: { error: e?.shortMessage ?? e?.message ?? "error" } });
  }
});

if (process.argv[1]?.endsWith("server.ts")) {
  server.listen(PORT, () => console.log(`bensin relayer on :${PORT}`));
}
