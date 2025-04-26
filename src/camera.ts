import { resX, resY } from './context';
import { World } from './world';

const SPEED = 1.75;
const MINVEL = 6;

const lerp = (v: number, target: number, step: number): number =>
  v + Math.sign(target - v) * Math.min(Math.abs(target - v), step);

export interface Camera {
  x: () => number;
  y: () => number;
  update: (dt: number) => void;
}

export function createCamera(world: World): Camera {
  const midX = resX * 0.5;
  const midY = resY * 0.5;
  const ww = world.width * 64;
  const wh = world.height * 64;

  const left = -Math.max(0, midX - ww * 0.5);
  const top = -Math.max(0, midY - wh * 0.5);
  const right = ww - resX;
  const bottom = wh - resY;

  const calcTarget = (): number[] => [
    Math.max(left, Math.min(right, 32 + world.player.worldX - midX)),
    Math.max(top, Math.min(bottom, 32 + world.player.worldY - midY)),
  ];

  let [x, y] = calcTarget();
  let targetX = x;
  let targetY = y;

  return {
    x: (): number => Math.ceil(x),

    y: (): number => Math.ceil(y),

    update: (dt: number): void => {
      [targetX, targetY] = calcTarget();
      const dx = targetX - x;
      const dy = targetY - y;
      const vel = Math.floor(SPEED ** Math.log(dx * dx + dy * dy));

      if (vel > MINVEL) {
        x = lerp(x, targetX, vel * dt);
        y = lerp(y, targetY, vel * dt);
      }
    },
  };
}
