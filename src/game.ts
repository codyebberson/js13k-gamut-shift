import { Camera, createCamera } from './camera';
import { LEVELS } from './levels';
import renderer from './renderer';
import { World } from './world';

const MOVEDIRS = [
  [0, 0],
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

export interface GameState {
  start: (...args: number[]) => void;
  step: (dt: number) => void;
}

export class Game {
  level = 1;
  time = 0;
  world?: World;
  camera?: Camera;
  renderer = renderer;
  audio: Record<string, () => void> = {};
  keyState = {
    down: false,
    up: false,
    right: false,
    left: false,
  };
  state?: GameState;
  snapshots = [];

  switchState(state: GameState, ...args: number[]): void {
    state.start(...args);
    game.state = state;
  }

  start(): void {
    try {
      game.level = Number.parseInt(window.localStorage.getItem('GamutShift-save') || '1');
    } catch (e) {}
    game.loadLevel();
    game.audio.music();
  }

  loadLevel(level = game.level): void {
    game.snapshots = [];
    game.level = level;
    game.world = new World(level, game.onExit, game.onColorCombine, game.onActivatePlate);
    game.camera = createCamera(game.world);
    game.renderer.reset(game.world);
    game.switchState(game.states.enter);
    try {
      window.localStorage.setItem('GamutShift-save', level.toString());
    } catch (e) {}
  }

  nextLevel(): void {
    game.loadLevel((game.level + 1) % LEVELS.length);
  }

  onExit(): void {
    game.switchState(game.states.leave);
  }

  onColorCombine(x: number, y: number): void {
    game.switchState(game.states.combine, x, y);
  }

  onActivatePlate(): void {
    0;
  }

  rewind(): void {
    if (game.world?.snapshots.length === 0 || game.state !== game.states.play) {
      game.audio.norewind();
      return;
    }
    game.switchState(game.states.rewind);
  }

  _movePlayer(_dt: number): void {
    const moveDir = game.keyState.down
      ? 1
      : game.keyState.up
        ? 2
        : game.keyState.right
          ? 3
          : game.keyState.left
            ? 4
            : 0;

    if (game.world?.player.resting) {
      game.world.movePlayer(MOVEDIRS[moveDir][0], MOVEDIRS[moveDir][1]);
    }
  }

  states = {
    enter: (() => {
      let time = 0;

      return {
        start: (): void => {
          time = 0;
          game.audio.enter();
        },

        step: (dt: number): void => {
          const world = game.world as World;
          const camera = game.camera as Camera;
          time = Math.min(1, time + dt * 0.75);
          world.update(dt);
          renderer.render(world, camera, 'transition', { time });
          if (time >= 1) {
            game.switchState(game.states.play);
          }
        },
      };
    })(),

    leave: (() => {
      let time = 1;

      return {
        start: (): void => {
          time = 1;
          game.audio.exit();
        },

        step: (dt: number): void => {
          const world = game.world as World;
          const camera = game.camera as Camera;
          time = Math.max(0, time - dt);
          world.update(dt);
          renderer.render(world, camera, 'transition', { time });
          if (time <= 0) {
            game.nextLevel();
          }
        },
      };
    })(),

    play: (() => {
      return {
        start: (): number => 0,

        step: (dt: number): void => {
          const world = game.world as World;
          const camera = game.camera as Camera;
          game._movePlayer(dt);
          game.world?.update(dt);
          game.camera?.update(dt);
          renderer.render(world, camera, 'screen');
        },
      };
    })(),

    combine: (() => {
      let time = 0;
      let x = 0;
      let y = 0;
      return {
        start: (px: number, py: number): void => {
          x = px;
          y = py;
          time = 0;
          game.audio.combine();
        },

        step: (dt: number): void => {
          const world = game.world as World;
          const camera = game.camera as Camera;
          time = Math.min(1, time + dt * (1 + time) * 0.5);
          game._movePlayer(dt);
          world.update(dt);
          camera.update(dt);
          renderer.render(world, camera, 'ripple', { x, y, time });
          if (time >= 1) {
            game.switchState(game.states.play);
          }
        },
      };
    })(),

    rewind: (() => {
      let time = 0;
      let rewound = false;
      return {
        start: (): void => {
          time = 0;
          rewound = false;
          game.audio.rewind();
        },

        step: (dt: number): void => {
          const world = game.world as World;
          const camera = game.camera as Camera;
          time = Math.min(1, time + dt * 1.5);
          if (!rewound && time >= 0.5) {
            rewound = true;
            world.rewind();
          }
          camera.update(dt);
          renderer.render(world, camera, 'rewind', { time });
          if (time >= 1) {
            game.switchState(game.states.play);
          }
        },
      };
    })(),
  };
}

export const game = new Game();
