import Phaser from 'phaser';
import type { State, Production, Machine } from './economy';
import { GainQueue, gainNumber } from './feedback';
import type { Resource, Gain, GainSource } from './feedback';
import { cargoSize, tide } from './economy';
import { familyCounts } from './hexes';

export const ART = './art/';
export const SPRITES = ['dock','crane','press','warehouse','lighthouse','beacon','boat-empty','boat-loaded','barge','scrap-pile','parts-crate','buoy','hoist','bench','office','jetty','crates','flag','icon-scrap','icon-parts','icon-coins','icon-charts','icon-salvage','icon-press','icon-boat','icon-auto','icon-route','icon-light'];
interface SceneHooks {
  state: () => State;
  panel: () => boolean;
  blocked: () => boolean;
  resourceTarget: (resource: Resource) => { x: number; y: number };
  gain: (gain: Gain) => void;
  action: (action: 'collect' | 'craft' | 'dispatch' | 'office' | 'islands') => void;
  ready: () => void;
  error: (message: string) => void;
}
interface Floating { sprite: Phaser.GameObjects.Image; x: number; y: number; phase: number }
interface Popup { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; amount: number; born: number }
export type Celebration = 'sale' | 'captain' | 'region' | 'hex' | 'surge' | 'research' | 'voyage';
const GAIN_COLORS: Record<Resource, number> = { scrap: 0xeafbf5, parts: 0x91d9bf, coins: 0xe7bc5a, charts: 0xf8faf5 };
const ANCHORS = { scrap: [343, 249], parts: [692, 281], coins: [660, 552], charts: [850, 148] } as const;

