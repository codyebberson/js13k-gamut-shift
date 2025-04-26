import { Camera } from './camera';
import { gl, resX, resY } from './context';
import { LightBuffer } from './geom/lightbuffer';
import { StaticBuffer } from './geom/staticbuffer';
import { TileBuffer } from './geom/tilebuffer';
import {
  ambientFragment,
  aoFragment,
  blurFragment,
  defaultVertex,
  diffuseFragment,
  lightFragment,
  lightVertex,
  playerFragment,
  playerVertex,
  rewindFragment,
  rippleFragment,
  screenFragment,
  screenVertex,
  tileFragment,
  tileVertex,
  transitionFragment,
} from './shaders';
import { World } from './world';

const BLURSCALE = 0.5;

gl.disable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);

const Framebuffer = (textures: WebGLTexture[]): { textures: WebGLTexture[]; bind: () => void } => {
  const attachments = textures.map(
    (_t, i) => gl[`COLOR_ATTACHMENT${i}` as keyof WebGLRenderingContext] as GLenum
  );
  const buffer = gl.createFramebuffer();

  const bind = (): void => {
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer);
    for (let i = 0; i < textures.length; ++i) {
      gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, attachments[i], gl.TEXTURE_2D, textures[i], 0);
    }
    gl.drawBuffers(attachments);
  };

  return { textures, bind };
};

const makeQuad = (w: number, h: number): (() => void) => {
  const ATTRIBS = [
    [2, 16, 0], // vp
    [2, 16, 8], // uv
  ];
  const vertices = new Float32Array([0, 0, 0, 0, 0, h, 0, 1, w, h, 1, 1, w, 0, 1, 0]);

  return StaticBuffer(ATTRIBS, vertices);
};

const createTexture = (
  width: number,
  height: number,
  format: number = gl.RGBA8,
  wrap: number = gl.REPEAT
): WebGLTexture => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return texture;
};

const createTextureArray = (textures: ImageData[]): WebGLTexture => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
  gl.texStorage3D(
    gl.TEXTURE_2D_ARRAY,
    1,
    gl.RGBA8,
    textures[0].width,
    textures[0].height,
    textures.length
  );
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  textures.forEach((t, i) =>
    gl.texSubImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      0,
      0,
      i,
      t.width,
      t.height,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      t.data
    )
  );
  return texture;
};

const createShader = (vert: string, frag: string): WebGLProgram => {
  const program = gl.createProgram();

  const vertShader = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
  gl.shaderSource(vertShader, vert);
  gl.compileShader(vertShader);
  gl.attachShader(program, vertShader);

  const fragShader = gl.createShader(gl.FRAGMENT_SHADER) as WebGLShader;
  gl.shaderSource(fragShader, frag);
  gl.compileShader(fragShader);
  gl.attachShader(program, fragShader);

  gl.linkProgram(program);
  return program;
};

const bgBuffer = Framebuffer([createTexture(resX, resY), createTexture(resX, resY)]);
const fgBuffer = Framebuffer([createTexture(resX, resY), bgBuffer.textures[1]]);
const fgDiffuseBuffer = Framebuffer([fgBuffer.textures[0]]);
const aoBlurBuffer = Framebuffer([
  createTexture(resX * BLURSCALE, resY * BLURSCALE, gl.R8, gl.CLAMP_TO_EDGE),
]);
const aoBuffer = Framebuffer([
  createTexture(resX * BLURSCALE, resY * BLURSCALE, gl.R8, gl.CLAMP_TO_EDGE),
]);
const diffuseBuffer = Framebuffer([createTexture(resX, resY)]);
const renderBuffer = Framebuffer([createTexture(resX, resY)]);

let diffuseArray: WebGLTexture;
let normalsArray: WebGLTexture;

const setTileTextures = (diffuse: ImageData[], normals: ImageData[]): void => {
  diffuseArray = createTextureArray(diffuse);
  normalsArray = createTextureArray(normals);
};

