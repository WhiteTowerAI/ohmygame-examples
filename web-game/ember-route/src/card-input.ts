import { motion, center, type Point } from './motion';
interface InputOptions{
 root:HTMLElement;blocked:()=>boolean;selected:()=>number|undefined;
 card:(uid:number)=>{target:boolean;kind:string;reason?:string}|undefined;
 select:(uid:number)=>void;play:(uid:number,target?:number,ghost?:HTMLElement)=>void;cancel:()=>void;reject:(message:string)=>void;
}
export function cardInput(o:InputOptions){
 let state:{uid:number;pointer:number;start:Point;point:Point;touch:boolean;active:boolean;keyboard:boolean;source:HTMLElement;ghost?:HTMLElement;svg?:SVGSVGElement;hover?:number;valid:boolean}|undefined;
 let suppressedUntil=0;
 const source=(uid:number)=>o.root.querySelector<HTMLElement>(`.hand .card[data-uid="${uid}"]`);
 function removeHighlights(){o.root.querySelectorAll('.drop-ready,.drag-source').forEach(el=>el.classList.remove('drop-ready','drag-source'));document.body.classList.remove('dragging-card');}
 function begin(){if(!state)return false;const c=o.card(state.uid);if(!c||c.reason){o.reject(c?.reason??'Cannot play this card.');state=undefined;return false;}
  state.active=true;state.ghost=motion.ghost(state.source);state.ghost.classList.add('drag-card');
  state.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');state.svg.classList.add('aim-line');state.svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);state.svg.setAttribute('aria-hidden','true');
  state.svg.innerHTML='<defs><marker id="aim-tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs><path class="aim-path" fill="none" stroke="currentColor" stroke-width="3" marker-end="url(#aim-tip)"/>';
  document.body.append(state.svg);o.select(state.uid);source(state.uid)?.classList.add('drag-source');document.body.classList.add('dragging-card');update(state.point);return true;
 }
 function update(p:Point){if(!state?.active||!state.ghost)return;state.point=p;state.hover=undefined;state.valid=false;removeHighlights();document.body.classList.add('dragging-card');source(state.uid)?.classList.add('drag-source');
  const c=o.card(state.uid);if(!c)return;const ghost=state.ghost,r=ghost.getBoundingClientRect();ghost.style.left=`${p.x-r.width/2}px`;ghost.style.top=`${p.y-r.height*.7}px`;
  let endpoint=p;
  const enemies=Array.from(o.root.querySelectorAll<HTMLElement>('.enemy-target'));
  if(c.target){const el=enemies.find(el=>{const b=el.getBoundingClientRect();return p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom;});if(el){state.hover=Number(el.dataset.action!.split(':')[1]);state.valid=true;el.classList.add('drop-ready');endpoint=center(el.getBoundingClientRect());}}
  else {const handTop=o.root.querySelector('.hand-area')?.getBoundingClientRect().top??innerHeight*.6;state.valid=p.y>58&&p.y<handTop-10&&p.x>0&&p.x<innerWidth;
   if(state.valid){if(c.kind==='攻击')enemies.forEach(el=>el.classList.add('drop-ready'));else o.root.querySelector('.hero-target')?.classList.add('drop-ready');}}
  ghost.classList.toggle('valid-drop',state.valid);if(state.svg){state.svg.style.color=state.valid?'#9ae7c1':'#b98249';const from=center((source(state.uid)??state.source).getBoundingClientRect()),path=state.svg.querySelector('path.aim-path')!;path.setAttribute('d',`M ${from.x} ${from.y} Q ${(from.x+endpoint.x)/2} ${Math.min(from.y,endpoint.y)-110} ${endpoint.x} ${endpoint.y}`);}
 }
 function finish(commit:boolean,quiet=false){if(!state)return;const s=state;state=undefined;removeHighlights();s.svg?.remove();if(o.root.hasPointerCapture(s.pointer))o.root.releasePointerCapture(s.pointer);
  if(!s.active)return;suppressedUntil=performance.now()+350;
  if(commit&&s.valid&&!o.blocked()){o.play(s.uid,s.hover,s.ghost);}else{void motion.returnCard(s.ghost!,source(s.uid)??undefined);o.cancel();if(commit&&!quiet)o.reject(o.card(s.uid)?.target?'Drag onto an enemy.':'Drag into the battlefield.');}
 }
 o.root.addEventListener('pointerdown',ev=>{if(state?.active){finish(false,true);return;}if(o.blocked()||ev.button!==0)return;const el=(ev.target as HTMLElement).closest<HTMLElement>('.hand .card');if(!el)return;
  state={uid:Number(el.dataset.uid),pointer:ev.pointerId,start:{x:ev.clientX,y:ev.clientY},point:{x:ev.clientX,y:ev.clientY},touch:ev.pointerType==='touch',active:false,keyboard:false,source:el,valid:false};
 });
 window.addEventListener('pointermove',ev=>{if(!state||state.keyboard||ev.pointerId!==state.pointer)return;const dx=ev.clientX-state.start.x,dy=ev.clientY-state.start.y;
  if(!state.active){if(Math.hypot(dx,dy)<10)return;if(state.touch&&Math.abs(dx)>Math.abs(dy)*1.2)return;if(!begin())return;o.root.setPointerCapture(ev.pointerId);}
  if(ev.cancelable)ev.preventDefault();update({x:ev.clientX,y:ev.clientY});
 },{passive:false});
 window.addEventListener('pointerup',ev=>{if(state&&!state.keyboard&&ev.pointerId===state.pointer)finish(true);});
 window.addEventListener('pointercancel',ev=>{if(state&&ev.pointerId===state.pointer)finish(false,true);});
 window.addEventListener('blur',()=>finish(false,true));window.addEventListener('resize',()=>finish(false,true));
 window.addEventListener('click',ev=>{if(performance.now()<suppressedUntil){ev.preventDefault();ev.stopImmediatePropagation();}},true);
 window.addEventListener('keydown',ev=>{
  if(ev.repeat&&(ev.code==='Space'||ev.key==='Enter'))return;
  if(ev.key==='Escape'&&state?.active){ev.preventDefault();finish(false,true);return;}
  if(state?.keyboard&&state.active){if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key)){ev.preventDefault();update({x:Math.max(1,Math.min(innerWidth-1,state.point.x+(ev.key==='ArrowRight'?56:ev.key==='ArrowLeft'?-56:0))),y:Math.max(60,Math.min(innerHeight-1,state.point.y+(ev.key==='ArrowDown'?56:ev.key==='ArrowUp'?-56:0)))});}else if(ev.key==='Enter'||ev.code==='Space'){ev.preventDefault();finish(true);}return;}
  if(ev.code!=='Space'||o.blocked())return;const uid=o.selected()??Number((document.activeElement as HTMLElement)?.closest<HTMLElement>('.hand .card')?.dataset.uid);if(!Number.isFinite(uid))return;const el=source(uid!);if(!el)return;ev.preventDefault();const p=center(el.getBoundingClientRect());state={uid:uid!,pointer:-1,start:p,point:p,touch:false,active:false,keyboard:true,source:el,valid:false};begin();
 });
 return {cancel:()=>finish(false,true),get dragging(){return !!state?.active;},get snapshot(){return state?.active?{uid:state.uid,valid:state.valid,target:state.hover,keyboard:state.keyboard,point:state.point}:undefined;}};
}
