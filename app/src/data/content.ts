import type {
  ChapterDef,
  DecorDef,
  EquipmentDef,
  PetActionDef,
  RecipeDef,
  StorybookChapterDef,
  TaskDef,
} from '../game/types'

/* ============================================================
   菜单配方
   ============================================================ */
export const RECIPES: RecipeDef[] = [
  {
    id: 'latte',
    name: '海盐拿铁',
    desc: '店里最稳的一杯，奶泡上撒一点海盐。',
    icon: 'Coffee',
    unlockCost: 0,
    unlockLevel: 1,
    price: 18,
    exp: 3,
    craftStep: 34,
  },
  {
    id: 'croissant',
    name: '黄油可颂',
    desc: '清晨现烤，起酥层层分明。',
    icon: 'Croissant',
    unlockCost: 0,
    unlockLevel: 1,
    price: 22,
    exp: 4,
    craftStep: 28,
  },
  {
    id: 'soda',
    name: '柑橘气泡水',
    desc: '酸酸甜甜，晒过太阳的午后限定。',
    icon: 'CupSoda',
    unlockCost: 90,
    unlockLevel: 2,
    price: 26,
    exp: 4,
    craftStep: 40,
  },
  {
    id: 'cake',
    name: '落日戚风',
    desc: '橙色的奶油像傍晚的海面。',
    icon: 'Cake',
    unlockCost: 160,
    unlockLevel: 3,
    price: 32,
    exp: 5,
    craftStep: 24,
  },
  {
    id: 'pudding',
    name: '布丁的焦糖布丁',
    desc: '猫咪布丁偷偷守着的甜点。',
    icon: 'IceCreamCone',
    unlockCost: 240,
    unlockLevel: 4,
    price: 38,
    exp: 6,
    craftStep: 22,
  },
  {
    id: 'fishsnack',
    name: '香烤小鱼干',
    desc: '人也能吃，猫更想吃。',
    icon: 'Fish',
    unlockCost: 320,
    unlockLevel: 5,
    price: 44,
    exp: 7,
    craftStep: 20,
  },
]

/* ============================================================
   设备升级
   ============================================================ */
export const EQUIPMENT: EquipmentDef[] = [
  {
    id: 'machine',
    name: '意式咖啡机',
    desc: '稳定的压力，稳定的奶泡。',
    icon: 'CookingPot',
    maxLevel: 5,
    baseCost: 120,
    costGrowth: 1.75,
    effects: [
      '基础单杯萃取，长按完成浓缩',
      '预热更快，咖啡机加工动作更短',
      '解锁双份并行萃取，可同时占用两台工序',
      '出杯速度进一步提升，连做两杯不排队',
      '招牌出杯，每单小费 +1',
    ],
  },
  {
    id: 'oven',
    name: '石板烤箱',
    desc: '可颂和戚风都要靠它。',
    icon: 'Flame',
    maxLevel: 5,
    baseCost: 100,
    costGrowth: 1.7,
    effects: [
      '单批烘焙，长按完成可颂',
      '预热更快，烘焙时间缩短',
      '双批批量，可同时烤两份可颂',
      '烘焙速度再提升',
      '烘焙类订单每单小费 +2',
    ],
  },
  {
    id: 'counter',
    name: '木质吧台',
    desc: '客人喜欢靠着它聊天。',
    icon: 'Armchair',
    maxLevel: 4,
    baseCost: 140,
    costGrowth: 1.9,
    effects: [
      '托盘容量 1，一次只能送一杯',
      '托盘容量 +1，可同时装两杯',
      '托盘容量再 +1，营业时间 +10 秒',
      '托盘容量再 +1，出餐更从容',
    ],
  },
  {
    id: 'signboard',
    name: '门口招牌',
    desc: '海风再大也吹不倒它。',
    icon: 'Store',
    maxLevel: 4,
    baseCost: 90,
    costGrowth: 1.8,
    effects: [
      '基础客流：上班族与游客为主',
      '游客和熟客变多，小费 +2',
      '猫爱好者常来，同时接待订单 +1',
      '营业时间 +10 秒，清理小费 +2',
    ],
  },
]

/* ============================================================
   咖啡馆装饰
   ============================================================ */
