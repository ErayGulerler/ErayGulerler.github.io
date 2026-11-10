// Drives trace-worker.js. Several workers each trace whole passes of the picture and
// this module adds them up. While you drag, it traces a small picture so it can keep up.
import { clamp, paintRange } from './kit.js';

const FULL = { width: 480, height: 320, passes: 48 };
const ROUGH = { width: 168, height: 112, passes: 0 };   // one pass from each worker

export function ray(figure) {
  const screen = figure.querySelector('.screen');
  const canvas = figure.querySelector('canvas');
  const poster = figure.querySelector('.inset');
  const meter = figure.querySelector('.meter');
  const readout = figure.querySelector('.readout');
  const angleInput = figure.querySelector('#ray-angle');
  const roughInput = figure.querySelector('#ray-rough');
  const context = canvas.getContext('2d');
  const buffer = document.createElement('canvas');
  const bufferContext = buffer.getContext('2d');
  if (!context || !('Worker' in window)) return;

  const threads = clamp((navigator.hardwareConcurrency || 2) - 1, 1, 4);
  let workers;
  try {
    workers = Array.from({ length: threads }, () => ({ worker: new Worker('trace-worker.js'), busy: false }));
  } catch { return; }

  const view = { angle: Number(angleInput.value), eyeY: 2.3, roughness: roughInput.value / 100 };
  let job = 0, size = FULL, sums, passes = 0, asked = 0, seed = 721, began = 0;
  let visible = false, settle = 0, failed = false;

  function begin(next) {
    job += 1;
    size = next;
    sums = new Float32Array(size.width * size.height * 3);
    passes = asked = 0;
    began = performance.now();
    buffer.width = size.width;
    buffer.height = size.height;
    meter.classList.remove('done');
    meter.style.width = '0';
    feed();
  }
  const wanted = () => (size.passes || threads);
  function feed() {
    if (!visible || failed) return;
    for (const slot of workers) {
      if (slot.busy || asked >= wanted()) continue;
      slot.busy = true;
      asked += 1;
      seed += 1;
      slot.worker.postMessage({ job, width: size.width, height: size.height, seed, ...view });
    }
  }
  function show() {
    const image = bufferContext.createImageData(size.width, size.height);
    const out = image.data, scale = 1 / passes;
    for (let i = 0, j = 0; i < out.length; i += 4, j += 3) {
      out[i] = 255 * Math.sqrt(sums[j] * scale);
      out[i + 1] = 255 * Math.sqrt(sums[j + 1] * scale);
      out[i + 2] = 255 * Math.sqrt(sums[j + 2] * scale);
      out[i + 3] = 255;
    }
    bufferContext.putImageData(image, 0, 0);
    context.imageSmoothingEnabled = size === FULL;
    context.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    if (canvas.hidden) {
      canvas.hidden = false;
      poster.classList.remove('poster');
    }
  }
  function report() {
    if (size !== FULL) { readout.textContent = 'Tracing a small picture while the camera moves'; return; }
    const seconds = (performance.now() - began) / 1000;
    const rate = size.width * size.height * passes / seconds / 1e6;
    const done = passes >= FULL.passes;
    readout.textContent = `${passes} of ${FULL.passes} samples a pixel on ${threads} thread${threads > 1 ? 's' : ''}, ${rate.toFixed(1)} million camera rays a second`
      + (done ? `. Done in ${seconds.toFixed(1)} seconds.` : '');
    meter.style.width = 100 * passes / FULL.passes + '%';
    meter.classList.toggle('done', done);
  }

  for (const slot of workers) {
    slot.worker.onmessage = ({ data }) => {
      slot.busy = false;
      if (data.job === job) {
        const pass = data.sums;
        for (let i = 0; i < pass.length; i++) sums[i] += pass[i];
        passes += 1;
        show();
        report();
      }
      feed();
    };
    slot.worker.onerror = () => {
      failed = true;
      readout.textContent = 'Live rendering isn’t available in this browser. This is the original C# render.';
    };
  }

  function moved() {
    angleInput.value = Math.round(view.angle);
    paintRange(angleInput);
    angleInput.previousElementSibling.textContent = Math.round(view.angle) + '°';
    roughInput.previousElementSibling.textContent = view.roughness.toFixed(2);
    begin(ROUGH);
    clearTimeout(settle);
    settle = setTimeout(() => begin(FULL), 260);
  }
  angleInput.addEventListener('input', () => { view.angle = Number(angleInput.value); moved(); });
  roughInput.addEventListener('input', () => { view.roughness = roughInput.value / 100; moved(); });

  let grip = null;
  screen.addEventListener('pointerdown', event => {
    if (event.target === poster && !canvas.hidden) return;
    grip = { x: event.clientX, y: event.clientY, angle: view.angle, eyeY: view.eyeY };
    screen.setPointerCapture(event.pointerId);
    screen.classList.add('dragging');
  });
  screen.addEventListener('pointermove', event => {
    if (!grip) return;
    const width = screen.clientWidth;
    let angle = grip.angle - (event.clientX - grip.x) / width * 150;
    angle = ((angle + 180) % 360 + 360) % 360 - 180;
    const eyeY = clamp(grip.eyeY + (event.clientY - grip.y) / width * 7, .45, 7);
    if (Math.round(angle) === Math.round(view.angle) && Math.abs(eyeY - view.eyeY) < .03) return;
    view.angle = angle;
    view.eyeY = eyeY;
    moved();
  });
  const release = () => { grip = null; screen.classList.remove('dragging'); };
  screen.addEventListener('pointerup', release);
  screen.addEventListener('pointercancel', release);

  new IntersectionObserver(entries => {
    visible = entries.at(-1).isIntersecting;
    if (visible && !job) begin(FULL);
    else feed();
  }, { threshold: .15 }).observe(screen);
}
