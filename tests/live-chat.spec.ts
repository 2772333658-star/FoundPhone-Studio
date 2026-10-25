import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { compileStory } from "../src/story-engine/compiler";
const story = JSON.parse(
  readFileSync(
    new URL("../stories/sponsor/story.json", import.meta.url),
    "utf8",
  ),
);
async function openKkt(page: Page) {
  await page
    .getByRole("button", { name: "打开App Store", exact: true })
    .click();
  await page.getByPlaceholder("搜索全部App").fill("KakaoTalk");
  await page
    .locator(".runtime-library-row")
    .getByRole("button", { name: "打开", exact: true })
    .click();
  await page.locator(".kzkcr").filter({ hasText: "Nicholas" }).click();
}
async function start(page: Page) {
  await page.route("**/work.json", (r) =>
    r.fulfill({ json: compileStory(story).work }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "轻触解锁" }).click();
  await openKkt(page);
}
test("free text reaches the model adapter and both sides survive a mobile reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route("**/api/chat/status", (r) =>
    r.fulfill({ json: { ready: true } }),
  );
  let received;
  await page.route("**/api/chat", async (r) => {
    received = r.request().postDataJSON();
    await r.fulfill({ json: { reply: "可以。你先说你最在意的条件。" } });
  });
  await start(page);
  await expect(page.getByText("聊天服务已连接", { exact: true })).toBeVisible();
  await expect(page.locator(".kzmav img").first()).toHaveAttribute(
    "src",
    story.contacts[0].avatar,
  );
  await page
    .getByRole("textbox", { name: "KKT消息" })
    .fill("今天先聊条件，我还没决定。");
  await page.getByRole("button", { name: "发送KKT消息" }).click();
  await expect(
    page.getByRole("button", {
      name: "可以。你先说你最在意的条件。",
      exact: true,
    }),
  ).toBeVisible();
  expect(received.storyId).toBe("pure-sponsor-phone");
  expect(received.messages.at(-1)).toEqual({
    role: "user",
    content: "今天先聊条件，我还没决定。",
  });
  expect(JSON.stringify(received)).not.toContain("data:image");
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/sponsor/kkt-live-mobile.png" });
  await page.reload();
  await page.getByRole("button", { name: "轻触解锁" }).click();
  await openKkt(page);
  await expect(
    page.getByRole("button", {
      name: "今天先聊条件，我还没决定。",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "可以。你先说你最在意的条件。",
      exact: true,
    }),
  ).toBeVisible();
  const bounds = await page.locator(".kzinp").boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(393);
});
test("failed replies can be retried after reload without duplicating the player's message", async ({
  page,
}) => {
  await page.route("**/api/chat/status", (r) =>
    r.fulfill({ json: { ready: true } }),
  );
  let attempts = 0;
  await page.route("**/api/chat", (r) => {
    attempts++;
    return r.fulfill(
      attempts === 1
        ? { status: 502, json: { error: "暂时没有收到回复。" } }
        : { json: { reply: "我在。我们可以继续。" } },
    );
  });
  await start(page);
  await expect(page.getByText("聊天服务已连接", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "KKT消息" }).fill("还有一件事。");
  await page.getByRole("button", { name: "发送KKT消息" }).click();
  await expect(page.getByRole("alert")).toContainText("暂时没有收到回复。");
  await page.reload();
  await page.getByRole("button", { name: "轻触解锁" }).click();
  await openKkt(page);
  await page.getByRole("button", { name: "重试回复" }).click();
  await expect(
    page.getByRole("button", { name: "我在。我们可以继续。", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "还有一件事。", exact: true }),
  ).toHaveCount(1);
  expect(attempts).toBe(2);
});
test("connection setup keeps the access token out of persistent player settings", async ({
  page,
}) => {
  let configured = false;
  await page.route("**/api/chat/status", (r) =>
    r.fulfill({ json: { ready: configured } }),
  );
  await start(page);
  await expect(
    page.getByText("等待连接模型服务", { exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "KKT消息" }).fill("你好。");
  await expect(
    page.getByRole("button", { name: "发送KKT消息" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "聊天连接", exact: true }).click();
  await page
    .getByLabel("访问口令", { exact: true })
    .fill("session-access-only");
  configured = true;
  await page.getByRole("button", { name: "保存连接" }).click();
  await expect(page.getByText("聊天服务已连接", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("foundphone-chat-token")),
  ).toBe("session-access-only");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "session-access-only",
  );
});
