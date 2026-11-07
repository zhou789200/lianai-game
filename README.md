# 海风镇宠物咖啡馆（lianai-game）

女性向宠物咖啡馆经营 × 恋爱剧情的移动端竖屏原型。当前为可运行的垂直切片：**经营主玩法 + 宠物互动 + 营业关卡 + AI 动态剧情 + 账号存档**。

## 技术栈

- 前端：React 18 + TypeScript + Vite 5，移动端竖屏（390 × 844）优先
- 服务端：Vite 中间件承载 `/api/story/*` 与 `/api/auth/*`、`/api/me/save`
- 数据库：Node.js 内置 `node:sqlite`（需 Node ≥ 22.5），Session 走 `HttpOnly` Cookie
- 剧情生成：兼容 OpenAI 协议的第三方模型，不可用时自动回退到 `shared/localStoryBank.mjs` 内置剧情

## 目录结构

```text
lianai-game/
├─ 00~11_*.md          产品、验收、架构、账号方案等项目文档
├─ 界面原型图/          视觉参考图（仅情绪与风格参考，非生产资产）
├─ app/                游戏应用（启动入口在这里）
│  ├─ src/             前端源码
│  ├─ server/          剧情接口、账号与存档接口、SQLite 封装
│  ├─ shared/          内置剧情回退库
│  ├─ public/art/      场景与角色位图资源
│  ├─ scripts/         dev / build / preview 脚本
│  ├─ tools/           单测与 E2E
│  └─ data/            SQLite 存档（已忽略，不入库）
├─ work/               R2/R3 阶段的任务书、规格、prompt 与证据
└─ package.json        注意：根目录这个是桌面运行时依赖，不是游戏入口
```

## 本地启动

```powershell
cd app
npm install     # 仅首次，需 Node.js >= 22.5
npm run dev     # http://127.0.0.1:5173/
```

其他命令：`npm test`、`npm run build`、`npm run preview`、`npm run e2e`。详见 `10_本地启动与使用说明.md`。

## 密钥与配置

- 剧情服务配置放在 `app/.env.local`（不入库），模板见 `app/.env.example`：

  ```dotenv
  OPENAI_API_KEY=
  OPENAI_BASE_URL=
  OPENAI_STORY_MODEL=
  ```

- 密钥只在服务端读取（`app/server/story-api.mjs`），不会进入前端产物。
- `work/pi-config/models.json` 等运行时配置同样已被 `.gitignore` 排除，模板见 `work/pi-config/models.example.json`。
- 没有有效密钥时游戏仍可完整运行，剧情回退到内置剧本。

## 协议说明

`界面原型图/` 与 `app/public/art/` 内含 AI 生成素材，仅用于本原型验证，正式商用前需逐张完成授权确认与人工重绘。
