/* ============================================================
   游戏状态类型定义
   ============================================================ */

export type ViewKey = 'home' | 'business' | 'cafe' | 'pet' | 'romance' | 'story'

export type NoticeKind = 'success' | 'error' | 'info' | 'reward'

export interface Notice {
  id: string
  kind: NoticeKind
  title: string
  text?: string
}

/** 宠物日记 */
export interface DiaryEntry {
  id: string
  at: number
  icon: string
  text: string
}

/** 宠物状态：亲密度 + 饱食 / 清洁 / 心情 */
export interface PetState {
  name: string
  breed: string
  age: string
  intimacy: number
  hunger: number
  cleanliness: number
  mood: number
  diary: DiaryEntry[]
}

/** 角色关系 */
export interface Relationship {
  id: string
  name: string
  role: string
  /** 0-100 关系值 */
  value: number
  /** 是否已登场 */
  met: boolean
  note: string
}

/** 每日任务进度 */
export interface TaskState {
  id: string
  progress: number
  claimed: boolean
}

export type RewardKind = 'coins' | 'exp' | 'stamina' | 'petIntimacy' | 'petMood'

export interface Reward {
  kind: RewardKind
  amount: number
}

/** 动态生成的正式剧情章节，同时保留续写所需的精简记忆 */
export interface StoryTrace {
  id: string
  at: number
  /** 剧情本中的稳定章节序号；旧存档可按生成顺序补齐 */
  chapterIndex?: number
  title: string
  subtitle: string
  scene: string
  source: 'ai' | 'local'
  memoryAnchors: string[]
  clue?: string
  choice: string
  outcome: string
  /** 完整章节快照，用于从剧情本目录重新阅读 */
  beats?: GeneratedStoryBeat[]
  choices?: GeneratedStoryChoice[]
  selectedChoiceId?: string
}

/** 静态剧情节点留下的选择记录，供存档恢复和后续动态剧情承接。 */
export interface StoryChoiceRecord {
  id: string
  at: number
  source: 'romance' | 'storybook'
  chapterId: string
  chapterTitle: string
  scene: string
  beatId: string
  prompt: string
  optionId: string
  optionText: string
  reply: string
  skipped: boolean
  characterId?: string
  branchId?: string
  storyFlags?: string[]
}

/** 存档主体 */
export interface GameState {
  version: number
  createdAt: number
  updatedAt: number

  playerName: string
  shopName: string

  coins: number
  stamina: number
  staminaMax: number
  /** 体力自然回复的时间锚点 */
  staminaRegenAt: number

  level: number
  exp: number

  pet: PetState
  relationships: Relationship[]

  /** 恋爱主线当前章节 id */
  chapterId: string
  /** 恋爱主线当前已读到的 beat 下标 */
  chapterBeat: number
  completedChapters: string[]

  /** 独立剧情本当前章节 id */
  storyChapterId: string
  /** 独立剧情本当前已读到的 beat 下标 */
  storyChapterBeat: number
  /** 当前正在阅读的临时分支 id */
  storyBranchId: string | null
  /** 当前分支已读到的 beat 下标 */
  storyBranchBeat: number
  storyCompletedChapters: string[]
  /** 剧情本分支与完成标记；恋爱章节可按显式条件引用 */
  storyFlags: string[]
  /** 动态短篇留下的选择、回扣与线索，只向生成接口提交精简摘要 */
  storyTraces: StoryTrace[]
  /** 静态章节选择；与动态章节快照分开保存，避免污染章节目录 */
  storyChoices: StoryChoiceRecord[]
  /** 存档创建时固定下来的剧情种子，保证同一份存档的生成结果可复现 */
  storySeed: string
  /** 已生成但尚未消费的动态章节缓存，避免刷新后重复请求模型 */
  storyCache: StoryCacheEntry[]
  /** 当前正在阅读的动态剧情 id；null 表示停留在静态剧情本章节 */
  storyTraceId: string | null
  /** 动态剧情已经推进的页数，不受剧情痕迹 30 条上限影响 */
  storyTurn: number

  tasks: TaskState[]
  /** 每日任务刷新日期 YYYY-MM-DD */
  tasksDate: string

  unlocked: string[]
  /** 设备升级等级，key 为设备 id */
  equipment: Record<string, number>
  /** 已研发菜单 id */
  recipes: string[]
  /** 已购买装饰 id */
  decor: string[]

  stats: {
    businessRuns: number
    ordersServed: number
    perfectRuns: number
    petInteractions: number
    choicesMade: number
    coinsEarned: number
  }

