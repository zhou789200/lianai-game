此目录用于存放主美（Codex）生成的位图资产。
约定文件名见 src/assets/manifest.ts：

场景底图  scene-home.webp / scene-business.webp / scene-cafe.webp / scene-pet.webp / scene-story.webp
角色立绘  char-linche-calm.webp 等（900x1400 透明底 WebP）
宠物立绘  pet-pudding-idle.webp 等（800x800 透明底 WebP）
道具装饰  prop-flowerpot.webp 等（512x512 透明底 WebP）

资源缺失时不会破图：SceneRenderer 会自动回退到 CSS 场景。