let bgGeom: TileBuffer;
let fgGeom: TileBuffer;
let lightGeom: LightBuffer;
let shaders: Record<string, WebGLProgram>;
const screenQuad = makeQuad(resX, resY);
const playerQuad = makeQuad(64, 64);

const reset = (world: World): void => {
  if (bgGeom) {
    bgGeom.release();
    fgGeom.release();
  }

  bgGeom = new TileBuffer(world.width, world.height);
  fgGeom = new TileBuffer(world.width, world.height);

  if (shaders) {
    return;
  }

  shaders = {
    ao: createShader(defaultVertex, aoFragment),
    tile: createShader(tileVertex, tileFragment),
    blur: createShader(defaultVertex, blurFragment),
    diffuse: createShader(defaultVertex, diffuseFragment),
    ambient: createShader(defaultVertex, ambientFragment),
    light: createShader(lightVertex, lightFragment),
    screen: createShader(screenVertex, screenFragment),
    player: createShader(playerVertex, playerFragment),
    transition: createShader(screenVertex, transitionFragment),
    ripple: createShader(screenVertex, rippleFragment),
    rewind: createShader(screenVertex, rewindFragment),
  };
  lightGeom = new LightBuffer();
};

const buildMapGeom = (world: World): void => {
  // TODO: update changed tiles only; don't rebuild entire map every frame
  bgGeom.clear();
  fgGeom.clear();
  lightGeom.clear();

  for (let i = 0; i < world.map.length; ++i) {
    const tile = world.map[i];
    const x = (i % world.width) * 64;
    const y = ((i / world.width) >>> 0) * 64;
    if (tile.traits.layer === 0) {
      bgGeom.addTile(x, y, tile.tex);
    } else {
      fgGeom.addTile(tile.worldX, tile.worldY, tile.tex);
      bgGeom.addTile(x, y, world.floorTex);
    }

    if (tile.traits.light) {
      const [z, r, g, b, intensity, radius] = tile.traits.light;
      lightGeom.addLight(tile.worldX + 32, tile.worldY + 32, z, radius, r, g, b, intensity);
    }
  }

  const tile = world.player;
  fgGeom.addTile(tile.worldX, tile.worldY, tile.tex);
  const [z, r, g, b, intensity, radius] = tile.traits.light as number[];
  lightGeom.addLight(tile.worldX + 32, tile.worldY + 32, z, radius, r, g, b, intensity);

  for (let i = 0; i < world.lights.length; ++i) {
    const [x, y] = world.lights[i];
    lightGeom.addLight(x, y, 32, 128, 1, 0.8, 0.7, 1);
  }
};

const renderAO = (): void => {
  gl.disable(gl.BLEND);
  gl.viewport(0, 0, resX * BLURSCALE, resY * BLURSCALE);

  aoBuffer.bind();
  gl.clearColor(255, 0, 0, 255);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(2, 2, resX * BLURSCALE - 4, resY * BLURSCALE - 4);

  gl.useProgram(shaders.ao);
  gl.uniform1i(gl.getUniformLocation(shaders.ao, 'tex'), 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fgBuffer.textures[0]);
  screenQuad();

  gl.disable(gl.SCISSOR_TEST);

  gl.useProgram(shaders.blur);
  for (let i = 0; i < 3; ++i) {
    aoBlurBuffer.bind();

    gl.uniform1i(gl.getUniformLocation(shaders.blur, 'tex'), 0);
    gl.uniform2f(gl.getUniformLocation(shaders.blur, 'dir'), 0, 3 / resY);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, aoBuffer.textures[0]);
    screenQuad();

    aoBuffer.bind();

    gl.uniform2f(gl.getUniformLocation(shaders.blur, 'dir'), 3 / resX, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, aoBlurBuffer.textures[0]);
    screenQuad();
  }

  gl.enable(gl.BLEND);
  gl.viewport(0, 0, resX, resY);
};

