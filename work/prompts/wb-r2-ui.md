# WorkBuddy 任务书 R2：按界面原型图重构视觉与场景层

## 背景

项目根目录：`C:\Users\19511\Desktop\lianai-game`
前端工程：`C:\Users\19511\Desktop\lianai-game\app`

上一轮交付了一套可构建的 React 原型（五个视图、存档、经营/关卡/宠物/剧情逻辑均可用），但**界面完全是奶油色卡片堆叠，背景只是 CSS 模糊色块，没有使用界面原型图**，因此视觉上远远达不到要求。

## 必读素材（必须先逐张打开查看，不要凭猜测）

界面原型图目录：`C:\Users\19511\Desktop\lianai-game\界面原型图`

1. `咖啡馆游戏界面设计.jpeg` —— 主界面/咖啡馆全景
2. `咖啡馆游戏界面设计 (营业关卡).jpeg` —— 营业关卡
3. `咖啡馆游戏界面设计(咖啡馆经营).jpeg` —— 咖啡馆经营
4. `咖啡馆游戏界面设计(宠物互动).jpeg` —— 宠物互动
5. `咖啡馆游戏界面设计(恋爱剧情).jpeg` —— 恋爱剧情

架构与选型文档：`C:\Users\19511\Desktop\lianai-game\07_架构设计与技术选型.md`（必读）

## 关键认知（这是上一轮失败的原因）

参考图的美感来自**结构**：整屏是一张手绘水彩场景（拱形窗、落日海面、女孩、橘猫、绿植、木吧台），**小面积描边羊皮纸面板悬浮在场景之上**。

当前实现恰好相反：整屏都是面板，场景几乎不存在。

注意：参考图**含水印和乱码假文字，绝对不能直接作为素材或整图背景嵌入成品**。你要做的是**还原它的布局结构与视觉语言**，真实场景底图由主美（Codex）另行生成并提供。

## 本轮任务

### 任务 1：把布局从"卡片堆叠"重构为"全屏场景 + 悬浮面板"

对五个视图（Home / Business / Cafe / Pet / Story）逐一改造：

- 内容不再铺满整屏；主内容收进**悬浮的羊皮纸描边面板**，面板之间留出可见的场景。
- 顶部资源栏、底部导航保持悬浮于场景之上，带手绘描边感（圆角、暖色描边、柔和投影）。
- 面板宽度统一，左右留白一致；面板圆角、描边、投影统一取自设计令牌。
- 恋爱剧情页：中部必须留出**角色立绘展示区**（当前是大片空白）。
- 首页与宠物页：必须留出**宠物立绘展示区**。
- 营业关卡页：底部空白区域改为场景可见区或订单区，不要整块空着。

### 任务 2：新增可插拔的场景渲染器

新建 `app/src/assets/manifest.ts`，作为资产唯一入口：

```ts
export interface SceneAsset {
  id: string
  kind: 'scene' | 'character' | 'pet' | 'prop'
  src: string
}
export const SCENES: Record<'home'|'business'|'cafe'|'pet'|'story', SceneAsset>
export const CHARACTERS: Record<string, SceneAsset>
export const PETS: Record<string, SceneAsset>
export const PROPS: Record<string, SceneAsset>
```

约定资产放置路径：`app/public/art/`
- 场景底图：`scene-home.webp` / `scene-business.webp` / `scene-cafe.webp` / `scene-pet.webp` / `scene-story.webp`
- 角色立绘：`char-linche-calm.webp` 等
- 宠物立绘：`pet-pudding-idle.webp` 等
- 道具：`prop-*.webp`

新建 `app/src/components/SceneRenderer.tsx`，替换现有 `SceneBackground.tsx` 的职责：

```
SceneRenderer(view, decor)
  ├─ BackgroundLayer   ← 场景底图（<img> 铺满，object-fit: cover）
  ├─ CharacterLayer    ← 角色立绘（story 视图）
  ├─ PetLayer          ← 宠物立绘（home / pet 视图）
  ├─ PropLayer         ← 已购装饰（固定安全位，不遮挡操作区）
  └─ AtmosphereLayer   ← 暖光 / 纸纹 / 暗角（保留现有 CSS 叠加）
```

**重要**：资产文件当前可能还不存在，渲染器必须优雅降级——图片加载失败时回退到现有的 CSS 场景（保留 `scene.css` 的渐变方案），不得出现破图或空白。

### 任务 3：设计令牌统一

把散落的颜色、圆角、描边、阴影收敛到 `app/src/styles/tokens.css`，五个视图统一引用。至少定义：

```css
--paper-0:#FFFBF3; --ink-900:#4A3B2E; --teal-700:#3E8C86;
--coral-500:#E8836A; --gold-500:#D9A84E;
--radius-panel:22px; --stroke-hand:2px solid rgba(120,90,60,.35);
```

### 任务 4：保证不回归

- 五个视图原有交互（关卡流程、升级扣费、宠物互动、剧情推进、存档）必须全部保留可用。
- `cd app && npm run build` 必须零错误通过。
- 视口 430×932 与 375×812 下不得有文字溢出、遮挡、控件重叠。

## 交付要求

1. 直接修改 `app/` 内的源码，不要只给方案或伪代码。
2. 完成后运行 `npm run build` 并把结果贴出来。
3. 最终回复用中文，列出：改了哪些文件、每个视图的布局变化、场景渲染器的接入方式、降级策略、构建结果。
