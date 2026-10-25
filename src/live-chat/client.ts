export type ChatMessage = { role: "user" | "assistant"; content: string };
export type LiveTurn = ChatMessage & {
  id: string;
  thread: string;
  time: string;
};
export type ChatConnection = { url: string; token: string };
export type ChatMode = "demo" | "model";

export function loadChatMode(connection: ChatConnection): ChatMode {
  try {
    const saved = localStorage.getItem("foundphone-chat-mode");
    if (saved === "demo" || saved === "model") return saved;
  } catch {
    /* A new browser session can still use the free local story. */
  }
  return connection.url || connection.token ? "model" : "demo";
}

export function saveChatMode(mode: ChatMode) {
  try {
    localStorage.setItem("foundphone-chat-mode", mode);
  } catch {
    /* Keep the selected mode in memory when storage is unavailable. */
  }
}

export function parseTurns(raw: string[]): LiveTurn[] {
  return raw.flatMap((text) => {
    try {
      const t = JSON.parse(text);
      return t &&
        typeof t.id === "string" &&
        typeof t.thread === "string" &&
        typeof t.time === "string" &&
        typeof t.content === "string" &&
        t.content.length <= 6000 &&
        ["user", "assistant"].includes(t.role)
        ? [t as LiveTurn]
        : [];
    } catch {
      return [];
    }
  });
}

export function recentMessages(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let size = 0;
  for (const message of messages.slice(-80).reverse()) {
    if (size + message.content.length > 24000) break;
    size += message.content.length;
    result.unshift({ role: message.role, content: message.content });
  }
  return result;
}

export function chatUrl(value: string): string {
  const url = new URL(value || "./api/chat", location.href);
  const sameOrigin = url.origin === new URL(location.href).origin;
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        (sameOrigin ||
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      ))
  )
    throw Error("请填写同源或 HTTPS 聊天服务地址；本机可使用 HTTP。");
  return url.href.replace(/\/$/, "");
}

export function loadConnection(): ChatConnection {
  try {
    return {
      url:
        localStorage.getItem("foundphone-chat-url") ||
        import.meta.env.VITE_CHAT_API_URL ||
        "",
      token: sessionStorage.getItem("foundphone-chat-token") || "",
    };
  } catch {
    return { url: import.meta.env.VITE_CHAT_API_URL || "", token: "" };
  }
}

export function saveConnection(connection: ChatConnection) {
  try {
    localStorage.setItem("foundphone-chat-url", connection.url);
    sessionStorage.setItem("foundphone-chat-token", connection.token);
  } catch {
    /* The current tab can still use an in-memory connection. */
  }
}

export async function chatFetch(
  connection: ChatConnection,
  status: boolean,
  signal: AbortSignal,
  body?: unknown,
) {
  let response: Response;
  try {
    response = await fetch(
      chatUrl(connection.url) + (status ? "/status" : ""),
      {
        method: status ? "GET" : "POST",
        signal,
        cache: "no-store",
        credentials: "omit",
        headers: {
          ...(status ? {} : { "Content-Type": "application/json" }),
          ...(connection.token
            ? { Authorization: "Bearer " + connection.token }
            : {}),
        },
        ...(status ? {} : { body: JSON.stringify(body) }),
      },
    );
  } catch (error) {
    if (signal.aborted) throw error;
    throw Error(
      status
        ? "可发送消息 · 自动回复暂未连接"
        : "暂时联系不上聊天服务。消息已保留，可以稍后重试。",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error("这个地址尚未提供聊天服务。");
  }
  if (!response.ok)
    throw Error(
      typeof data.error === "string" ? data.error : "聊天服务暂时不可用。",
    );
  return data;
}
