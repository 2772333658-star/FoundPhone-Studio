import { useEffect, useRef, useState } from "react";
import type { SkinProps } from "../AppSkins";
import { makeItem, uid } from "../schema";
import { useSkinState } from "../skinState";
import {
  chatFetch,
  chatUrl,
  loadConnection,
  loadChatMode,
  parseTurns,
  recentMessages,
  saveConnection,
  saveChatMode,
  type ChatConnection,
  type ChatMode,
  type LiveTurn,
} from "./client";
import { demoReply } from "./demo";

export function useLiveKakao(p: SkinProps) {
  const available = p.workId === "pure-sponsor-phone" && !p.creator;
  const seed = p.items.filter((i) => i.title === p.thread);
  const enabled =
    available && seed.some((i) => i.meta.aiCharacter === "nicholas");
  const [raw, setRaw] = useSkinState<string[]>(p, "liveKktTurns", []);
  const turns = parseTurns(raw);
  const current = useRef(turns);
  current.current = turns;
  const [connection, setConnection] = useState(loadConnection);
  const [mode, setMode] = useState(() => loadChatMode(connection));
  const [connectionState, setConnectionState] = useState("正在检查聊天连接…");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!available) return;
    if (mode === "demo") {
      setReady(true);
      setConnectionState("免费试玩 · 本地剧情回复");
      return;
    }
    const check = new AbortController();
    setReady(false);
    setConnectionState("正在检查聊天连接…");
    void chatFetch(
      connection,
      true,
      AbortSignal.any([check.signal, AbortSignal.timeout(10000)]),
    )
      .then((data) => {
        if (check.signal.aborted) return;
        setReady(data.ready === true);
        setConnectionState(
          data.ready ? "聊天服务已连接" : "可发送消息 · 自动回复未开启",
        );
      })
      .catch((e: Error) => {
        if (!check.signal.aborted) setConnectionState(e.message);
      });
    return () => check.abort();
  }, [available, connection, mode]);

  useEffect(() => {
    setBusy(false);
    setError("");
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, [p.thread, p.workId]);

  const write = (next: LiveTurn[]) => {
    current.current = next;
    setRaw(next.map((t) => JSON.stringify(t)));
  };
  const request = async (history: LiveTurn[]) => {
    if (!enabled || !ready || controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError("");
    try {
      const conversation = [
        ...seed
          .filter((i) => i.body && !i.media)
          .map((i) => ({
            role: i.outgoing ? ("user" as const) : ("assistant" as const),
            content: i.body,
          })),
        ...history.filter((t) => t.thread === p.thread),
      ];
      let reply: unknown;
      if (mode === "demo") {
        // A small, cancellable typing pause; all dialogue stays in the browser.
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            active.signal.removeEventListener("abort", finish);
            resolve();
          };
          const timer = setTimeout(finish, 420);
          active.signal.addEventListener("abort", finish, { once: true });
        });
        if (active.signal.aborted) return;
        reply = demoReply(conversation);
      } else {
        const data = await chatFetch(
          connection,
          false,
          AbortSignal.any([active.signal, AbortSignal.timeout(55000)]),
          {
            storyId: p.workId,
            character: "nicholas",
            messages: recentMessages(conversation),
          },
        );
        reply = data.reply;
      }
      if (active.signal.aborted) return;
      if (typeof reply !== "string" || !reply.trim() || reply.length > 6000)
        throw Error("这次没有收到完整回复，可以重试。");
      write([
        ...current.current,
        {
          id: uid(),
          thread: p.thread,
          role: "assistant",
          content: reply.trim(),
          time: p.virtualTime || "21:13",
        },
      ]);
    } catch (e) {
      if (!active.signal.aborted)
        setError(e instanceof Error ? e.message : "暂时没有收到回复。");
    } finally {
      if (controller.current === active) {
        controller.current = null;
        setBusy(false);
      }
    }
  };
  const pending =
    turns.filter((t) => t.thread === p.thread).at(-1)?.role === "user";
  const send = (text: string) => {
    if (!enabled || controller.current || !text.trim()) return false;
    const next = [
      ...current.current,
      {
        id: uid(),
        thread: p.thread,
        role: "user" as const,
        content: text.trim().slice(0, 2000),
        time: p.virtualTime || "21:13",
      },
    ];
    write(next);
    setError("");
    if (ready) void request(next);
    return true;
  };
  const configure = (next: ChatConnection, nextMode: ChatMode) => {
    if (nextMode === "model") chatUrl(next.url);
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setError("");
    setReady(nextMode === "demo");
    saveConnection(next);
    saveChatMode(nextMode);
    setConnection(next);
    setMode(nextMode);
  };
  const items = available
    ? turns.map((t) => {
        const contact = p.items.find(
          (i) => i.title === t.thread && !i.outgoing,
        );
        return makeItem({
          id: "live-" + t.id,
          title: t.thread,
          body: t.content,
          sender:
            t.role === "user" ? p.owner || "ima" : contact?.sender || t.thread,
          avatar: t.role === "assistant" ? contact?.avatar || "" : "",
          outgoing: t.role === "user",
          time: t.time,
          meta: { local: "true" },
        });
      })
    : [];
  return {
    available,
    enabled,
    items,
    ready,
    busy,
    pending,
    error,
    connectionState,
    connection,
    mode,
    configure,
    send,
    retry: () => {
      if (pending && ready) void request(current.current);
    },
    cancel: () => {
      controller.current?.abort();
      controller.current = null;
      setBusy(false);
    },
  };
}
