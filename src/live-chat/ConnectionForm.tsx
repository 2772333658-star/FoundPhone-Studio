import { useState } from "react";
import type { ChatConnection } from "./client";
export function ConnectionForm({
  connection,
  save,
}: {
  connection: ChatConnection;
  save: (next: ChatConnection) => void;
}) {
  const [url, setUrl] = useState(connection.url);
  const [token, setToken] = useState(connection.token);
  const [error, setError] = useState("");
  return (
    <form
      className="live-connection"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          save({ url: url.trim(), token: token.trim() });
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "地址无法使用。");
        }
      }}
    >
      <p>连接后，你发出的消息和近期对话会交给模型生成角色回复。</p>
      <label>
        聊天服务地址
        <input
          type="url"
          aria-label="聊天服务地址"
          value={url}
          placeholder="留空使用当前网站"
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <label>
        访问口令
        <input
          type="password"
          aria-label="访问口令"
          value={token}
          autoComplete="off"
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      <small>口令仅保留在当前浏览器会话。模型密钥由服务端配置。</small>
      {error && <p role="alert">{error}</p>}
      <button type="submit">保存连接</button>
    </form>
  );
}
