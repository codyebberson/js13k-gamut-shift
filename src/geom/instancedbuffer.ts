import { gl } from '../context';

export class InstancedBuffer {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  data: Float32Array;
  instanceSize: number;
  numInstances: number;
  instanceStart: number;

  constructor(
    attributes: number[][],
    maxInstances: number,
    instanceSize: number,
    vertices: Float32Array
  ) {
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.instanceSize = instanceSize;
    this.numInstances = 0;
    this.instanceStart = vertices.length;
    const size = maxInstances * instanceSize + vertices.byteLength;
    this.data = new Float32Array(size / 4);
    this.data.set(vertices, 0);

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    attributes.forEach((a, index) => {
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, a[0], gl.FLOAT, false, a[1], a[2]);
      gl.vertexAttribDivisor(index, a[3] || 0);
    });

    gl.bufferData(gl.ARRAY_BUFFER, size, gl.DYNAMIC_DRAW);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0);
    gl.bindVertexArray(null);
  }

  clear(): void {
    this.numInstances = 0;
  }

  bind(): void {
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0);
  }

  addInstances(data: Float32Array): void {
    this.data.set(data, this.instanceStart + this.numInstances * (this.instanceSize / 4));
    this.numInstances += data.byteLength / this.instanceSize;
  }

  release(): void {
    gl.deleteBuffer(this.buffer);
    gl.deleteVertexArray(this.vao);
  }
}
