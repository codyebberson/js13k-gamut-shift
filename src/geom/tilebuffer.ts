import { InstancedBuffer } from './instancedbuffer';

const ATTRIBUTES = [
  // size stride offset [divisor]
  [2, 16, 0], // vp
  [2, 16, 8], // uv
  [3, 0, 64, 1], // tile
];

const TEMP = new Float32Array(3);

export class TileBuffer extends InstancedBuffer {
  constructor(width: number, height: number, tileSize = 64) {
    super(
      ATTRIBUTES,
      width * height,
      12,
      new Float32Array([0, 0, 0, 0, 0, tileSize, 0, 1, tileSize, tileSize, 1, 1, tileSize, 0, 1, 0])
    );
  }

  addTile(...args: number[]): void {
    // x, y, tex
    TEMP.set(args);
    this.addInstances(TEMP);
  }
}
