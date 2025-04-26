import { LEVELS } from './levels';
import { TILES, TileTraits } from './tiles';

const MOVESPEED = 3; // tiles per second
const LIGHTPOS = [0, 32, 64, 32, 32, 0, 32, 64];
const EXIT = TILES[4];
const PLAYER = TILES[19];

class Tile {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  tex: number;
  traits: TileTraits;
  offsetX: number;
  offsetY: number;
  dx: number;
  dy: number;
  resting: boolean;

  constructor(tex: number, traits: TileTraits, x: number, y: number) {
    this.x = x;
    this.y = y;
    this.worldX = x * 64;
    this.worldY = y * 64;
    this.traits = traits;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dx = 0;
    this.dy = 0;
    this.tex = tex;
    this.resting = true;
  }

  move(dx: number, dy: number, world: World): void {
    if (!world.get(this.x + dx, this.y + dy)) {
      return;
    }
    this.dx = dx;
    this.dy = dy;
    this.resting = dx * dx + dy * dy < 0.001;
  }

  update(dt: number, world: World): void {
    if (this.resting) {
      return;
    }

    this.offsetX = Math.min(1, this.offsetX + MOVESPEED * dt);
    this.offsetY = Math.min(1, this.offsetY + MOVESPEED * dt);
    this.worldX = (this.x + this.dx * this.offsetX) * 64;
    this.worldY = (this.y + this.dy * this.offsetY) * 64;
    if (this.offsetX >= 1 || this.offsetY >= 1) {
      this._endMove(world);
      this.resting = true;
      this.offsetX = this.offsetY = 0;
      this.dx = this.dy = 0;
    }
  }

  _endMove(world: World): void {
    world.set(this.x, this.y, new Tile(world.floorTex, TILES[0], this.x, this.y));
    this.x += this.dx;
    this.y += this.dy;
    const target = world.get(this.x, this.y).traits;
    const combined = target.combiner(this.traits, target);
    const tile =
      combined !== this.traits
        ? new Tile(combined.tex[world.level % combined.tex.length], combined, this.x, this.y)
        : this;
    if (tile !== this) {
      world.onColorCombine(this.worldX, this.worldY);
    }
    world.set(this.x, this.y, tile);
  }
}

class Player extends Tile {
  _endMove(world: World): void {
    this.x += this.dx;
    this.y += this.dy;
    if (world.get(this.x, this.y).traits === EXIT) {
      world.onExit();
    }
  }
}

export interface Snapshot {
  map: [number, TileTraits, number, number][];
  x: number;
  y: number;
}

export class World {
  map: Tile[];
  lights: number[][];
  level: number;
  onExit: () => void;
  onColorCombine: (x: number, y: number) => void;
  onActivatePlate: () => void;
  snapshots: Snapshot[];
  floorTex: number;
  player: Player;
  width: number;
  height: number;

  constructor(
    level: number,
    onExit: () => void,
    onColorCombine: (x: number, y: number) => void,
    onActivatePlate: () => void
  ) {
    const MAPPING = ' #.*XRGBYCMWrgbycmwP';
    this.map = [];
    this.lights = [];
    this.snapshots = [];

    const lines = LEVELS[level].split(/\n/).filter((line) => line.length > 0);
    this.height = lines.length;
    this.width = lines.reduce((val, line) => Math.max(val, line.length), 0);
    let player: Player | undefined;

    lines.forEach((line, y) => {
      for (let x = 0; x < this.width; ++x) {
        let t = line.charAt(x) || '.';

        const lightOfs = '<>^v'.indexOf(t) * 2;
        if (lightOfs >= 0) {
          this.lights.push([x * 64 + LIGHTPOS[lightOfs], y * 64 + LIGHTPOS[lightOfs + 1]]);
          t = ' ';
        }

        if (t === 'P') {
          player = new Player(PLAYER.tex[0], PLAYER, x, y);
          t = ' ';
        }

        const traits = TILES[MAPPING.indexOf(t)];
        const tile = new Tile(traits.tex[level % traits.tex.length], traits, x, y);
        this.set(x, y, tile);
      }
    });

    if (!player) {
      throw new Error('Player not found in level');
    }

    this.player = player;
    this.level = level;
    this.onExit = onExit;
    this.onColorCombine = onColorCombine;
    this.onActivatePlate = onActivatePlate;

    this.floorTex = TILES[0].tex[level % TILES[0].tex.length];
  }

  snapshot(): void {
    this.snapshots.push({
      map: this.map.map((t) => [t.tex, t.traits, t.x, t.y]),
      x: this.player.x,
      y: this.player.y,
    });
  }

  rewind(): void {
    const snap = this.snapshots.pop() as Snapshot;
    snap.map.forEach((t, i) => (this.map[i] = new Tile(...t)));
    this.player = new Player(PLAYER.tex[0], PLAYER, snap.x, snap.y);
  }

  update(dt: number): void {
    for (let i = 0; i < this.map.length; ++i) {
      this.map[i].update(dt, this);
    }
    this.player.update(dt, this);
  }

  get(x: number, y: number): Tile {
    return this.map[y * this.width + x];
  }

  set(x: number, y: number, tile: Tile): void {
    this.map[y * this.width + x] = tile;
  }

  movePlayer(dx: number, dy: number): void {
    const tile = this.get(this.player.x + dx, this.player.y + dy);
    if (tile.traits.walk()) {
      this.player.move(dx, dy, this);
    } else if (tile.traits.push()) {
      const target = this.get(tile.x + dx, tile.y + dy);
      if (target?.traits.combine(tile.traits, target.traits)) {
        this.snapshot();
        this.player.move(dx, dy, this);
        tile.move(dx, dy, this);
      }
    }
  }
}