export class HarborScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Container;
  private backdrop!: Phaser.GameObjects.Image;
  private wake!: Phaser.GameObjects.Graphics;
  private waves!: Phaser.GameObjects.Graphics;
  private route!: Phaser.GameObjects.Graphics;
  private floating: Floating[] = [];
  private boats: Phaser.GameObjects.Image[] = [];
  private explorer?: Phaser.GameObjects.Image;
  private gear?: Phaser.GameObjects.Image;
  private crane?: Phaser.GameObjects.Image;
  private press?: Phaser.GameObjects.Image;
  private bench?: Phaser.GameObjects.Image;
  private effectsLayer!: Phaser.GameObjects.Container;
  private energy!: Phaser.GameObjects.Graphics;
  private gains = new GainQueue();
  private popups = new Map<string, Popup>();
  private totals: Record<Resource, number> = { scrap: 0, parts: 0, coins: 0, charts: 0 };
  private gainBatches = 0;
  private lastCelebration = '';
  private flights = 0;
  private sparks = 0;
  private pulseTimes = new Map<Phaser.GameObjects.Image, number>();
  private signature = '';
  private decorTime = 0;
  private ready = false;
  private layoutScale = 1;
  private selected = 'hoist';
  private panelVisible = false;
  constructor(private hooks: SceneHooks) { super('harbor'); }
  preload() {
    this.load.image('sea', `${ART}sea.webp`);
    for (const key of SPRITES) this.load.image(key, `${ART}${key}.webp`);
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.hooks.error(`素材未能加载：${file.key}`));
  }
  create() {
    this.backdrop = this.add.image(0, 0, 'sea').setOrigin(0);
    this.waves = this.add.graphics();
    this.world = this.add.container(0, 0);
    this.rebuild();
    this.effectsLayer = this.add.container(0, 0).setDepth(10);
    this.scale.on('resize', () => this.fit());
    this.fit();
    this.ready = true;
    this.hooks.ready();
  }
  private fit() {
    if (!this.backdrop || !this.world) return;
    this.clearFeedback();
    const { width: w, height: h } = this.scale;
    const source = this.textures.get('sea').getSourceImage();
    const backgroundScale = Math.max(w / source.width, h / source.height);
    this.backdrop.setDisplaySize(source.width * backgroundScale, source.height * backgroundScale);
    this.backdrop.setPosition((w - this.backdrop.displayWidth) / 2, (h - this.backdrop.displayHeight) / 2);
    this.panelVisible = this.hooks.panel();
    const visibleWidth = this.panelVisible && w > 760 ? w - (w <= 1100 ? 342 : 360) : w;
    this.layoutScale = Math.min(visibleWidth / (w < 761 ? 920 : 1050), Math.max(110, h - 235) / 590);
    this.world.setScale(this.layoutScale);
    this.world.setPosition(visibleWidth / 2 - 550 * this.layoutScale, h / 2 + (w <= 760 ? -10 : 16) - 365 * this.layoutScale);
  }
  private scenePointer(pointer: Phaser.Input.Pointer) {
    if (this.hooks.blocked()) return false;
    const event = pointer.event as MouseEvent | TouchEvent;
    const contact = 'changedTouches' in event ? event.changedTouches[0] : event;
    const bounds = this.game.canvas.getBoundingClientRect();
    const x = contact?.clientX ?? bounds.left + pointer.x * bounds.width / this.scale.width;
    const y = contact?.clientY ?? bounds.top + pointer.y * bounds.height / this.scale.height;
    return document.elementFromPoint(x, y) === this.game.canvas;
  }
  private addSprite(key: string, x: number, y: number, size: number, action?: 'collect' | 'craft' | 'dispatch' | 'office') {
    const sprite = this.add.image(x, y, key).setOrigin(.5, 500 / 512).setDisplaySize(size, size);
    this.world.add(sprite);
    this.floating.push({ sprite, x, y, phase: x / 89 });
    if (action) {
      sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 100, useHandCursor: true });
      sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (!this.scenePointer(pointer)) return; this.selected = key; this.hooks.action(action); });
      sprite.on('pointerover', () => sprite.setTint(0xfff6dd));
      sprite.on('pointerout', () => sprite.clearTint());
    }
    return sprite;
  }
  private label(text: string, x: number, y: number) {
    const label = this.add.text(x, y, text, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif', fontSize: '15px',
      color: '#254a4d', backgroundColor: '#f5faf1', padding: { x: 11, y: 5 },
    }).setOrigin(.5).setAlpha(.93);
    this.world.add(label);
    return label;
  }
  private stateSignature(s:State) {
    return `${s.salvage}|${s.presses.length}|${s.ships.length}|${s.region}|${s.hexes.join(',')}|${Object.values(s.refits).join(',')}|${s.focus}|${s.runSales>=96}`;
  }
  private rebuild() {
    for (const child of this.world.list) this.tweens.killTweensOf(child);
    this.world.removeAll(true);
    this.pulseTimes.clear();
    this.floating = []; this.boats = [];
    const s = this.hooks.state();
    this.route = this.add.graphics(); this.world.add(this.route);
    this.energy = this.add.graphics(); this.world.add(this.energy);
    this.route.lineStyle(2, 0xd9f3e8, .42);
    for (let i = 0; i < 16; i++) {
      const x = 640 + i * 24;
      const y = 543 + i * 7;
      this.route.lineBetween(x, y, x + 11, y + 3);
    }
    this.addSprite('buoy', 240, 300, 54);
    this.addSprite('buoy', 835, 585, 55);
    this.addSprite('buoy', 940, 390, 48);
    this.addSprite('buoy', 315, 635, 50);
    this.addSprite('jetty', 405, 360, 190);
    this.addSprite('jetty', 603, 459, 205);
    this.addSprite('jetty', 415, 463, 203);
    this.addSprite('office', 526, 314, 223, 'office');
    if (s.region > 0) {
      this.addSprite('warehouse', 725, 335, 210);
      this.addSprite('jetty', 684, 407, 180);
    }
    if (s.region === 2) {
      this.addSprite('lighthouse', 850, 340, 263);
    } else {
      this.addSprite('flag', 850, 340, 120).setAlpha(.72);
    }
    this.crane = this.addSprite(s.salvage ? 'crane' : 'hoist', 343, 423, 277, 'collect');
    this.bench = this.addSprite('bench', 550, 468, 259, 'craft');
    this.press = this.bench;
    if (s.presses.length) {
      this.press = this.addSprite('press', 692, 451, 233, 'craft');
      this.gear = this.add.image(690, 296, 'icon-parts').setDisplaySize(28, 28).setOrigin(.5,.5);
      this.world.add(this.gear);
    } else this.gear = undefined;
    if (s.salvage >= 4) this.addSprite('crane', 257, 535, 209, 'collect');
    if (s.presses.length >= 4) this.addSprite('press', 745, 535, 202, 'craft');
    this.addSprite('dock', 552, 553, 198, 'dispatch');
    this.addSprite('crates', 563, 525, 80).setAlpha(s.parts > 0 || s.runSales > 0 ? 1 : .7);
    this.addSprite('flag', 480, 514, 63);
    this.addSprite('scrap-pile', 238, 411, 74, 'collect');
    if (s.salvage) this.label(`×${s.salvage}${s.refits.salvage?' · ◆'+s.refits.salvage:''}`, 340, 440);
    if (s.presses.length) this.label(`×${s.presses.length}${s.refits.press?' · ◆'+s.refits.press:''}`, 705, 455);
    if(s.refits.salvage)this.crane.setTint(0xfff3cc);
    if(s.refits.press)this.press.setTint(0xfff3cc);
    const resonance = familyCounts(s.hexes);
    if (resonance.salvage >= 2) this.addSprite('barge', 195, 505, 145, 'collect');
    if (resonance.industry >= 2) this.addSprite('parts-crate', 660, 543, 95);
    if (resonance.fleet >= 2) this.addSprite('beacon', 930, 473, 140);
    if (resonance.active >= 2) this.addSprite('buoy', 370, 600, 78);
    this.wake = this.add.graphics(); this.world.add(this.wake);
    for (let i = 0; i < Math.min(s.ships.length, 7); i++) {
      const boat = this.add.image(590 + i * 49, 582 - i * 20, 'boat-empty').setOrigin(.5, .5).setDisplaySize(173 - i * 4, 173 - i * 4);
      this.world.add(boat); this.boats.push(boat);
      boat.setInteractive({ pixelPerfect: true, useHandCursor: true });
      boat.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (this.scenePointer(pointer)) this.hooks.action('dispatch'); });
    }
    this.explorer=undefined;
    if(s.runSales>=96){
      this.explorer=this.add.image(195,590,'barge').setDisplaySize(165,165);
      this.world.add(this.explorer);
      this.explorer.setInteractive({pixelPerfect:true,useHandCursor:true});
      this.explorer.on('pointerdown',(pointer: Phaser.Input.Pointer)=>{if(this.scenePointer(pointer))this.hooks.action('islands');});
      this.label('Explore',195,646);
    }
    this.signature = this.stateSignature(s);
    this.fit();
  }
  update(_time: number, delta: number) {
    if (!this.ready) return;
    const s = this.hooks.state();
    if (this.panelVisible !== this.hooks.panel()) this.fit();
    const signature = this.stateSignature(s);
    if (signature !== this.signature) this.rebuild();
    if (!this.hooks.blocked()) for (const gain of this.gains.drain(performance.now())) this.showGain(gain);
    if (!s.settings.reducedMotion) this.decorTime += delta / 1000;
    const t = this.decorTime;
    this.energy.clear();
    if (s.surgeUntil > s.time) {
      this.energy.lineStyle(3, 0xf9db81, s.settings.reducedMotion ? .65 : .55 + Math.sin(t * 4) * .2);
      for (const [x, y] of [[343, 419], [550, 464], ...(s.presses.length ? [[692, 447]] : [])]) {
        this.energy.strokePoints([{ x: x - 90, y }, { x, y: y - 43 }, { x: x + 90, y }, { x, y: y + 43 }], true);
      }
    }
    for (const f of this.floating) f.sprite.setPosition(f.x, f.y + Math.sin(t * 1.5 + f.phase) * (s.settings.reducedMotion ? 0 : 1.2));
    if (this.gear && s.presses.some((v) => v !== null) && !s.settings.reducedMotion) this.gear.rotation += delta / 1000 * (s.surgeUntil > s.time ? 1.9 : .7);
    this.wake.clear();
    this.wake.lineStyle(2, 0xecfff4, .35);
    for (let i = 0; i < this.boats.length; i++) {
      const ship = s.ships[i];
      const boat = this.boats[i];
      const homeX = 580 + i * 33, homeY = 582 - i * 21;
      if (ship?.until !== null) {
        const p = Phaser.Math.Clamp((s.time - ship.departed) / (ship.until! - ship.departed), 0, 1);
        const distance = p < .5 ? p * 2 : (1 - p) * 2;
        boat.setPosition(homeX + distance * (190 - i * 10), homeY + distance * (75 + i * 8));
        boat.setTexture(p < .5 ? 'boat-loaded' : 'boat-empty').setFlipX(p >= .5);
        const sign = p < .5 ? -1 : 1;
        for (let j=1; j<5; j++) this.wake.lineBetween(boat.x + sign*j*17, boat.y+14+j*4, boat.x + sign*(j*17+9), boat.y+17+j*4);
      } else {
        boat.setTexture(s.parts >= cargoSize(s) ? 'boat-loaded' : 'boat-empty').setFlipX(false);
        boat.setPosition(homeX,homeY + Math.sin(t*1.3+i)* (s.settings.reducedMotion ? 0 : 2));
      }
    }
    if(this.explorer){
      const p=s.expedition?Phaser.Math.Clamp((s.time-s.expedition.departed)/(s.expedition.until-s.expedition.departed),0,1):0;
      this.explorer.setPosition(195-Math.sin(p*Math.PI)*55,590-Math.sin(p*Math.PI)*330).setFlipX(p>.5);
      if(s.expedition)this.explorer.setTint(0xffedbb);else this.explorer.clearTint();
    }
    this.waves.clear();
    if (!s.settings.reducedMotion) {
      const w = this.scale.width, h = this.scale.height;
      const phase = tide(s).index;
      this.waves.lineStyle(phase === 1 ? 2 : 1.3, phase === 1 ? 0xe2fff0 : 0xd7fcf4, phase === 1 ? .26 : .18);
      for (let i=0;i<23;i++) {
        const x=(i*137+t*(phase === 2 ? 20 : 8))%w;
        const y=(i*113+Math.sin(t*.35+i)*7)%h;
        this.waves.lineBetween(x,y,x+11,y-2);
        this.waves.lineBetween(x+15,y-2,x+24,y-1);
      }
    }
  }
  private screenPoint(x: number, y: number) {
    return { x: this.world.x + x * this.layoutScale, y: this.world.y + y * this.layoutScale };
  }
  clearFeedback() {
    this.gains.clear();
    if (!this.effectsLayer) return;
    for (const child of this.effectsLayer.list) {
      this.tweens.killTweensOf(child);
      if (child instanceof Phaser.GameObjects.Container) for (const nested of child.list) this.tweens.killTweensOf(nested);
    }
    this.effectsLayer.removeAll(true); this.popups.clear(); this.flights = 0; this.sparks = 0;
  }
  private pulse(sprite?: Phaser.GameObjects.Image) {
    if (!sprite || this.hooks.state().settings.reducedMotion) return;
    const now = performance.now();
    if (now - (this.pulseTimes.get(sprite) ?? -Infinity) < 220) return;
    this.pulseTimes.set(sprite, now);
    this.tweens.killTweensOf(sprite); sprite.setAngle(0);
    this.tweens.add({ targets: sprite, angle: sprite === this.crane ? -2.4 : 1.8, duration: 100, yoyo: true, ease: 'Sine.easeOut' });
  }
  private burst(x: number, y: number, color: number, count = 6, spread = 35) {
    if (this.hooks.state().settings.reducedMotion) return;
    for (let i = 0; i < count && this.sparks < 48; i++) {
      const angle = Math.PI * 2 * i / count - Math.PI / 2;
      const spark = this.add.rectangle(x, y, 3, 8, color).setRotation(angle);
      this.effectsLayer.add(spark); this.sparks++;
      spark.once('destroy', () => { this.sparks = Math.max(0, this.sparks - 1); });
      this.tweens.add({ targets: spark, x: x + Math.cos(angle) * spread, y: y + Math.sin(angle) * spread,
        alpha: 0, scale: .4, duration: 420, ease: 'Cubic.easeOut', onComplete: () => spark.destroy() });
    }
  }
  private popup(key: string, texture: string, text: string, point: { x: number; y: number }, color: string, amount = 0) {
    const previous = this.popups.get(key);
    const now = performance.now();
    if (previous && now - previous.born < 650 && amount > 0) {
      previous.amount += amount; previous.label.setText(`+${gainNumber(previous.amount)}`);
      return;
    }
    if (previous) { this.tweens.killTweensOf(previous.container); previous.container.destroy(); }
    const glyph = this.add.image(0, 0, texture).setDisplaySize(28, 28);
    const label = this.add.text(20, 0, text, {
      fontFamily: '"Avenir Next", "PingFang SC", sans-serif', fontSize: '23px', fontStyle: 'bold',
      color, stroke: '#245c63', strokeThickness: 4, shadow: { offsetY: 2, color: '#245c63', blur: 0, fill: true },
    }).setOrigin(0, .5);
    const width = 34 + label.width;
    const left = Phaser.Math.Clamp(point.x - width / 2 + 13, 22, Math.max(22, this.scale.width - width + 6));
    const container = this.add.container(left, Phaser.Math.Clamp(point.y, 181, this.scale.height - 185), [glyph, label]);
    this.effectsLayer.add(container);
    this.popups.set(key, { container, label, amount, born: now });
    container.once('destroy', () => { if (this.popups.get(key)?.container === container) this.popups.delete(key); });
    if (this.hooks.state().settings.reducedMotion) {
      this.time.delayedCall(950, () => { if (container.scene) container.destroy(); });
    } else {
      container.setScale(.72);
      this.tweens.add({ targets: container, scale: 1, duration: 180, ease: 'Back.easeOut' });
      this.tweens.add({ targets: container, y: container.y - 38, duration: 1150, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: container, alpha: 0, delay: 780, duration: 360, onComplete: () => container.destroy() });
    }
  }
  private fly(resource: Resource, point: { x: number; y: number }, count = 1) {
    if (this.hooks.state().settings.reducedMotion) return;
    const target = this.hooks.resourceTarget(resource);
    for (let i = 0; i < count && this.flights < 12; i++) {
      const start = { x: point.x + (i - (count - 1) / 2) * 17, y: point.y + 17 };
      const item = this.add.image(start.x, start.y, `icon-${resource}`).setDisplaySize(22, 22);
      this.effectsLayer.add(item); this.flights++;
      item.once('destroy', () => { this.flights = Math.max(0, this.flights - 1); });
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(start.x, start.y),
        new Phaser.Math.Vector2((start.x + target.x) / 2 + 40, Math.min(start.y, target.y) - 35),
        new Phaser.Math.Vector2(target.x, target.y));
      this.tweens.add({ targets: item, delay: 170 + i * 65, duration: 650, ease: 'Cubic.easeIn',
        scaleX: item.scaleX * .65, scaleY: item.scaleY * .65,
        onUpdate: (tween) => { const p = curve.getPoint(tween.progress); item.setPosition(p.x, p.y); },
        onComplete: () => item.destroy() });
    }
  }
  private showGain(gain: Gain) {
    const { resource, amount, source } = gain;
    const anchor = resource === 'parts' && (source === 'manual' || !this.hooks.state().presses.length) ? [550, 323] : ANCHORS[resource];
    const point = this.screenPoint(anchor[0], anchor[1]);
    this.popup(resource, `icon-${resource}`, `+${gainNumber(amount)}`, point, resource === 'coins' ? '#fff0aa' : '#f5fff8', amount);
    this.totals[resource] += amount; this.gainBatches++;
    this.burst(point.x, point.y + 15, GAIN_COLORS[resource], resource === 'coins' ? 8 : 4, resource === 'coins' ? 39 : 24);
    this.fly(resource, point, resource === 'coins' ? Math.min(3, Math.max(1, Math.ceil(amount / 32))) : 1);
    if (resource === 'scrap') this.pulse(this.crane);
    if (resource === 'parts') this.pulse(source === 'manual' ? this.bench : this.press);
    this.hooks.gain(gain);
  }
  feedback(resource: Resource, amount: number, source: GainSource = 'manual') {
    if (!this.ready || this.hooks.blocked()) return;
    this.gains.add(resource, amount, source);
  }
  production(result: Production, manual = false) {
    if (!this.ready || this.hooks.blocked()) return;
    this.gains.production(result, manual);
  }
  work(kind: 'craft' | 'dispatch') {
    if (!this.ready) return;
    const point = this.screenPoint(kind === 'craft' ? 550 : 585, kind === 'craft' ? 355 : 543);
    this.burst(point.x, point.y, kind === 'craft' ? 0x91d9bf : 0xf5fff8);
    this.pulse(kind === 'craft' ? this.bench : this.boats[0]);
  }
  built(kind: Machine, amount: number) {
    if (!this.ready) return;
    this.rebuild();
    const [x, y] = kind === 'salvage' ? [343, 235] : kind === 'press' ? [692, 255] : [660, 520];
    const point = this.screenPoint(x, y);
    this.popup('build', kind === 'salvage' ? 'icon-salvage' : kind === 'press' ? 'icon-press' : 'icon-boat', amount>0?`+${amount}`:'×2', point, '#fff0aa');
    this.burst(point.x, point.y + 25, 0xe7bc5a, 14, 58);
    this.pulse(kind === 'salvage' ? this.crane : kind === 'press' ? this.press : this.boats[0]);
  }
  celebrate(kind: Celebration) {
    if (!this.ready) return;
    this.lastCelebration = kind;
    if (kind === 'region' || kind === 'hex') this.rebuild();
    const anchor = kind === 'surge' ? [343, 310] : kind === 'region' || kind === 'voyage' ? [850, 160] : kind === 'hex' || kind === 'research' ? [526, 200] : [660, 523];
    const point = this.screenPoint(anchor[0], anchor[1]);
    this.burst(point.x, point.y, kind === 'surge' ? 0xe7bc5a : 0xf7edb8, 22, 84);
    if (kind === 'surge') { this.pulse(this.crane); this.pulse(this.press); }
  }
  arrival() { this.celebrate('hex'); }
  getDiagnostics() {
    return { ready: this.ready, boats: this.boats.length, sprites: this.floating.length, scale: this.layoutScale, selected: this.selected,
      loaded: SPRITES.every((key) => this.textures.exists(key)), canvas: { width: this.scale.width, height: this.scale.height },
      feedback: { totals: { ...this.totals }, batches: this.gainBatches, pending: this.gains.snapshot(), flights: this.flights, sparks: this.sparks,
        lastCelebration: this.lastCelebration, popups: [...this.popups.entries()].map(([resource, popup]) => ({ resource, amount: popup.amount, text: popup.label.text,
          fontSize: popup.label.style.fontSize, x: popup.container.x, y: popup.container.y, width: popup.container.getBounds().width })) } };
  }
}
export function createHarbor(parent: HTMLElement, hooks: SceneHooks) {
  const scene = new HarborScene(hooks);
  const game = new Phaser.Game({
    type:Phaser.AUTO, parent, transparent:true, antialias:true, banner:false,
    scale:{mode:Phaser.Scale.RESIZE,width:parent.clientWidth,height:parent.clientHeight},
    scene:[scene], audio:{noAudio:true}, render:{roundPixels:false},
    fps:{target:60},
  });
  const observer = new ResizeObserver(() => game.scale.resize(Math.max(1,parent.clientWidth),Math.max(1,parent.clientHeight)));
  observer.observe(parent);
  return {scene,game,destroy:()=>{observer.disconnect();game.destroy(true);}};
}
