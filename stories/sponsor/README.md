# 纯情金主 · Nicholas 素材接入

此目录是现有 FoundPhone Studio 中可单独选择的作品草稿，复用原有运行时和 App。默认测试模板与空白手机保持原样。当前仅接入已指定的照片用途和一条来信，尚未编写完整剧情或连接在线 AI；玩家没有预写的回复或决定。

## 照片安排

顺序以本次上传顺序为准；原图原样保存，文件哈希与原始名称见 `media-manifest.json`。

| 序号 | 文件 | 设定用途 | 当前状态 |
| --- | --- | --- | --- |
| 1 | `assets/nicholas/paparazzi.jpeg` | 剧情中的狗仔偷拍 | 论坛帖子配图 |
| 2 | `assets/nicholas/ig-event.jpeg` | Nicholas 自己发布的 IG 活动图 | 唯一的 IG 照片帖 |
| 3 | `assets/nicholas/graduation.jpeg` | 高中毕业照 | 备用，未指定学校、年份或发现方式 |
| 4 | `assets/nicholas/market-lookback.jpeg` | 生活游玩照 | 备用 |
| 5 | `assets/nicholas/market-table.jpeg` | 生活游玩照 | 备用 |
| 6 | `assets/nicholas/market-stall.jpeg` | 生活游玩照 | 备用 |
| 7 | `assets/nicholas/transit.jpeg` | 生活照 | 备用 |
| 8 | `assets/nicholas/rest-selfie.jpeg` | 生活自拍 | 备用 |
| 9 | `assets/nicholas/kkt-avatar.jpeg` | KKT 头像 | Nicholas 联系人与 KKT 来信头像 |
| 10 | `assets/nicholas/theme-park.jpeg` | 生活游玩照 | 备用 |

除第 2 张外的照片均不进入 IG。备用照片只存放在本目录中，不写入当前作品 JSON，也不复制到 `public/`；它们不会出现在玩家相册或导出的网页里。未来确定剧情来源后再接入。当前 IG 文案、论坛文字与时间是可替换的虚构预览内容，不代表真实照片信息。

## 使用现有校验与预览流程

在仓库根目录执行：

```sh
npm ci
npm run story:validate -- stories/sponsor/story.json
STORY_FILE=stories/sponsor/story.json npm run story:test
STORY_FILE=stories/sponsor/story.json npm run story:preview
```

正式构建该草稿：

```sh
STORY_FILE=stories/sponsor/story.json npm run build
```

`?preview=test` 仍可打开原有完整 App 测试预览，`?template=blank` 保留纯空白手机。各作品使用独立的作品 ID 保存进度；后续剧情更新需递增 `revision`。

## 素材来源与许可

十张图片均来自作者本次提供的附件。这里仅为虚构角色分配叙事用途，不据照片判断真实人物身份、关系或拍摄经历。没有收到额外的图片开源许可声明，因此这些照片不适用项目源码的 MIT 许可。图片的原有权利归相应权利人；公开分发前应确认适用授权范围。

源码的 MIT、第三方依赖与品牌声明保持完整；网页包含 `STORY_MEDIA_NOTICE.txt` 素材说明。
