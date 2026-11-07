# pi-config

本目录保存 DeepSeekHarness / pi 运行时在本地调试 R3 阶段时使用的配置与启动脚本。

## 密钥处理规则

真实配置文件 **`models.json` 不入库**（见根目录 `.gitignore`），因为它含有第三方大模型服务的 `apiKey`。

首次使用：

1. 复制模板：

   ```powershell
   cd C:\Users\19511\Desktop\lianai-game\work\pi-config
   Copy-Item models.example.json models.json
   ```

2. 通过环境变量提供密钥，再替换 `models.json` 中的 `"${ENW_API_KEY}"` 为实际值：

   ```powershell
   $env:ENW_API_KEY = "你的密钥"
   ```

3. `auth.json`、`models-store.json` 同样被排除，属于运行时会自行生成的本地状态文件。

## 与游戏主体的关系

本目录只服务于 R3 阶段的自动化调试，**不参与游戏构建**。游戏本体的剧情服务配置在 `app/.env.local`（同样不入库，模板为 `app/.env.example`），由 `app/server/story-api.mjs` 通过 `process.env` 读取，前端代码不会接触密钥。
