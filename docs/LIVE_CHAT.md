# 《纯情金主》自由聊天

本 Fork 在现有 KKT 组件中增加了可选的模型聊天。开场由 Nicholas 提出私下谈安排，ima 尚未答应。人物设定与语言风格保存在 `server/nicholas.mjs`；不会代玩家回复或预先接受条件。十张照片的原始用途保持不变。

## 在本机开玩

使用 Node 22.17+。在仓库根目录将 `.env.example` 复制为 `.env`，在本机文件内填写：

```dotenv
MODEL_API_KEY=你的模型服务密钥
MODEL_NAME=该服务中你可以使用的模型名称
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_API_FORMAT=responses
```

也可使用提供 OpenAI 兼容 Chat Completions 接口的模型服务：填写它的基础地址和模型名，将 `MODEL_API_FORMAT` 改成 `chat-completions`。未指定或推荐某个付费模型；以你的服务权限为准。

然后执行：

```sh
npm ci
npm run play
```

打开 `http://127.0.0.1:8787/`，解锁手机，在 KKT 打开 Nicholas 的聊天即可输入并发送。未接入模型时，消息仍会保存，页面明确提示自动回复未开启。连接状态出现“聊天服务已连接”后可获得模型回复；实际模型鉴权和响应会在请求时检查。

`npm run play` 会调用原有故事编译器和正式构建，再由 `server/index.mjs` 同时提供网页与聊天接口。模型密钥只从服务端环境读取，不写入作品、前端或浏览器存档；`.env` 已被 Git 忽略。服务端不记录聊天正文。对话会发到你配置的模型服务，其保留规则由该服务决定。

## 网页与服务分开部署

GitHub Pages 继续提供原有静态网页；它不运行此 Node 聊天服务。部署聊天功能时，需要一个可运行 Node 的服务器，或可提供相同接口的后端。

服务端配置：

```dotenv
CHAT_HOST=0.0.0.0
CHAT_PORT=8787
PLAYER_TOKEN=自行生成的访问口令
ALLOWED_ORIGINS=https://2772333658-star.github.io
CHAT_HTTPS=true
```

`CHAT_HTTPS=true` 用于你自己的 HTTPS 反向代理。同源直连本机继续使用默认配置。对外监听强制要求访问口令；跨站请求只接受明确允许的 Origin。需要自行配置 HTTPS、进程管理和模型服务额度。

前端在 KKT 的“聊天连接”中填写完整服务地址，例如 `https://你的聊天服务/api/chat`，再填该服务的访问口令。也可在构建时设置公开的 `VITE_CHAT_API_URL`。访问口令只保存到当前浏览器会话，重新打开浏览器后可能需要重新填写；模型厂商的密钥应始终留在服务端。

接口为 `GET /api/chat/status` 与 `POST /api/chat`。后者接收 `storyId`、`character` 和 `messages`；服务端限定为本作品的 Nicholas，并从可信代码加载角色设定。请求只包含消息文本，不上传照片。

## 当前范围

- 只有本作品标记 `meta.aiCharacter="nicholas"` 的 KKT 会话接入模型，其他作品与 App 保留现有行为。
- 双方完整消息保存在原有 IndexedDB 玩家存档里。每次模型请求只使用最近最多 80 条、合计不超过 24000 字符的对话；超出窗口的旧约定可能需要你再次提及。
- 失败时保留已发送消息，点击“重试回复”不会重复添加玩家气泡。离开会话或停止等待会取消请求，返回后可以重试。网络取消未必能撤销模型服务已经产生的用量。
- 未连接模型也能连续发送消息，并在刷新后恢复。连接模型后，点击“重试回复”可将近期已保存的对话一起交给模型，生成回复；连接本身不会自动发起生成请求。
- 这版支持自由对话。模型回复是聊天文字，不会自动执行转账、发布动态、接电话或替玩家接受邀约。已有静态 App 内容仍可浏览。
- `?preview=test` 与 `?template=blank` 保留。修改开场或人物重大设定时递增 `revision`；当前修订号为 2。

## 验证

```sh
npm run typecheck
npm run lint
npm test
npm run test:server
npm run story:validate -- stories/sponsor/story.json
STORY_FILE=stories/sponsor/story.json npm run story:test
npm run sponsor:build
npm run test:e2e -- tests/live-chat.spec.ts tests/mymy.spec.ts
```

浏览器测试使用明确的模拟模型接口，验证消息发送、双向存档、失败重试、手机布局和连接配置，不会产生真实模型用量。真实模型测试需要你的有效服务配置，不能用测试通过来替代真实鉴权验证。

官方接口参考：[文本生成](https://developers.openai.com/api/docs/guides/text)、[会话状态](https://developers.openai.com/api/docs/guides/conversation-state)、[API 认证](https://developers.openai.com/api/reference/overview)。
