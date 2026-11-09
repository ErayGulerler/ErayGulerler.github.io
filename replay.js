// Each row replaces the quantity at a price level in TickLadder's public sample.
const tape = [
  [12000, 75, 'The first bid rests at 12000. There are no asks yet.'],
  [12004, 40, 'An ask at 12004 opens a spread of four ticks.'],
  [11998, 60, 'A second bid rests at 11998, behind the best bid.'],
  [12000, 25, 'The best bid shrinks from 75 lots to 25. Its price stays the same.'],
  [12002, 30, 'A new ask at 12002 narrows the spread to two ticks.'],
  [12000, 0, 'The bid at 12000 is removed. The next best bid is 11998.'],
  [12002, 0, 'The ask at 12002 is removed. The best ask moves back to 12004.'],
  [11998, 0, 'The last bid is removed. Only the ask at 12004 remains.']
];
let current = 4;
const previous = document.querySelector('#prev');
const next = document.querySelector('#next');
function render() {
  const book = new Map();
  for (const [tick, size] of tape.slice(0, current + 1)) book.set(tick, size);
  for (const row of document.querySelectorAll('[data-tick]')) {
    const tick = Number(row.dataset.tick);
    const size = book.get(tick) || 0;
    row.querySelector('output').textContent = size;
    row.style.setProperty('--w', (100 * size / 75) + '%');
    row.querySelector('.bar').style.removeProperty('--w');
    row.classList.toggle('changed', tick === tape[current][0]);
  }
  document.querySelector('#event').textContent = tape[current][2];
  document.querySelector('#step').textContent = 'Update ' + (current + 1) + ' of ' + tape.length;
  previous.disabled = current === 0;
  next.disabled = current === tape.length - 1;
}
previous.addEventListener('click', () => { current -= 1; render(); });
next.addEventListener('click', () => { current += 1; render(); });
render();
document.querySelector('#buttons').hidden = false;
