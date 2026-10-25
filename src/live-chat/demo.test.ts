import { describe, expect, it } from "vitest";
import { demoReply } from "./demo";
import type { ChatMessage } from "./client";
import script from "../../stories/sponsor/free-chat.json";

function conversation() {
  const messages: ChatMessage[] = [];
  return (content: string) => {
    messages.push({ role: "user", content });
    const reply = demoReply(messages);
    messages.push({ role: "assistant", content: reply });
    return reply;
  };
}

describe("free local sponsor story", () => {
  it("answers the opener and follows a player-proposed meeting without accepting the whole arrangement", () => {
    const send = conversation();
    expect(send("先说说你的条件。")).toContain("你还没答应");
    expect(send("可以先见面聊吗？")).toContain("方便");
    expect(send("明晚八点可以")).toContain("明晚八点");
    expect(send("选江南的咖啡店吧")).toContain("候选");
    expect(send("你还记得我们说的安排吗？")).toMatch(/明晚八点.*咖啡店/s);
  });
  it("remembers dietary information after ordinary chat and a saved-history reload", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "晚饭吃什么？" },
      { role: "assistant", content: "你有不吃的东西吗？" },
      { role: "user", content: "我不吃胡萝卜和芹菜。" },
      { role: "assistant", content: "知道了。" },
      { role: "user", content: "我想吃火锅。" },
      { role: "assistant", content: "记住了。" },
      { role: "user", content: "你在干嘛？" },
      { role: "assistant", content: "刚忙完。" },
      { role: "user", content: "你记得我的口味吗？" },
    ];
    const reply = demoReply(JSON.parse(JSON.stringify(history)));
    expect(reply).toContain("胡萝卜和芹菜");
    expect(reply).toContain("火锅");
  });
  it("does not mistake questions, unavailable times or short acknowledgements for consent", () => {
    const send = conversation();
    send("可以见面聊吗？");
    expect(send("明晚八点可以吗？")).not.toContain("先按你说的");
    expect(send("明天有练习")).not.toContain("先按你说的");
    expect(send("你记得我定了什么时间吗？")).toContain("都还没定");
    send("条件是什么？");
    expect(send("好")).not.toMatch(/你已经答应|我们已经交往|达成协议/);
  });
  it("accepts refusal, resets cancelled proposals and respects a request to stop", () => {
    const send = conversation();
    send("明晚八点可以见面");
    send("选咖啡店吧");
    expect(send("我不想见面了，明晚八点也不行")).toContain("先不见面");
    expect(send("记得时间吗？")).toContain("都还没定");
    expect(send("我不需要钱")).toContain("钱的话题放下");
    expect(send("我不喜欢你，别撩我了")).toContain("收住");
    expect(send("不要联系我了")).toBe("好，我会停下来。照顾好自己。");
    expect(send("嗯")).toBe("我在。你想重新聊的时候，再告诉我。");
    expect(send("在吗，我们继续聊")).toContain("今天想从哪里聊起");
  });
  it("uses previous context for reciprocal questions and avoids repeating an identical bubble", () => {
    const send = conversation();
    send("吃饭了吗？");
    expect(send("你呢？")).toContain("汤饭");
    const first = send("你好");
    const second = send("你好");
    expect(first).not.toBe(second);
    const unfamiliar = send("这段话超出了预设的话题，蓝色四边形。");
    expect(send("这段话超出了预设的话题，蓝色四边形。")).not.toBe(unfamiliar);
  });
  it("keeps photo placement and sleeping negations consistent", () => {
    const send = conversation();
    expect(send("你头像挺好看的")).toContain("头像");
    expect(send("生活照呢？")).toContain("没有发到 IG");
    expect(send("我不想睡了")).toContain("陪你聊");
    expect(send("晚安，我去睡了")).toContain("晚安");
  });
  it("has nonempty, bounded replies for every curated topic and never produces player turns", () => {
    for (const topic of script.topics) {
      const reply = demoReply([{ role: "user", content: topic.keywords[0] }]);
      expect(reply.length).toBeGreaterThan(4);
      expect(reply.length).toBeLessThan(6000);
      expect(reply).not.toMatch(/ima[:：]|玩家[:：]|<script|https?:\/\//);
    }
  });
});
