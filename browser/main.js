const canvas = document.querySelector('canvas');
const pause = document.querySelector('#pause');
const speed = document.querySelector('#speed');
const speedValue = document.querySelector('#speed-value');
const fullscreen = document.querySelector('#fullscreen');
const status = document.querySelector('#status');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let paused = motion.matches;
let cleanup = () => {};

function syncPause() {
  pause.textContent = paused ? 'Resume' : 'Pause';
  pause.setAttribute('aria-pressed', String(paused));
}
syncPause();
pause.addEventListener('click', () => { paused = !paused; syncPause(); });
speed.addEventListener('input', () => { speedValue.value = `${speed.value}×`; });
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) { status.textContent = `Fullscreen unavailable: ${error.message}`; }
});
document.addEventListener('fullscreenchange', () => {
  fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
});
motion.addEventListener('change', event => {
  if (event.matches) { paused = true; syncPause(); }
});
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  cleanup();
  status.textContent = 'Graphics context lost. Reload this page to restart.';
});

async function start() {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) throw new Error('WebGL 2 is unavailable. Try a browser with GPU acceleration enabled.');
  const response = await fetch('../hyperflower.frag');
  if (!response.ok) throw new Error(`Shader request failed (${response.status}). Serve the repository root.`);
  const source = (await response.text()).replace(/^#version 320 es/, '#version 300 es');
  const shaders = [];
  let program, buffer, observer, frame;
  cleanup = () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
    cleanup = () => {};
  };
  function compile(type, text) {
    const shader = gl.createShader(type);
    shaders.push(shader);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }`));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, source));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'u_resolution');
  const timeUniform = gl.getUniformLocation(program, 'u_time');
  gl.uniform1f(gl.getUniformLocation(program, 'u_speed_scale'), 1);

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const density = Math.min(devicePixelRatio || 1, 2);
    // Bound GPU cost on large/high-DPI displays.
    const scale = Math.min(density, Math.sqrt(4000000 / Math.max(1, bounds.width * bounds.height)));
    canvas.width = Math.max(1, Math.round(bounds.width * scale));
    canvas.height = Math.max(1, Math.round(bounds.height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  let time = 0, last = performance.now();
  function render(now) {
    const elapsed = Math.min((now - last) / 1000, .1);
    last = now;
    if (!document.hidden) {
      if (!paused) time += elapsed * Number(speed.value);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(timeUniform, time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    frame = requestAnimationFrame(render);
  }
  status.textContent = '';
  frame = requestAnimationFrame(render);
}
window.addEventListener('pagehide', () => cleanup(), { once: true });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
start().catch(error => {
  cleanup();
  status.textContent = error.message;
  pause.disabled = true;
  speed.disabled = true;
});