const render = (
  world: World,
  cam: Camera,
  shader: string,
  uniforms: Record<string, number> = {}
): void => {
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.viewport(0, 0, resX, resY);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  buildMapGeom(world);

  gl.useProgram(shaders.tile);
  gl.uniform2f(gl.getUniformLocation(shaders.tile, 'scroll'), cam.x(), cam.y());
  gl.uniform1i(gl.getUniformLocation(shaders.tile, 'tex'), 0);
  gl.uniform1i(gl.getUniformLocation(shaders.tile, 'normals'), 1);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, diffuseArray);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, normalsArray);

  fgBuffer.bind();
  gl.clear(gl.COLOR_BUFFER_BIT);

  // bg
  bgBuffer.bind();
  gl.clear(gl.COLOR_BUFFER_BIT);
  bgGeom.bind();
  gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, bgGeom.numInstances);

  // fg
  fgBuffer.bind();
  fgGeom.bind();
  gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, fgGeom.numInstances);

  // player
  fgDiffuseBuffer.bind();

  gl.useProgram(shaders.player);
  gl.uniform2f(gl.getUniformLocation(shaders.player, 'scroll'), cam.x(), cam.y());
  gl.uniform2f(
    gl.getUniformLocation(shaders.player, 'pos'),
    world.player.worldX,
    world.player.worldY
  );
  gl.uniform1i(gl.getUniformLocation(shaders.player, 'tex'), 0);

  playerQuad();

  renderAO();

  // diffuse + ao
  diffuseBuffer.bind();
  gl.useProgram(shaders.diffuse);
  gl.uniform1i(gl.getUniformLocation(shaders.diffuse, 'bg'), 0);
  gl.uniform1i(gl.getUniformLocation(shaders.diffuse, 'fg'), 1);
  gl.uniform1i(gl.getUniformLocation(shaders.diffuse, 'ao'), 2);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, bgBuffer.textures[0]);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, fgBuffer.textures[0]);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, aoBuffer.textures[0]);
  screenQuad();

  // lighting
  renderBuffer.bind();
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(shaders.ambient);
  gl.uniform1i(gl.getUniformLocation(shaders.ambient, 'tex'), 0);
  gl.uniform1i(gl.getUniformLocation(shaders.ambient, 'normals'), 1);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, diffuseBuffer.textures[0]);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bgBuffer.textures[1]);

  screenQuad();

  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(shaders.light);
  gl.uniform1i(gl.getUniformLocation(shaders.light, 'tex'), 0);
  gl.uniform1i(gl.getUniformLocation(shaders.light, 'normals'), 1);
  gl.uniform2f(gl.getUniformLocation(shaders.light, 'scroll'), cam.x(), cam.y());

  lightGeom.bind();
  gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 30, lightGeom.numInstances);

  // screen
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawBuffers([]);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

  switch (shader) {
    case 'screen': {
      gl.useProgram(shaders.screen);
      gl.uniform1i(gl.getUniformLocation(shaders.screen, 'tex'), 0);
      break;
    }
    case 'transition': {
      gl.useProgram(shaders.transition);
      gl.uniform1i(gl.getUniformLocation(shaders.transition, 'tex'), 0);
      gl.uniform3f(
        gl.getUniformLocation(shaders.transition, 'pos'),
        world.player.worldX - cam.x() + 32,
        resY - (world.player.worldY - cam.y() + 32),
        uniforms.time * resX
      );
      break;
    }
    case 'ripple': {
      gl.useProgram(shaders.ripple);
      gl.uniform1i(gl.getUniformLocation(shaders.ripple, 'tex'), 0);
      gl.uniform3f(
        gl.getUniformLocation(shaders.ripple, 'pos'),
        uniforms.x - cam.x() + 32,
        resY - (uniforms.y - cam.y() + 32),
        uniforms.time * resX
      );
      break;
    }
    case 'rewind': {
      gl.useProgram(shaders.rewind);
      gl.uniform1i(gl.getUniformLocation(shaders.rewind, 'tex'), 0);
      gl.uniform1f(gl.getUniformLocation(shaders.rewind, 'time'), uniforms.time);
      break;
    }
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderBuffer.textures[0]);

  screenQuad();
};

export default {
  reset,
  setTileTextures,
  render,
};
