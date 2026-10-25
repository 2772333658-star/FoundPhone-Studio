import { describe, expect, it } from "vitest";
import { parseTurns, recentMessages, type ChatMessage } from "./client";

describe("persisted live conversations", () => {
  it("recovers valid user and assistant turns without accepting corrupted records", () => {
    const valid = {
      id: "one",
      thread: "Nicholas",
      time: "21:13",
      role: "user",
      content: "我想先聊聊条件。",
    };
    expect(
      parseTurns([
        JSON.stringify(valid),
        "broken",
        JSON.stringify({ ...valid, role: "system" }),
        JSON.stringify({ ...valid, content: "x".repeat(6001) }),
      ]),
    ).toEqual([valid]);
  });
  it("retains the newest context within the provider budget and strips local fields", () => {
    const turns = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 ? "user" : "assistant",
      content: String(i).padStart(4, "0") + "x".repeat(996),
      secretLocalField: "not a model input",
    }));
    const bounded = recentMessages(turns as ChatMessage[]);
    expect(bounded).toHaveLength(24);
    expect(bounded.at(-1)?.content).toBe(turns.at(-1)?.content);
    expect(bounded[0].content).toBe(turns[76].content);
    expect(Object.keys(bounded[0])).toEqual(["role", "content"]);
  });
});
