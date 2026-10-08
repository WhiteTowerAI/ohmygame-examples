import './style.css';
import { en, translateUI } from './locale';
import './hud.css';
import { createElement, Anchor, Settings as SettingsIcon, Volume2, VolumeX, Plus, Ship as ShipIcon, Compass, Map as MapIcon, Factory, Hammer, ChevronRight, Waves, Wind, Clock, Check, Lock, BookOpen, Download, Upload, RotateCcw, Clipboard, X, Navigation, Sparkles, Zap, PackageCheck, ArrowRight, ChevronDown } from 'lucide';
import { claimMilestone, explore, explorationQuote, learnLegacy, refit, refitQuote, setFocus, advance, bottleneck, buy, cargoSize, chartMultiplier, chooseHex, collect, CONTRACT_NAMES, contractReward, count, craft, deliverContract, dispatch, effects, ensureContracts, expand, freshState, hireCaptain, manualDuration, offlineCap, parseState, pressDuration, quote, REGIONS, research, rerollHexes, ROUTES, salvageRate, setRoute, settleOffline, steadyRates, TECH_COST, tide, tripDuration, tripPrice, voyage, voyageReward } from './economy';
import type { State, Machine, Tech, Batch, Production, Route } from './economy';
import { FOCUSES, focusUnlocked, ISLANDS, LEGACIES, legacyCost, MILESTONES, milestoneReady, nextMilestone, REFIT_NAMES } from './progression';
import type { Focus, Legacy } from './progression';
import { FAMILY, familyCounts, HEXES, hexById, RARITY, RESONANCE } from './hexes';
import type { Family } from './hexes';
import { ART, createHarbor } from './harbor';
import type { Celebration } from './harbor';
import type { Gain, Resource } from './feedback';
import { HarborAudio } from './audio';

const ICONS={anchor:Anchor,settings:SettingsIcon,sound:Volume2,mute:VolumeX,plus:Plus,ship:ShipIcon,compass:Compass,map:MapIcon,factory:Factory,hammer:Hammer,next:ChevronRight,waves:Waves,wind:Wind,clock:Clock,check:Check,lock:Lock,book:BookOpen,download:Download,upload:Upload,reset:RotateCcw,clipboard:Clipboard,close:X,navigation:Navigation,sparkle:Sparkles,zap:Zap,contract:PackageCheck,arrow:ArrowRight,down:ChevronDown};
const icon=(name:keyof typeof ICONS,size=20)=>{
  const [tag,attrs,children]=ICONS[name];
  return createElement([tag,{...attrs,width:String(size),height:String(size),'stroke-width':'1.7','aria-hidden':'true'},children]).outerHTML;
};
const art=(name:string,cls='')=>`<img class="${cls}" src="${ART}${name}.webp" alt="" draggable="false">`;
const fmt=(n:number,digits=0)=>n>=1e9?`${(n/1e9).toFixed(1)}B`:n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=10000?`${(n/1000).toFixed(1)}K`:n.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const duration=(seconds:number)=>seconds>=3600?`${(seconds/3600).toFixed(1)}h`:seconds>=60?`${Math.floor(seconds/60)}m`:`${Math.ceil(seconds)}s`;
const progress=(current:number,total:number)=>Math.min(100,Math.max(0,current/total*100));
const KEY='tidal-workshop-save-v1';
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
let state=freshState(),startup:ReturnType<typeof settleOffline>|null=null,warning='';
try{
  const saved=localStorage.getItem(KEY);
  if(saved){state=parseState(saved);startup=settleOffline(state,Date.now());}
  else state.settings.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
}catch{warning='存档未能读取，已建立新码头';}
let storageWarning=false,tab:'workshop'|'routes'|'voyage'='workshop',batch:Batch=1;
let panelOpen=false,modal='',panelSignature='',ready=false,holding=false,lastHeld=0;
let toastTimer=0,lastFrame=performance.now(),lastRender=0,lastSave=Date.now();
let candidate:State|null=null,modalReturnFocus:HTMLElement|null=null;
let celebrationTimer=0,seenSales=state.runSales;
const hudPulses=new Map<Resource,Animation>();

