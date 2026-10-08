export interface Point{x:number;y:number}
export interface HandFrame{uid:number;rect:DOMRect;clone:HTMLElement;retained:boolean}
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
let layer:HTMLDivElement;
function surface(){if(!layer){layer=document.createElement('div');layer.className='motion-layer';layer.setAttribute('aria-hidden','true');document.body.append(layer);}return layer;}
function animate(el:HTMLElement,frames:Keyframe[],duration:number,delay=0){const a=el.animate(frames,{duration,delay,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});return a.finished.catch(()=>{}).then(()=>a.cancel());}
export const center=(r:DOMRect):Point=>({x:r.x+r.width/2,y:r.y+r.height/2});
export function cloneCard(el:HTMLElement){const c=el.cloneNode(true) as HTMLElement;c.removeAttribute('data-action');c.removeAttribute('data-uid');c.removeAttribute('aria-label');c.classList.remove('selected','unplayable');c.classList.add('card-ghost');c.setAttribute('tabindex','-1');if(c instanceof HTMLButtonElement)c.disabled=true;
 for(const cls of ['card-text','card-name']){const original=el.querySelector<HTMLElement>(`.${cls}`),copy=c.querySelector<HTMLElement>(`.${cls}`);if(original&&copy){const style=getComputedStyle(original);copy.style.fontSize=style.fontSize;copy.style.lineHeight=style.lineHeight;}}
 return c;
}
export const motion={
 reduced:false,muted:false,context:undefined as AudioContext|undefined,consumed:new Set<number>(),kept:new Set<number>(),lastScreen:'',lastTurn:0,
 capture():HandFrame[]{return Array.from(document.querySelectorAll<HTMLElement>('.hand .card')).map(el=>({uid:Number(el.dataset.uid),rect:el.getBoundingClientRect(),clone:cloneCard(el),retained:!!el.querySelector('.retain-mark')||this.kept.has(Number(el.dataset.uid))}));},
 ghost(el:HTMLElement){const r=el.getBoundingClientRect(),c=cloneCard(el);Object.assign(c.style,{position:'fixed',left:`${r.x}px`,top:`${r.y}px`,width:`${r.width}px`,height:`${r.height}px`,margin:'0',transform:'none'});surface().append(c);return c;},
 async fly(el:HTMLElement,destination:Point,provided?:HTMLElement){const ghost=provided??this.ghost(el),r=ghost.getBoundingClientRect(),p=center(r);el.style.visibility='hidden';
  if(!this.reduced)await animate(ghost,[{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${(destination.x-p.x)*.45}px,${(destination.y-p.y)*.65}px) rotate(-5deg) scale(1.12)`,opacity:1,offset:.55},{transform:`translate(${destination.x-p.x}px,${destination.y-p.y}px) rotate(4deg) scale(.33)`,opacity:0}],260);
  ghost.remove();
 },
 async returnCard(ghost:HTMLElement,el?:HTMLElement){if(el&&!this.reduced){const from=center(ghost.getBoundingClientRect()),to=center(el.getBoundingClientRect());await animate(ghost,[{transform:'scale(1)',opacity:1},{transform:`translate(${to.x-from.x}px,${to.y-from.y}px) scale(.92)`,opacity:.6}],180);}ghost.remove();},
 hand(before:HandFrame[],turn:number,screen:string){const isNewTurn=screen==='battle'&&(this.lastScreen!=='battle'||turn!==this.lastTurn),old=new Map(before.map(c=>[c.uid,c]));this.lastTurn=turn;this.lastScreen=screen;
  if(this.reduced){this.consumed.clear();this.kept.clear();return 0;}
  const current=Array.from(document.querySelectorAll<HTMLElement>('.hand .card')),present=new Set(current.map(c=>Number(c.dataset.uid))),draw=document.querySelector<HTMLElement>('.draw-pile'),discard=document.querySelector<HTMLElement>('.discard-pile');let duration=0,index=0;
  for(const c of before)if((!present.has(c.uid)||isNewTurn&&!c.retained)&&!this.consumed.has(c.uid)&&screen==='battle'){
   const to=discard?center(discard.getBoundingClientRect()):{x:innerWidth-30,y:innerHeight-110};Object.assign(c.clone.style,{position:'fixed',left:`${c.rect.x}px`,top:`${c.rect.y}px`,width:`${c.rect.width}px`,height:`${c.rect.height}px`});surface().append(c.clone);const from=center(c.rect);
   void animate(c.clone,[{transform:'none',opacity:.85},{transform:`translate(${to.x-from.x}px,${to.y-from.y}px) rotate(22deg) scale(.18)`,opacity:0}],220).then(()=>c.clone.remove());
  }
  for(const el of current){const uid=Number(el.dataset.uid),prior=old.get(uid),r=el.getBoundingClientRect();if(!prior||isNewTurn&&!prior.retained){const p=draw?center(draw.getBoundingClientRect()):{x:30,y:innerHeight-110},end=center(r),delay=(before.length&&isNewTurn?170:0)+index++*55;
    void animate(el,[{transform:`translate(${p.x-end.x}px,${p.y-end.y}px) rotate(-24deg) scale(.18)`,opacity:0},{transform:'translate(0,-7px) rotate(1deg) scale(1.025)',opacity:1,offset:.82},{transform:'none',opacity:1}],330,delay);duration=Math.max(duration,delay+330);setTimeout(()=>this.sound('draw'),delay);
   }else{const dx=prior.rect.x-r.x;if(Math.abs(dx)>2)void animate(el,[{transform:`translateX(${dx}px)`},{transform:'none'}],170);}}
  this.consumed.clear();this.kept.clear();return duration;
 },
 pulse(selector:string,color='#78d6b6'){if(this.reduced)return;document.querySelectorAll<HTMLElement>(selector).forEach(el=>{void animate(el,[{filter:'brightness(1)',transform:'scale(1)'},{filter:'brightness(1.9)',transform:'scale(1.12)',color,offset:.3},{filter:'brightness(1)',transform:'scale(1)'}],420);});},
 pop(text:string,point:Point,color='#78d6b6'){const el=document.createElement('div');el.className='feedback-number';el.textContent=text;Object.assign(el.style,{left:`${point.x}px`,top:`${point.y}px`,color});surface().append(el);void animate(el,this.reduced?[{opacity:1,transform:'translate(-50%,0)'},{opacity:0,transform:'translate(-50%,0)'}]:[{transform:'translate(-50%,0) scale(.75)',opacity:0},{transform:'translate(-50%,-12px) scale(1.18)',opacity:1,offset:.18},{transform:'translate(-50%,-48px) scale(1)',opacity:0}],this.reduced?500:850).then(()=>el.remove());},
 banner(text:string,kind='victory'){const el=document.createElement('div');el.className=`battle-banner ${kind}`;el.textContent=text;surface().append(el);void animate(el,this.reduced?[{opacity:1,transform:'translate(-50%,-50%)'},{opacity:0,transform:'translate(-50%,-50%)'}]:[{opacity:0,transform:'translate(-50%,-50%) scale(.88)',letterSpacing:'.45em'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',letterSpacing:'.2em',offset:.22},{opacity:1,offset:.7},{opacity:0,transform:'translate(-50%,-60%) scale(1.04)'}],850).then(()=>el.remove());},
 burst(p:Point,color='#e7bc80',count=14){if(this.reduced)return;for(let i=0;i<count;i++){const spark=document.createElement('i');spark.className='motion-spark';Object.assign(spark.style,{left:`${p.x}px`,top:`${p.y}px`,background:color});surface().append(spark);const angle=Math.PI*2*i/count,distance=25+Math.random()*55;void animate(spark,[{transform:'scale(1.5)',opacity:1},{transform:`translate(${Math.cos(angle)*distance}px,${Math.sin(angle)*distance}px) scale(0)`,opacity:0}],420+Math.random()*150).then(()=>spark.remove());}},
 view(screen:string){if(this.reduced)return;if(['reward','forge','finish'].includes(screen))document.querySelectorAll<HTMLElement>('.choice-cards>.card,.choice-cards>div,.finish-screen .run-stats,.finish-screen .screen-actions').forEach((el,i)=>{void animate(el,[{opacity:0,transform:'translateY(25px) scale(.93)'},{opacity:1,transform:'none'}],420,i*90);});},
 sound(kind:string){if(this.muted)return;try{this.context??=new AudioContext();void this.context.resume();const ctx=this.context,t=ctx.currentTime;
   const note=(hz:number,start:number,length:number,volume:number,type:OscillatorType='sine')=>{const osc=ctx.createOscillator(),g=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(hz,t+start);if(kind==='hit')osc.frequency.exponentialRampToValueAtTime(55,t+start+length);g.gain.setValueAtTime(.0001,t+start);g.gain.exponentialRampToValueAtTime(volume,t+start+.008);g.gain.exponentialRampToValueAtTime(.0001,t+start+length);osc.connect(g);g.connect(ctx.destination);osc.start(t+start);osc.stop(t+start+length+.02);};
   if(kind==='win'||kind==='reward'){[392,523.25,659.25,783.99].forEach((hz,i)=>note(hz,i*.075,.42,.045,'triangle'));}
   else if(kind==='hit'){note(170,0,.13,.085,'triangle');note(880,0,.08,.02,'square');}
   else if(kind==='block'){note(520,0,.17,.04,'triangle');note(1040,.025,.2,.025);}
   else if(kind==='vent'){note(240,0,.3,.04,'sawtooth');note(480,.04,.25,.02);}
   else if(kind==='draw')note(760,0,.065,.016,'triangle');else if(kind==='select')note(480,0,.075,.02);else if(kind==='reject')note(110,0,.12,.035,'triangle');else if(kind==='heat'){note(440,0,.18,.035);note(660,.055,.2,.025);}else if(kind==='end')note(180,0,.2,.03,'triangle');else note(600,0,.14,.03);
  }catch{}},
 clear(){surface().replaceChildren();this.lastScreen='';this.lastTurn=0;this.consumed.clear();this.kept.clear();},
 wait
};