export const DECOR: DecorDef[] = [
  {
    id: 'flowerpot',
    name: '陶土花盆',
    desc: '窗口那盆开了很久的花。',
    icon: 'Flower2',
    cost: 60,
    charm: 6,
    unlockLevel: 1,
  },
  {
    id: 'hangingplant',
    name: '垂吊绿植',
    desc: '从梁上垂下来的绿意。',
    icon: 'Leaf',
    cost: 110,
    charm: 10,
    unlockLevel: 2,
  },
  {
    id: 'pendantlamp',
    name: '黄铜吊灯',
    desc: '傍晚亮起来的时候最好看。',
    icon: 'Lamp',
    cost: 180,
    charm: 14,
    unlockLevel: 2,
  },
  {
    id: 'seapainting',
    name: '海面挂画',
    desc: '画的是窗外那片落日。',
    icon: 'Frame',
    cost: 240,
    charm: 18,
    unlockLevel: 3,
  },
  {
    id: 'cattree',
    name: '猫爬架',
    desc: '布丁的私人领地。',
    icon: 'TreePine',
    cost: 300,
    charm: 22,
    unlockLevel: 4,
  },
  {
    id: 'warmlight',
    name: '暖光壁灯',
    desc: '把整间店照成蜂蜜色。',
    icon: 'Sparkles',
    cost: 380,
    charm: 28,
    unlockLevel: 5,
  },
  /* 家具：对应咖啡店场景底部那一排可更换的物件，点哪一格买哪一格 */
  {
    id: 'vase',
    name: '白瓷花瓶',
    desc: '吧台左侧那只素色花瓶。',
    icon: 'Amphora',
    cost: 80,
    charm: 7,
    unlockLevel: 1,
  },
  {
    id: 'teacups',
    name: '手绘杯具',
    desc: '一套画着海风花纹的茶具。',
    icon: 'Coffee',
    cost: 140,
    charm: 11,
    unlockLevel: 2,
  },
  {
    id: 'crate',
    name: '藤编收纳箱',
    desc: '把杂物收进去，台面立刻清爽。',
    icon: 'Package',
    cost: 200,
    charm: 14,
    unlockLevel: 2,
  },
  {
    id: 'pourover',
    name: '铜制手冲壶',
    desc: '擦得发亮的铜壶，冲咖啡时最好看。',
    icon: 'CookingPot',
    cost: 260,
    charm: 18,
    unlockLevel: 3,
  },
  {
    id: 'chair',
    name: '原木餐椅',
    desc: '靠窗那两张椅子终于配成一对了。',
    icon: 'Armchair',
    cost: 330,
    charm: 22,
    unlockLevel: 4,
  },
  {
    id: 'sofa',
    name: '绒面沙发',
    desc: '客人最爱赖着不走的位置。',
    icon: 'Sofa',
    cost: 420,
    charm: 28,
    unlockLevel: 5,
  },
]

/* ============================================================
   每日任务
   ============================================================ */
export const TASKS: TaskDef[] = [
  {
    id: 'open_shop',
    name: '开门迎客',
    desc: '完成 1 次营业关卡',
    icon: 'ClipboardList',
    target: 1,
    rewardCoins: 80,
    rewardExp: 10,
  },
  {
    id: 'serve_orders',
    name: '手脚麻利',
    desc: '在营业中上菜 6 单',
    icon: 'Coffee',
    target: 6,
    rewardCoins: 120,
    rewardExp: 14,
  },
  {
    id: 'pet_care',
    name: '照顾布丁',
    desc: '与宠物互动 3 次',
    icon: 'PawPrint',
    target: 3,
    rewardCoins: 70,
    rewardExp: 8,
  },
  {
    id: 'upgrade_once',
    name: '添置家当',
    desc: '升级设备或购置装饰 1 次',
    icon: 'TrendingUp',
    target: 1,
    rewardCoins: 100,
    rewardExp: 12,
  },
  {
    id: 'story_step',
    name: '海风里的心事',
    desc: '推进 1 段剧情',
    icon: 'Heart',
    target: 1,
    rewardCoins: 90,
    rewardExp: 16,
  },
]

/* ============================================================
   宠物互动
   ============================================================ */