  /** 正在进行的营业 runId；刷新后据此归还体力，避免重复扣除 */
  activeRunId?: string | null
  /** 最近一次已发奖的营业 runId，保证结算幂等 */
  lastSettledRunId?: string | null
  /** 最近一次营业的快照，用于准备页回显 */
  lastBusiness?: {
    at: number
    served: number
    failed: number
    rating: number
    coins: number
  } | null
  /** 营业中已上菜收益快照；刷新后一次性入账，结算时清空 */
  pendingRunRewards?: {
    coins: number
    exp: number
  } | null
  /** reconcileAbandonedRun 恢复的收益；由 Provider 入账后清空 */
  recoveredRunRewards?: {
    coins: number
    exp: number
  } | null
}

/* ---------- 静态内容定义 ---------- */

export interface RecipeDef {
  id: string
  name: string
  desc: string
  icon: string
  /** 研发/解锁所需金币，0 表示初始拥有 */
  unlockCost: number
  /** 解锁所需店铺等级 */
  unlockLevel: number
  price: number
  exp: number
  /** 制作单次点击推进的进度（百分比） */
  craftStep: number
}

export interface EquipmentDef {
  id: string
  name: string
  desc: string
  icon: string
  maxLevel: number
  baseCost: number
  costGrowth: number
  /** 每级带来的效果描述，下标 = 等级 - 1 */
  effects: string[]
}

export interface DecorDef {
  id: string
  name: string
  desc: string
  icon: string
  cost: number
  /** 家居值，影响咖啡馆魅力 */
  charm: number
  unlockLevel: number
}

export interface TaskDef {
  id: string
  name: string
  desc: string
  icon: string
  target: number
  rewardCoins: number
  rewardExp: number
}

export interface PetActionDef {
  id: 'feed' | 'play' | 'groom' | 'photo'
  name: string
  desc: string
  icon: string
  cost: number
  staminaCost: number
  effects: Partial<Record<'hunger' | 'cleanliness' | 'mood' | 'intimacy', number>>
  /** 生成日记用的模板 */
  diary: string[]
}

/* ---------- 剧情 ---------- */

export interface StoryLine {
  id: string
  type: 'narration' | 'dialogue'
  speaker?: string
  text: string
}

export interface StoryOption {
  id: string
  text: string
  /** 选择后的即时回应 */
  reply: string
  /** 可选的分支段落；读完后会回到本章主线 */
  branch?: StoryBranchDef
  effects: {
    /** 仅恋爱主线读取，剧情本会忽略 */
    relationship?: number
    /** 仅剧情本读取，恋爱主线会忽略 */
    coins?: number
    exp?: number
    petIntimacy?: number
    petMood?: number
    /** 仅剧情本读取，用于后续剧情或恋爱支线的显式解锁条件 */
    storyFlags?: string[]
  }
}

export interface StoryBranchDef {
  id: string
  beats: StoryLine[]
}

export interface StoryChoice {
  id: string
  type: 'choice'
  prompt: string
  options: StoryOption[]
}

export type StoryBeat = StoryLine | StoryChoice

export interface ChapterDef {
  id: string
  index: number
  title: string
  subtitle: string
  /** 绑定的角色 id */
  characterId: string
  /** 环境描述，用于场景氛围提示 */
  scene: string
  /** 解锁条件：前置章节 + 关系值 */
  requiresChapter?: string
  requiresRelationship?: number
  /** 可选的剧情本联动条件：必须已获得这些剧情标记 */
  requiresStoryFlags?: string[]
  /** 完成奖励 */
  rewardCoins: number
  rewardExp: number
  beats: StoryBeat[]
}

/** 独立剧情本章节：不绑定恋爱关系与角色好感 */
export interface StorybookChapterDef {
  id: string
  index: number
  title: string
  subtitle: string
  scene: string
  requiresChapter?: string
  /** 剧情本自己的分支解锁条件，不读取恋爱进度 */
  requiresStoryFlags?: string[]
  /** 完成本章后写入的剧情标记，可供后续剧情或恋爱支线引用 */
  unlockStoryFlags?: string[]
  rewardCoins: number
  rewardExp: number
  beats: StoryBeat[]
}

/** 动态短篇接口返回值 */
export interface GeneratedStoryBeat {
  type: 'narration' | 'dialogue'
  speaker?: string
  text: string
}

export interface GeneratedStoryChoice {
  id: string
  text: string
  reply: string
  consequence: string
}

export interface GeneratedStory {
  id: string
  source: 'ai' | 'local'
  degraded: boolean
  title: string
  subtitle: string
  scene: string
  beats: GeneratedStoryBeat[]
  choices: GeneratedStoryChoice[]
  memoryAnchors: string[]
  clue?: string
}

/** 随存档持久化的动态章节缓存条目 */
export interface StoryCacheEntry {
  /** 由 Seed、剧情轮次和连续性上下文生成 */
  key: string
  at: number
  story: GeneratedStory
}
