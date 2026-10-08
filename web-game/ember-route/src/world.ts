import Phaser from 'phaser';
import { type Run, type Effect } from './engine';
import { ENEMIES } from './data';
import { motion } from './motion';
export interface ActorLayout { x:number; y:number; height:number; uid?:number }
export function positions(w:number,h:number,r?:Run){
 const narrow=w<650,floor=h*(narrow?.49:.57),hero={x:w*(narrow?.19:.23),y:floor,height:Math.min(h*(narrow?.28:.39),w*(narrow?.44:.28))},count=r?.battle?.enemies.length??1;
 const enemies=(r?.battle?.enemies??[]).map((e,i)=>({uid:e.uid,x:w*(count===1?.73:(narrow?.60:.65)+i*(narrow?.24:.18)),y:floor,height:Math.min(h*(e.id==='boss'?.43:e.id==='heavy'||e.id==='stoker'?.37:e.id==='whelp'||e.id==='crawler'?.23:.34),w*(count===1?.36:.25))}));return {hero,enemies};
}
class World extends Phaser.Scene {
 bg!:Phaser.GameObjects.Image;hero!:Phaser.GameObjects.Image;actors=new Map<number,Phaser.GameObjects.Image>();state?:Run;ready=false;reduced=false;lastSpark=0;
 constructor(){super('world');}
 preload(){for(const key of ['bridge','hero','sentinel','whelp','lantern','boss','ui-shield'])this.load.image(key,`${import.meta.env.BASE_URL}art/${key}.webp`);}
 create(){this.bg=this.add.image(0,0,'bridge').setOrigin(0);this.hero=this.add.image(0,0,'hero').setOrigin(.5,1).setVisible(false);this.ready=true;this.scale.on('resize',()=>this.layout());this.layout();window.dispatchEvent(new Event('world-ready'));}
 sync(r?:Run){this.state=r;if(!this.ready)return;const active=r?.screen==='battle';this.hero.setVisible(active).setAlpha(1).setRotation(0);
  const current=new Set(r?.battle?.enemies.map(e=>e.uid)??[]);for(const [uid,actor]of this.actors)if(!current.has(uid)){actor.destroy();this.actors.delete(uid);}
  if(active)for(const e of r!.battle!.enemies){let actor=this.actors.get(e.uid);if(!actor){actor=this.add.image(0,0,ENEMIES[e.id].art).setOrigin(.5,1);this.actors.set(e.uid,actor);}actor.setFlipX(ENEMIES[e.id].art==='sentinel');actor.setVisible(e.hp>0).setAlpha(1).setRotation(0).clearTint();}
  for(const [uid,actor]of this.actors)actor.setVisible(active&&!!r?.battle?.enemies.find(e=>e.uid===uid&&e.hp>0));this.layout();
 }
 layout(){if(!this.ready)return;const w=this.scale.width,h=this.scale.height,scale=Math.max(w/1672,h/941),p=positions(w,h,this.state);this.bg.setScale(scale).setPosition((w-1672*scale)/2,this.state?.screen==='battle'?p.hero.y-535*scale:(h-941*scale)/2);this.hero.setPosition(p.hero.x,p.hero.y).setScale(p.hero.height/this.hero.height);for(const e of p.enemies){const actor=this.actors.get(e.uid!);if(actor)actor.setPosition(e.x,e.y).setScale(e.height/actor.height);}}
 sparks(x:number,y:number,color:number,count=16){if(this.reduced)return;for(let i=0;i<count;i++){const a=i*Math.PI*2/count,p=this.add.circle(x,y,1.4+Math.random()*2.8,color,.95).setDepth(11);this.tweens.add({targets:p,x:x+Math.cos(a)*(25+Math.random()*65),y:y+Math.sin(a)*(25+Math.random()*65),alpha:0,scale:.1,duration:300+Math.random()*250,onComplete:()=>p.destroy()});}}
 hit(e:Effect,lane:number){const actor=e.target?this.actors.get(e.target):this.hero;if(!actor?.active||!actor.visible)return;const x=actor.x,y=actor.y-actor.displayHeight*.55,blocked=!e.value;
  if(!this.reduced){actor.setTint(blocked?0xb5f3de:0xffd49e);this.time.delayedCall(100,()=>actor.active&&actor.clearTint());this.tweens.add({targets:actor,x:x+(e.target?12:-8),duration:70,yoyo:true});this.sparks(x,y,blocked?0x78d6b6:e.target?0xe7bc80:0xd66a50);
   if(!blocked){const slash=this.add.graphics().setDepth(10);slash.lineStyle(4,0xf2d39b,.9);slash.lineBetween(x-32,y+34,x+32,y-34);slash.lineStyle(1,0xffffff,.9);slash.lineBetween(x-27,y+38,x+36,y-30);this.tweens.add({targets:slash,alpha:0,duration:170,onComplete:()=>slash.destroy()});this.cameras.main.shake(90,e.target?.0025:.0035);}}
  const text=this.add.text(x+(lane%3-1)*18,y-lane%3*12,blocked?'Blocked':`${e.value}`,{fontFamily:'Georgia, serif',fontSize:e.value&&e.value>=15?'39px':'31px',color:blocked?'#b7ffe1':e.target?'#ffdf9c':'#ff9b80',stroke:'#172427',strokeThickness:4}).setOrigin(.5).setDepth(20);
  this.tweens.add({targets:text,y:text.y-(this.reduced?8:55),scale:this.reduced?1:1.12,alpha:0,duration:740,onComplete:()=>text.destroy()});motion.sound(blocked?'block':'hit');
 }
 animate(effects:Effect[],dead:number[]){if(!this.ready)return 0;const hits=effects.filter(e=>e.kind==='hit');hits.forEach((e,i)=>this.time.delayedCall(this.reduced?0:i*85,()=>this.hit(e,i)));let duration=hits.length?(this.reduced?80:(hits.length-1)*85+260):0;
  for(const uid of dead){const actor=this.actors.get(uid);if(!actor?.visible)continue;const delay=this.reduced?0:Math.max(180,hits.length*85);this.time.delayedCall(delay,()=>{if(!actor.active)return;this.sparks(actor.x,actor.y-actor.displayHeight*.5,0xe7bc80,24);if(this.reduced)actor.setAlpha(0);else this.tweens.add({targets:actor,alpha:0,angle:7,scaleX:actor.scaleX*.86,scaleY:actor.scaleY*.86,y:actor.y+12,duration:390});});duration=Math.max(duration,delay+(this.reduced?80:420));}
  for(const e of effects)if(e.kind==='vent'){this.vent();duration=Math.max(duration,this.reduced?80:320);}return duration;
 }
 guard(value:number){if(!this.ready||!this.hero.visible)return;const x=this.hero.x,y=this.hero.y-this.hero.displayHeight*.5;const shield=this.add.image(x,y,'ui-shield').setDisplaySize(54,54).setAlpha(.8).setDepth(12);this.tweens.add({targets:shield,y:y-(this.reduced?0:18),alpha:0,scaleX:shield.scaleX*1.3,scaleY:shield.scaleY*1.3,duration:650,onComplete:()=>shield.destroy()});motion.pop(`+${value}`,{x:x+25,y},'#a9ead1');}
 heat(){if(!this.ready||!this.hero.visible||this.reduced)return;this.sparks(this.hero.x,this.hero.y-this.hero.displayHeight*.45,0x78d6b6,18);}
 vent(){if(!this.hero?.visible)return;for(let i=0;i<(this.reduced?2:16);i++){const mist=this.add.circle(this.hero.x+15,this.hero.y-this.hero.displayHeight*.5,4+Math.random()*8,0xb3f5de,.5).setDepth(10);this.tweens.add({targets:mist,x:mist.x+40+Math.random()*90,y:mist.y-20-Math.random()*70,alpha:0,scale:2,duration:550,onComplete:()=>mist.destroy()});}}
 playerMotion(){if(!this.ready||this.reduced||!this.hero.visible)return;this.tweens.add({targets:this.hero,x:this.hero.x+24,angle:3,duration:115,yoyo:true,ease:'Sine.easeInOut'});}
 enemyMotion(ids:number[]){if(!this.ready||this.reduced)return;ids.forEach((uid,i)=>{const actor=this.actors.get(uid);if(actor?.visible)this.tweens.add({targets:actor,x:actor.x-22,duration:115,delay:i*90,yoyo:true,ease:'Sine.easeInOut'});});}
 update(time:number){if(!this.ready||this.reduced||time-this.lastSpark<1000)return;this.lastSpark=time;const p=this.add.circle(Math.random()*this.scale.width,this.scale.height*.6,1.5,0x9be3be,.35);this.tweens.add({targets:p,y:p.y-80-Math.random()*90,x:p.x+20,alpha:0,duration:4000,onComplete:()=>p.destroy()});}
}
const scene=new World();
export const world={start(){return new Phaser.Game({type:Phaser.AUTO,parent:'world',transparent:false,backgroundColor:'#172427',scene:[scene],scale:{mode:Phaser.Scale.RESIZE,width:innerWidth,height:innerHeight},render:{antialias:true},audio:{noAudio:true}});},sync(r?:Run){scene.sync(r);},effects(e:Effect[],dead:number[]=[]){return scene.animate(e,dead);},playerMotion(){scene.playerMotion();},enemyMotion(ids:number[]){scene.enemyMotion(ids);},guard(n:number){scene.guard(n);},heat(){scene.heat();},reduced(value:boolean){scene.reduced=value;}};