export const PET_ACTIONS: PetActionDef[] = [
  {
    id: 'feed',
    name: '喂食',
    desc: '饱食 +18 · 心情 +4 · 亲密度 +3',
    icon: 'Fish',
    cost: 12,
    staminaCost: 1,
    effects: { hunger: 18, mood: 4, intimacy: 3 },
    diary: [
      '今天吃了两碗，碗底都舔干净了。',
      '闻到小鱼干的味道就从吧台上跳了下来。',
      '吃到一半停住，抬头看了我一眼，又低下头。',
    ],
  },
  {
    id: 'play',
    name: '玩耍',
    desc: '心情 +20 · 饱食 -6 · 亲密度 +5',
    icon: 'Sparkles',
    cost: 0,
    staminaCost: 1,
    effects: { mood: 20, hunger: -6, intimacy: 5 },
    diary: [
      '追着逗猫棒绕了吧台三圈，最后自己晕了。',
      '把毛线球推到窗边，又假装不是自己做的。',
      '玩累了，摊在暖光里伸了个很长的懒腰。',
    ],
  },
  {
    id: 'groom',
    name: '梳毛',
    desc: '清洁 +22 · 心情 +6 · 亲密度 +4',
    icon: 'Brush',
    cost: 8,
    staminaCost: 1,
    effects: { cleanliness: 22, mood: 6, intimacy: 4 },
    diary: [
      '梳毛的时候呼噜声一直没停过。',
      '被梳到耳后那块，整只猫都软下去了。',
      '梳完抖了抖，把浮毛抖了我一身。',
    ],
  },
  {
    id: 'photo',
    name: '拍照',
    desc: '心情 +8 · 亲密度 +2',
    icon: 'Camera',
    cost: 0,
    staminaCost: 0,
    effects: { mood: 8, intimacy: 2 },
    diary: [
      '今天在窗台上拍到了一张很好看的侧脸。',
      '它盯着镜头看了三秒，然后转头走掉了。',
      '落日的角度刚好，照片像一张明信片。',
    ],
  },
]

/* ============================================================
   角色
   ============================================================ */
export const CHARACTERS = [
  {
    id: 'linche',
    name: '林澈',
    role: '新来的咖啡师',
    note: '话不多，学东西很快，围裙是墨绿色的。',
  },
  {
    id: 'guhuai',
    name: '顾淮',
    role: '镇上的兽医',
    note: '每周三来给布丁做检查，总会多点一杯拿铁。',
  },
]

/* ============================================================
   主线章节
   ============================================================ */
