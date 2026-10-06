import Phaser from 'phaser';
import { ART, BOARD_ART } from './assets';
import { BASE_MASK, DIRECTIONS, isRotatable, neighbor, rotateMask, turnsToMask } from './game/rules';
import geometry from './circuit-art-geometry.json';
import { SKINS } from './game/save';
import type { GameSession, Change } from './game/session';

const COLORS = { current: 0xffd663, core: 0xfff5b7, hint: 0x71e1e1, hover: 0xffffff, keyboard: 0xf5cf68 };

export class CircuitScene extends Phaser.Scene {
  private images: Phaser.GameObjects.Image[] = [];
  readonly bulbArt = new Map<string, string>([['sunlight', ART['tile-bulb-on']]]);
  private effects = new Set<Phaser.GameObjects.Image>();
  private joins!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private highlights!: Phaser.GameObjects.Graphics;
  private sparks: { image: Phaser.GameObjects.Image; points: { x: number; y: number }[]; lengths: number[]; totalLength: number; seed: number }[] = [];
  private positions: { x: number; y: number }[] = [];
  private cellSize = 0;
  private stride = 0;
  private hovered = -1;
  selected = 0;
  private lastLevel = -1;
  private lastSkin = '';
  private unsubscribe?: () => void;
  ready = false;

  constructor(
    private session: GameSession,
    private onReady: () => void,
    private onProgress: (amount: number) => void,
    private onError: (key: string) => void,
    private onTouch: () => void,
  ) { super('circuit'); }

