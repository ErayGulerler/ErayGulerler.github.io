const start = document.querySelector('#start');
const canvas = document.querySelector('#canvas');
const original = document.querySelector('#original');
const caption = document.querySelector('#caption');
const progress = document.querySelector('#progress');
const controls = document.querySelector('#controls');
const status = document.querySelector('#lab-status');
const angle = document.querySelector('#angle');
const rough = document.querySelector('#rough');
const context = canvas.getContext('2d');
let worker;
let timer;

function cancel() {
  clearTimeout(timer);
  worker?.terminate();
  worker = undefined;
}
function restore() {
  cancel();
  canvas.hidden = controls.hidden = true;
  original.hidden = start.hidden = false;
  caption.textContent = 'Original C# render · January 2026';
  progress.textContent = '200 × 133 px';
  status.textContent = '';
}
function render() {
  cancel();
  try {
    worker = new Worker('trace-worker.js');
  } catch {
    restore();
    progress.textContent = 'Live rendering unavailable in this browser';
    return;
  }
  const job = worker;
  controls.hidden = false;
  start.hidden = true;
  progress.textContent = 'Tracing rays…';
  job.onmessage = ({data:{pixels,pass,samples}}) => {
    if (job !== worker) return;
    context.putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);
    canvas.hidden = false;
    original.hidden = true;
    caption.textContent = 'Browser render · 360 × 240';
    progress.textContent = pass + ' / ' + samples + ' samples per pixel';
    if (pass === samples) status.textContent = 'Render complete at ' + angle.value + ' degrees and roughness ' + (rough.value/100).toFixed(2);
  };
  job.onerror = () => {
    if (job !== worker) return;
    restore();
    progress.textContent = 'Live rendering unavailable in this browser';
  };
  job.postMessage({width:canvas.width,height:canvas.height,angle:Number(angle.value),roughness:rough.value/100});
}
if (context && 'Worker' in window) start.hidden = false;
start.addEventListener('click', () => { render(); if (!controls.hidden) angle.focus({preventScroll:true}); });
document.querySelector('#restore').addEventListener('click', () => { restore(); start.focus({preventScroll:true}); });
controls.addEventListener('input', () => {
  document.querySelector('#angle-value').textContent = angle.value + '°';
  document.querySelector('#rough-value').textContent = (rough.value/100).toFixed(2);
  cancel();
  status.textContent = '';
  progress.textContent = 'Tracing rays…';
  timer = setTimeout(render,110);
});
window.addEventListener('pagehide', restore);