export const CHAPTERS: ChapterDef[] = [
  {
    id: 'ch1',
    index: 1,
    title: '海风初遇',
    subtitle: '风铃响了一声',
    characterId: 'linche',
    scene: '傍晚六点 · 咖啡馆吧台',
    rewardCoins: 150,
    rewardExp: 40,
    beats: [
      {
        id: 'ch1-b1',
        type: 'narration',
        text: '傍晚六点，海风把咸味和花香一起送进店里。风铃响了一声，门被推开。',
      },
      {
        id: 'ch1-b2',
        type: 'dialogue',
        speaker: '林澈',
        text: '打扰了……我在门口的告示上看到，这里在招咖啡师。',
      },
      {
        id: 'ch1-b3',
        type: 'dialogue',
        speaker: '你',
        text: '嗯，正好缺一个会拉花的人。外套先挂那边吧，肩都湿了。',
      },
      {
        id: 'ch1-b4',
        type: 'narration',
        text: '他笑了笑，把外套搭在椅背上。布丁从吧台上跳下来，绕着他的脚转了一整圈。',
      },
      {
        id: 'ch1-b5',
        type: 'choice',
        prompt: '你想先问他点什么？',
        options: [
          {
            id: 'ch1-b5-a',
            text: '「你以前在哪家店做过？」',
            reply: '他认真地讲了很久，从豆子讲到水温，眼睛里有光。你发现他其实并不木讷。',
            effects: { relationship: 5 },
          },
          {
            id: 'ch1-b5-b',
            text: '「先喝点热的吧，手都冻红了。」',
            reply: '他把杯子捧在掌心，指尖一点点暖起来。半天才低声说了句谢谢。',
            effects: { relationship: 8 },
          },
          {
            id: 'ch1-b5-c',
            text: '「布丁好像很喜欢你。」',
            reply: '他蹲下来，很轻地挠了挠猫的下巴。布丁直接翻过身露出肚皮。',
            effects: { relationship: 4 },
          },
        ],
      },
      {
        id: 'ch1-b6',
        type: 'dialogue',
        speaker: '林澈',
        text: '……谢谢。我会好好学的，不会让你失望。',
      },
      {
        id: 'ch1-b7',
        type: 'narration',
        text: '窗外的落日把海面染成金色。今天的店，好像比昨天更长一点点。',
      },
    ],
  },
  {
    id: 'ch2',
    index: 2,
    title: '雨夜的伞',
    subtitle: '雨比预报来得更早',
    characterId: 'linche',
    scene: '夜里九点 · 打烊前的店',
    requiresChapter: 'ch1',
    requiresRelationship: 12,
    rewardCoins: 220,
    rewardExp: 60,
    beats: [
      {
        id: 'ch2-b1',
        type: 'narration',
        text: '雨下得比天气预报更早。招牌被收进来了，玻璃上全是水痕。',
      },
      {
        id: 'ch2-b2',
        type: 'dialogue',
        speaker: '林澈',
        text: '店长，最后一桌客人走了。我把机器也洗好了。',
      },
      {
        id: 'ch2-b3',
        type: 'choice',
        prompt: '他还没打算走。你要说什么？',
        options: [
          {
            id: 'ch2-b3-a',
            text: '「这么晚，外面雨这么大。」',
            reply: '他看了一眼窗外，又看回来，说：那我把地再拖一遍吧。',
            effects: { relationship: 6 },
          },
          {
            id: 'ch2-b3-b',
            text: '「剩下的可颂，你带走当宵夜。」',
            reply: '他愣了一下，把纸袋小心地放进包最里面。',
            effects: { relationship: 9 },
          },
        ],
      },
      {
        id: 'ch2-b4',
        type: 'narration',
        text: '你找出柜子里的两把伞，一把递给他。他撑开的时候，伞面在灯下亮了一下。',
      },
      {
        id: 'ch2-b5',
        type: 'choice',
        prompt: '门口只有一把伞够大。',
        options: [
          {
            id: 'ch2-b5-a',
            text: '「顺路，一起走吧。」',
            reply: '他往你那边偏了偏伞，自己半边肩膀都淋湿了，一路上没说话。',
            effects: { relationship: 12 },
          },
          {
            id: 'ch2-b5-b',
            text: '「路上小心，明天见。」',
            reply: '他点点头，走了两步又回头：明天见，店长。',
            effects: { relationship: 5 },
          },
        ],
      },
      {
        id: 'ch2-b6',
        type: 'narration',
        text: '第二天早上，吧台上放着一把伞，伞柄上系了一小束晒干的满天星。',
      },
    ],
  },
]

/* ============================================================
   独立剧情本
   ============================================================ */
