import { useState } from "react";
import type { ChatConnection, ChatMode } from "./client";
export function ConnectionForm({
  connection,
  mode,
  save,
}: {
  connection: ChatConnection;
  mode: ChatMode;
  save: (next: ChatConnection, mode: ChatMode) => void;
}) {
  const [url, setUrl] = useState(connection.url);
  const [token, setToken] = useState(connection.token);
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState(mode);
  return (
    <form
      className="live-connection"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          save({ url: url.trim(), token: token.trim() }, selectedMode);
          setError("");
        } catch (e) {
          setError(e instanceof Error ? e.message : "地址无法使用。");
        }
      }}
    >
      <label>
        聊天模式
        <select
          aria-label="聊天模式"
          value={selectedMode}
          onChange={(e) => setSelectedMode(e.target.value as ChatMode)}
        >
          <option value="demo">免费剧情试玩</option>
          <option value="model">模型自由聊天</option>
        </select>
      </label>
      {selectedMode === "demo" ? (
        <>
          <p>
            直接打字就会收到本地剧情回复，无需密钥。可聊条件、见面、近况、饮食和照片；会记住这段聊天里提过的安排。
          </p>
          <small>
            回复使用预设话题和规则，理解范围有限。聊天保存在此浏览器，不会发送给模型服务。
          </small>
        </>
      ) : (
        <>
          <p>
            连接后，你发出的消息和近期对话会交给所配置的模型服务生成角色回复。
          </p>
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
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="submit">
        {selectedMode === "demo" ? "开始免费试玩" : "保存连接"}
      </button>
    </form>
  );
}
