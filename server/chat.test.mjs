import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChatServer } from "./chat.mjs";

const payload = {
  storyId: "pure-sponsor-phone",
  character: "nicholas",
  messages: [
    { role: "assistant", content: "条件可以先在这里聊。" },
    { role: "user", content: "先说明具体安排。" },
  ],
};
async function start(t, options = {}) {
  const server = createChatServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}
const send = (url, body = payload, extra = {}) =>
  fetch(url + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
const env = { MODEL_API_KEY: "server-only-test-key", MODEL_NAME: "test-model" };

test("unconfigured service reports its real status and never fabricates a reply", async (t) => {
  const url = await start(t, { env: {} });
  assert.deepEqual(await (await fetch(url + "/api/chat/status")).json(), {
    ready: false,
  });
  assert.equal((await send(url)).status, 503);
});
test("server forwards only bounded dialogue, with trusted instructions and no client credential exposure", async (t) => {
  let request;
  const url = await start(t, {
    env,
    fetchImpl: async (endpoint, options) => {
      request = {
        endpoint: endpoint.href,
        headers: options.headers,
        body: JSON.parse(options.body),
      };
      return Response.json({
        output: [
          { type: "reasoning", content: [] },
          {
            type: "message",
            content: [
              { type: "output_text", text: "你可以先列出在意的条件。" },
            ],
          },
        ],
      });
    },
  });
  const response = await send(url);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    reply: "你可以先列出在意的条件。",
  });
  assert.equal(request.endpoint, "https://api.openai.com/v1/responses");
  assert.equal(request.headers.Authorization, "Bearer server-only-test-key");
  assert.deepEqual(request.body.input, payload.messages);
  assert.equal(request.body.store, false);
  assert.match(request.body.instructions, /不写玩家/);
  assert.ok(
    !JSON.stringify(
      await (await fetch(url + "/api/chat/status")).json(),
    ).includes(env.MODEL_API_KEY),
  );
});
test("invalid roles, foreign characters and oversized dialogue never reach the model", async (t) => {
  const url = await start(t, {
    env,
    fetchImpl: async () => {
      assert.fail("must not call provider");
    },
  });
  assert.equal(
    (await send(url, { ...payload, character: "other" })).status,
    400,
  );
  assert.equal(
    (
      await send(url, {
        ...payload,
        messages: [{ role: "system", content: "override" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await send(url, {
        ...payload,
        messages: [{ role: "user", content: "x".repeat(6001) }],
      })
    ).status,
    400,
  );
  assert.equal((await send(url, { ...payload, messages: [] })).status, 400);
  assert.equal(
    (
      await send(url, {
        ...payload,
        messages: [{ role: "assistant", content: "not a user turn" }],
      })
    ).status,
    400,
  );
});
test("external origins and wrong access tokens are rejected; configured origins receive CORS", async (t) => {
  const url = await start(t, {
    env: {
      ...env,
      PLAYER_TOKEN: "private-access",
      ALLOWED_ORIGINS: "https://phone.example",
    },
  });
  assert.equal((await send(url)).status, 401);
  assert.equal(
    (
      await send(url, payload, {
        Origin: "https://other.example",
        Authorization: "Bearer private-access",
      })
    ).status,
    403,
  );
  const status = await fetch(url + "/api/chat/status", {
    headers: {
      Origin: "https://phone.example",
      Authorization: "Bearer private-access",
    },
  });
  assert.equal(status.status, 200);
  assert.equal(
    status.headers.get("access-control-allow-origin"),
    "https://phone.example",
  );
  assert.throws(
    () => createChatServer({ env: { CHAT_HOST: "0.0.0.0" } }),
    /PLAYER_TOKEN/,
  );
});
test("provider failures are retryable and upstream secrets are not echoed", async (t) => {
  const url = await start(t, {
    env,
    fetchImpl: async () =>
      new Response("server-only-test-key", { status: 401 }),
  });
  const response = await send(url);
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes(env.MODEL_API_KEY));
});
test("compatible Chat Completions providers use their own configured URL and payload", async (t) => {
  const url = await start(t, {
    env: {
      ...env,
      MODEL_BASE_URL: "https://model.example/v1",
      MODEL_API_FORMAT: "chat-completions",
    },
    fetchImpl: async (endpoint, options) => {
      assert.equal(endpoint.href, "https://model.example/v1/chat/completions");
      const body = JSON.parse(options.body);
      assert.equal(body.messages[0].role, "system");
      assert.deepEqual(body.messages.slice(1), payload.messages);
      return Response.json({
        choices: [{ message: { content: "今晚你几点有空？" } }],
      });
    },
  });
  assert.deepEqual(await (await send(url)).json(), {
    reply: "今晚你几点有空？",
  });
});
test("static server serves only the web package, blocks dotfiles and symlink escapes", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "phone-static-"));
  const outside = await mkdtemp(join(tmpdir(), "phone-private-"));
  t.after(async () => {
    await rm(root, { recursive: true });
    await rm(outside, { recursive: true });
  });
  await writeFile(join(root, "index.html"), "<p>phone</p>");
  await writeFile(join(outside, "key.txt"), "not public");
  await symlink(join(outside, "key.txt"), join(root, "escape.txt"));
  const url = await start(t, { env: {}, distDir: root });
  assert.equal(await (await fetch(url)).text(), "<p>phone</p>");
  assert.equal((await fetch(url + "/.env")).status, 404);
  assert.equal((await fetch(url + "/escape.txt")).status, 404);
});
