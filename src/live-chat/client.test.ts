import { describe, expect, it, vi } from "vitest";
import {
  chatUrl,
  loadChatMode,
  parseTurns,
  recentMessages,
  type ChatMessage,
} from "./client";

describe("persisted live conversations", () => {
  it("starts with the free story while retaining an existing model connection or explicit mode", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) || null,
    });
    try {
      expect(loadChatMode({ url: "", token: "" })).toBe("demo");
      expect(
        loadChatMode({ url: "https://chat.example/api/chat", token: "" }),
      ).toBe("model");
      expect(loadChatMode({ url: "", token: "session-only" })).toBe("model");
      values.set("foundphone-chat-mode", "demo");
      expect(
        loadChatMode({ url: "https://chat.example/api/chat", token: "" }),
      ).toBe("demo");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("allows same-origin preview calls but rejects remote HTTP credential destinations", () => {
    vi.stubGlobal("location", new URL("http://terminal.local:4173/"));
    try {
      expect(chatUrl("")).toBe("http://terminal.local:4173/api/chat");
      expect(() => chatUrl("http://other.example/api/chat")).toThrow();
      expect(chatUrl("https://chat.example/api/chat")).toBe(
        "https://chat.example/api/chat",
      );
      expect(() =>
        chatUrl("https://user:pass@chat.example/api/chat"),
      ).toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
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