  preload(): void {
    this.load.on('progress', this.onProgress);
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.onError(file.key));
    BOARD_ART.forEach((key) => this.load.image(key, ART[key]));
  }

  create(): void {
    this.prepareSkins();
    this.joins = this.add.graphics().setDepth(0);
    this.glow = this.add.graphics().setDepth(2);
    this.highlights = this.add.graphics().setDepth(4);
    this.scale.on('resize', () => this.build());
    this.unsubscribe = this.session.subscribe((change) => this.changed(change));
    this.events.once('shutdown', () => this.unsubscribe?.());
    this.ready = true;
    this.build();
    this.onReady();
  }

  private reduced(): boolean {
    return this.session.progress.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private prepareSkins(): void {
    const image = this.textures.get('tile-bulb-on').getSourceImage() as HTMLImageElement;
    for (const skin of SKINS.slice(1)) {
      const texture = this.textures.createCanvas(`bulb-${skin.id}`, 256, 256)!;
      const context = texture.context;
      context.drawImage(image, 0, 0, 256, 256);
      const data = context.getImageData(0, 0, 256, 256);
      const color = Phaser.Display.Color.HexStringToColor(skin.color);
      for (let index = 0; index < data.data.length; index += 4) {
        const [r, g, b] = [data.data[index], data.data[index + 1], data.data[index + 2]];
        if (index >= 216 * 256 * 4 || r < 160 || g < 95 || b > g * 0.86 || r < g * 0.9) continue;
        const bright = Math.max(r, g, b) / 255;
        data.data[index] = Math.round(color.red * bright);
        data.data[index + 1] = Math.round(color.green * bright);
        data.data[index + 2] = Math.round(color.blue * bright);
      }
      context.putImageData(data, 0, 0);
      texture.refresh();
      this.bulbArt.set(skin.id, texture.canvas.toDataURL('image/png'));
    }
  }

  private tileTexture(index: number): string {
    const tile = this.session.level.tiles[index];
    if (tile.kind === 'bulb') {
      if (!this.session.circuit.lit.has(index)) return 'tile-bulb-off';
      return this.session.progress.skin === 'sunlight' ? 'tile-bulb-on' : `bulb-${this.session.progress.skin}`;
    }
    return `tile-${tile.kind}`;
  }

  private build(): void {
    if (!this.ready) return;
    this.tweens.killAll();
    for (const effect of this.effects) effect.destroy();
    this.effects.clear();
    this.hovered = -1;
    for (const image of this.images) image.destroy();
    for (const spark of this.sparks) spark.image.destroy();
    this.images = [];
    this.sparks = [];
    const size = this.session.level.size;
    const available = Math.min(this.scale.width, this.scale.height);
    const gap = Math.max(3, Math.min(7, available * 0.012));
    this.cellSize = (available - gap * (size - 1) - 4) / size;
    this.stride = this.cellSize + gap;
    const left = (this.scale.width - (this.cellSize * size + gap * (size - 1))) / 2;
    const top = (this.scale.height - (this.cellSize * size + gap * (size - 1))) / 2;
    this.positions = this.session.level.tiles.map((_tile, index) => ({
      x: left + (index % size) * this.stride + this.cellSize / 2,
      y: top + Math.floor(index / size) * this.stride + this.cellSize / 2,
    }));
    this.session.level.tiles.forEach((tile, index) => {
      const at = this.positions[index];
      const image = this.add.image(at.x, at.y, this.tileTexture(index))
        .setDisplaySize(this.cellSize * geometry.displayScale, this.cellSize * geometry.displayScale)
        .setAngle((isRotatable(tile.kind) ? this.session.rotations[index] : tile.initial) * 90)
        .setDepth(1);
      if (tile.kind === 'empty') image.setAlpha(0.42).setAngle(0);
      if (tile.kind === 'obstacle') image.setAlpha(0.8).setAngle(0);
      image.setInteractive({ useHandCursor: isRotatable(tile.kind) });
      image.on('pointerover', () => { this.hovered = index; });
      image.on('pointerout', () => { if (this.hovered === index) this.hovered = -1; });
      image.on('pointerdown', () => {
        this.onTouch();
        this.selected = index;
        if (!this.session.active) return;
        if (!this.session.rotate(index) && tile.kind !== 'empty') {
          this.tweens.add({ targets: image, x: at.x + 2, duration: 45, yoyo: true, repeat: 1, onComplete: () => image.setX(at.x) });
        }
      });
      this.images.push(image);
    });
    if (this.lastLevel !== this.session.levelIndex) this.selected = this.session.level.tiles.findIndex((tile) => isRotatable(tile.kind));
    this.lastLevel = this.session.levelIndex;
    this.lastSkin = this.session.progress.skin;
    this.renderElectricity();
  }

  private changed(change: Change): void {
    if (!this.ready) return;
    if (change.type === 'load' || change.type === 'restart' || this.lastSkin !== this.session.progress.skin) {
      this.build();
      return;
    }
    if (change.cell !== undefined && (change.type === 'rotate' || change.type === 'undo')) {
      const image = this.images[change.cell];
      this.tweens.killTweensOf(image);
      const target = this.session.rotations[change.cell] * 90;
      const delta = change.type === 'undo' ? -((image.angle - target + 720) % 360) : (target - image.angle + 720) % 360;
      this.tweens.add({ targets: image, angle: image.angle + delta, duration: this.reduced() ? 0 : 160, ease: 'Cubic.Out' });
      if (!this.reduced()) this.flash(change.cell, 'fx-rotation', 0.9, 320);
      this.renderElectricity();
    }
    if (change.type === 'hint' && this.session.hint && !this.reduced()) {
      this.flash(this.session.hint.cell, 'fx-hint-ring', 1.15, 1500);
      this.flash(this.session.hint.bulb, 'fx-hint-ring', 1.15, 1500);
    }
    this.session.level.goals.forEach((index) => this.images[index]?.setTexture(this.tileTexture(index)));
    for (const index of change.newlyLit ?? []) {
      if (change.type !== 'win' && !this.reduced()) this.flash(index, 'fx-bulb-ignition', 1.14, 450);
    }
  }

  private flash(index: number, key: string, size: number, duration: number): void {
    const at = this.positions[index];
    if (!at) return;
    const effect = this.add.image(at.x, at.y, key).setDisplaySize(this.cellSize * size, this.cellSize * size).setDepth(5).setAlpha(0.65);
    this.effects.add(effect);
    this.tweens.add({ targets: effect, alpha: 0, scaleX: effect.scaleX * 1.15, scaleY: effect.scaleY * 1.15,
      duration, onComplete: () => { this.effects.delete(effect); effect.destroy(); } });
  }

  private connectedNeighbor(index: number, ordinal: number): number | null {
    const next = neighbor(index, ordinal, this.session.level.size);
    const direction = DIRECTIONS[ordinal];
    return next !== null && (this.session.circuit.masks[index] & direction.bit)
      && (this.session.circuit.masks[next] & direction.opposite) ? next : null;
  }

  private renderJoins(): void {
    this.joins.clear();
    const unit = this.cellSize * geometry.displayScale / geometry.textureSize;
    const face = (geometry.center - geometry.faceInset - 1) * unit;
    this.positions.forEach((at, index) => DIRECTIONS.forEach((direction, ordinal) => {
      const next = this.connectedNeighbor(index, ordinal);
      if (next === null || next < index) return;
      const other = this.positions[next];
      const ax = at.x + direction.dx * face, ay = at.y + direction.dy * face;
      const bx = other.x - direction.dx * face, by = other.y - direction.dy * face;
      this.joins.lineStyle(geometry.collarWidth * unit, 0x193047, 1).lineBetween(ax, ay, bx, by);
      this.joins.lineStyle((geometry.collarWidth - 4) * unit, 0xe0a25c, 1).lineBetween(ax, ay, bx, by);
    }));
  }

  private renderElectricity(): void {
    this.renderJoins();
    this.glow.clear();
    for (const spark of this.sparks) spark.image.destroy();
    this.sparks = [];
    const scale = this.cellSize;
    const unit = scale * geometry.displayScale / geometry.textureSize;
    const face = (geometry.center - geometry.faceInset) * unit;
    for (const index of this.session.circuit.powered) {
      const tile = this.session.level.tiles[index];
      const at = this.positions[index];
      const mask = this.session.circuit.masks[index];
      if (!at || tile.kind === 'bulb' || tile.kind === 'power') continue;
      const extent = (ordinal: number) => this.connectedNeighbor(index, ordinal) === null ? face : this.stride / 2;
      const paths: { x: number; y: number }[][] = [];
      if (tile.kind === 'elbow') {
        const radius = geometry.elbowRadius * unit;
        const rotation = this.session.rotations[index];
        const points = [{ x: extent((1 + rotation) % 4), y: 0 }, { x: radius, y: 0 }];
        for (let step = 1; step <= 24; step++) {
          const t = step / 24;
          points.push({ x: (1 - t) ** 2 * radius, y: t ** 2 * radius });
        }
        points.push({ x: 0, y: extent((2 + rotation) % 4) });
        const angle = rotation * Math.PI / 2;
        paths.push(points.map((point) => ({ x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle) })));
      } else {
        DIRECTIONS.forEach((direction, ordinal) => {
          if (mask & direction.bit) paths.push([{ x: 0, y: 0 }, { x: direction.dx * extent(ordinal), y: direction.dy * extent(ordinal) }]);
        });
      }
      for (const [ordinal, points] of paths.entries()) {
        for (const [width, color, alpha] of [[scale * 0.17, COLORS.current, 0.14], [scale * 0.065, COLORS.current, 0.64], [scale * 0.02, COLORS.core, 0.9]]) {
          this.glow.lineStyle(width, color, alpha);
          this.glow.beginPath();
          this.glow.moveTo(at.x + points[0].x, at.y + points[0].y);
          for (const point of points.slice(1)) this.glow.lineTo(at.x + point.x, at.y + point.y);
          this.glow.strokePath();
        }
        const absolute = points.map((point) => ({ x: at.x + point.x, y: at.y + point.y }));
        const lengths = absolute.slice(1).map((point, i) => Math.hypot(point.x - absolute[i].x, point.y - absolute[i].y));
        this.sparks.push({
          image: this.add.image(at.x, at.y, 'fx-current-particle').setDisplaySize(scale * 0.20, scale * 0.20).setDepth(3).setAlpha(0.9),
          points: absolute, lengths, totalLength: lengths.reduce((sum, length) => sum + length, 0),
          seed: index * 0.163 + ordinal * 0.29,
        });
      }
    }
  }

  private guide(): number | null {
    if (this.session.phase === 'won') return null;
    if (this.session.hint) return this.session.hint.cell;
    if (this.session.level.id > 3) return null;
    return this.session.level.tiles.findIndex((tile, index) => tile.required && isRotatable(tile.kind)
      && turnsToMask(tile.kind, this.session.rotations[index], rotateMask(BASE_MASK[tile.kind], tile.solution)) > 0);
  }

  update(time: number): void {
    if (!this.ready || this.session.screen !== 'game') return;
    const still = this.reduced();
    for (const spark of this.sparks) {
      const t = still ? 0.4 : ((time / 1100 + spark.seed) % 1);
      let distance = t * spark.totalLength;
      let segment = 0;
      while (segment < spark.lengths.length - 1 && distance > spark.lengths[segment]) distance -= spark.lengths[segment++];
      const local = distance / Math.max(0.001, spark.lengths[segment]);
      const start = spark.points[segment], end = spark.points[segment + 1];
      spark.image.setPosition(start.x + (end.x - start.x) * local, start.y + (end.y - start.y) * local);
      spark.image.setAlpha(still ? 0.5 : 0.6 + Math.sin(t * Math.PI) * 0.4);
    }
    this.highlights.clear();
    if (!this.session.active) return;
    const target = this.guide();
    const highlighted = new Set<number>();
    if (target !== null && target >= 0) highlighted.add(target);
    if (this.session.hint) highlighted.add(this.session.hint.bulb);
    for (const index of highlighted) {
      const at = this.positions[index];
      const alpha = still ? 0.9 : 0.6 + Math.sin(time / 340) * 0.25;
      const color = this.session.hint ? COLORS.hint : COLORS.keyboard;
      this.highlights.lineStyle(Math.max(2, this.cellSize * 0.025), color, alpha);
      this.highlights.strokeRoundedRect(at.x - this.cellSize / 2, at.y - this.cellSize / 2, this.cellSize, this.cellSize, 7);
    }
    if (this.hovered >= 0 && isRotatable(this.session.level.tiles[this.hovered].kind)) {
      const at = this.positions[this.hovered];
      this.highlights.lineStyle(2, COLORS.hover, 0.8).strokeRoundedRect(at.x - this.cellSize / 2, at.y - this.cellSize / 2, this.cellSize, this.cellSize, 7);
    }
    const host = document.getElementById('board-host');
    if (document.activeElement === host && this.positions[this.selected]) {
      const at = this.positions[this.selected];
      this.highlights.lineStyle(3, COLORS.keyboard, 1).strokeRoundedRect(at.x - this.cellSize / 2, at.y - this.cellSize / 2, this.cellSize, this.cellSize, 7);
    }
  }

  moveSelection(dx: number, dy: number): void {
    const size = this.session.level.size;
    const x = Phaser.Math.Clamp(this.selected % size + dx, 0, size - 1);
    const y = Phaser.Math.Clamp(Math.floor(this.selected / size) + dy, 0, size - 1);
    this.selected = y * size + x;
  }

  snapshotCells(): { index: number; type: string; rotation: number; powered: boolean; x: number; y: number; turnsToReference: number }[] {
    const rectangle = this.game.canvas.getBoundingClientRect();
    return this.session.level.tiles.map((tile, index) => {
      const at = this.positions[index] ?? { x: 0, y: 0 };
      return {
        index, type: tile.kind, rotation: this.session.rotations[index], powered: this.session.circuit.powered.has(index),
        x: Math.round(rectangle.left + at.x * rectangle.width / this.scale.width),
        y: Math.round(rectangle.top + at.y * rectangle.height / this.scale.height),
        turnsToReference: tile.required && isRotatable(tile.kind) ? turnsToMask(tile.kind, this.session.rotations[index], rotateMask(BASE_MASK[tile.kind], tile.solution)) : 0,
      };
    });
  }
}

export function startBoard(parent: HTMLElement, session: GameSession, callbacks: {
  ready: () => void; progress: (amount: number) => void; error: (key: string) => void; touch: () => void;
}): { game: Phaser.Game; scene: CircuitScene } {
  const scene = new CircuitScene(session, callbacks.ready, callbacks.progress, callbacks.error, callbacks.touch);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, transparent: true, width: parent.clientWidth, height: parent.clientHeight,
    // DOM sizing keeps hidden boards from allocating a zero-sized framebuffer.
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
    render: { antialias: true, roundPixels: false },
    input: { touch: { capture: true } },
    audio: { noAudio: true },
    scene: [scene],
    banner: false,
  });
  return { game, scene };
}
