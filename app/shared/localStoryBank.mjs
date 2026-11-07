const LOCAL_STORY_BANK = [
  {
    title: '只给猫点的单',
    subtitle: '没有写进菜单的那一杯',
    scene: '打烊前二十分钟 · 吧台',
    beats: [
      {
        type: 'narration',
        text: '打烊前二十分钟，{pet}忽然跳上吧台，把一张没有落款的点单卡推到灯下。',
      },
      {
        type: 'dialogue',
        speaker: '顾淮',
        text: '它今天第二次拦这张单了。也许不是有人在开玩笑。',
      },
      {
        type: 'narration',
        text: '{pet}用爪子按住那张点单卡，尾巴尖一下一下敲着台面。卡片上只写着一句话：给会在这里等门的人。',
      },
      {
        type: 'narration',
        text: '门外的风铃没有响。海风却把没关严的窗吹开了一条缝。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '照着{pet}停留的位置做一杯温牛奶',
        reply: '杯子刚放下，门口的风铃就响了。顾淮没有立刻进来，只站在灯外看着那只杯子。',
        consequence: '顾淮记住了你愿意相信{pet}的判断。',
      },
      {
        id: 'choice-b',
        text: '把点单卡收进抽屉，先等失主回来',
        reply: '你合上抽屉时，{pet}轻轻叫了一声。顾淮把诊所的名片压在杯子下面，没有追问。',
        consequence: '那张没有落款的点单卡成为剧情本里的一条未解线索。',
      },
    ],
    memoryAnchors: ['打烊前二十分钟的点单卡', '一直守在吧台边的{pet}'],
    clue: '点单卡背面有一道被水泡开的蓝色印痕。',
  },
  {
    title: '雨伞上的旧车票',
    subtitle: '从没有人带着它进门',
    scene: '午后阵雨 · 门廊',
    beats: [
      {
        type: 'narration',
        text: '午后忽然落雨，门口伞桶里多了一把深蓝色折叠伞，伞柄上系着一根褪色的红线。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '这把伞不是店里的。今天也没人带着它进来。',
      },
      {
        type: 'narration',
        text: '《{previous}》留下的动静还没散，{pet}又蹲到伞边，从夹层里拨出一张去旧港站的蓝色车票。',
      },
      {
        type: 'narration',
        text: '你蹲下时，{pet}用鼻尖碰了碰车票背面。那里用铅笔写着一个很小的数字：07。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把车票压在收银台，等伞主人回来',
        reply: '你把车票放进透明压板下。{pet}在门边守了很久，直到雨停才回到窗台。',
        consequence: '林澈把伞桶挪到灯下，说这样回来的人一眼就能看见。',
      },
      {
        id: 'choice-b',
        text: '撑开伞仔细检查夹层',
        reply: '伞面里侧缝着一小片布标，上面是旧港站的字样。{pet}立刻把尾巴搭在你的鞋面上。',
        consequence: '这把伞和旧港站的某段往事被你记了下来。',
      },
    ],
    memoryAnchors: ['深蓝色折叠伞', '旧港站的蓝色车票'],
    clue: '车票日期是十年前，背面用铅笔写着“07”。',
  },
  {
    title: '寄到明天的明信片',
    subtitle: '邮戳比今天晚一天',
    scene: '清晨 · 靠窗座位',
    beats: [
      {
        type: 'narration',
        text: '邮差从门缝塞进一张明信片。收件人写着咖啡馆，落款日期却是明天。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '更像是写错了。不过这个蓝色邮戳，我只在旧港见过。',
      },
      {
        type: 'narration',
        text: '《{previous}》里的旧港车站被重新提起。{pet}把明信片按在爪下，只露出一角海堤的画。',
      },
      {
        type: 'narration',
        text: '画背面没有署名，只有一句：等退潮以后，再看窗台。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '先收进剧情本，真的等到明天再拆',
        reply: '你把明信片夹进剧情本。{pet}在封面上踩了一个梅花印，像替你盖了章。',
        consequence: '你和林澈约好，明天开门前一起看窗台。',
      },
      {
        id: 'choice-b',
        text: '趁午休去旧港邮局问邮戳',
        reply: '林澈把路线写在你手背上。{pet}一路送到门口，又在台阶上停了很久。',
        consequence: '旧港邮局成为下一条可以追的线索。',
      },
    ],
    memoryAnchors: ['寄到明天的明信片', '旧港特有的蓝色邮戳'],
    clue: '明信片上的海堤，与咖啡馆翻修前的旧照片来自同一个角度。',
  },
  {
    title: '凌晨四点的电话',
    subtitle: '来电人知道猫还没有睡',
    scene: '凌晨四点 · 吧台',
    beats: [
      {
        type: 'narration',
        text: '凌晨四点，店里的座机响了。{pet}先跳到吧台上，用爪子按下了免提。',
      },
      {
        type: 'dialogue',
        speaker: '顾淮',
        text: '它是不是一直盯着窗外？别开灯，先看看门缝下面。',
      },
      {
        type: 'narration',
        text: '《{previous}》之后，{pet}对旧港方向格外敏感。门缝下果然压着一枚诊所的旧号码牌。',
      },
      {
        type: 'narration',
        text: '电话在你问出原因前挂断。号码牌背面只有顾淮的字：明早带来给我。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '立刻回拨顾淮，问清楚发生了什么',
        reply: '电话响了很久才接通。顾淮听见{pet}的叫声，沉默两秒后轻声让你别出门。',
        consequence: '顾淮答应天亮后亲自来店里解释。',
      },
      {
        id: 'choice-b',
        text: '记下号码，陪{pet}等到天亮',
        reply: '你把号码牌翻过来放在灯下。{pet}终于趴在你手边，却仍朝着门的方向。',
        consequence: '这通电话留下了一个只有顾淮能解答的问题。',
      },
    ],
    memoryAnchors: ['凌晨四点的座机电话', '诊所旧号码牌'],
    clue: '号码牌上的编号已经停用，背面写着“明早带来给我”。',
  },
  {
    title: '多出来的一把钥匙',
    subtitle: '它认得旧港的锁',
    scene: '午后 · 后门',
    beats: [
      {
        type: 'narration',
        text: '你在{pet}的猫窝里发现一把黄铜钥匙。钥匙柄被磨得发亮，刻着旧港的浪纹。',
      },
      {
        type: 'dialogue',
        speaker: '阿岚',
        text: '这种钥匙，旧港的储物柜以前都在用。七号柜，我小时候替人送过东西。',
      },
      {
        type: 'narration',
        text: '《{previous}》留下的线索又指向旧港。{pet}咬住钥匙上的红绳，慢慢把你带到后门。',
      },
      {
        type: 'narration',
        text: '后门没有上锁。门边却放着一张刚被海风吹干的旧港地图。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '请阿岚带你去看看七号储物柜',
        reply: '阿岚没问原因，只把外套搭在肩上。{pet}率先跳上他的自行车后座。',
        consequence: '你和阿岚约好傍晚一起去旧港。',
      },
      {
        id: 'choice-b',
        text: '先把钥匙和地图收好，不急着出门',
        reply: '你锁好后门。{pet}在钥匙旁趴下，尾巴把地图压出一条平整的折痕。',
        consequence: '七号储物柜成为下一段旧港剧情的入口。',
      },
    ],
    memoryAnchors: ['黄铜钥匙', '旧港七号储物柜'],
    clue: '旧港地图上，七号储物柜被红笔圈了两次。',
  },
  {
    title: '窗台上的第二只杯子',
    subtitle: '有人记得猫也怕烫',
    scene: '清晨 · 窗边座位',
    beats: [
      {
        type: 'narration',
        text: '开门时，窗台上已经放着两只杯子。一只装着咖啡，另一只盛着刚好不烫的温水。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '我只做了一杯。另一只杯底有店里的拉花记号，但不是我放的。',
      },
      {
        type: 'narration',
        text: '《{previous}》之后，{pet}第一次没有先去闻杯子，而是坐在旁边看你。',
      },
      {
        type: 'narration',
        text: '温水表面浮着一小片薄荷。杯垫下面压着一张写着今天日期的便签。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把第二只杯子留在窗边，不追问',
        reply: '林澈把便签收进抽屉。你们都没再提这件事，{pet}却把两只杯子轮流看了一遍。',
        consequence: '这份没有说破的照顾被留在了窗边。',
      },
      {
        id: 'choice-b',
        text: '问林澈这个拉花记号是谁教的',
        reply: '林澈停了一会儿，才说那是他刚学咖啡时画坏的第一个图案。',
        consequence: '你无意间问到了林澈很少提起的旧事。',
      },
    ],
    memoryAnchors: ['窗台上的第二只杯子', '杯底的小拉花记号'],
    clue: '便签上的日期和林澈学咖啡那年，正好是同一天。',
  },
  {
    title: '阿岚的湿盐',
    subtitle: '帆布袋里藏着旧照片',
    scene: '傍晚 · 门廊',
    beats: [
      {
        type: 'narration',
        text: '阿岚冒雨送来一只帆布袋，袋口沾着盐粒。{pet}闻了一下，连打了两个喷嚏。',
      },
      {
        type: 'dialogue',
        speaker: '阿岚',
        text: '从旧港仓库里翻出来的。袋上绣的店名，已经褪得差不多了。',
      },
      {
        type: 'narration',
        text: '《{previous}》里的地名再次出现。你打开袋口，里面只有一张被海风磨白的照片。',
      },
      {
        type: 'narration',
        text: '照片拍的是咖啡馆翻修前的窗边，同一张窗台上也趴着一只橘白猫。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '请阿岚讲讲照片里的旧港仓库',
        reply: '阿岚把湿外套挂好，坐下来讲了很久。{pet}在故事讲到一半时睡着了。',
        consequence: '你第一次把咖啡馆的过去和旧港连在了一起。',
      },
      {
        id: 'choice-b',
        text: '把照片烘干，收进剧情本',
        reply: '你隔着棉布慢慢压干照片。{pet}守在旁边，直到窗边那双旧猫的轮廓重新清楚。',
        consequence: '照片成为剧情本里关于咖啡馆过去的第一份证据。',
      },
    ],
    memoryAnchors: ['沾着盐粒的帆布袋', '咖啡馆翻修前的旧照片'],
    clue: '照片背后写着“旧港仓库，等风停”，没有留下年份。',
  },
  {
    title: '风铃没有响',
    subtitle: '门却被轻轻推开',
    scene: '夜雨 · 门边',
    beats: [
      {
        type: 'narration',
        text: '夜雨下到一半，门被推开，风铃却没有响。{pet}冲到门边，停在一个纸盒前。',
      },
      {
        type: 'dialogue',
        speaker: '顾淮',
        text: '盒子里不是药。它上次躲得厉害，我就把复诊提醒换成了纸片。',
      },
      {
        type: 'narration',
        text: '《{previous}》里被小心照顾的痕迹还在。顾淮把伞收好，没有急着走近{pet}。',
      },
      {
        type: 'narration',
        text: '纸盒里有一块新毯子和一张日期便签。{pet}先踩上毯子，才允许顾淮摸一下耳朵。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '留顾淮喝一杯热饮，等雨小一点',
        reply: '顾淮在离猫窝最近的位置坐下。{pet}没有躲，只把尾巴搭在椅子边缘。',
        consequence: '顾淮答应下次复诊也带着毯子来。',
      },
      {
        id: 'choice-b',
        text: '把新毯子铺到{pet}最喜欢的位置',
        reply: '你铺好毯子，{pet}立刻占了正中间。顾淮看着它，终于放轻了声音。',
        consequence: '诊所纸盒不再只意味着紧张，也带上了店里的一点安心。',
      },
    ],
    memoryAnchors: ['顾淮带来的新毯子', '风铃没有响的夜雨'],
    clue: '纸盒底下压着一张手写的下次复诊日期。',
  },
  {
    title: '檐下的旧唱片',
    subtitle: '唱针落下时，雨停了',
    scene: '雨后黄昏 · 门廊',
    beats: [
      {
        type: 'narration',
        text: '雨停后，屋檐下多了一张没有封套的黑胶唱片，边缘还沾着新鲜水汽。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '这首歌以前只在旧港的渡轮上放过。现在几乎没有人记得了。',
      },
      {
        type: 'narration',
        text: '《{previous}》留下的动静还没散，{pet}已经蹲在唱片旁，用爪子轻碰标签。',
      },
      {
        type: 'narration',
        text: '标签背面用蓝墨写着：第七码头，日落前。字迹被水晕开了一半。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '用店里的唱机放一遍',
        reply: '唱针落下后，林澈忽然安静下来。{pet}也收好爪子，趴在音箱边听完。',
        consequence: '唱片里短暂的潮声，让林澈想起一段没有说完的旧事。',
      },
      {
        id: 'choice-b',
        text: '先把唱片擦干，再问林澈来历',
        reply: '林澈接过唱片，只擦到标签旁就停了手。他说这张唱片原本不该留在这里。',
        consequence: '唱片标签上的蓝墨，成为辨认旧港渡轮的关键。',
      },
    ],
    memoryAnchors: ['没有封套的黑胶唱片', '蓝墨写下的第七码头'],
    clue: '唱片内圈刻着一个日期，比旧港渡轮停航早了三天。',
  },
  {
    title: '没端走的那碗汤',
    subtitle: '勺柄一直朝着门',
    scene: '午休过后 · 窗边',
    beats: [
      {
        type: 'narration',
        text: '午休时，靠窗桌上留着一碗还温着的海带汤，勺柄端端正正朝着门。',
      },
      {
        type: 'dialogue',
        speaker: '阿岚',
        text: '今天没有客人点汤。而且这碗的咸淡，像是旧港那边的手艺。',
      },
      {
        type: 'narration',
        text: '《{previous}》之后，{pet}第一次主动跳上陌生人的椅子，低头闻了闻碗沿。',
      },
      {
        type: 'narration',
        text: '碗底压着一小片折好的餐巾，上面只写着：喝完就不必找了。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把汤留温，等写字的人回来',
        reply: '你重新盖上碗盖。{pet}在窗边守了一下午，直到汤彻底凉透也没有离开。',
        consequence: '那碗汤没有等到主人，却让阿岚确认了一件事。',
      },
      {
        id: 'choice-b',
        text: '顺着海带的味道去问阿岚',
        reply: '阿岚尝了一小口，眉头慢慢松开。他说这是旧港一户人家常做的味道。',
        consequence: '一碗普通的汤，把线索带回了阿岚熟悉的旧港。',
      },
    ],
    memoryAnchors: ['还温着的海带汤', '只写了半句话的餐巾'],
    clue: '餐巾边缘印着一间已经停业多年的小食堂名字。',
  },
  {
    title: '落在收银台的羽毛',
    subtitle: '不是店里任何一只鸟',
    scene: '清晨 · 收银台',
    beats: [
      {
        type: 'narration',
        text: '开门时，收银台上落着一根灰蓝色羽毛，细看还沾着一点海盐。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '门一直关着，窗也只开了一条缝。它不像是自己飘进来的。',
      },
      {
        type: 'narration',
        text: '《{previous}》里的线索还没有归位，{pet}却把羽毛从台面推到了你脚边。',
      },
      {
        type: 'narration',
        text: '羽毛下面压着一张送货单，收件地址只写了海风镇最高的那盏灯。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把羽毛和送货单一起收进剧情本',
        reply: '林澈替你压平送货单。{pet}盯着那片羽毛，直到它被夹进书页。',
        consequence: '这份没有送达的单据，成了海边灯塔线的第一页记录。',
      },
      {
        id: 'choice-b',
        text: '去海边问问常来的送货车',
        reply: '车夫看了羽毛很久，只说今早有人托他把一只空笼子送上灯塔。',
        consequence: '空笼子与灰蓝色羽毛，让清晨多出一条可以追的路线。',
      },
    ],
    memoryAnchors: ['灰蓝色羽毛', '送往灯塔的送货单'],
    clue: '送货单上的取件时间，比咖啡馆开门早了整整一小时。',
  },
  {
    title: '停在七点十七分',
    subtitle: '墙钟错过了一场雨',
    scene: '傍晚 · 吧台',
    beats: [
      {
        type: 'narration',
        text: '打烊前，你发现墙钟停在七点十七分，窗外的雨却刚刚开始下。',
      },
      {
        type: 'dialogue',
        speaker: '顾淮',
        text: '昨晚七点十七分，我在门口听见它响了三次。那时店里应该没有人。',
      },
      {
        type: 'narration',
        text: '《{previous}》之后，{pet}总会避开那面墙。今天却坐在钟下，抬头一动不动。',
      },
      {
        type: 'narration',
        text: '你取下钟，发现背板夹着一张当天的旧收据，时间正好也是七点十七分。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '按收据上的桌号复原那晚',
        reply: '顾淮把椅子摆回原位。{pet}立刻跳上其中一把，像在等一个迟到的人。',
        consequence: '你和顾淮拼出了那晚没有被记录的一桌客人。',
      },
      {
        id: 'choice-b',
        text: '先修好钟，把收据留下',
        reply: '钟重新走动时，{pet}轻轻叫了一声。顾淮把收据折好，没有急着解释。',
        consequence: '停摆的十分钟被留在剧情本里，等待下一次核对。',
      },
    ],
    memoryAnchors: ['停在七点十七分的墙钟', '钟背板里的旧收据'],
    clue: '旧收据上的桌号，是店里现在已经撤掉的第七桌。',
  },
  {
    title: '后巷的蓝色粉笔',
    subtitle: '有人画了一只小猫',
    scene: '打烊后 · 后巷',
    beats: [
      {
        type: 'narration',
        text: '打烊后，后巷墙上多了一只用蓝色粉笔画的小猫，脚边画着一只鱼形铃铛。',
      },
      {
        type: 'dialogue',
        speaker: '阿岚',
        text: '这种粉笔以前给旧港的孩子做记号用。现在很难买到了。',
      },
      {
        type: 'narration',
        text: '《{previous}》里出现过的蓝色印痕闪过脑海。{pet}走到墙边，鼻尖正好碰到铃铛。',
      },
      {
        type: 'narration',
        text: '粉笔画下面压着一小段粉笔，旁边写着：明晚还会来补完。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把后巷灯留着，明晚再来',
        reply: '阿岚帮你把灯调亮。第二天墙上的小猫果然多了一条尾巴，画的人却没出现。',
        consequence: '后巷那盏灯，成了对方确认你愿意继续等的信号。',
      },
      {
        id: 'choice-b',
        text: '请阿岚辨认粉笔的来源',
        reply: '阿岚把粉笔放在灯下看了很久，说他认识卖这种粉笔的老店。',
        consequence: '蓝色粉笔把线索带向了旧港的一间文具铺。',
      },
    ],
    memoryAnchors: ['后巷墙上的粉笔猫', '半截蓝色粉笔'],
    clue: '粉笔尾端压着一个很小的鱼形图案，与画中的铃铛相似。',
  },
  {
    title: '不认路的快递箱',
    subtitle: '收件人写着布丁',
    scene: '午后 · 门口',
    beats: [
      {
        type: 'narration',
        text: '午后，门口放着一只没有快递单的纸箱。封面上只用粗笔写着{pet}的名字。',
      },
      {
        type: 'dialogue',
        speaker: '顾淮',
        text: '诊所今天没有寄东西给你。而且这只箱子的胶带，是旧港仓库常用的那种。',
      },
      {
        type: 'narration',
        text: '《{previous}》里的仓库气息似乎又回来了。{pet}绕着箱子闻了一圈，最后坐进阴影里。',
      },
      {
        type: 'narration',
        text: '箱里没有危险物品，只有一只洗得很旧的猫项圈和半张手写地址。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把项圈留下，先查寄出的地址',
        reply: '顾淮把地址抄下来。{pet}把项圈拨到猫窝边，却没有靠近。',
        consequence: '你决定先弄清这份旧物属于谁，再想它为什么寄到这里。',
      },
      {
        id: 'choice-b',
        text: '让布丁自己决定要不要留下',
        reply: '你等了很久，{pet}才慢慢走过去，把项圈叼回了自己最喜欢的毯子上。',
        consequence: '这份没有署名的旧物，暂时被{pet}自己收下了。',
      },
    ],
    memoryAnchors: ['写有{pet}名字的纸箱', '洗旧的猫项圈'],
    clue: '项圈内侧刻着旧港仓库的编号，却没有留下猫的名字。',
  },
  {
    title: '阿岚的旧相机',
    subtitle: '最后一张底片还在',
    scene: '黄昏 · 储物间',
    beats: [
      {
        type: 'narration',
        text: '阿岚来借梯子时，把一台旧相机落在了储物间。相机里还剩最后一张底片。',
      },
      {
        type: 'dialogue',
        speaker: '阿岚',
        text: '那卷底片我找了很多年。拍完以后，我就再没见过照片里的地方。',
      },
      {
        type: 'narration',
        text: '《{previous}》之后，{pet}很少进储物间。今天却一直坐在相机旁，尾巴轻轻扫过背带。',
      },
      {
        type: 'narration',
        text: '相机背后贴着一张旧冲洗单，取件日期已经褪得只剩年份。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '陪阿岚去把底片冲洗出来',
        reply: '照片里是雨后的咖啡馆。阿岚看了很久，说那扇窗比现在多一道木框。',
        consequence: '你们第一次看见咖啡馆翻修前最完整的一张照片。',
      },
      {
        id: 'choice-b',
        text: '先修好相机，让阿岚自己决定',
        reply: '阿岚把相机重新挂回肩上。走进门前，他回头替你和{pet}拍了一张。',
        consequence: '旧相机留下的不只是过去的底片，也多了一张今天的照片。',
      },
    ],
    memoryAnchors: ['阿岚的旧相机', '只剩一张的底片'],
    clue: '冲洗单上的店铺地址，与旧港邮局只隔一条街。',
  },
  {
    title: '海盐罐里的贝壳',
    subtitle: '听见了昨天的潮声',
    scene: '晚饭前 · 吧台',
    beats: [
      {
        type: 'narration',
        text: '林澈换海盐罐时，从罐底倒出一枚很小的白贝壳。上面有一圈蓝色记号。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '这罐盐是上周从旧港带回来的。我不记得里面放过这种东西。',
      },
      {
        type: 'narration',
        text: '《{previous}》留下的蓝色印痕还没有解释。{pet}凑近贝壳，忽然朝门外连着叫了两声。',
      },
      {
        type: 'narration',
        text: '贝壳放在耳边时，海潮声里夹着一段很轻的敲击，像有人隔着门打招呼。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把贝壳交给林澈保管',
        reply: '林澈把贝壳放进围裙口袋，又特意拍了拍。{pet}这才安静下来。',
        consequence: '林澈开始留意那批旧港海盐的来路。',
      },
      {
        id: 'choice-b',
        text: '沿着盐袋上的店铺名去找',
        reply: '你们在灯下把盐袋翻了个面，找到一枚被磨白的印章。林澈立刻认出了那条街。',
        consequence: '海盐罐里的贝壳，把线索带回旧港的一条老街。',
      },
    ],
    memoryAnchors: ['海盐罐底的白贝壳', '带蓝色记号的盐袋'],
    clue: '贝壳上的蓝色记号，和咖啡馆旧钥匙上的浪纹来自同一种颜料。',
  },
  {
    title: '林澈写错的菜单',
    subtitle: '多了一杯没人点过的咖啡',
    scene: '午后 · 小黑板',
    beats: [
      {
        type: 'narration',
        text: '午后，你发现黑板上多了一杯没人点过的咖啡，名字只写了“海风”。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '不是我写的。不过这个字距，和我刚学做咖啡时的习惯很像。',
      },
      {
        type: 'narration',
        text: '《{previous}》里关于旧事的痕迹还没淡去。{pet}坐在黑板下，抬爪碰了碰“风”字。',
      },
      {
        type: 'narration',
        text: '黑板背后夹着一张当年的练习单，最下面也写着同样的三个字。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '按练习单复原那杯咖啡',
        reply: '林澈尝了一口，沉默片刻后笑了。{pet}立刻把爪子搭上杯垫。',
        consequence: '林澈第一次愿意提起自己刚开始学咖啡时的店。',
      },
      {
        id: 'choice-b',
        text: '把练习单还给林澈，不追问',
        reply: '林澈把纸折了两折，放进围裙。那天下午，他重新写了整块菜单。',
        consequence: '那张练习单被林澈收好，也留下了一个可以以后再问的入口。',
      },
    ],
    memoryAnchors: ['多出的一杯“海风”', '黑板背后的练习单'],
    clue: '练习单角落印着一间旧咖啡馆的店章，名字只剩半个字。',
  },
  {
    title: '忘在门口的听诊器',
    subtitle: '顾淮没有立刻回来拿',
    scene: '雨前 · 门边',
    beats: [
      {
        type: 'narration',
        text: '顾淮离开后，门边留下了一只听诊器。金属听头还是温的。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '他每次出诊都会检查两遍。忘在这里，不像他的习惯。',
      },
      {
        type: 'narration',
        text: '《{previous}》里的旧号码牌仍在抽屉里。{pet}走到听诊器旁，却没有像平时那样伸爪去碰。',
      },
      {
        type: 'narration',
        text: '管子内侧夹着一张小纸片，上面是顾淮的字：如果我没回来，先别关窗。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '留一扇窗，等顾淮回来',
        reply: '雨落下来前，顾淮终于回到门口。他看见那扇窗，脚步明显慢了下来。',
        consequence: '顾淮意识到，你读懂了他留下的那句提醒。',
      },
      {
        id: 'choice-b',
        text: '收起听诊器，主动去找他',
        reply: '你在诊所门口找到顾淮。他接过听诊器时，先问的是{pet}有没有不安。',
        consequence: '你把那纸条带回了诊所，也带回了一个需要解释的约定。',
      },
    ],
    memoryAnchors: ['顾淮忘下的听诊器', '写着别关窗的纸片'],
    clue: '纸片背面有一道很浅的药柜编号，诊所里却没有对应柜子。',
  },
  {
    title: '布丁藏起来的纽扣',
    subtitle: '和一件旧围裙很相配',
    scene: '上午 · 洗衣篮旁',
    beats: [
      {
        type: 'narration',
        text: '你找围裙纽扣时，{pet}从猫窝里叼出一枚木扣，放在你鞋尖前。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '这不是新扣子。木头已经发亮，应该被摸了很多年。',
      },
      {
        type: 'narration',
        text: '《{previous}》里留下的旧物线索又添了一件。{pet}见你没有拿走，又把纽扣推近一点。',
      },
      {
        type: 'narration',
        text: '纽扣背面刻着一只很小的猫头，图案与店里旧围裙上的针脚相同。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把纽扣缝回旧围裙',
        reply: '你缝好最后一针，{pet}立刻在围裙边坐下，像在验收你的手艺。',
        consequence: '旧围裙重新完整，林澈也想起它最初属于谁。',
      },
      {
        id: 'choice-b',
        text: '先把纽扣收好，问问林澈',
        reply: '林澈对着猫头看了很久，说这是开店初期的定制扣。',
        consequence: '一枚旧纽扣，把咖啡馆最早的一批物件重新带回了视线。',
      },
    ],
    memoryAnchors: ['{pet}叼来的木扣', '刻着猫头的小纽扣'],
    clue: '纽扣比旧围裙现有的孔位小半圈，说明它原本属于另一件衣服。',
  },
  {
    title: '黄昏广播里的名字',
    subtitle: '没有说完的那句话',
    scene: '黄昏 · 收音机',
    beats: [
      {
        type: 'narration',
        text: '黄昏广播念到海风镇时，店里的旧收音机忽然盖过了林澈的声音。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '刚才那个名字，被电流截断了。听起来像是旧港的一位老邮差。',
      },
      {
        type: 'narration',
        text: '《{previous}》里出现过旧港邮戳。{pet}跳上收音机旁，尾巴正好挡住调频旋钮。',
      },
      {
        type: 'narration',
        text: '节目结束时，广播留下一个电话号码。最后两位重复了三次。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '让林澈尝试回拨广播号码',
        reply: '电话接通后只有很轻的海浪声。林澈报出店名，对面才有人应声。',
        consequence: '一段断掉的广播，把咖啡馆和旧港邮差重新连上。',
      },
      {
        id: 'choice-b',
        text: '先记下号码，等节目重播',
        reply: '你把号码写进剧情本。{pet}在纸角按下一枚爪印，像替这页封存。',
        consequence: '电话号码与遗漏的名字，成为下一次收听广播的线索。',
      },
    ],
    memoryAnchors: ['打断林澈的旧收音机', '重复三次的末两位号码'],
    clue: '广播里的电话号码属于旧港邮局，但那座邮局早已改成了仓库。',
  },
  {
    title: '窗边多出的猫爪印',
    subtitle: '一直印到关着的窗外',
    scene: '清晨 · 窗台',
    beats: [
      {
        type: 'narration',
        text: '清晨擦窗时，你发现玻璃内侧有一串湿猫爪印，一直延伸到关着的窗边。',
      },
      {
        type: 'dialogue',
        speaker: '顾淮',
        text: '昨晚下过雨，但室内不该有这种痕迹。{pet}的爪子也是干的。',
      },
      {
        type: 'narration',
        text: '《{previous}》留下的水痕还没干透。{pet}看着那串爪印，慢慢退到柜台后面。',
      },
      {
        type: 'narration',
        text: '爪印最上方有一小块被按出的空白，正好是窗锁的位置。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '检查窗锁，暂时不擦掉爪印',
        reply: '顾淮确认窗锁没有被动过。{pet}见你没有擦，才重新靠近窗台。',
        consequence: '爪印被完整保留下来，等待下一次下雨时对照。',
      },
      {
        id: 'choice-b',
        text: '先顺着爪印寻找水迹来源',
        reply: '你们沿着淡淡的水线走到储物间，最后停在一只旧喷壶旁。',
        consequence: '窗边的爪印有了现实来源，也让旧喷壶重新进入调查。',
      },
    ],
    memoryAnchors: ['窗内的湿猫爪印', '停在窗锁旁的空白'],
    clue: '旧喷壶里的水混着极淡的蓝墨，与之前出现过的印痕颜色相同。',
  },
  {
    title: '停电后的那盏灯',
    subtitle: '只有储物间还亮着',
    scene: '夜里 · 店内',
    beats: [
      {
        type: 'narration',
        text: '整条街停电时，咖啡馆只剩储物门缝里透出一线暖光。',
      },
      {
        type: 'dialogue',
        speaker: '阿岚',
        text: '那间没有接备用电路。你先别开门，我听见里面有铃铛声。',
      },
      {
        type: 'narration',
        text: '《{previous}》里的风铃声再次出现。{pet}守在储物间外，尾巴慢慢压低。',
      },
      {
        type: 'narration',
        text: '门开后，里面只有一盏老式露营灯。灯脚缠着已经停用的电线。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '先检查电线和露营灯',
        reply: '阿岚找到一处被重新接过的线头。{pet}在灯下坐好，终于不再盯着门。',
        consequence: '你确认这不是异常亮灯，而是一次有人提前准备的照明。',
      },
      {
        id: 'choice-b',
        text: '把露营灯带回大厅，陪猫等电来',
        reply: '灯放在猫窝旁后，{pet}很快趴了下来。阿岚则去门外查看线路。',
        consequence: '这盏旧灯既照见了停电的夜，也照出一个来过储物间的人。',
      },
    ],
    memoryAnchors: ['停电后仍亮着的储物间', '缠着旧电线的露营灯'],
    clue: '露营灯底部贴着一张小标签，写着旧港仓库的应急物资编号。',
  },
  {
    title: '旧港寄来的空信封',
    subtitle: '封口留着海盐',
    scene: '上午 · 信箱',
    beats: [
      {
        type: 'narration',
        text: '信箱里躺着一个旧港寄来的信封，封口粘得很紧，里面却是空的。',
      },
      {
        type: 'dialogue',
        speaker: '阿岚',
        text: '这不是邮局的新信封。边角的海盐，是仓库那边才会沾上的。',
      },
      {
        type: 'narration',
        text: '《{previous}》之后，{pet}对带盐的东西总会多闻两下。信封也不例外。',
      },
      {
        type: 'narration',
        text: '你对着灯举起信封，纸背慢慢浮出一排被压过的铅笔字。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把纸背的字拓下来',
        reply: '阿岚找来软铅笔。字迹显现时，{pet}忽然用爪子按住最后一行。',
        consequence: '空信封留下了一段地址，也留下了{pet}不愿让你立刻读完的句子。',
      },
      {
        id: 'choice-b',
        text: '请阿岚带你去旧港仓库',
        reply: '阿岚把信封收进外套。出发前，{pet}先一步跳上了自行车后座。',
        consequence: '空信封成为前往旧港仓库的正当理由。',
      },
    ],
    memoryAnchors: ['旧港寄来的空信封', '信封边角的海盐'],
    clue: '纸背压痕里重复出现“七码头”，和唱片上的地点相同。',
  },
  {
    title: '雨停前最后一桌',
    subtitle: '客人只点了一杯温水',
    scene: '夜雨 · 窗边',
    beats: [
      {
        type: 'narration',
        text: '雨停前，最后一位客人只要了杯温水，却把椅子摆成面向猫窝的位置。',
      },
      {
        type: 'dialogue',
        speaker: '林澈',
        text: '她问我{pet}是不是还怕雷。我只说，它现在会自己找地方躲。',
      },
      {
        type: 'narration',
        text: '《{previous}》里的照顾痕迹还在。{pet}没有躲开客人，只是隔着桌脚看她。',
      },
      {
        type: 'narration',
        text: '客人离开后，杯底压着一张旧照片。照片里也有这家店的窗和一只橘白猫。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '追到门口，把照片还给她',
        reply: '客人在雨棚下停住，说照片不是遗落，而是特意留给你确认的。',
        consequence: '你第一次知道，{pet}来到店里之前还有另一位照顾它的人。',
      },
      {
        id: 'choice-b',
        text: '收好照片，先陪布丁',
        reply: '你坐到猫窝边。{pet}把额头贴在你手背上，直到雨完全停下。',
        consequence: '你把照片收进剧情本，也决定先尊重{pet}当下的安静。',
      },
    ],
    memoryAnchors: ['只点温水的最后一位客人', '留下旧照片的空杯'],
    clue: '照片背面写着布丁原来的名字，但那个名字被水浸得只剩一个字。',
  },
]