$('#app').innerHTML=`
  <main class="playfield" aria-label="海上工坊">
    <div id="scene"></div>
    <header class="hud-top">
      <div class="resources" aria-label="港口资源">
        <div class="resource" title="废料" aria-label="废料">${art('icon-scrap')}<div class="resource-copy"><span class="resource-label">废料</span><strong id="scrap">0</strong></div></div>
        <div class="resource" title="零件" aria-label="零件">${art('icon-parts')}<div class="resource-copy"><span class="resource-label">零件</span><strong id="parts">0</strong></div></div>
        <div class="resource coin-resource" title="金币 / 当前潮汐预计销售速率" aria-label="金币">${art('icon-coins')}<div class="resource-copy"><span class="resource-label">金币</span><strong id="coins">0</strong><small id="income">+0.0/s</small></div></div>
        <button class="resource charts-resource" data-action="panel" data-tab="voyage" aria-label="航图与远航" aria-controls="management" aria-expanded="false" data-tip="航图与远航">${art('icon-charts')}<div class="resource-copy"><span class="resource-label">航图</span><strong id="charts">0</strong></div></button>
      </div>
      <button class="hud-button settings-button" data-action="settings" aria-label="设置" data-tip="设置与存档">${icon('settings')}</button>
    </header>
    <button class="tide-indicator" data-action="tide" id="tide-button" aria-label="潮汐状态" data-tip="潮汐状态"><span id="tide-symbol">${icon('waves',18)}</span><span id="tide-name">平潮</span><small id="tide-time">60s</small></button>
    <div class="hex-strip" id="hex-strip"></div>
    <div id="loading"><span class="loading-mark">${icon('anchor',34)}</span><span>码头靠泊中</span><div class="track"><i></i></div></div>
    <div id="toast" role="status" aria-live="polite"></div>
    <div id="celebration" class="reward-banner" role="status" aria-live="polite" hidden><span id="reward-icon"></span><strong id="reward-title"></strong></div>
    <button class="goal-hud" data-action="goal" aria-label="查看当前目标"><span class="goal-emblem" id="goal-symbol">${icon('compass',22)}</span><div class="goal-copy"><div class="goal-heading"><span class="goal-kicker">航程目标</span><span class="goal-status" id="goal-status">进行中</span></div><strong id="goal-title">从海面开始</strong><small id="goal-value">收集 4 废料</small><div class="track"><i id="goal-progress"></i></div></div>${icon('next',16)}</button>
    <nav class="nav-dock" aria-label="港口经营">
      <button class="hud-button" data-action="panel" data-tab="workshop" aria-label="工坊" aria-controls="management" aria-expanded="false" data-tip="工坊">${art('icon-press')}<span>Build</span></button>
      <button class="hud-button" data-action="panel" data-tab="routes" aria-label="航线与委托" aria-controls="management" aria-expanded="false" data-tip="航线与委托">${art('icon-route')}<span>Fleet</span><i id="contract-dot" class="notification" hidden></i></button>
      <button class="hud-button" data-action="panel" data-tab="voyage" aria-label="海克斯与远航" aria-controls="management" aria-expanded="false" data-tip="海克斯与远航">${art('icon-charts')}<span>Voyage</span><i id="voyage-dot" class="notification" hidden></i></button>
    </nav>
    <div class="action-dock">
      <div class="surge-meter" id="surge-meter" title="潮能" hidden><span>${icon('zap',14)}</span><i id="surge-fill"></i><small id="surge-value">0/16</small></div>
      <button class="game-action" id="craft" data-action="craft" aria-label="加工零件" data-tip="加工零件">${art('icon-press')}<span class="action-caption">加工</span><i class="action-progress" id="craft-progress"></i></button>
      <button class="game-action" id="dispatch" data-action="dispatch" aria-label="装船交货" data-tip="装船交货">${art('icon-boat')}<span class="action-caption">交货</span><i class="action-progress" id="ship-progress"></i></button>
      <button class="game-action salvage-action" id="collect" data-action="collect" aria-label="打捞废料" data-tip="长按持续打捞">${art('icon-salvage')}<span class="action-caption">打捞</span></button>
    </div>
    <aside class="management" id="management" aria-label="港口经营面板" hidden>
      <div class="panel-heading"><div><span class="panel-kicker">港口经营</span><h2 id="panel-title">工坊</h2></div><button class="icon-button" data-action="close-panel" aria-label="收起经营面板" title="收起">${icon('close')}</button></div>
      <nav class="tabs" role="tablist" aria-label="港口视图">
        <button data-action="tab" data-tab="workshop" aria-label="工坊" aria-controls="panel" role="tab" title="工坊">${icon('factory',17)}<span>工坊</span></button>
        <button data-action="tab" data-tab="routes" aria-label="航线" aria-controls="panel" role="tab" title="航线">${icon('compass',17)}<span>航线</span></button>
        <button data-action="tab" data-tab="voyage" aria-label="远航" aria-controls="panel" role="tab" title="海克斯与远航">${icon('sparkle',17)}<span>远航</span></button>
      </nav>
      <div id="panel" class="panel-body" tabindex="0" aria-label="经营内容"></div>
    </aside>
    <span class="save-mark" id="save-mark" title="进度已保存" aria-label="进度已保存">${icon('check',12)}</span>
  </main>
  <dialog id="dialog" aria-labelledby="modal-title"><div id="modal-content"></div></dialog>
  <input id="file-import" type="file" accept="application/json,.json" hidden>
`;
const audio=new HarborAudio(()=>state.settings);
const harbor=createHarbor($('#scene'),{
  state:()=>state,panel:()=>panelOpen,blocked:()=>!!modal||document.hidden,
  resourceTarget:(resource)=>{
    const bounds=$('#'+resource).closest('.resource')!.querySelector('img')!.getBoundingClientRect();
    return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
  },gain:(gain)=>onGain(gain),action:(action)=>act(action),
  ready:()=>{
    ready=true;$('#loading').classList.add('loaded');
    if(state.hexOffers.length)showHexChoice();
    else if(warning)toast(warning);
    else if(startup&&startup.seconds>10&&(startup.scrap||startup.parts||startup.coins))showOffline(startup);
    render(true);
  },error:(message)=>{warning=message;toast(message);},
});
function save(){
  state.savedAt=Date.now();lastSave=state.savedAt;
  try{localStorage.setItem(KEY,JSON.stringify(state));$('#save-mark').title='进度已保存';}
  catch{if(!storageWarning){storageWarning=true;toast('本地存档不可用，可在设置中导出进度');}}
}
function toast(text:string){
  text=en(text);
  if(modal){
    let notice=$<HTMLElement>('.modal-notice');
    if(!notice){notice=document.createElement('div');notice.className='modal-notice';notice.setAttribute('role','status');$('#modal-content').insertBefore(notice,$('.modal-body'));}
    notice.textContent=text;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>notice.remove(),2600);return;
  }
  $('#toast').textContent=text;$('#toast').classList.add('visible');
  clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('#toast').classList.remove('visible'),2600);
}
function onGain(gain:Gain){
  const el=$('#'+gain.resource).closest<HTMLElement>('.resource')!;
  hudPulses.get(gain.resource)?.cancel();
  const reduced=state.settings.reducedMotion;
  hudPulses.set(gain.resource,el.animate(reduced?[{background:'#e7bc5a55'},{background:'transparent'}]:[
    {background:gain.resource==='coins'?'#e7bc5a70':'#91d9bf70',transform:'translateY(-2px)'},
    {background:'transparent',transform:'translateY(0)'},
  ],{duration:420,easing:'ease-out'}));
  if(gain.source==='automatic'||gain.resource==='parts')audio.play(gain.resource==='scrap'?'salvage':gain.resource==='parts'?'output':'sale');
}
function celebrate(title:string,artwork:string,kind:Celebration){
  title=en(title);
  if(modal||!ready)return;
  clearTimeout(celebrationTimer);
  $('#reward-icon').innerHTML=art(artwork);$('#reward-title').textContent=title;
  $('#celebration').hidden=false;
  $('#celebration').classList.toggle('surge-reward',kind==='surge');
  if(!state.settings.reducedMotion)$('#celebration').animate([
    {opacity:0,translate:'0 8px',scale:'.92'},{opacity:1,translate:'0 0',scale:'1'},
  ],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
  harbor.scene.celebrate(kind);audio.play(kind==='surge'?'surge':'milestone');
  celebrationTimer=window.setTimeout(()=>{$('#celebration').hidden=true;},2400);
}
function clearRewards(){
  clearTimeout(celebrationTimer);clearTimeout(toastTimer);$('#toast').classList.remove('visible');$('#celebration').hidden=true;
  for(const animation of hudPulses.values())animation.cancel();hudPulses.clear();
  harbor.scene.clearFeedback();seenSales=state.runSales;
}
function checkProgress(){
  const before=seenSales;seenSales=state.runSales;
  if(modal||seenSales<=before)return;
  if(before<20000&&seenSales>=20000&&state.region===2)celebrate('远航就绪','icon-charts','voyage');
  else if(before<12000&&seenSales>=12000&&state.region===1)celebrate('灯塔修复就绪','icon-light','region');
  else if(before<1200&&seenSales>=1200&&state.region===0)celebrate('新航道就绪','icon-route','region');
  else if(before<32&&seenSales>=32)celebrate('航线与委托已开放','icon-route','sale');
  else if(before===0&&seenSales>0)celebrate('首笔交货','icon-coins','sale');
}
function stopHolding(){holding=false;$('#collect').classList.remove('holding');}
function openPanel(next:typeof tab){stopHolding();tab=next;panelOpen=true;render(true);}
function act(action:string,el?:HTMLElement){
  if(modal||!ready)return;void audio.unlock();
  if(action==='collect'){
    const before=state.surgeUntil,yieldAmount=effects(state).tap;
    if(collect(state)){harbor.scene.feedback('scrap',yieldAmount);audio.play('tap');if(state.surgeUntil>before&&before<=state.time)celebrate('潮能爆发','icon-auto','surge');}
  }else if(action==='craft'){
    if(craft(state)){harbor.scene.work('craft');audio.play('craft');save();}else toast(state.manualUntil!==null?'工作台正在加工':`还缺 ${Math.max(0,effects(state).input-state.scrap)} 废料`);
  }else if(action==='dispatch'){
    if(dispatch(state)){harbor.scene.work('dispatch');audio.play('dispatch');save();}else toast(state.ships.every((b)=>b.until!==null)?'货船尚未返港':`还缺 ${Math.max(0,cargoSize(state)-state.parts)} 零件`);
  }else if(action==='buy'){
    const kind=el!.dataset.kind as Machine,purchased=buy(state,kind,batch);
    if(purchased){audio.play('buy');harbor.scene.built(kind,purchased);save();}
  }else if(action==='captain'){
    if(hireCaptain(state)){celebrate('船长就位','icon-boat','captain');save();}
  }else if(action==='expand'){
    if(expand(state)){celebrate(state.region===2?'灯塔已点亮':'珊瑚航道已开通',state.region===2?'icon-light':'icon-route','region');save();}
  }else if(action==='route'){
    if(setRoute(state,el!.dataset.route as Route)){audio.play('tap');save();}
  }else if(action==='contract'){
    const reward=deliverContract(state,Number(el!.dataset.id));
    if(reward){audio.play('sale');harbor.scene.feedback('coins',reward,'contract');celebrate('委托完成','icon-coins','sale');checkProgress();save();}
  }else if(action==='research'){
    if(research(state,el!.dataset.tech as Tech)){celebrate('航图科技已点亮','icon-charts','research');save();}
  }else if(action==='refit'){
    const kind=el!.dataset.kind as Machine;
    if(refit(state,kind)){harbor.scene.built(kind,0);celebrate(`${{salvage:'打捞产量',press:'加工速度',boat:'航行速度'}[kind]} ×2`,'icon-auto','research');save();}
  }else if(action==='focus'){
    if(setFocus(state,el!.dataset.focus as Focus)){celebrate(`${FOCUSES[state.focus].name}专精`,FOCUSES[state.focus].icon,'research');save();}
  }else if(action==='legacy'){
    const key=el!.dataset.legacy as Legacy;
    if(learnLegacy(state,key)){celebrate(`${LEGACIES[key].name} · ${state.legacy[key]}级`,LEGACIES[key].icon,'research');save();}
  }else if(action==='focus-menu')showFocus();
  else if(action==='legacy-menu')showLegacy();
  else if(action==='islands')showIslands();
  else if(action==='voyage'){if(voyageReward(state))showVoyage();}
  else if(action==='panel'){
    const next=el!.dataset.tab as typeof tab;
    if(panelOpen&&tab===next)panelOpen=false;else openPanel(next);
  }else if(action==='close-panel'){panelOpen=false;}
  else if(action==='tab'){tab=el!.dataset.tab as typeof tab;}
  else if(action==='batch'){batch=el!.dataset.batch==='max'?'max':Number(el!.dataset.batch) as 1|10;}
  else if(action==='settings')showSettings();
  else if(action==='office')openPanel('workshop');
  else if(action==='hex-journal')showHexJournal();
  else if(action==='tide')toast(`${tide(state).name} · ${tide(state).description}`);
  else if(action==='goal')showMilestones();
  render(true);
}
function renderPanel(){
  if(!panelOpen)return;
  const signature=[tab,batch,state.salvage,state.presses.length,state.ships.length,state.captain,state.region,state.chartsAvailable,state.chartsEarnedTotal,...Object.values(state.tech),state.voyages,state.hexes.join(','),state.route,state.focus,Object.values(state.refits).join(','),Object.values(state.legacy).join(','),state.islands.join(','),state.blueprints,state.runSales>=96,state.contracts.map((c)=>c.id).join(','),state.runSales>=32].join('|');
  if(signature===panelSignature)return;panelSignature=signature;
  const panel=$('#panel'),changedTab=panel.dataset.tab!==tab;
  panel.dataset.tab=tab;
  const active=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const focus=active?.closest('#panel')?{action:active.dataset.action,kind:active.dataset.kind,tech:active.dataset.tech,batch:active.dataset.batch,route:active.dataset.route}:null;
  $('#panel-title').textContent={workshop:'工坊',routes:'航线与委托',voyage:'海克斯与远航'}[tab];
  document.querySelectorAll<HTMLElement>('[role="tab"]').forEach((b)=>{b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1;b.classList.toggle('active',b.dataset.tab===tab);});
  if(tab==='workshop'){
    $('#panel').innerHTML=`
      <div class="section-head"><h3>生产线</h3><span class="bottleneck" id="bottleneck"></span>${focusUnlocked(state)?`<button class="icon-button focus-control" data-action="focus-menu" aria-label="经营专精" title="${FOCUSES[state.focus].name}专精">${icon('sparkle',18)}</button>`:''}</div>
      <div class="captain-row">${icon('ship',24)}<div><h4>船长</h4><p>${state.captain?'自动航运':'未雇佣'}</p></div><button class="buy-button ${state.captain?'purchased':''}" data-action="captain" aria-label="雇佣船长">${state.captain?icon('check',18):`80${art('icon-coins')}`}</button></div>
      <div class="batch-selector" aria-label="购买数量">${([1,10,'max'] as const).map((v)=>`<button data-action="batch" data-batch="${v}" class="${batch===v?'active':''}" aria-label="${v==='max'?'购买最大数量':`购买数量 ${v}`}" aria-pressed="${batch===v}">${v==='max'?'MAX':`×${v}`}</button>`).join('')}</div>
      ${(['salvage','press','boat'] as const).map((kind)=>`<div class="machine-row"><div class="machine-art">${art({salvage:'crane',press:'press',boat:'boat-loaded'}[kind])}</div><div class="machine-info"><div class="machine-title"><h4>${{salvage:'打捞机',press:'加工机',boat:'货船'}[kind]}</h4><span>×${count(state,kind)}</span></div><p id="${kind}-rate"></p><button class="buy-button" data-action="buy" data-kind="${kind}" aria-label="购买${{salvage:'打捞机',press:'加工机',boat:'货船'}[kind]}">${icon('plus',16)}<span id="${kind}-price"></span>${art('icon-coins')}</button><button class="refit-button" data-action="refit" data-kind="${kind}" aria-label="改造${{salvage:'打捞机',press:'加工机',boat:'货船'}[kind]}"><span id="${kind}-refit-label"></span><b id="${kind}-refit-price"></b></button></div></div>`).join('')}
      <div class="throughput">${icon('waves',17)}<strong id="rate-scrap"></strong>${icon('arrow',13)}${icon('hammer',17)}<strong id="rate-parts"></strong></div>
    `;
  }else if(tab==='routes'){
    $('#panel').innerHTML=`
      <div class="section-head"><h3>货运策略</h3><span id="trip-info" class="quiet"></span></div>
      <div class="route-selector">${(Object.keys(ROUTES) as Route[]).map((r)=>`<button data-action="route" data-route="${r}" class="${state.route===r?'active':''}" aria-label="${en(ROUTES[r].name)} route" aria-pressed="${state.route===r}" title="${ROUTES[r].description}" ${state.runSales<32?'disabled':''}>${art(ROUTES[r].icon)}<span>${ROUTES[r].name}</span></button>`).join('')}</div>
      <p class="route-description">${state.runSales<32?'累计交货 32 金币后解锁':ROUTES[state.route].description}</p>
      <div class="fleet-summary">${icon('ship',18)}<strong id="fleet-status"></strong><span id="trip-payout"></span></div>
      <button class="exploration-link" data-action="islands" aria-label="群岛探索">${icon('map',20)}<span>群岛探索</span><small id="exploration-status"></small>${icon('next',16)}</button>
      <div class="section-head"><h3>港口委托</h3><span class="quiet">${icon('check',13)} ${state.contractsCompleted}</span></div>
      ${state.contracts.length?state.contracts.map((c)=>`<div class="contract-row"><div class="contract-heading">${icon(c.kind===0?'anchor':c.kind===1?'hammer':'navigation',17)}<h4>${CONTRACT_NAMES[c.kind]}</h4><b>${fmt(contractReward(state,c))}${art('icon-coins')}</b></div><div class="contract-materials">${c.scrap?`<span id="contract-scrap-${c.id}">${art('icon-scrap')}${fmt(c.scrap)}</span>`:''}<span id="contract-parts-${c.id}">${art('icon-parts')}${fmt(c.parts)}</span><button class="icon-button deliver-button" data-action="contract" data-id="${c.id}" aria-label="交付${CONTRACT_NAMES[c.kind]}" title="交付">${icon('check',20)}</button></div></div>`).join(''):`<div class="empty-state">${icon('contract',28)}<p>累计交货 32 金币后开放</p></div>`}
      <section class="expansion"><div class="section-head"><h3>${state.region===2?'灯塔港':state.region===0?'珊瑚航道':'修复灯塔'}</h3>${icon('map',18)}</div><div class="expansion-art">${art(state.region===0?'beacon':'lighthouse')}<div><span id="expand-condition" class="quiet"></span><button class="buy-button" data-action="expand" id="expand-button" aria-label="${state.region===0?'扩建珊瑚航道':'修复灯塔'}">${state.region===2?icon('check',18):`${icon('plus',16)}${state.region===0?'800':'6,000'}${art('icon-coins')}`}</button></div></div></section>
    `;
  }else{
    const c=familyCounts(state.hexes);
    $('#panel').innerHTML=`
      <div class="voyage-stats"><div>${art('icon-charts')}<strong>${fmt(state.chartsEarnedTotal)}</strong></div><div>${icon('ship',18)}<strong>×${chartMultiplier(state).toFixed(2)}</strong></div></div>
      <button class="wide-button coral" data-action="voyage" id="voyage-button" aria-label="开启远航">${icon('navigation')}<span>远航</span><b id="voyage-amount"></b></button><p id="voyage-condition" class="quiet center"></p>
      <button class="exploration-link" data-action="legacy-menu" aria-label="永久传承">${icon('book',20)}<span>永久传承</span><small id="blueprints">${state.blueprints} 手稿</small>${icon('next',16)}</button>
      <div class="section-head"><h3>海克斯共鸣</h3><button class="icon-button" data-action="hex-journal" aria-label="海克斯图鉴" title="海克斯图鉴">${icon('book',17)}</button></div>
      <div class="resonances">${(Object.keys(FAMILY) as Family[]).map((f)=>`<div class="resonance ${c[f]>=2?'active':''}" title="${RESONANCE[f].join('；')}">${art(FAMILY[f].icon)}<span>${FAMILY[f].name}</span><strong>${c[f]}<small> / ${c[f]>=2?4:2}</small></strong><div class="resonance-dots">${Array.from({length:4},(_,i)=>`<i class="${i<c[f]?'on':''}"></i>`).join('')}</div></div>`).join('')}</div>
      <div class="owned-hexes">${state.hexes.map((id)=>{const h=hexById(id)!;return `<button class="hex-mini ${h.rarity}" data-action="hex-journal" aria-label="${h.name}" title="${h.name}：${h.description}">${art(h.icon)}</button>`;}).join('')||`<span class="quiet">首次远航后获得海克斯</span>`}</div>
      <div class="section-head tech-head"><h3>航图科技</h3><span class="quiet">${state.chartsAvailable}${art('icon-charts')}</span></div>
      ${(['currents','captain','night'] as const).map((tech)=>`<div class="tech-row"><div class="tech-icon">${icon({currents:'waves',captain:'ship',night:'clock'}[tech] as keyof typeof ICONS,21)}</div><div><h4>${{currents:'潮流学',captain:'熟练船长',night:'长夜航灯'}[tech]}</h4><p>${{currents:'打捞 +20%',captain:'开局自带船长',night:'离线 12 小时'}[tech]}</p></div><button class="tech-buy ${state.tech[tech]?'purchased':''}" data-action="research" data-tech="${tech}" aria-label="研究${{currents:'潮流学',captain:'熟练船长',night:'长夜航灯'}[tech]}">${state.tech[tech]?icon('check',17):`${TECH_COST[tech]}${art('icon-charts')}`}</button></div>`).join('')}
    `;
  }
  if(changedTab)panel.scrollTop=0;
  if(focus?.action){
    const selector=`#panel [data-action="${focus.action}"]${Object.entries(focus).filter(([key,value])=>key!=='action'&&value).map(([key,value])=>`[data-${key}="${value}"]`).join('')}`;
    $<HTMLButtonElement>(selector)?.focus({preventScroll:true});
  }
}
function goal(){
  if(state.runSales===0)return {title:'首笔交货',current:state.parts,target:cargoSize(state),value:`${state.parts} / ${cargoSize(state)}`,symbol:'ship' as const};
  if(!state.salvage)return {title:'打捞机',current:state.coins,target:quote(state,'salvage',1).cost,value:`${fmt(state.coins)} / ${quote(state,'salvage',1).cost}`,symbol:'anchor' as const};
  if(!state.presses.length)return {title:'自动加工',current:state.coins,target:quote(state,'press',1).cost,value:`${fmt(state.coins)} / ${quote(state,'press',1).cost}`,symbol:'hammer' as const};
  if(!state.captain)return {title:'船长就位',current:state.coins,target:80,value:`${fmt(state.coins)} / 80`,symbol:'ship' as const};
  if(state.region===0)return {title:'珊瑚航道',current:state.runSales,target:1200,value:`${fmt(state.runSales)} / 1.2K`,symbol:'map' as const};
  if(state.region===1)return {title:'点亮灯塔',current:state.runSales,target:12000,value:`${fmt(state.runSales)} / 12K`,symbol:'map' as const};
  return {title:voyageReward(state)?'远航就绪':'远航准备',current:state.runSales,target:20000,value:`${fmt(state.runSales)} / 20K`,symbol:'navigation' as const};
}
function render(force=false){
  if(!force&&performance.now()-lastRender<100)return;lastRender=performance.now();
  ensureContracts(state);
  document.documentElement.classList.toggle('reduced-motion',state.settings.reducedMotion);
  const rates=steadyRates(state),m=effects(state);
  for(const [id,n] of [['scrap',state.scrap],['parts',state.parts],['coins',Math.floor(state.coins)],['charts',state.chartsAvailable]] as const)$('#'+id).textContent=fmt(n);
  $('#income').textContent=`+${fmt(rates.coins,1)}/s`;
  const phase=tide(state);$('#tide-name').textContent=phase.name;$('#tide-time').textContent=`${Math.ceil(phase.remaining)}s`;$('#tide-symbol').innerHTML=icon(phase.index===2?'wind':'waves',18);$('#tide-button').title=phase.description;
  const surge=state.surgeUntil>state.time;
  $('#surge-meter').hidden=!surge&&state.effort===0;
  $('#surge-meter').classList.toggle('active',surge);$('#collect').classList.toggle('charged',surge);$('#surge-fill').style.width=`${surge?100:state.effort/16*100}%`;
  $('#surge-value').textContent=surge?`${Math.ceil(state.surgeUntil-state.time)}s`:`${state.effort}/16`;
  const locked=!!modal||!ready;
  $<HTMLButtonElement>('#craft').disabled=state.manualUntil!==null||state.scrap<m.input||locked;
  $('#craft').title=state.manualUntil!==null?`加工中 · ${Math.max(0,state.manualUntil-state.time).toFixed(1)}s`:`${m.input} 废料 → ${m.output} 零件`;
  $('#craft-progress').style.transform=`scaleX(${state.manualUntil!==null?progress(manualDuration(state)-(state.manualUntil-state.time),manualDuration(state))/100:0})`;
  const underway=state.ships.filter((s)=>s.until!==null),free=state.ships.length-underway.length;
  $<HTMLButtonElement>('#dispatch').disabled=state.parts<cargoSize(state)||free===0||locked;
  $('#dispatch').title=free===0?'货船返港中':`${cargoSize(state)} 零件 → ${fmt(tripPrice(state),1)} 金币`;
  const ship=underway[0];$('#ship-progress').style.transform=`scaleX(${ship?progress(state.time-ship.departed,ship.until!-ship.departed)/100:0})`;
  $<HTMLButtonElement>('#collect').disabled=locked;
  $('#collect').title=`打捞 +${m.tap} 废料`;
  $('#management').hidden=!panelOpen;
  $('.playfield').classList.toggle('panel-open',panelOpen);
  document.querySelectorAll<HTMLElement>('[data-action="panel"]').forEach((b)=>{
    const expanded=panelOpen&&b.dataset.tab===tab;b.setAttribute('aria-expanded',String(expanded));
    if(b.closest('.nav-dock'))b.classList.toggle('active',expanded);
  });
  $('#voyage-dot').hidden=!voyageReward(state);
  $('#contract-dot').hidden=!state.contracts.some((c)=>state.scrap>=c.scrap&&state.parts>=c.parts);
  const stripSignature=state.hexes.join('|');
  if($('#hex-strip').dataset.signature!==stripSignature){
    $('#hex-strip').dataset.signature=stripSignature;
    $('#hex-strip').innerHTML=state.hexes.slice(-3).map((id)=>{const h=hexById(id)!;return `<button class="hex-mini ${h.rarity}" data-action="hex-journal" aria-label="${h.name}" data-tip="${h.name}">${art(h.icon)}</button>`;}).join('');
    if(state.hexes.length>3)$('#hex-strip').innerHTML+=`<button class="hex-mini" data-action="hex-journal" aria-label="全部海克斯" data-tip="全部海克斯">+${state.hexes.length-3}</button>`;
  }
  renderPanel();
  if(panelOpen&&tab==='workshop'){
    $('#bottleneck').textContent=`${bottleneck(state)}瓶颈`;
    for(const kind of ['salvage','press','boat'] as const){
      const q=quote(state,kind,batch),b=$<HTMLButtonElement>(`[data-action="buy"][data-kind="${kind}"]`);
      b.disabled=!q.affordable;b.title=q.affordable?`购入 ${q.count}`:q.count?`还缺 ${fmt(Math.max(0,q.cost-state.coins))} 金币`:'数量已达上限';
      const rq=refitQuote(state,kind),rb=$<HTMLButtonElement>(`[data-action="refit"][data-kind="${kind}"]`);
      rb.disabled=!rq.affordable;
      $(`#${kind}-refit-label`).textContent=rq.level===3?'潮核完成':rq.unlocked?`${REFIT_NAMES[rq.level]} · ×2`:`${rq.requirement} 台解锁改造`;
      $(`#${kind}-refit-price`).textContent=rq.unlocked?fmt(rq.cost):rq.level?`${rq.level}/3`:'';
      rb.title=rq.level===3?'已完成全部改造':rq.unlocked?`${fmt(rq.cost)} 金币，使${kind==='salvage'?'打捞产量':kind==='press'?'加工速度':'航速'}翻倍`:`需要 ${rq.requirement} 台`;
      $(`#${kind}-price`).textContent=fmt(q.cost);
      $(`#${kind}-rate`).textContent=kind==='salvage'?`${fmt(salvageRate(state),1)} 废料/s`:kind==='press'?`${m.input} → ${m.output} · ${pressDuration(state).toFixed(1)}s`:`${cargoSize(state)} 零件 · ${tripDuration(state).toFixed(1)}s`;
    }
    $<HTMLButtonElement>('[data-action="captain"]').disabled=state.captain||state.coins<80;
    $('#rate-scrap').textContent=`${fmt(rates.scrap,1)}/s`;$('#rate-parts').textContent=`${fmt(rates.parts,2)}/s`;
  }else if(panelOpen&&tab==='routes'){
    $('#exploration-status').textContent=state.expedition?`${ISLANDS[state.expedition.island].name} · ${duration(state.expedition.until-state.time)}`:state.runSales<96?'96 销售额解锁':`${state.islands.length}/4 发现`;
    $('#trip-info').textContent=`${cargoSize(state)} 零件`;
    $('#trip-payout').textContent=`${fmt(tripPrice(state),1)} / 航次`;
    $('#fleet-status').textContent=`${underway.length} / ${state.ships.length} 航行中`;
    for(const c of state.contracts){
      $<HTMLButtonElement>(`[data-action="contract"][data-id="${c.id}"]`).disabled=state.scrap<c.scrap||state.parts<c.parts;
      if(c.scrap)$(`#contract-scrap-${c.id}`).classList.toggle('met',state.scrap>=c.scrap);
      $(`#contract-parts-${c.id}`).classList.toggle('met',state.parts>=c.parts);
    }
    $<HTMLButtonElement>('#expand-button').disabled=state.region>=2||state.runSales<(state.region===0?1200:12000)||state.coins<(state.region===0?800:6000);
    $('#expand-condition').textContent=state.region===2?'航灯长明':`${fmt(state.runSales)} / ${state.region===0?'1.2K':'12K'}`;
  }else if(panelOpen){
    const reward=voyageReward(state);
    $('#voyage-amount').textContent=`+${reward}${reward?' 航图':''}`;
    $<HTMLButtonElement>('#voyage-button').disabled=!reward;
    $('#voyage-condition').textContent=reward?'海克斯三选一':state.region<2?'灯塔尚未修复':`${fmt(state.runSales)} / 20K`;
    $('#blueprints').textContent=`${fmt(state.blueprints)} 手稿`;
    for(const tech of ['currents','captain','night'] as const)$<HTMLButtonElement>(`[data-tech="${tech}"]`).disabled=state.tech[tech]||state.chartsAvailable<TECH_COST[tech];
  }
  const milestone=nextMilestone(state),claimable=milestone&&milestoneReady(state,milestone.id);
  const g=milestone?{title:milestone.name,current:milestone.current(state),target:milestone.target,value:claimable?'领取补给':milestone.detail,symbol:'book' as const}:goal();
  $('#goal-status').textContent=claimable?'可领取':'进行中';
  $('#goal-title').textContent=g.title;$('.goal-hud').classList.toggle('goal-ready',!!claimable);$('#goal-value').textContent=g.value;$('#goal-symbol').innerHTML=icon(g.symbol,18);$('#goal-progress').style.width=`${progress(g.current,g.target)}%`;
  if(modal==='legacy')for(const key of Object.keys(LEGACIES) as Legacy[])$<HTMLButtonElement>(`[data-legacy="${key}"]`).disabled=state.legacy[key]>=5||state.blueprints<legacyCost(state.legacy[key]);
  if(modal==='milestones')for(const b of document.querySelectorAll<HTMLButtonElement>('[data-modal-action="claim"]')){
    const available=milestoneReady(state,b.dataset.id!);b.disabled=!available;b.closest('.milestone-row')!.classList.toggle('available',available);
  }
  if(modal==='islands'){
    const expedition=state.expedition;
    const p=$('#explore-progress');if(p)p.style.width=expedition?`${progress(state.time-expedition.departed,expedition.until-expedition.departed)}%`:'100%';
    const label=$('#explore-countdown');if(label)label.textContent=expedition?duration(expedition.until-state.time):'已返港';
    for(const b of document.querySelectorAll<HTMLButtonElement>('[data-modal-action="explore"]'))b.disabled=!explorationQuote(state,Number(b.dataset.island))?.affordable;
  }
  translateUI($('.playfield'));
  if(modal)translateUI($('#dialog'));
}
function showLegacy(){
  openModal('legacy','永久传承',`<div class="journal-intro">${icon('book',20)}<span>${state.blueprints} 手稿 · 远航保留</span></div>${(Object.keys(LEGACIES) as Legacy[]).map(key=>`<div class="tech-row legacy-row"><div class="tech-icon">${art(LEGACIES[key].icon)}</div><div><h4>${LEGACIES[key].name} <small>${state.legacy[key]}/5</small></h4><p>${LEGACIES[key].detail}</p></div><button class="tech-buy" data-modal-action="legacy" data-legacy="${key}" aria-label="研究${LEGACIES[key].name}">${state.legacy[key]===5?icon('check',17):`${legacyCost(state.legacy[key])}${icon('book',14)}`}</button></div>`).join('')}<p class="quiet center">目标补给与群岛探索提供手稿</p>`);
}
function showFocus(){
  openModal('focus','经营专精',`<p class="quiet center">根据生产瓶颈切换，已出发的任务保持原参数</p><div class="focus-options">${(Object.keys(FOCUSES) as Focus[]).map(f=>`<button data-modal-action="focus" data-focus="${f}" class="${state.focus===f?'active':''}" aria-label="${FOCUSES[f].name}专精" aria-pressed="${state.focus===f}">${art(FOCUSES[f].icon)}<span><strong>${FOCUSES[f].name}</strong><small>${FOCUSES[f].detail}</small></span>${state.focus===f?icon('check',18):icon('next',16)}</button>`).join('')}</div>`);
}
function showMilestones(){
  openModal('milestones','航程与补给',`<div class="journal-intro">${icon('book',20)}<span>${state.milestones.length} / ${MILESTONES.length} · 奖励永久记录</span></div>${[...MILESTONES].sort((a,b)=>{const rank=(id:string)=>milestoneReady(state,id)?0:state.milestones.includes(id)?2:1;return rank(a.id)-rank(b.id);}).map(m=>{const claimed=state.milestones.includes(m.id),available=milestoneReady(state,m.id);return `<div class="milestone-row ${claimed?'claimed':''} ${available?'available':''}">${art(m.icon)}<div><h3>${m.name}</h3><p>${m.detail}</p><small>${m.coins?`+${fmt(m.coins)} 金币 `:''}${m.scrap?`+${m.scrap} 废料 `:''}${m.blueprints?`+${m.blueprints} 手稿`:''}</small></div><button class="icon-button" data-modal-action="claim" data-id="${m.id}" aria-label="领取${m.name}" ${available?'':'disabled'}>${icon(claimed?'check':available?'download':'lock',19)}</button></div>`;}).join('')}`);
}
function showIslands(){
  openModal('islands','群岛探索',`<div class="journal-intro">${icon('compass',20)}<span>${state.islands.length}/4 发现</span><b class="manuscript-count">${icon('book',16)} ${state.blueprints} 手稿</b></div>${state.expedition?`<div class="expedition-progress"><span>${ISLANDS[state.expedition.island].name}</span><small id="explore-countdown"></small><div class="track"><i id="explore-progress"></i></div></div>`:''}<div class="island-map">${ISLANDS.map((island,i)=>{const q=explorationQuote(state,i)!,known=state.islands.includes(i);return `<section class="island-entry ${q.unlocked?'unlocked':''} ${known?'discovered':''}"><div class="island-art">${art(island.icon)}<span>${known?icon('check',16):q.unlocked?icon('compass',16):icon('lock',16)}</span></div><div class="island-info"><h3>${island.name}</h3><p>${q.unlocked?known?island.story:'修复旧航标，带回失落的工匠知识':`${REGIONS[island.region]} · ${fmt(island.sales)} 销售额`}</p><div class="island-reward">${icon('book',14)} +${q.blueprints} <span>${art('icon-coins')} +${fmt(q.coins)}</span><small>${duration(q.duration)}</small></div><div class="explore-command"><span>${art('icon-scrap')}${island.scrap} ${art('icon-parts')}${island.parts}</span><button class="buy-button" data-modal-action="explore" data-island="${i}" aria-label="Explore ${en(island.name)}" ${q.affordable?'':'disabled'}>${state.expedition?'探索中':known?'再访':'探索'}${icon('navigation',15)}</button></div></div></section>`;}).join('')}</div><p class="quiet center">独立探险船 · 材料在出发时消耗 · 手稿与发现永久保留</p>`);
}
function bindScrollRegion(element:HTMLElement){
  element.addEventListener('click',(event)=>{
    const target=event.target as Element;
    if(!target.closest('button,input,textarea,select,a'))element.focus({preventScroll:true});
  });
  element.addEventListener('keydown',(event)=>{
    if(event.target!==element||!['Home','End','PageUp','PageDown'].includes(event.key))return;
    event.preventDefault();
    const amount=element.clientHeight*.85;
    element.scrollTop=event.key==='Home'?0:event.key==='End'?element.scrollHeight:element.scrollTop+(event.key==='PageDown'?amount:-amount);
  });
}
bindScrollRegion($('#panel'));
function openModal(kind:string,title:string,content:string){
  title=en(title);content=en(content);
  clearRewards();stopHolding();if(!modal)modalReturnFocus=document.activeElement as HTMLElement;modal=kind;
  $('#dialog').classList.toggle('hex-dialog',kind==='hex-choice');
  const emblems:Record<string,keyof typeof ICONS>={settings:'settings',legacy:'book',focus:'sparkle',milestones:'compass',islands:'map',voyage:'navigation',offline:'anchor',journal:'book','hex-journal':'sparkle','hex-choice':'sparkle',reset:'reset',import:'upload','import-confirm':'upload'};
  $('#modal-content').innerHTML=`<div class="modal-head"><div class="modal-heading"><span class="modal-seal">${icon(emblems[kind]??'anchor',23)}</span><div><span class="modal-eyebrow">潮汐工坊</span><h2 id="modal-title">${title}</h2></div></div>${kind==='hex-choice'?`<span class="hex-voyage-count">${state.voyages.toString().padStart(2,'0')}</span>`:`<button class="icon-button" data-modal-action="close" aria-label="关闭">${icon('close')}</button>`}</div><div class="modal-body" tabindex="0" aria-label="${title}内容">${content}</div>`;
  bindScrollRegion($('.modal-body'));
  $('#dialog').scrollTop=0;
  if(!$<HTMLDialogElement>('#dialog').open)$<HTMLDialogElement>('#dialog').showModal();render(true);
}
function closeModal(){
  if(modal==='hex-choice'&&state.hexOffers.length)return;
  modal='';candidate=null;$<HTMLDialogElement>('#dialog').close();lastFrame=performance.now();render(true);modalReturnFocus?.focus({preventScroll:true});
}
function showHexChoice(){
  const counts=familyCounts(state.hexes);
  openModal('hex-choice','海克斯航藏',`
    <div class="hex-choice-heading"><span>${icon('sparkle',17)} 永久强化</span><span>${state.hexes.length} / ${HEXES.length}</span></div>
    <div class="hex-choices">${state.hexOffers.map((id)=>{
      const h=hexById(id)!,c=counts[h.family],next=c+1;
      return `<button class="hex-choice ${h.rarity}" data-modal-action="choose-hex" data-id="${id}" aria-label="选择${h.name}"><span class="rarity-label">${RARITY[h.rarity]}</span><span class="hex-emblem">${art(h.icon)}</span><h3>${h.name}</h3><p>${h.description}</p><span class="hex-family" style="--family:${FAMILY[h.family].color}">${art(FAMILY[h.family].icon)}${FAMILY[h.family].name}<b>${c} → ${next}</b></span><small class="hex-resonance ${next===2||next===4?'unlocks':''}">${next===2?RESONANCE[h.family][0]:next===4?RESONANCE[h.family][1]:next<2?RESONANCE[h.family][0]:RESONANCE[h.family][1]}</small></button>`;
    }).join('')}</div>
    <div class="hex-choice-footer"><span>${art('icon-charts')} 累计航图 ${state.chartsEarnedTotal}</span><button class="reroll-button" data-modal-action="reroll-hex" aria-label="重抽海克斯" ${state.hexRerolls?'':'disabled'}>${icon('reset',17)}<span>${state.hexRerolls?'重抽':'已重抽'}</span><b>${state.hexRerolls}</b></button></div>
  `);
}
function showHexJournal(){
  const c=familyCounts(state.hexes);
  openModal('hex-journal','海克斯图鉴',`
    <div class="journal-intro">${icon('sparkle',20)}<span>${state.hexes.length} / ${HEXES.length}</span></div>
    <div class="journal-resonance">${(Object.keys(FAMILY) as Family[]).map((f)=>`<div><h3>${art(FAMILY[f].icon)}${FAMILY[f].name}<b>${c[f]}</b></h3><p class="${c[f]>=2?'met':''}">${RESONANCE[f][0]}</p><p class="${c[f]>=4?'met':''}">${RESONANCE[f][1]}</p></div>`).join('')}</div>
    ${state.hexes.length?state.hexes.map((id)=>{const h=hexById(id)!;return `<div class="journal-hex">${art(h.icon)}<div><h3>${h.name}<small>${RARITY[h.rarity]}</small></h3><p>${h.description}</p></div></div>`;}).join(''):`<div class="empty-state">${icon('compass',34)}<p>海克斯航藏尚未开启</p></div>`}
  `);
}
function showSettings(){
  openModal('settings','设置与存档',`
    <section class="settings-section"><div class="section-head"><h3>海港声音</h3><button class="icon-button" data-modal-action="sound" id="sound" aria-label="${state.settings.muted?'开启声音':'静音'}">${icon(state.settings.muted?'mute':'sound')}</button></div><label class="slider-label"><span>${icon('waves',18)}海浪</span><output id="ambient-value">${Math.round(state.settings.ambience*100)}%</output></label><input type="range" min="0" max="100" value="${state.settings.ambience*100}" data-setting="ambience" aria-label="海浪环境音"><label class="slider-label"><span>${icon('sound',18)}音效</span><output id="effects-value">${Math.round(state.settings.effects*100)}%</output></label><input type="range" min="0" max="100" value="${state.settings.effects*100}" data-setting="effects" aria-label="音效音量"><label class="toggle-label"><span>减少动态效果</span><input type="checkbox" data-setting="reducedMotion" ${state.settings.reducedMotion?'checked':''}><i></i></label></section>
    <section class="settings-section"><div class="section-head"><h3>本地存档</h3><span class="quiet">${offlineCap(state)/3600}h 离线</span></div><div class="save-commands"><button data-modal-action="export">${icon('download')}导出</button><button data-modal-action="import-file">${icon('upload')}导入</button><button data-modal-action="import-text">${icon('clipboard')}粘贴</button></div></section>
    <button class="journal-command" data-modal-action="journal">${icon('book',18)}航海图鉴</button><button class="reset-command" data-modal-action="reset">${icon('reset',18)}重置进度</button>
  `);
}
function showJournal(){
  openModal('journal','航海图鉴',`<div class="journal-intro">${icon('map',22)}<span>${state.discovered.length} / 3</span></div>${REGIONS.map((name,i)=>`<div class="journal-entry ${state.discovered.includes(i)?'discovered':''}">${art(['office','beacon','lighthouse'][i])}<div><h3>${state.discovered.includes(i)?name:'未探索海域'}</h3><p>${state.discovered.includes(i)?['近岸浮台与第一艘货船','珊瑚航道的导航浮标','长明航灯与远航起点'][i]:'航道尚未连通'}</p></div>${icon(state.discovered.includes(i)?'check':'lock',20)}</div>`).join('')}`);
}
function showVoyage(){
  openModal('voyage','驶向下一片海域',`<div class="voyage-confirm-art">${art('boat-loaded')}${art('icon-charts')}</div><div class="reward-display">+${voyageReward(state)} <span>航图</span></div><div class="confirm-lines"><div>${icon('sparkle',18)}<span>${state.hexes.length<HEXES.length?`从 ${HEXES.length-state.hexes.length} 种未发现海克斯中抽选`:'全部海克斯已收集'}</span></div><div>${icon('check',18)}<span>海克斯、航图、手稿、传承与图鉴永久保留</span></div><div>${icon('reset',18)}<span>重建港口，获得打捞机与 ${24+state.legacy.supplies*60} 金币；在途探索取消</span></div></div><div class="modal-commands"><button class="secondary" data-modal-action="close">留在港口</button><button class="coral" data-modal-action="voyage" aria-label="确认远航">${icon('navigation',18)}确认远航</button></div>`);
}
function showOffline(result:ReturnType<typeof settleOffline>){
  openModal('offline','欢迎返港',`<div class="offline-heading">${icon('clock',24)}<span>${duration(result.seconds)}</span></div><div class="offline-rewards">${[['icon-scrap',result.scrap],['icon-parts',result.parts],['icon-coins',result.coins]].map(([key,value])=>`<div>${art(String(key))}<strong>+${fmt(Number(value))}</strong></div>`).join('')}</div>${result.blueprints?`<p class="offline-manuscripts">${icon('book',18)} +${result.blueprints} 手稿 · ${ISLANDS[result.exploration!].name}已返港</p>`:''}<p class="quiet center">${result.truncated?`已按 ${offlineCap(state)/3600} 小时上限结算`:'进度已保存'}</p><button class="wide-button coral" data-modal-action="close" aria-label="继续经营">${icon('anchor')}继续经营</button>`);
}
function showTextImport(){
  openModal('import','导入存档',`<p class="import-note">导入会替换当前码头进度。</p><textarea id="import-json" aria-label="存档 JSON" placeholder="存档 JSON" spellcheck="false"></textarea><p class="import-error" id="import-error" role="alert"></p><div class="modal-commands"><button class="secondary" data-modal-action="close">取消</button><button class="coral" data-modal-action="read-import" aria-label="检查并导入存档">${icon('upload',18)}检查存档</button></div>`);
}
function reviewImport(raw:string){
  try{
    const parsed=parseState(raw);
    openModal('import-confirm','替换当前码头？',`<div class="import-summary"><span>${REGIONS[parsed.region]}</span><strong>${fmt(parsed.coins)} 金币</strong><p>${parsed.salvage} 打捞机 · ${parsed.presses.length} 加工机 · ${parsed.ships.length} 货船</p></div><p class="import-note">当前进度将被替换。建议先导出备份。</p><div class="modal-commands"><button class="secondary" data-modal-action="close">取消</button><button class="coral" data-modal-action="confirm-import" aria-label="确认导入">${icon('upload',18)}确认导入</button></div>`);candidate=parsed;
  }catch(error){const message=error instanceof Error?error.message:'存档格式无效';const target=$('#import-error');if(target)target.textContent=en(message);else toast(message);}
}
function modalAction(action:string,el?:HTMLElement){
  if(action==='legacy'){
    const key=el!.dataset.legacy as Legacy;
    if(learnLegacy(state,key)){closeModal();celebrate(`${LEGACIES[key].name} · ${state.legacy[key]}级`,LEGACIES[key].icon,'research');save();}
  }else if(action==='focus'){
    const focus=el!.dataset.focus as Focus;
    if(setFocus(state,focus)){closeModal();celebrate(`${FOCUSES[focus].name}专精`,FOCUSES[focus].icon,'research');save();}
  }else if(action==='claim'){
    const id=el!.dataset.id!,m=MILESTONES.find(m=>m.id===id)!;
    if(claimMilestone(state,id)){closeModal();celebrate(`${m.name} · 补给已到账`,m.icon,'sale');if(m.coins)harbor.scene.feedback('coins',m.coins);if(m.scrap)harbor.scene.feedback('scrap',m.scrap);save();}
  }else if(action==='explore'){
    const index=Number(el!.dataset.island);
    if(explore(state,index)){closeModal();celebrate(`${ISLANDS[index].name} · 出发`,'barge','captain');save();}
  }else if(action==='close')closeModal();
  else if(action==='sound'){state.settings.muted=!state.settings.muted;audio.sync();save();showSettings();}
  else if(action==='journal')showJournal();
  else if(action==='export'){
    save();const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`tidal-workshop-${new Date().toISOString().slice(0,10)}.json`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);toast('存档已导出');
  }else if(action==='import-file')$<HTMLInputElement>('#file-import').click();
  else if(action==='import-text')showTextImport();
  else if(action==='read-import')reviewImport($<HTMLTextAreaElement>('#import-json').value);
  else if(action==='confirm-import'&&candidate){
    state=candidate;clearRewards();const result=settleOffline(state,Date.now());closeModal();save();panelSignature='';render(true);harbor.scene.arrival();
    if(state.hexOffers.length)showHexChoice();else if(result.seconds>10&&(result.scrap||result.parts||result.coins))showOffline(result);else toast('存档导入成功');
  }else if(action==='reset'){
    openModal('reset','重置这座码头？',`<div class="reset-art">${icon('reset',36)}</div><p class="confirm-warning">资源、机器、海克斯、航图与科技都将清空。<br>此操作不能撤销。</p><div class="modal-commands"><button class="secondary" data-modal-action="close">保留进度</button><button class="danger" data-modal-action="confirm-reset" aria-label="确认重置">确认重置</button></div>`);
  }else if(action==='confirm-reset'){
    const settings={...state.settings};state=freshState();state.settings=settings;clearRewards();closeModal();tab='workshop';batch=1;panelOpen=false;panelSignature='';save();render(true);harbor.scene.arrival();
  }else if(action==='voyage'){
    const next=voyage(state);
    if(next){state=next;clearRewards();closeModal();panelOpen=false;tab='workshop';batch=1;panelSignature='';audio.play('voyage');harbor.scene.arrival();save();if(state.hexOffers.length)showHexChoice();else toast('全部海克斯已收集');render(true);}
  }else if(action==='reroll-hex'){
    if(rerollHexes(state)){audio.play('tap');save();showHexChoice();}
  }else if(action==='choose-hex'){
    const id=el!.dataset.id!;
    if(chooseHex(state,id)){save();closeModal();const h=hexById(id)!,c=familyCounts(state.hexes)[h.family];celebrate(c===2||c===4?`${h.name} · 共鸣激活`:`${h.name} · 已激活`,h.icon,'hex');render(true);}
  }
}
$('#collect').addEventListener('pointerdown',(event)=>{
  const e=event as PointerEvent;if(modal||!ready||e.button!==0)return;e.preventDefault();$('#collect').focus({preventScroll:true});
  holding=true;lastHeld=performance.now();$('#collect').setPointerCapture(e.pointerId);$('#collect').classList.add('holding');act('collect');
});
for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])$('#collect').addEventListener(event,stopHolding);
$('#collect').addEventListener('keydown',(event)=>{
  const e=event as KeyboardEvent;if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();if(!modal){holding=true;lastHeld=performance.now();act('collect');$('#collect').classList.add('holding');}}
});
$('#collect').addEventListener('keyup',(event)=>{const e=event as KeyboardEvent;if(e.key===' '||e.key==='Enter'){e.preventDefault();stopHolding();}});
$('#collect').addEventListener('click',(event)=>{if((event as MouseEvent).detail===0)act('collect');});
document.addEventListener('click',(event)=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action],[data-modal-action]');if(!target||target instanceof HTMLButtonElement&&target.disabled)return;
  if(target.dataset.modalAction){modalAction(target.dataset.modalAction,target);return;}
  if(target.dataset.action!=='collect')act(target.dataset.action!,target);
});
$('#dialog').addEventListener('cancel',(event)=>{event.preventDefault();closeModal();});
$('#dialog').addEventListener('click',(event)=>{if(event.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
$('#dialog').addEventListener('input',(event)=>{
  const target=event.target as HTMLInputElement,setting=target.dataset.setting;if(!setting)return;
  if(setting==='reducedMotion')state.settings.reducedMotion=target.checked;
  else if(setting==='ambience'||setting==='effects'){state.settings[setting]=Number(target.value)/100;$(setting==='ambience'?'#ambient-value':'#effects-value').textContent=`${target.value}%`;}
  audio.sync();save();render(true);
});
$('#file-import').addEventListener('change',async(event)=>{
  const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;
  if(file.size>300000){toast('存档文件过大');return;}reviewImport(await file.text());
});
document.addEventListener('keydown',(event)=>{
  if(modal)return;
  if(event.key==='Escape'&&panelOpen){event.preventDefault();panelOpen=false;stopHolding();render(true);$<HTMLButtonElement>(`.nav-dock [data-tab="${tab}"]`).focus();}
  const target=event.target as HTMLElement;
  if(target.closest('.tabs')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();const tabs=['workshop','routes','voyage'] as const;
    const index=event.key==='Home'?0:event.key==='End'?2:(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:2))%3;
    tab=tabs[index];render(true);$<HTMLButtonElement>(`.tabs [data-tab="${tab}"]`).focus();
  }
});
window.addEventListener('blur',stopHolding);window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{
  stopHolding();harbor.scene.clearFeedback();if(document.hidden){save();audio.sync(true);}else{
    const result=settleOffline(state,Date.now());save();lastFrame=performance.now();audio.sync();render(true);
    if(state.hexOffers.length)showHexChoice();else if(!modal&&result.seconds>10&&(result.scrap||result.parts||result.coins))showOffline(result);
  }
});
function processProduction(result:Production,manual=false){
  harbor.scene.production(result,manual);checkProgress();
  if(result.exploration!==undefined){
    if(modal==='islands')showIslands();
    else if(!modal)celebrate(`${ISLANDS[result.exploration].name}返港 · +${result.blueprints} 手稿`,'icon-charts','sale');
    save();
  }
}
function simulate(seconds:number){
  const manualUntil=state.manualUntil;
  const result=advance(state,seconds);
  processProduction(result,manualUntil!==null&&manualUntil<=state.time);
}
function frame(now:number){
  const elapsed=(now-lastFrame)/1000;lastFrame=now;
  if(!document.hidden&&!['voyage','reset','import-confirm','hex-choice'].includes(modal)){
    simulate(Math.min(elapsed,2));
    if(holding&&!modal&&now-lastHeld>=250){lastHeld=now;act('collect');}
    if(Date.now()-lastSave>=10000)save();
  }
  render();requestAnimationFrame(frame);
}
if(import.meta.env.DEV){
  Object.assign(globalThis,{__OHMYGAME_PLAYTEST__:{
    snapshot:()=>({state:structuredClone(state),rates:steadyRates(state),goal:goal(),tab,batch,panelOpen,modal,ready,scene:harbor.scene.getDiagnostics(),overflow:document.documentElement.scrollWidth>window.innerWidth}),
    reset:()=>{stopHolding();state=freshState();clearRewards();if(modal)closeModal();state.settings.muted=true;tab='workshop';batch=1;panelOpen=false;panelSignature='';save();render(true);lastFrame=performance.now();},
    setSeed:(seed:number)=>{state.seed=seed>>>0;save();},
    step:(milliseconds:number)=>{simulate(Math.max(0,milliseconds)/1000);save();render(true);lastFrame=performance.now();},
  }});
}
render(true);save();requestAnimationFrame(frame);
