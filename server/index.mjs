import { createChatServer } from "./chat.mjs";
const port = Number(process.env.CHAT_PORT || 8787);
const host = process.env.CHAT_HOST || "127.0.0.1";
createChatServer().listen(port, host, () => {
  console.log(`FoundPhone: http://${host}:${port}/`);
  console.log(
    process.env.MODEL_NAME &&
      (process.env.MODEL_API_KEY || process.env.OPENAI_API_KEY)
      ? "聊天服务已配置。"
      : "尚未配置模型。在 .env 填写 MODEL_NAME 和 MODEL_API_KEY 后重启。 ",
  );
});
