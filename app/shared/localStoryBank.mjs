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

const ROMANCE_STORY_BANK = [
  {
    title: '留下的一盏灯',
    subtitle: '打烊后还没关的那盏',
    scene: '打烊后 · 吧台',
    beats: [
      {
        type: 'narration',
        text: '你已经擦完最后一只杯子，{character}还在吧台边把椅子一张张摆正。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '灯先别关吧。我想把今天新学的拉花再试一次。',
      },
      {
        type: 'narration',
        text: '{pet}趴在窗台上，尾巴轻轻垂下来。{character}把第一杯推到你面前，杯沿的热气很慢。',
      },
      {
        type: 'narration',
        text: '他没有催你评价，只把手收进围裙口袋，等你先开口。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '认真尝一口，再告诉他哪里不同',
        reply: '你说完后，{character}低头笑了一下，像是终于把绷着的那口气松开。',
        consequence: '{character}知道，你会认真接住他用心做的小事。',
      },
      {
        id: 'choice-b',
        text: '先递给他一杯温水，让他也坐下',
        reply: '{character}接过杯子，在离你最近的位置坐下。今晚第一次，他没有忙着收拾。',
        consequence: '打烊后的吧台，多了一段只留给你们的安静。',
      },
    ],
    memoryAnchors: ['打烊后留下的一盏灯', '{character}试做的拉花'],
    clue: '{character}把第二只杯子悄悄留在了你手边。',
  },
  {
    title: '雨声借伞',
    subtitle: '伞沿偏向谁的一边',
    scene: '傍晚骤雨 · 门廊',
    beats: [
      {
        type: 'narration',
        text: '雨突然落下时，{character}正站在门廊收招牌，半边肩膀很快被淋湿。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '我回去拿伞就行。你先别出来，台阶滑。',
      },
      {
        type: 'narration',
        text: '《{previous}》里的那点安静还没散。{pet}从门边探出头，{character}下意识往后退了半步。',
      },
      {
        type: 'narration',
        text: '店里只剩一把够大的伞。雨点敲在伞面上，谁都没有先动。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把伞往他那边递，说一起走',
        reply: '{character}接过伞柄时，手指碰到你的手背。他一路都把伞偏向你。',
        consequence: '雨停以后，{character}还记得你肩上几乎没有淋到雨。',
      },
      {
        id: 'choice-b',
        text: '让他带走伞，自己在店里等雨停',
        reply: '{character}走到巷口又回头，隔着雨朝你抬了抬伞，像在说很快回来。',
        consequence: '你们第一次开始认真计算，对方什么时候会回到店里。',
      },
    ],
    memoryAnchors: ['门廊里的一把大伞', '{character}被雨打湿的肩'],
    clue: '{character}回头时，似乎有话被雨声压住了。',
  },
  {
    title: '窗边的早餐',
    subtitle: '多出来的一份煎蛋',
    scene: '清晨 · 靠窗座位',
    beats: [
      {
        type: 'narration',
        text: '开门时，窗边已经摆好两份早餐。{character}坐在外侧，替你把椅子拉开了一点。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '我猜你还没吃。煎蛋是安静煎的，没有吵到{pet}。',
      },
      {
        type: 'narration',
        text: '你坐下才发现，他那份面包边已经切掉了，恰好是你昨天随口提过的习惯。',
      },
      {
        type: 'narration',
        text: '{pet}在桌脚边绕了一圈。{character}低头看它，又很轻地看了你一眼。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把自己那份煎蛋分一半给他',
        reply: '{character}愣了一下，还是把盘子往前推了推。你们谁都没说够了没有。',
        consequence: '一顿普通的早餐，被你们吃成了彼此照顾的习惯。',
      },
      {
        id: 'choice-b',
        text: '问他怎么记得这些小事',
        reply: '他捏着叉子想了很久，只说：你说的时候，我在听。',
        consequence: '你第一次清楚地听见了，{character}认真在意你的方式。',
      },
    ],
    memoryAnchors: ['窗边的两份早餐', '切掉面包边的习惯'],
    clue: '{character}把自己的盘子推近时，耳尖有一点红。',
  },
  {
    title: '擦肩的咖啡香',
    subtitle: '围裙带子没有系好',
    scene: '午后 · 吧台内侧',
    beats: [
      {
        type: 'narration',
        text: '午后的店里挤满熟客，你转身取杯子时，和{character}在吧台后几乎擦肩。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '别动，我身后围裙带子好像散了。',
      },
      {
        type: 'narration',
        text: '他背过身去，把带子递到你手里。外头有人催单，谁都没有催你们。',
      },
      {
        type: 'narration',
        text: '《{previous}》之后，你第一次离{character}这么近，连他围裙上淡淡的咖啡香都很清楚。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '低头把带子仔细系好',
        reply: '你系完最后一个结，{character}轻声说了谢谢，转身时还特意把那杯咖啡放稳。',
        consequence: '{character}开始习惯在忙碌里先找到你的位置。',
      },
      {
        id: 'choice-b',
        text: '故意系松一点，让他再提醒一次',
        reply: '{character}回头看你，像是明白了什么，最后还是笑着把带子重新递给你。',
        consequence: '忙碌的吧台后，多了一个只有你们知道的玩笑。',
      },
    ],
    memoryAnchors: ['吧台后散开的围裙带', '淡淡的咖啡香'],
    clue: '{character}转身以后，没有马上走回外场。',
  },
  {
    title: '一起洗杯子',
    subtitle: '泡沫落在同一只手上',
    scene: '晚饭后 · 水池边',
    beats: [
      {
        type: 'narration',
        text: '晚饭后的杯子比平时多。{character}卷起袖子站到水池另一边，和你分了一摞。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '你洗，我冲。这样比我一个人快。',
      },
      {
        type: 'narration',
        text: '你们的手偶尔在泡沫里碰到。{pet}蹲在脚边，盯着水面来回晃的灯影。',
      },
      {
        type: 'narration',
        text: '{character}接过最后一只盘子时，没有立刻松手，像是在等你把水关小。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '让水池安静下来，先听他说完',
        reply: '{character}说今天其实不累，只是很喜欢关店前这一段。他的声音比水流还轻。',
        consequence: '你们有了一个不需要安排就会自然发生的并肩时刻。',
      },
      {
        id: 'choice-b',
        text: '把最后一只杯子留给他擦干',
        reply: '他把杯子擦得很亮，放回你每天最先拿到的那一层。',
        consequence: '{character}开始把自己的习惯放进店里的日常。',
      },
    ],
    memoryAnchors: ['水池边并排的两摞杯子', '落在手背上的泡沫'],
    clue: '{character}说喜欢关店前这一段时，没有把“们”字说出口。',
  },
  {
    title: '他的旧围裙',
    subtitle: '口袋里有张折好的纸',
    scene: '午后 · 储物间',
    beats: [
      {
        type: 'narration',
        text: '{character}换下旧围裙时，口袋里掉出一张折了很多次的纸。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '不是店里的单子。我本来想等做好了再给你看。',
      },
      {
        type: 'narration',
        text: '纸上画着店里的窗边，桌椅比例有些歪，旁边认真写着“想让店长休息的位置”。',
      },
      {
        type: 'narration',
        text: '{pet}跳上纸角，{character}赶紧把它抱开，耳朵却先红了。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把纸铺平，和他一起改设计',
        reply: '你们肩挨着肩在纸上画线，{character}第一次没有反驳你靠得太近。',
        consequence: '一张没做完的草图，变成了你们共同期待的小角落。',
      },
      {
        id: 'choice-b',
        text: '把纸还给他，说等你做好再看',
        reply: '{character}小心地把纸折回原位，收进围裙最里面。',
        consequence: '你给了他准备的时间，也接住了这份还没说出口的心意。',
      },
    ],
    memoryAnchors: ['旧围裙里的折纸', '为店长留的休息位置'],
    clue: '纸背还写着一行被折痕挡住的小字。',
  },
  {
    title: '你喜欢的口味',
    subtitle: '新菜单只写了一半',
    scene: '午后 · 小黑板前',
    beats: [
      {
        type: 'narration',
        text: '小黑板上多了一款还没定价的饮品，名字是{character}的字迹。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '我按你上次说喜欢的味道试了试。还没定名字。',
      },
      {
        type: 'narration',
        text: '《{previous}》里那张草图的事还没淡，{pet}已经先蹲到杯边闻了起来。',
      },
      {
        type: 'narration',
        text: '{character}把粉笔递给你，黑板空着一小行，像特意留下的。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '写下你们刚才一起想到的名字',
        reply: '你落笔时，{character}站在身后没有退开。写完才发现，他笑得比平时明显。',
        consequence: '新菜单上有了第一个同时属于你们两个人的名字。',
      },
      {
        id: 'choice-b',
        text: '先尝味道，让他自己决定名字',
        reply: '{character}认真看你喝完后，才重新拿起粉笔。他写下的名字恰好也让你想起今天。',
        consequence: '你让他保留了表达自己的空间，他也把心意放进了店里。',
      },
    ],
    memoryAnchors: ['没有定价的新饮品', '{character}递来的粉笔'],
    clue: '{character}说名字时，先看了你一眼才落笔。',
  },
  {
    title: '檐下的沉默',
    subtitle: '两个人听同一阵雨',
    scene: '黄昏 · 后门屋檐',
    beats: [
      {
        type: 'narration',
        text: '后门屋檐很窄，你和{character}并排站着，肩膀之间只隔着一小段风。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '以前下雨，我总想着快点走。今天倒没那么急。',
      },
      {
        type: 'narration',
        text: '他说完便不再开口。{pet}在门内坐下，安安静静地看着你们两个。',
      },
      {
        type: 'narration',
        text: '雨没有马上停，{character}也没有挪开那半步。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '告诉他，你也不急着回去',
        reply: '{character}侧过脸，眼里有一点很轻的笑。雨声把后面的话盖得很温柔。',
        consequence: '你们第一次把沉默当成可以一起停留的地方。',
      },
      {
        id: 'choice-b',
        text: '安静地把伞往他那边挪一点',
        reply: '他没有说谢谢，只在伞沿下又靠近了一点。',
        consequence: '{character}记住了你不说出口的照顾。',
      },
    ],
    memoryAnchors: ['后门屋檐下的窄伞', '没有被雨声打断的沉默'],
    clue: '{character}说到“今天”时，声音停顿得很短。',
  },
  {
    title: '半块可颂',
    subtitle: '最后一口留给谁',
    scene: '下午茶 · 吧台',
    beats: [
      {
        type: 'narration',
        text: '最后一块可颂只剩半块。你还没开口，{character}已经把它推到了盘子中间。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '一人一半。今天你比我先忙完早班。',
      },
      {
        type: 'narration',
        text: '你掰开可颂时，酥皮落了一桌。{character}伸手替你挡开，指尖停在你袖口旁。',
      },
      {
        type: 'narration',
        text: '{pet}凑过来闻了闻，发现没有自己的份，又慢吞吞地趴回窗台。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把自己那一半分一点给猫',
        reply: '{character}看着你认真分小块的侧脸，忽然说，你总是先想到别人。',
        consequence: '{character}开始直接说出他注意到的你。',
      },
      {
        id: 'choice-b',
        text: '把最后一口留给他',
        reply: '{character}没有推辞，吃完后轻轻说了一句，下次换我留给你。',
        consequence: '“下次”成了你们之间自然说出口的约定。',
      },
    ],
    memoryAnchors: ['盘子中间的半块可颂', '落在袖口旁的指尖'],
    clue: '{character}说下次的时候，语气像已经想好了。',
  },
  {
    title: '门外的脚步声',
    subtitle: '他比平时早到了十分钟',
    scene: '清晨 · 门边',
    beats: [
      {
        type: 'narration',
        text: '离开门还有十分钟，门外已经响起{character}的脚步声。他走到门边又停下。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '来早了。你不用为了我提前开门。',
      },
      {
        type: 'narration',
        text: '你隔着玻璃看他，他把手从门上收回，低头整理已经很整齐的围巾。',
      },
      {
        type: 'narration',
        text: '{pet}在门内挠了一下门板。{character}听见声音，抬头时没有来得及收起笑意。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '提前开门，让他进来等',
        reply: '{character}进门时带进一点晨风。他把手里多买的一份早餐放到吧台上。',
        consequence: '开门前那十分钟，从此有了一个可以等的人。',
      },
      {
        id: 'choice-b',
        text: '隔着门陪他站一会儿',
        reply: '你们隔着一层玻璃说话。{character}抬手碰了碰门，像在接住你还不能打开的那扇门。',
        consequence: '{character}知道，你也想早点见到他。',
      },
    ],
    memoryAnchors: ['开门前十分钟的脚步声', '隔着玻璃的短暂笑意'],
    clue: '{character}手里那份早餐，恰好是两人份。',
  },
  {
    title: '洗干净的外套',
    subtitle: '衣领上多了一点阳光',
    scene: '上午 · 衣架旁',
    beats: [
      {
        type: 'narration',
        text: '{character}把外套落在这里。你洗完晾干后，衣领上留着一股很淡的阳光味。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '其实不用特意洗。不过……谢谢你。',
      },
      {
        type: 'narration',
        text: '他接过外套没有立刻穿上，先低头闻了闻，又像觉得这样做太明显，轻咳了一声。',
      },
      {
        type: 'narration',
        text: '《{previous}》里留下的那点近意还在，{pet}蹭过衣角，把几根白毛留在上面。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '帮他把猫毛拍干净',
        reply: '你抬手拍衣角，{character}站得很近，最后只说了一句，下次我也可以帮你。',
        consequence: '互相照顾从一件外套开始变得顺理成章。',
      },
      {
        id: 'choice-b',
        text: '说留着猫毛也很好',
        reply: '{character}低头看了看衣角，笑着说，那就留着吧。',
        consequence: '他开始把店里的痕迹当成自己生活的一部分。',
      },
    ],
    memoryAnchors: ['洗干净的外套', '落在衣角的猫毛'],
    clue: '{character}说“下次我也可以”时，没有把视线移开。',
  },
  {
    title: '同一首歌',
    subtitle: '谁都没有先去换',
    scene: '关店前 · 唱机旁',
    beats: [
      {
        type: 'narration',
        text: '店里的唱机跳到同一首歌。{character}停下擦桌子的手，没有去换。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '这首很适合现在。慢一点，关店也不会太晚。',
      },
      {
        type: 'narration',
        text: '{pet}伏在音箱边，尾巴跟着节拍轻轻动。{character}把最后一张桌子留给了明天。',
      },
      {
        type: 'narration',
        text: '歌快结束时，他看了你一眼，像在等你要不要再说点什么。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '跟着音乐轻轻哼给他听',
        reply: '你哼得很轻，{character}却听见了。他把擦桌布叠好，站在灯下听完整段。',
        consequence: '从这天起，这首歌有了只属于店里的记忆。',
      },
      {
        id: 'choice-b',
        text: '问他以前会想起谁',
        reply: '{character}想了很久，说以前只记得旋律，今天开始会记得店里的人。',
        consequence: '{character}第一次把“店里的人”说得这么具体。',
      },
    ],
    memoryAnchors: ['关店前循环的唱片', '被留到明天的最后一张桌子'],
    clue: '{character}说“店里的人”时，目光没有离开你。',
  },
  {
    title: '窗台晒太阳',
    subtitle: '三个人的午后',
    scene: '午后 · 窗台',
    beats: [
      {
        type: 'narration',
        text: '午后的阳光刚好落在窗台。{pet}占了最好的位置，{character}只好坐到它旁边。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '它今天不让位。我坐这里可以吗？',
      },
      {
        type: 'narration',
        text: '你点头后，他往旁边挪了挪，恰好给你留出半块靠垫。',
      },
      {
        type: 'narration',
        text: '三个人都没有说话。阳光慢慢移过桌面，{character}的袖口碰到你的手背。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '不挪开手，继续晒一会儿太阳',
        reply: '他也没有挪开。窗外的海风很轻，午后的时间像被谁故意放慢。',
        consequence: '你们第一次把靠近交给一段不需要解释的时间。',
      },
      {
        id: 'choice-b',
        text: '起身给大家倒杯冰水',
        reply: '你回来时，{character}已经替你把靠垫摆回原处，自己却还坐在旁边。',
        consequence: '{character}开始自然替你留意舒服的位置。',
      },
    ],
    memoryAnchors: ['窗台上晒太阳的猫', '半块靠垫'],
    clue: '{character}袖口停在那里，没有急着收回。',
  },
  {
    title: '打烊后的甜点',
    subtitle: '只剩一只叉子',
    scene: '深夜 · 吧台',
    beats: [
      {
        type: 'narration',
        text: '冰箱里只剩一小块蛋糕。{character}把它端出来，发现抽屉里也只剩一只叉子。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '我再去洗一只就好。',
      },
      {
        type: 'narration',
        text: '他说完却没有走。{pet}在吧台下抬起头，像也在等你的回答。',
      },
      {
        type: 'narration',
        text: '蛋糕上的奶油慢慢变软，灯下只有一只银叉安静地放着。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '说一只叉子也够，两个人分',
        reply: '{character}坐回来，每一口都刻意留得很大。你笑出声时，他也终于不再装镇定。',
        consequence: '一只叉子成了你们不必躲开的亲密。',
      },
      {
        id: 'choice-b',
        text: '把叉子推给他，自己用手掰',
        reply: '{character}把第一块奶油最多的地方递到你嘴边，动作小心得像在问。',
        consequence: '{character}开始愿意主动，也愿意等你回应。',
      },
    ],
    memoryAnchors: ['深夜的一小块蛋糕', '抽屉里只剩的一只叉子'],
    clue: '{character}把奶油最多的一块留下了。',
  },
  {
    title: '给你留的座位',
    subtitle: '靠窗那把椅子',
    scene: '忙碌午后 · 窗边',
    beats: [
      {
        type: 'narration',
        text: '店里坐满了人，只有靠窗那把椅子空着。{character}把一只写着“预留”的小牌放上去。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '你忙完总要坐一会儿。先别让给别人。',
      },
      {
        type: 'narration',
        text: '熟客笑着看了你们一眼。{character}没有解释，只把牌子摆得更正。',
      },
      {
        type: 'narration',
        text: '{pet}已经跳上椅子占了一半，像是在替你们守位。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '忙完后坐过去，让他也一起',
        reply: '{character}把猫往旁边挪了挪，自己却只坐了一小半。你们挤在同一扇窗下。',
        consequence: '靠窗那把椅子，从此默认留给你们两个人。',
      },
      {
        id: 'choice-b',
        text: '把牌子收起来，先照顾等位的客人',
        reply: '{character}没有拦你，等你忙完才发现那把椅子一直空着。',
        consequence: '{character}尊重你的忙碌，也把等你变成了自然的事。',
      },
    ],
    memoryAnchors: ['写着预留的椅子', '{character}挪开猫的动作'],
    clue: '{character}只坐了一小半，却始终没有起身。',
  },
  {
    title: '风衣上的海风',
    subtitle: '他替你挡了一下',
    scene: '傍晚 · 店门外',
    beats: [
      {
        type: 'narration',
        text: '傍晚起风，{character}正好来到门口。他先一步站到迎风那边，替你挡了一下。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '门我来关。你先进去，外面有点冷。',
      },
      {
        type: 'narration',
        text: '他的风衣被吹得贴在身侧。{pet}在门内叫了一声，他却仍等你先走。',
      },
      {
        type: 'narration',
        text: '《{previous}》之后，你已经能看懂他那些不说出口的照顾。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '拉住他的袖口，让他一起进来',
        reply: '{character}低头看了看被你拉住的地方，没有挣开，跟着你走进了暖和的灯下。',
        consequence: '{character}开始接受，你也可以主动照顾他。',
      },
      {
        id: 'choice-b',
        text: '先进门，再替他留一杯热的',
        reply: '他进门时，杯子已经放在最顺手的位置。{character}捧起来，肩膀慢慢放松。',
        consequence: '你们开始用各自熟悉的方式接住对方。',
      },
    ],
    memoryAnchors: ['门外迎风的位置', '被风吹起的风衣'],
    clue: '{character}低头看你拉住袖口时，没有马上抽回手。',
  },
  {
    title: '忘记的约定',
    subtitle: '他却一直记得',
    scene: '傍晚 · 储物间门口',
    beats: [
      {
        type: 'narration',
        text: '你忙到忘了下午要去买灯罩。{character}回来时，手里已经提着那只看中的纸袋。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '你昨天提过。我路过就顺便带回来了。',
      },
      {
        type: 'narration',
        text: '纸袋里还多了一只小小的灯泡。{character}说怕颜色不合适，可以换。',
      },
      {
        type: 'narration',
        text: '{pet}在纸袋边闻了闻。你忽然想起，自己确实只提过一次。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '请他一起装上，看看效果',
        reply: '你们一人扶着灯罩，一人拧灯泡。亮起来时，{character}先看的是你的表情。',
        consequence: '一盏新灯亮起时，你们也确认了彼此都记得对方的小事。',
      },
      {
        id: 'choice-b',
        text: '认真告诉他，被记住的感觉很好',
        reply: '{character}安静了一下，说那以后就多记一点。他说得很轻，却没有回避。',
        consequence: '{character}知道，他的用心会被你清楚接住。',
      },
    ],
    memoryAnchors: ['被带回来的灯罩', '纸袋里备用的小灯泡'],
    clue: '{character}说“以后”，像把这件事放进了很长的日子里。',
  },
  {
    title: '名字写在一起',
    subtitle: '新排班表的第一行',
    scene: '清晨 · 小黑板',
    beats: [
      {
        type: 'narration',
        text: '新一周的排班表写好了。{character}把你们的名字放在同一行，中间只隔一个小点。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '这样一眼就能知道，谁和谁一起开店。',
      },
      {
        type: 'narration',
        text: '你看了他一会儿，他假装在检查时间，粉笔却拿反了。',
      },
      {
        type: 'narration',
        text: '{pet}从黑板前经过，尾巴扫掉了一点粉笔灰。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把中间的小点改成一枚心形',
        reply: '你画完抬头，{character}没说幼稚，只把黑板往门口挪了挪，让进门的人都能看见。',
        consequence: '排班表成了你们第一件公开承认的亲密。',
      },
      {
        id: 'choice-b',
        text: '笑着把他的名字写得更靠你一点',
        reply: '{character}看着被挤近的名字，终于忍不住笑了，也没有把它擦回去。',
        consequence: '你们开始允许别人看见彼此之间那一点不同。',
      },
    ],
    memoryAnchors: ['同一行的排班名字', '被拿反的粉笔'],
    clue: '{character}把黑板挪向门口时，特意停了一下。',
  },
  {
    title: '迟到的晚安',
    subtitle: '门口那两秒',
    scene: '夜里 · 店门口',
    beats: [
      {
        type: 'narration',
        text: '关灯以后，你和{character}一起走到门口。今天的道别比平时晚了很久。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '那我走了。明天……还是这个时间见？',
      },
      {
        type: 'narration',
        text: '他问完没有立刻转身。街灯落在你们脚边，{pet}在门内安静地看着。',
      },
      {
        type: 'narration',
        text: '你发现，原来一句普通的明天见，也能让人停住两秒。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '说会等他，明天早点来',
        reply: '{character}点点头，走出几步又回头挥了挥手，像是确认你真的还在看。',
        consequence: '“明天见”从此不再只是客气的话。',
      },
      {
        id: 'choice-b',
        text: '先对他说晚安，再关上门',
        reply: '门合上后，你听见外面停了片刻才响起脚步声。',
        consequence: '你们都知道，那两秒的停顿不是偶然。',
      },
    ],
    memoryAnchors: ['夜里晚了两秒的道别', '街灯下的脚步声'],
    clue: '{character}问明天时，先握了一下自己的袖口。',
  },
  {
    title: '一起关窗',
    subtitle: '海风从两边吹进来',
    scene: '起风前 · 窗边',
    beats: [
      {
        type: 'narration',
        text: '海风变大前，你和{character}同时去关窗。两扇窗从两边合上，在中间碰了一下。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '左边我来。你别踩到{pet}的尾巴。',
      },
      {
        type: 'narration',
        text: '猫从你们脚边绕过去。{character}关好窗，却没有立刻把手从窗框上拿开。',
      },
      {
        type: 'narration',
        text: '玻璃映出你们两个并肩的影子，比平时更近一点。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '也把手留在窗框上，陪他站一会儿',
        reply: '窗外风声很响，窗内却安静得能听见彼此的呼吸。{character}先低头笑了。',
        consequence: '一次普通的关窗，被你们共同留成了慢镜头。',
      },
      {
        id: 'choice-b',
        text: '转身去给猫铺好毯子',
        reply: '你铺好毯子回头，{character}已经把两边的窗帘都理整齐了。',
        consequence: '照顾店和照顾彼此，开始变成同一件自然的事。',
      },
    ],
    memoryAnchors: ['从两边关上的窗', '玻璃里并肩的影子'],
    clue: '{character}离开窗框前，手指轻轻敲了一下。',
  },
  {
    title: '借你的围巾',
    subtitle: '还回来时还带着温度',
    scene: '清晨 · 门口',
    beats: [
      {
        type: 'narration',
        text: '早风太冷，{character}把围巾解下来，没等你拒绝就绕到你颈边。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '我走两步就到。你先戴着，晚上再还。',
      },
      {
        type: 'narration',
        text: '围巾上还留着他的温度。你抬头时，他已经转过身去开门，只露出一点发红的耳尖。',
      },
      {
        type: 'narration',
        text: '{pet}追着围巾末端扑了一下，又被你轻轻抱开。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '晚上认真洗干净再还给他',
        reply: '{character}接过围巾，说其实不必这么客气，但叠好时动作很慢。',
        consequence: '一条围巾在你们手里来回，像把关心延长了几天。',
      },
      {
        id: 'choice-b',
        text: '晚上直接围着还给他，说自己不怕冷',
        reply: '{character}看着你脖子上的围巾，半天才说，那明天也借你。',
        consequence: '借与还之间，多了一个双方都愿意继续的约定。',
      },
    ],
    memoryAnchors: ['带着温度的围巾', '{character}发红的耳尖'],
    clue: '{character}说“明天也借你”时，已经想好了下一次。',
  },
  {
    title: '停电的晚餐',
    subtitle: '蜡烛只找到一支',
    scene: '停电的夜 · 窗边桌',
    beats: [
      {
        type: 'narration',
        text: '街区忽然停电。你和{character}摸黑找到一支蜡烛，只够照亮一张小桌。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '今晚将就一下。我做的晚饭应该还能看清。',
      },
      {
        type: 'narration',
        text: '你们在烛光里吃简单的热汤。{pet}趴在不远处，眼睛映着一点暖光。',
      },
      {
        type: 'narration',
        text: '没有音乐，也没有其他客人。{character}把最后一块面包推到你手边。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '把面包分成两半，和他碰一下',
        reply: '{character}配合地碰了碰。烛光里，你们都笑得很轻。',
        consequence: '一次停电，反而让普通的晚餐有了纪念的意义。',
      },
      {
        id: 'choice-b',
        text: '在烛光里问他今天累不累',
        reply: '{character}说不累，又说有人一起吃晚饭，关店也没那么像收尾。',
        consequence: '{character}开始把与你相处说成一天里最期待的部分。',
      },
    ],
    memoryAnchors: ['停电夜里的一支蜡烛', '照着热汤的暖光'],
    clue: '{character}说完“没那么像收尾”后，把汤碗往你面前推了推。',
  },
  {
    title: '替你尝味道',
    subtitle: '勺子停在半空',
    scene: '午后 · 吧台',
    beats: [
      {
        type: 'narration',
        text: '新配方有点拿不准。{character}舀起一勺，递到你面前又忽然停住。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '你要不要先尝？我忘了问会不会太甜。',
      },
      {
        type: 'narration',
        text: '勺子停在半空。{pet}抬头看了看你们，像是嫌你们太慢。',
      },
      {
        type: 'narration',
        text: '《{previous}》里那只留下的杯子，还放在吧台内侧。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '就着他的手尝一口',
        reply: '{character}没有收回手，只在你尝完后问得很轻：会不会太甜？',
        consequence: '一个试味道的动作，被你们两个人都放慢了。',
      },
      {
        id: 'choice-b',
        text: '接过勺子，也让他尝一口',
        reply: '你把勺子递回去。{character}低头时，嘴角已经先弯了起来。',
        consequence: '互相试味道成了吧台后不必解释的默契。',
      },
    ],
    memoryAnchors: ['停在半空的一勺', '吧台内侧的第二只杯子'],
    clue: '{character}问“太甜”时，目光落在你嘴边。',
  },
  {
    title: '留到最后的话',
    subtitle: '关门前才说出口',
    scene: '打烊后 · 门口',
    beats: [
      {
        type: 'narration',
        text: '关门前，{character}已经穿好外套，却还站在灯下没有走。',
      },
      {
        type: 'dialogue',
        speaker: '{character}',
        text: '今天有句话想了很久，还是想当面说。',
      },
      {
        type: 'narration',
        text: '他没有催你回应，只把手里那串钥匙握紧了一些。{pet}在门边安静地坐好。',
      },
      {
        type: 'narration',
        text: '店里只剩最后一盏灯。你忽然发现，自己也在等他把这句话说完。',
      },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '告诉他，你愿意听',
        reply: '{character}看着你，慢慢说，明天开门的时候，他第一个想见到的人是你。',
        consequence: '今晚没有说完的话，变成了明天见面时最明确的期待。',
      },
      {
        id: 'choice-b',
        text: '让他留到明天，再带着早餐来',
        reply: '{character}怔了一下，随后笑着答应。他没有失望，反而像更确定明天一定会来。',
        consequence: '你们给这句未完成的话，留了一个温柔的下一章。',
      },
    ],
    memoryAnchors: ['关门前不肯走的人', '被握紧的钥匙串'],
    clue: '{character}要说的那句话，也许明天会有一个更清楚的答案。',
  },
]

