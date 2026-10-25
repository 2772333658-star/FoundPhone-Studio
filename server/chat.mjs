import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { nicholasInstructions } from "./nicholas.mjs";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const loopback = (host) =>
  ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
};
const json = (res, status, value, extra = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  });
  res.end(JSON.stringify(value));
};
async function readJson(req) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json"))
    throw new HttpError(415, "聊天请求需要使用 JSON。");
  if (Number(req.headers["content-length"]) > 100000)
    throw new HttpError(413, "对话太长，请缩短后重试。");
  const body = await new Promise((done, fail) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 100000) {
        chunks.length = 0;
        fail(new HttpError(413, "对话太长，请缩短后重试。"));
      } else chunks.push(chunk);
    });
    req.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
    req.on("error", fail);
  });
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "聊天请求格式不正确。");
  }
}
export function validateMessages(body) {
  if (body?.storyId !== "pure-sponsor-phone" || body?.character !== "nicholas")
    throw new HttpError(400, "这个角色尚未接入自由聊天。");
  const messages = body.messages;
  if (
    !Array.isArray(messages) ||
    !messages.length ||
    messages.length > 80 ||
    messages.some(
      (m) =>
        !m ||
        !["user", "assistant"].includes(m.role) ||
        typeof m.content !== "string" ||
        !m.content.trim() ||
        m.content.length > 6000,
    ) ||
    messages.at(-1).role !== "user" ||
    messages.reduce((n, m) => n + m.content.length, 0) > 24000
  )
    throw new HttpError(400, "对话格式或长度不正确。");
  return messages.map(({ role, content }) => ({ role, content }));
}
export function modelPayload(format, model, messages) {
  return format === "chat-completions"
    ? {
        model,
        messages: [
          { role: "system", content: nicholasInstructions },
          ...messages,
        ],
        max_tokens: 1200,
      }
    : {
        model,
        instructions: nicholasInstructions,
        input: messages,
        store: false,
        max_output_tokens: 1200,
      };
}
export function modelText(format, result) {
  const text =
    format === "chat-completions"
      ? result?.choices?.[0]?.message?.content
      : result?.output
          ?.filter((x) => x.type === "message")
          .flatMap((x) => x.content || [])
          .filter((x) => x.type === "output_text" || x.type === "refusal")
          .map((x) => x.text || x.refusal)
          .join("\n");
  if (typeof text !== "string" || !text.trim() || text.length > 6000)
    throw new HttpError(502, "这次没有收到完整回复，请重试。");
  return text.trim();
}

export function createChatServer({
  env = process.env,
  fetchImpl = fetch,
  distDir = fileURLToPath(new URL("../dist/", import.meta.url)),
} = {}) {
  const host = env.CHAT_HOST || "127.0.0.1";
  const token = env.PLAYER_TOKEN || "";
  if (!loopback(host) && !token)
    throw Error("对外提供聊天服务时需要设置 PLAYER_TOKEN。");
  const key = env.MODEL_API_KEY || env.OPENAI_API_KEY || "";
  const model = env.MODEL_NAME || "";
  const format = env.MODEL_API_FORMAT || "responses";
  if (!["responses", "chat-completions"].includes(format))
    throw Error("MODEL_API_FORMAT 配置不正确。");
  const upstream = new URL(
    (env.MODEL_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "") +
      (format === "responses" ? "/responses" : "/chat/completions"),
  );
  if (
    upstream.username ||
    upstream.password ||
    upstream.search ||
    upstream.hash ||
    (upstream.protocol !== "https:" &&
      !(upstream.protocol === "http:" && loopback(upstream.hostname)))
  )
    throw Error("MODEL_BASE_URL 需要使用 HTTPS（本机测试除外）。");
  const allowed = new Set(
    (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
  const rate = new Map();
  let inflight = 0;
  return createServer(async (req, res) => {
    let cors = {};
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        const origin = req.headers.origin;
        const requestHost = new URL("http://" + req.headers.host).hostname;
        if (loopback(host) && !loopback(requestHost))
          throw new HttpError(403, "请求来源不受支持。");
        const ownOrigin = `${env.CHAT_HTTPS === "true" ? "https" : "http"}://${req.headers.host}`;
        if (origin && origin !== ownOrigin && !allowed.has(origin))
          throw new HttpError(403, "这个网页尚未获得聊天服务授权。");
        if (origin)
          cors = {
            "Access-Control-Allow-Origin": origin,
            Vary: "Origin",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          };
        if (req.method === "OPTIONS") {
          res.writeHead(204, cors);
          res.end();
          return;
        }
        const supplied = String(req.headers.authorization || "");
        const expected = "Bearer " + token;
        if (
          token &&
          (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
            !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
        )
          throw new HttpError(401, "访问口令不正确，请检查聊天连接。");
        if (url.pathname === "/api/chat/status" && req.method === "GET") {
          json(res, 200, { ready: Boolean(key && model) }, cors);
          return;
        }
        if (url.pathname !== "/api/chat" || req.method !== "POST")
          throw new HttpError(404, "聊天接口不存在。");
        if (!key || !model)
          throw new HttpError(503, "服务尚未配置模型，请完成连接设置后再试。");
        const messages = validateMessages(await readJson(req));
        const now = Date.now(),
          address = req.socket.remoteAddress || "local";
        for (const [ip, state] of rate) if (state.until < now) rate.delete(ip);
        const state = rate.get(address) || { count: 0, until: now + 60000 };
        if (state.count >= 20 || inflight >= 2)
          throw new HttpError(429, "消息有点密，请稍后再试。");
        state.count++;
        rate.set(address, state);
        inflight++;
        const cancel = new AbortController();
        res.on("close", () => cancel.abort());
        try {
          const response = await fetchImpl(upstream, {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.any([
              cancel.signal,
              AbortSignal.timeout(45000),
            ]),
            headers: {
              Authorization: "Bearer " + key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(modelPayload(format, model, messages)),
          });
          if (!response.ok)
            throw new HttpError(
              response.status === 429 ? 429 : 502,
              response.status === 429
                ? "模型服务繁忙，请稍后重试。"
                : "模型服务未能回复，请检查服务端配置。",
            );
          json(
            res,
            200,
            { reply: modelText(format, await response.json()) },
            cors,
          );
        } catch (e) {
          if (e instanceof HttpError) throw e;
          throw new HttpError(
            502,
            "等待回复超时或连接中断，消息已保留，可以重试。",
          );
        } finally {
          inflight--;
        }
        return;
      }
      if (!["GET", "HEAD"].includes(req.method))
        throw new HttpError(405, "请求方式不受支持。");
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.split("/").some((part) => part.startsWith(".")))
        throw new HttpError(404, "文件不存在。");
      const root = await realpath(distDir);
      const file = await realpath(
        resolve(root, "." + (pathname === "/" ? "/index.html" : pathname)),
      );
      if (!file.startsWith(root + sep))
        throw new HttpError(404, "文件不存在。");
      const bytes = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (e) {
      if (!res.headersSent && !res.destroyed)
        json(
          res,
          e instanceof HttpError ? e.status : 404,
          { error: e instanceof HttpError ? e.message : "文件不存在。" },
          cors,
        );
    }
  });
}
