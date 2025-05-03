import { combine } from './combine';
import { enter } from './enter';
import { exit } from './exit';
import { music } from './music';
import { norewind } from './norewind';
import { rewind } from './rewind';
import { Player } from './soundbox';

const ENABLED = true;

const SOUNDS = { music, enter, exit, combine, rewind, norewind };

export function genAudio(target: Record<string, () => void>): Promise<AudioContext> {
  return new Promise((resolve) => {
    const context = new AudioContext();
    const keys = Object.keys(SOUNDS) as (keyof typeof SOUNDS)[];
    let current = 0;
    let player: Player | undefined = undefined;

    if (!ENABLED) {
      for (const k of keys) {
        target[k] = (): void => {};
      }
      return resolve(context);
    }

    const generator = setInterval(() => {
      player = player || new Player(SOUNDS[keys[current] as keyof typeof SOUNDS]);

      if (player.generate() < 1) {
        return;
      }

      const buffer = player.createAudioBuffer(context);
      player = undefined;
      target[keys[current]] = (): AudioBufferSourceNode => {
        if (context.state === 'suspended') {
          context.resume();
        }
        const source = new AudioBufferSourceNode(context, {
          buffer,
          loop: buffer.duration > 100,
        });
        source.connect(context.destination);
        source.start();
        return source;
      };

      if (++current === keys.length) {
        clearInterval(generator);
        resolve(context);
      }
    }, 0);
  });
}
