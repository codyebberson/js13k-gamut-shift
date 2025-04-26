const canvas = document.getElementById('c') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
const resX = canvas.width;
const resY = canvas.height;

export { canvas, gl, resX, resY };