function fillPlaceholders(value, context) {
  return value
    .replaceAll('{pet}', context.petName)
    .replaceAll('{anchor}', context.anchor)
    .replaceAll('{previous}', context.previousTitle)
}

export function buildLocalStory(request = {}, degraded = false, at = Date.now()) {
  const petName =
    typeof request.petName === 'string' && request.petName.trim()
      ? request.petName.trim().slice(0, 16)
      : '布丁'
  const storyTurn = Math.max(0, Math.min(999, Math.trunc(Number(request.storyTurn) || 0)))
  const memories = Array.isArray(request.memories) ? request.memories : []
  const previous = memories[0]
  const previousAnchor =
    previous && Array.isArray(previous.memoryAnchors) && previous.memoryAnchors[0]
      ? String(previous.memoryAnchors[0]).slice(0, 64)
      : '打烊前二十分钟的点单卡'
  const previousTitle =
    previous && typeof previous.title === 'string' && previous.title.trim()
      ? previous.title.trim().slice(0, 36)
      : '上一页'
  const cycle = Math.floor(storyTurn / LOCAL_STORY_BANK.length)
  const template = LOCAL_STORY_BANK[storyTurn % LOCAL_STORY_BANK.length]
  const context = { petName, anchor: previousAnchor, previousTitle }
  const fill = (value) => fillPlaceholders(value, context)
  const title = cycle === 0 ? template.title : `${template.title} · 潮汐${cycle + 1}`

  return {
    id: `local_${storyTurn}_${at.toString(36)}`,
    source: 'local',
    degraded,
    title: title.slice(0, 36),
    subtitle: fill(template.subtitle),
    scene: fill(template.scene),
    beats: template.beats.map((beat) => {
      const next = {
        type: beat.type,
        text: fill(beat.text),
      }
      if (beat.type === 'dialogue') next.speaker = fill(beat.speaker)
      return next
    }),
    choices: template.choices.map((choice) => ({
      id: choice.id,
      text: fill(choice.text),
      reply: fill(choice.reply),
      consequence: fill(choice.consequence),
    })),
    memoryAnchors: template.memoryAnchors.map(fill),
    clue: fill(template.clue),
  }
}

export { LOCAL_STORY_BANK }
