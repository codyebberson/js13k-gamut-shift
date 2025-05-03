import { genAudio } from './audio/audio';
import { game } from './game';
import { setTileTextures } from './renderer';
import { genTextures } from './tex/texgen';

let focus = true;

const frame = (t: number): void => {
  const dt = Math.min(1000 / 30, t - game.time) * 0.001;

  game.time = t;
  game.state?.step(dt);

  if (focus) {
    requestAnimationFrame(frame);
  }
};

export interface KeyBinding {
  keys: string[];
  down: () => void;
  up: () => void;
}

const addEventListeners = (): void => {
  const BINDINGS = {
    down: {
      keys: ['ArrowDown', 'KeyS'],
      down: (): boolean => (game.keyState.down = true),
      up: (): boolean => (game.keyState.down = false),
    },
    up: {
      keys: ['ArrowUp', 'KeyW'],
      down: (): boolean => (game.keyState.up = true),
      up: (): boolean => (game.keyState.up = false),
    },
    left: {
      keys: ['ArrowLeft', 'KeyA'],
      down: (): boolean => (game.keyState.left = true),
      up: (): boolean => (game.keyState.left = false),
    },
    right: {
      keys: ['ArrowRight', 'KeyD'],
      down: (): boolean => (game.keyState.right = true),
      up: (): boolean => (game.keyState.right = false),
    },
    rewind: {
      keys: ['Space'],
      down: (): void => game.rewind(),
      up: (): number => 0,
    },
    reset: {
      keys: ['r'],
      down: (): void => game.loadLevel(),
      up: (): number => 0,
    },
    next: {
      keys: ['n'],
      down: (): void => game.nextLevel(),
      up: (): number => 0,
    },
  };

  window.addEventListener('blur', () => {
    focus = false;
  });

  window.addEventListener('focus', () => {
    if (!focus) {
      requestAnimationFrame(frame);
    }
    focus = true;
  });

  const checkKeyDown = (code: string, repeat: boolean, binding: KeyBinding): boolean => {
    if (binding.keys.indexOf(code) === -1) {
      return false;
    }
    if (!repeat) {
      binding.down();
    }
    return true;
  };

  const checkKeyUp = (code: string, binding: KeyBinding): boolean => {
    if (binding.keys.indexOf(code) === -1) {
      return false;
    }
    binding.up();
    return true;
  };

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const consumed =
      checkKeyDown(event.code, event.repeat, BINDINGS.down) ||
      checkKeyDown(event.code, event.repeat, BINDINGS.up) ||
      checkKeyDown(event.code, event.repeat, BINDINGS.left) ||
      checkKeyDown(event.code, event.repeat, BINDINGS.right) ||
      checkKeyDown(event.code, false, BINDINGS.rewind) ||
      checkKeyDown(event.key, event.repeat, BINDINGS.reset) ||
      checkKeyDown(event.key, event.repeat, BINDINGS.next);

    if (consumed) {
      event.preventDefault();
    }
  });

  document.addEventListener('keyup', (event) => {
    const consumed =
      checkKeyUp(event.code, BINDINGS.down) ||
      checkKeyUp(event.code, BINDINGS.up) ||
      checkKeyUp(event.code, BINDINGS.left) ||
      checkKeyUp(event.code, BINDINGS.right);

    if (consumed) {
      event.preventDefault();
    }
  });
};

genTextures().then(([diffuse, normals]) => {
  setTileTextures(diffuse, normals);

  genAudio(game.audio).then(() => {
    let hasSave = false;
    try {
      hasSave = Number(window.localStorage.getItem('GamutShift-save') || 0) > 1;
    } catch (e) {}

    const txt = document.getElementById('load') as HTMLParagraphElement;
    const play = document.getElementById('play') as HTMLButtonElement;
    const cont = document.getElementById('cont') as HTMLButtonElement;
    (document.getElementById('loud') as HTMLParagraphElement).style.display = 'block';

    txt.style.display = 'none';
    play.style.display = 'block';
    cont.style.display = hasSave ? 'block' : 'none';

    const startGame = (): void => {
      (document.getElementById('title') as HTMLDivElement).style.display = 'none';
      txt.style.display = 'block';
      txt.innerText = 'Move with ARROW keys - SPACE rewinds - R restarts level';
      game.start();
      addEventListeners();
      requestAnimationFrame(frame);
    };

    cont.onclick = startGame;
    play.onclick = (): void => {
      try {
        window.localStorage.setItem('GamutShift-save', '1');
      } catch (e) {}
      startGame();
    };
  });
});
