// English presentation for the original Chinese-authored game. IDs and saved
// state stay language-independent; only text and accessible UI labels change.
const phrases:Record<string,string>={
  '潮汐工坊':'Tidal Workshop','漂流码头':'Driftwood Dock','珊瑚航道':'Coral Passage','灯塔港':'Lighthouse Harbor',
  '海上工坊':'Floating workshop','港口资源':'Harbor resources','金币 / 当前潮汐预计销售速率':'Coins / estimated sales rate',
  '航图与远航':'Charts & voyages','设置与存档':'Settings & saves','潮汐状态':'Tide conditions','码头靠泊中':'Docking at the harbor',
  '查看当前目标':'View voyage goals','航程目标':'VOYAGE GOAL','进行中':'In progress','可领取':'Ready','港口经营面板':'Harbor management',
  '港口经营':'HARBOR LOG','海克斯与远航':'Voyages','航线与委托':'Fleet & contracts','长按持续打捞':'Hold to keep salvaging',
  '加工零件':'Craft parts','装船交货':'Ship cargo','打捞废料':'Salvage scrap','收起经营面板':'Close management','港口视图':'Harbor views','经营内容':'Management content',
  '进度已保存':'Progress saved','存档未能读取，已建立新码头':'Save could not be read. A new dock is ready.',
  '本地存档不可用，可在设置中导出进度':'Local saving is unavailable. Export your progress in Settings.',
  '远航就绪':'Voyage ready','灯塔修复就绪':'Lighthouse restoration ready','新航道就绪':'New passage ready',
  '航线与委托已开放':'Routes & contracts unlocked','首笔交货':'First shipment','潮能爆发':'Tidal surge',
  '工作台正在加工':'The workbench is busy','货船尚未返港':'The fleet is still at sea','船长就位':'Captain aboard','灯塔已点亮':'Lighthouse lit',
  '珊瑚航道已开通':'Coral Passage opened','委托完成':'Contract fulfilled','航图科技已点亮':'Chart research unlocked',
  '打捞产量':'Salvage output','加工速度':'Crafting speed','航行速度':'Sailing speed','生产线':'Production line','经营专精':'Specialization',
  '自动航运':'Automatic departures','未雇佣':'Not hired','雇佣船长':'Hire captain','购买最大数量':'Buy maximum','购买数量':'Purchase quantity',
  '货运策略':'Cargo routes','累计交货 32 金币后解锁':'Unlocks at 32 coins in sales','累计交货 32 金币后开放':'Unlocks at 32 coins in sales',
  '群岛探索':'Island expeditions','港口委托':'Harbor contracts','修复灯塔':'Restore lighthouse','扩建珊瑚航道':'Open Coral Passage',
  '开启远航':'Begin voyage','永久传承':'Permanent knowledge','海克斯共鸣':'Hex resonance','海克斯图鉴':'Hex collection',
  '首次远航后获得海克斯':'Earn your first hex after a voyage','航图科技':'Chart research','潮流学':'Current studies','熟练船长':'Veteran captain','长夜航灯':'Night beacon',
  '打捞 +20%':'Salvage +20%','开局自带船长':'Start voyages with a captain','离线 12 小时':'12 hours of offline production','自动加工':'Automatic crafting','点亮灯塔':'Light the lighthouse','远航准备':'Prepare to sail',
  '加工中':'Crafting','货船返港中':'Ships returning','全部海克斯':'All hexes','数量已达上限':'Machine limit reached','潮核完成':'Tidal core complete','已完成全部改造':'All upgrades complete',
  '96 销售额解锁':'Unlocks at 96 sales','航灯长明':'Beacon burning bright','海克斯三选一':'Choose one of three hexes','灯塔尚未修复':'Restore the lighthouse first','领取补给':'Claim supplies','已返港':'Returned',
  '远航保留':'Kept after voyages','目标补给与群岛探索提供手稿':'Earn manuscripts from goals and expeditions',
  '根据生产瓶颈切换，已出发的任务保持原参数':'Choose a focus for your bottleneck. Tasks already underway keep their original stats.',
  '航程与补给':'Voyage goals','奖励永久记录':'Rewards are claimed once','修复旧航标，带回失落的工匠知识':'Restore the old beacon and recover lost crafting knowledge.',
  '独立探险船 · 材料在出发时消耗 · 手稿与发现永久保留':'One dedicated explorer. Supplies are spent at departure. Knowledge and discoveries are permanent.',
  '海克斯航藏':'Voyage hexes','永久强化':'Permanent upgrade','累计航图':'Lifetime charts','重抽海克斯':'Reroll hexes','已重抽':'Reroll used','海克斯航藏尚未开启':'Complete a voyage to unlock your hex collection.',
  '海港声音':'Harbor audio','开启声音':'Unmute','海浪环境音':'Ocean ambience','音效音量':'Effects volume','减少动态效果':'Reduce motion','本地存档':'Local save','航海图鉴':'Harbor journal','重置进度':'Reset progress',
  '未探索海域':'Uncharted waters','近岸浮台与第一艘货船':'A floating dock and your first cargo boat.',
  '珊瑚航道的导航浮标':'Navigation buoys guide ships through the coral.',
  '长明航灯与远航起点':'A beacon for the next voyage.','航道尚未连通':'This passage has yet to be opened.',
  '驶向下一片海域':'Sail for new horizons','全部海克斯已收集':'All hexes collected',
  '海克斯、航图、手稿、传承与图鉴永久保留':'Keep hexes, charts, manuscripts, knowledge and discoveries.',
  '留在港口':'Stay in port','确认远航':'Confirm voyage','欢迎返港':'Welcome back','继续经营':'Return to the harbor',
  '导入存档':'Import save','导入会替换当前码头进度。':'Importing replaces your current harbor progress.',
  '存档 JSON':'Save JSON','检查并导入存档':'Review save','检查存档':'Review save','替换当前码头？':'Replace this harbor?',
  '当前进度将被替换。建议先导出备份。':'Your current progress will be replaced. Export a backup first.',
  '确认导入':'Confirm import','存档格式无效':'Invalid save format','补给已到账':'Supplies received','存档已导出':'Save exported','存档导入成功':'Save imported',
  '重置这座码头？':'Reset this harbor?','资源、机器、海克斯、航图与科技都将清空。':'All resources, machines, hexes, charts and research will be cleared.',
  '此操作不能撤销。':'This cannot be undone.','保留进度':'Keep progress','确认重置':'Confirm reset','共鸣激活':'Resonance unlocked','已激活':'Activated','存档文件过大':'Save file is too large',
  '深海打捞':'Deep salvage','精密工坊':'Precision workshop','远洋商会':'Ocean traders','潮汐先锋':'Tidal pioneers','白银':'Silver','黄金':'Gold','棱彩':'Prismatic',
  '深潜吊钩':'Deepwater hooks','磁力回收':'Magnetic recovery','潮汐阵列':'Tidal array','海底宝库':'Sunken treasure','拆船专家':'Shipbreaker','富矿航道':'Richwater route',
  '无损锻造':'Lean forging','双联模具':'Twin molds','飞轮增压':'Flywheel boost','模块工厂':'Modular factory','精工认证':'Quality seal','红炉流水线':'Hot forge',
  '顺风帆':'Trade winds','扩容船舱':'Expanded hold','商会金印':'Merchant seal','启航船队':'Starter convoy','港口特许':'Port charter','珍品专线':'Luxury line',
  '双钩吊架':'Double hook','巧手匠人':'Master crafter','潮能超载':'Tidal overdrive','群岛悬赏':'Island bounty','漂流基金':'Driftwood fund','工坊之心':'Harbor heart',
  '寻宝委托':'Treasure contract','规模制造':'Mass production','群岛联运':'Island network','极速绞盘':'Rapid winch',
  '自动打捞产量 +35%。':'Automatic salvage output +35%.','每次加工返还 1 废料。':'Recover 1 scrap per batch.',
  '自动打捞产量 +100%。':'Automatic salvage output +100%.','打捞产量 +25%；本次赠送 3 台打捞机。':'Salvage output +25%. Gain 3 salvagers now.',
  '设备购入费用 -15%。':'Machine costs -15%.','打捞产量 +60%，船速 -10%。':'Salvage output +60%. Sailing speed -10%.',
  '加工配方从 4 废料减至 3 废料。':'Recipes use 3 scrap instead of 4.','每批加工额外产出 1 零件，加工速度 -15%。':'Produce 1 extra part per batch. Crafting speed -15%.',
  '自动加工速度 +35%。':'Automatic crafting speed +35%.','加工速度 +20%；本次赠送 2 台加工机。':'Crafting speed +20%. Gain 2 presses now.',
  '交货售价 +25%。':'Sale prices +25%.','加工速度 +80%，每批多消耗 1 废料。':'Crafting speed +80%. Each batch uses 1 extra scrap.',
  '全部货船航速 +35%。':'Sailing speed +35%.','每航次多装 2 零件，按货量结算；航速 -10%。':'Carry 2 extra parts per trip, paid per cargo. Sailing speed -10%.',
  '所有交货售价 +80%。':'All sale prices +80%.','航速 +15%；本次赠送 2 艘船并雇佣船长。':'Sailing speed +15%. Gain 2 ships and a captain now.',
  '委托奖励 +40%。':'Contract rewards +40%.','交货售价 +55%，航速 -15%。':'Sale prices +55%. Sailing speed -15%.',
  '每次手动打捞额外获得 2 废料。':'Manual salvage yields 2 extra scrap.',
  '手动加工速度 +100%，打捞额外获得 1 废料。':'Manual crafting speed +100%. Manual salvage yields 1 extra scrap.',
  '潮能爆发期间，生产与船速额外 +100%。':'During tidal surge, production and sailing speed gain an extra +100%.',
  '委托奖励 +70%。':'Contract rewards +70%.','设备费用 -10%；本次获得 240 金币。':'Machine costs -10%. Gain 240 coins now.',
  '打捞、加工、船速各 +15%。':'Salvage, crafting and sailing speed +15%.','打捞 +20%，委托奖励 +20%。':'Salvage +20%. Contract rewards +20%.',
  '加工速度 +20%，设备费用 -10%。':'Crafting speed +20%. Machine costs -10%.','航速 +25%，委托奖励 +25%。':'Sailing speed +25%. Contract rewards +25%.',
  '手动打捞额外 +1，手动加工速度 +50%。':'Manual salvage +1. Manual crafting speed +50%.',
  '2 枚：打捞 +20%':'2 hexes: salvage +20%','4 枚：加工再返还 1 废料':'4 hexes: recover 1 extra scrap per batch',
  '2 枚：加工速度 +20%':'2 hexes: crafting speed +20%','4 枚：每批额外 +1 零件':'4 hexes: +1 part per batch',
  '2 枚：航速 +20%':'2 hexes: sailing speed +20%','4 枚：交货售价 +35%':'4 hexes: sale prices +35%',
  '2 枚：打捞额外 +1':'2 hexes: manual salvage +1','4 枚：委托奖励 +50%':'4 hexes: contract rewards +50%',
  '标准生产，无取舍':'Standard production with no tradeoff.','打捞 ×1.6 · 加工速度 ×0.85':'Salvage ×1.6 · Crafting speed ×0.85',
  '加工速度 ×1.6 · 打捞 ×0.85':'Crafting speed ×1.6 · Salvage ×0.85','售价 ×1.4、船速 ×1.2 · 打捞 ×0.85':'Sale price ×1.4 · Sailing speed ×1.2 · Salvage ×0.85',
  '手动打捞 +3 · 手动加工速度 ×1.8':'Manual salvage +3 · Manual crafting speed ×1.8',
  '均衡':'Balanced','深潜':'Deep dive','制造':'Industry','贸易':'Trade','先锋':'Pioneer','增压':'Boost','联动':'Linkage','潮核':'Tidal core',
  '机巧传承':'Engineering','群岛商盟':'Island alliance','拓荒补给':'Pioneer supplies',
  '每级打捞、加工与船速 ×1.12':'Each level: salvage, crafting and sailing speed ×1.12.',
  '每级交货与委托奖励 ×1.15':'Each level: sales and contract rewards ×1.15.',
  '每级手动打捞 +1；远航开局 +60 金币、16 废料':'Each level: manual salvage +1. Start voyages with 60 extra coins and 16 scrap.',
  '漂木湾':'Driftwood Bay','齿轮礁':'Gear Reef','风帆群岛':'Sailwind Isles','长明遗址':'Beacon Ruins',
  '旧航标重新立起，漂木湾送来了第一份工匠手稿。':'The old beacon stands again. Driftwood Bay sends its first crafting manuscripts.',
  '珊瑚里保存着旧工坊的模具，机械师愿意与你交换技术。':'Old molds survive among the coral. The mechanics are ready to share their knowledge.',
  '沿着风向接通商路，群岛船队开始共享航海手稿。':'Trade routes follow the wind. Island crews begin sharing their sailing manuscripts.',
  '失落的灯室再次亮起，潮核技术终于回到工坊。':'The lost lantern burns again. Tidal core technology returns to the workshop.',
  '从海面开始':'First salvage','收集 4 废料':'Collect 4 scrap','第一份收入':'First earnings','完成首次交货':'Complete your first shipment',
  '吊臂自转':'A working crane','拥有 1 台打捞机':'Own 1 salvager','工坊开工':'Press into service','拥有 1 台加工机':'Own 1 press',
  '解放双手':'All hands free','小小船队':'Small fleet','拥有 4 艘货船':'Own 4 ships','第一次飞跃':'First upgrade','完成任意设备改造':'Upgrade any machine',
  '海的另一边':'Across the sea','发现 1 座岛屿':'Discover 1 island','可靠的工匠':'Trusted crafter','本轮完成 3 份委托':'Complete 3 contracts this voyage',
  '珊瑚间的航道':'Through the coral','开通珊瑚航道':'Open Coral Passage','港口轰鸣':'Harbor humming','拥有 12 台加工机':'Own 12 presses',
  '长明的约定':'A lasting light','点亮灯塔港':'Light Lighthouse Harbor','带着经验归来':'Wiser upon return','完成首次远航':'Complete your first voyage',
  '群岛重连':'Islands reunited','发现全部 4 座岛屿':'Discover all 4 islands','不止一片海':'Beyond one sea','完成 3 次远航':'Complete 3 voyages',
  '标准装载，稳定交货':'Standard cargo. Steady deliveries.','5 秒往返，售价 -15%':'5-second trips. Sale price -15%.',
  '多装 2 零件，10 秒往返':'Carry 2 extra parts. 10-second trips.','12 秒往返，售价 +70%':'12-second trips. Sale price +70%.',
  '近海':'Coastal','快航':'Express','重载':'Bulk','珍品':'Premium','打捞补给':'Salvage supplies','机械订单':'Machine order','群岛急件':'Island express',
  '工坊平稳运转':'The harbor is running steadily.','打捞产量 +25%':'Salvage output +25%','货船航速 +25%':'Sailing speed +25%',
  '平潮':'Calm tide','涨潮':'Rising tide','退潮':'Falling tide','存档版本不兼容':'Incompatible save version',
  '存档数值无效':'Invalid save values','存档数量无效':'Invalid save quantities','存档资源无效':'Invalid saved resources','存档生产状态无效':'Invalid production state',
  '存档加工状态无效':'Invalid crafting state','存档航行状态无效':'Invalid sailing state','存档科技无效':'Invalid research state','存档图鉴无效':'Invalid discovery state',
  '存档设置无效':'Invalid settings','存档海克斯状态无效':'Invalid hex state','存档海克斯进度无效':'Invalid hex progress',
  '存档经营状态无效':'Invalid management state','存档委托无效':'Invalid contracts','存档改造或专精无效':'Invalid upgrades or specialization',
  '存档航程奖励无效':'Invalid voyage rewards','存档传承或群岛无效':'Invalid knowledge or islands','存档探索任务无效':'Invalid expedition',
  '素材未能加载':'Asset could not load',
  // Short fragments are for numbers and values interpolated into UI templates.
  '打捞机':'Salvager','加工机':'Press','货船':'Ship','废料':'scrap','零件':'parts','金币':'coins','航图':'charts','手稿':'manuscripts',
  '专精':' focus','船长':'Captain','工坊':'Workshop','航线':'Routes','远航':'Voyage','探索中':'Exploring','再访':'Revisit','探索':'Explore',
  '航速':'sailing speed','供料':'Supply','加工':'Craft','运输':'Shipping','打捞':'Salvage','交货':'Ship','瓶颈':' bottleneck',
  '购买':'Buy ','改造':'Upgrade ','交付':'Deliver ','研究':'Research ','选择':'Choose ','领取':'Claim ',
  '关闭':'Close','收起':'Close','取消':'Cancel','静音':'Mute','海浪':'Ocean','音效':'Effects','导出':'Export','导入':'Import','粘贴':'Paste','重抽':'Reroll',
  '设置':'Settings','航行中':'at sea','航次':'trip','销售额':'sales',
  '返港':' returned','出发':'Departed','离线':'offline','发现':'discovered','内容':' content','潮能':'Tidal surge',
  '：':': ','；':'; ','，':', ','。':'. ',
};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=new RegExp(Object.keys(phrases).sort((a,b)=>b.length-a.length).map(escape).join('|'),'g');
const hasHan=/[\u3400-\u9fff]/;
export function en(value:string):string{
  if(!hasHan.test(value))return value;
  const text=value
    .replace(/还缺 ([\d.,KMB]+) (废料|零件|金币)/g,'Need $1 more $2')
    .replace(/购入 (\d+)/g,'Buy $1')
    .replace(/(\d+) 台解锁改造/g,'Upgrade at $1 machines')
    .replace(/需要 (\d+) 台/g,'Requires $1 machines')
    .replace(/([\d.,KMB]+) 金币，使(.+)翻倍/g,'$1 coins · Doubles $2')
    .replace(/(\d+)级/g,'Lv. $1')
    .replace(/从 (\d+) 种未发现海克斯中抽选/g,'Choose from $1 undiscovered hexes')
    .replace(/重建港口，获得打捞机与 ([\d.,KMB]+) 金币；在途探索取消/g,'Rebuild with a salvager and $1 coins. Active expeditions are canceled.')
    .replace(/已按 (\d+) 小时上限结算/g,'Settled up to the $1-hour offline limit');
  return text.replace(pattern,match=>phrases[match]);
}
export function translateUI(root:HTMLElement){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(node.nodeValue&&hasHan.test(node.nodeValue))node.nodeValue=en(node.nodeValue);
  }
  for(const element of [root,...root.querySelectorAll<HTMLElement>('*')]){
    for(const attribute of ['aria-label','title','data-tip','placeholder']){
      const value=element.getAttribute(attribute);
      if(value&&hasHan.test(value))element.setAttribute(attribute,en(value));
    }
  }
}
