import { sobel } from './sobel';
import {
  TextureDefinition,
  bricks,
  checkerBoard,
  crate,
  marble,
  metalCrate,
  nil,
  panel,
  plate,
  portal,
  roundedTile,
  sphere,
  stone,
  wood,
} from './textures';

function renderSVG(src: string): Promise<CanvasRenderingContext2D> {
  const svg = new Image();
  svg.src = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
  return new Promise((resolve) => {
    svg.onload = (): void => {
      const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      ctx.drawImage(svg, 0, 0);
      resolve(ctx);
    };
  });
}

const TILETEXTURES: TextureDefinition[] = [
  sphere('#f44', 26), // R
  sphere('#4f4', 26), // G
  sphere('#44f', 26), // B
  sphere('#ff4', 26), // Y
  sphere('#4ff', 26), // C
  sphere('#f4f', 26), // M
  sphere('#fff', 26), // W
  bricks('#fff', '#fff', '#888', 3, 3, 0, 0, 63.5, 63.5, 0.5, 0, 255), // floor
  bricks('#a55', '#aaa', '#fff8', 3, 3, 0.8, 0.5, 30, 14, 2, 16, 40, 1), // wall
  nil(),
  plate('#f44', 22), // r
  plate('#4f4', 22), // g
  plate('#44f', 22), // b
  plate('#ff4', 22), // y
  plate('#4ff', 22), // c
  plate('#f4f', 22), // m
  plate('#fff', 22), // w
  crate('#320', 0),
  portal(26),
  sphere('#fff', 30), // player
  checkerBoard('#fc3', '#421'), // player
  bricks('#bbd', '#eee', '#fff3', 0, 0, 0, 0, 31, 31, 1, 0, 200), // floor
  wood('#fed'), // floor
  bricks('#333', '#444', '#fff3', 0, 0, 0.7, 0.01, 30, 14, 2, 16, 8), // wall
  crate('#d72', 1),
  marble('#fff', 8),
  stone(),
  panel('#8ac', '#0000', true), // wall
  panel('#46b', '#0007', true), // wall
  crate('#820', 2),
  bricks('#fa7', '#e97', '#fff3', 4, 4, 0.07, 0.2, 30, 30, 2, 16, 200, 2), // wall
  bricks('#563', '#888', '#fff4', 3, 3, 0.9, 0.025, 14, 14, 2, 7, 20, 2), // wall
  bricks('#ccc', '#777', '#fff2', 0, 0, 0.07, 0.1, 60, 60, 2, 0, 20), // floor
  bricks('#ccf', '#ccf', '#fffb', 0, 0, 0.47, 0.1, 64, 64, 0, 0, 20), // floor
  panel('#a64', '#fff3', false), // wall
  bricks('#5df', '#567', '#aaa2', 0, 0, 0, 0, 3, 3, 1, 2, 30, 0.5), // floor
  metalCrate(),
  roundedTile(), // floor
];

export function genTextures(): Promise<ImageData[][]> {
  return new Promise((resolve) => {
    const diffuse: CanvasRenderingContext2D[] = [];
    const normals: CanvasRenderingContext2D[] = [];

    const tiles = TILETEXTURES.map(
      (t, i) =>
        new Promise((r) => {
          Promise.all([
            renderSVG(t[0]).then(
              (img: CanvasRenderingContext2D): CanvasRenderingContext2D => (diffuse[i] = img)
            ),
            renderSVG(t[1]).then(
              (img: CanvasRenderingContext2D): CanvasRenderingContext2D => (normals[i] = img)
            ),
          ]).then(r);
        })
    );

    Promise.all(tiles).then(() => {
      resolve([
        diffuse.map((t) => t.getImageData(0, 0, 64, 64)),
        normals.map((t, i) =>
          sobel(t.getImageData(0, 0, 64, 64), TILETEXTURES[i][2] ?? 0, TILETEXTURES[i][3] ?? 0)
        ),
      ]);
    });
  });
}
