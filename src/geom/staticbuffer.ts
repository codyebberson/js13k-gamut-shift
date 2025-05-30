import { gl } from '../context';

export const StaticBuffer = (attributes: number[][], vertices: Float32Array): (() => void) => {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  attributes.forEach((a, index) => {
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, a[0], gl.FLOAT, false, a[1], a[2]);
    gl.vertexAttribDivisor(index, a[3] || 0);
  });

  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  return (): void => {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  };
};