function fillPlaceholders(value, context) {
  return value
    .replaceAll('{pet}', context.petName)
    .replaceAll('{character}', context.characterName)
    .replaceAll('{role}', context.role)
    .replaceAll('{anchor}', context.anchor)
    .replaceAll('{previous}', context.previousTitle)
}

function storySeedOffset(value) {
  const seed =
    typeof value === 'string'
      ? value
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 80)
      : ''
  if (!seed || seed === 'legacy') return 0
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
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
  const focusCharacter =
    request.focusCharacter &&
    typeof request.focusCharacter === 'object' &&
    !Array.isArray(request.focusCharacter)
      ? request.focusCharacter
      : null
  const characterName =
    focusCharacter &&
    typeof focusCharacter.name === 'string' &&
    focusCharacter.name.trim()
      ? focusCharacter.name.trim().slice(0, 24)
      : '林澈'
  const characterRole =
    focusCharacter &&
    typeof focusCharacter.role === 'string' &&
    focusCharacter.role.trim()
      ? focusCharacter.role.trim().slice(0, 32)
      : '咖啡师'
  const storyBank =
    request.mode === 'romance' ? ROMANCE_STORY_BANK : LOCAL_STORY_BANK
  const seedOffset = storySeedOffset(request.storySeed)
  const start = seedOffset % storyBank.length
  const cycle = Math.floor(storyTurn / storyBank.length)
  const template =
    storyBank[(start + storyTurn) % storyBank.length]
  const context = {
    petName,
    characterName,
    role: characterRole,
    anchor: previousAnchor,
    previousTitle,
  }
  const fill = (value) => fillPlaceholders(value, context)
  const title =
    cycle === 0
      ? template.title
      : request.mode === 'romance'
        ? `${template.title} · 日常${cycle + 1}`
        : `${template.title} · 潮汐${cycle + 1}`

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

export { LOCAL_STORY_BANK, ROMANCE_STORY_BANK }
