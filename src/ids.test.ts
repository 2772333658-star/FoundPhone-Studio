import { describe, expect, it, vi } from "vitest";
import { makeItem, uid } from "./schema";

describe("IDs on local preview origins", () => {
  it("can create and render messages when randomUUID is unavailable", () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    try {
      const ids = Array.from({ length: 20 }, () => uid());
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids)
        expect(id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      expect(makeItem({ id: "saved-message", body: "消息保留" }).id).toBe(
        "saved-message",
      );
      expect(makeItem({ body: "新消息" }).body).toBe("新消息");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