export const STORYBOOK_CHAPTERS: StorybookChapterDef[] = [
  {
    id: 'sb1',
    index: 1,
    title: '灯塔旧信',
    subtitle: '潮水退去以后',
    scene: '清晨六点 · 海堤尽头',
    unlockStoryFlags: ['story:lighthouse-letter'],
    rewardCoins: 80,
    rewardExp: 18,
    beats: [
      {
        id: 'sb1-b1',
        type: 'narration',
        text: '潮水退到礁石后面。布丁先一步跑上海堤，在旧灯塔脚下停住，回头冲你叫了一声。',
      },
      {
        id: 'sb1-b2',
        type: 'dialogue',
        speaker: '阿岚',
        text: '你也捡到这个了？这封信泡过海水，收信人的名字还没糊掉。',
      },
      {
        id: 'sb1-b3',
        type: 'choice',
        prompt: '这封信该怎么处理？',
        options: [
          {
            id: 'sb1-b3-a',
            text: '先送回邮局查地址',
            reply: '阿岚把信夹进防水袋，说傍晚前就能找到地址。布丁却一直盯着港边。',
            effects: { exp: 8, storyFlags: ['story:letter-to-post'] },
          },
          {
            id: 'sb1-b3-b',
            text: '跟着湿脚印去港边',
            reply: '脚印一路通向废弃仓库。门缝里，旧唱片机正轻轻转着。',
            effects: { exp: 8, storyFlags: ['story:follow-footprints'] },
          },
        ],
      },
      {
        id: 'sb1-b4',
        type: 'narration',
        text: '灯塔上的玻璃映出云影。那封信的封口处，露出一枚褪色的蓝色火漆印。',
      },
      {
        id: 'sb1-b5',
        type: 'narration',
        text: '你把火漆印记了下来。海风翻过信纸，像有人从很远的地方轻轻叹了口气。',
      },
    ],
  },
  {
    id: 'sb2',
    index: 2,
    title: '猫知道的路',
    subtitle: '它总在同一个路口转弯',
    scene: '午后三点 · 旧街尽头',
    requiresChapter: 'sb1',
    unlockStoryFlags: ['story:old-harbor-address'],
    rewardCoins: 110,
    rewardExp: 26,
    beats: [
      {
        id: 'sb2-b1',
        type: 'narration',
        text: '第二天午后，布丁又溜出店门。它熟门熟路地穿过旧街，在第三个路口左转。',
      },
      {
        id: 'sb2-b2',
        type: 'dialogue',
        speaker: '你',
        text: '你到底想带我去哪儿？',
      },
      {
        id: 'sb2-b3',
        type: 'choice',
        prompt: '巷口传来收音机的杂音。',
        options: [
          {
            id: 'sb2-b3-a',
            text: '敲门问问',
            reply: '门后的人认得那枚蓝色火漆，也认得信上的名字。',
            branch: {
              id: 'sb2-door',
              beats: [
                {
                  id: 'sb2-door-1',
                  type: 'dialogue',
                  speaker: '旧屋主人',
                  text: '你终于来了。那封信，是我四十年前寄出去的。',
                },
                {
                  id: 'sb2-door-2',
                  type: 'narration',
                  text: '老人把一张旧船票推过桌面。角落的日期，与信纸背面完全一致。',
                },
                {
                  id: 'sb2-door-3',
                  type: 'dialogue',
                  speaker: '你',
                  text: '寄信的人，还在等回音吗？',
                },
              ],
            },
            effects: { exp: 10, storyFlags: ['story:knocked-on-door'] },
          },
          {
            id: 'sb2-b3-b',
            text: '先在窗外听一会儿',
            reply: '收音机里念出旧港的航号，和信纸背面写的一模一样。',
            branch: {
              id: 'sb2-window',
              beats: [
                {
                  id: 'sb2-window-1',
                  type: 'narration',
                  text: '隔着半扇窗，你看见桌上摊着同一张旧港地图，红笔圈住了灯塔。',
                },
                {
                  id: 'sb2-window-2',
                  type: 'dialogue',
                  speaker: '阿岚',
                  text: '别敲门。先听听他下一句会说什么。',
                },
                {
                  id: 'sb2-window-3',
                  type: 'narration',
                  text: '收音机突然安静。门后的人拿起电话，说出了阿岚的名字。',
                },
              ],
            },
            effects: { exp: 10, storyFlags: ['story:heard-radio-code'] },
          },
        ],
      },
      {
        id: 'sb2-b4',
        type: 'dialogue',
        speaker: '阿岚',
        text: '地址找到了。可它不属于现在的海风镇。',
      },
      {
        id: 'sb2-b5',
        type: 'narration',
        text: '布丁跳上窗台，尾巴指向港口。旧灯塔在远处亮起第一盏晚灯。',
      },
    ],
  },
]

/* ============================================================
   今日节奏（主界面）
   ============================================================ */
export interface RhythmSlot {
  id: string
  label: string
  time: string
  desc: string
  icon: string
  view: 'business' | 'cafe' | 'pet' | 'romance' | 'story'
}

export const RHYTHM: RhythmSlot[] = [
  {
    id: 'morning',
    label: '上午',
    time: '07:00 - 11:00',
    desc: '备料开店，出杯快一点',
    icon: 'Coffee',
    view: 'cafe',
  },
  {
    id: 'noon',
    label: '午后',
    time: '12:00 - 16:00',
    desc: '整理店面，添置家当',
    icon: 'Store',
    view: 'cafe',
  },
  {
    id: 'dusk',
    label: '傍晚',
    time: '17:00 - 20:00',
    desc: '布丁的精神最好',
    icon: 'PawPrint',
    view: 'pet',
  },
  {
    id: 'night',
    label: '夜里',
    time: '21:00 - 23:00',
    desc: '打烊后，有人还没走',
    icon: 'Heart',
    view: 'romance',
  },
]
