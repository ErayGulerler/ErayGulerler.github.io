// A JavaScript port of LadderBook from ErayGulerler/TickLadder (include/tickladder/book.hpp).
// The C++ uses 64-bit words. JavaScript bit operations are 32-bit, so each word is two halves here.
import { el, css, onThemeChange, seededRandom, group, reducedMotion } from './kit.js';

const FIRST_TICK = 10000, TICKS = 4096;

class Ladder {
  sizes = new Uint32Array(TICKS);
  occupied = new Uint32Array(128);   // 64 words, low half then high half
  groups = new Uint32Array(2);       // one bit for each of the 64 rows
  count = 0;

  set(offset, size) {
    const row = offset >> 6, half = offset >> 5, bit = 1 << (offset & 31);
    if (!this.sizes[offset] !== !size) this.count += size ? 1 : -1;
    this.sizes[offset] = size;
    if (size) {
      this.occupied[half] |= bit;
      this.groups[row >> 5] |= 1 << (row & 31);
    } else {
      this.occupied[half] &= ~bit;
      if (!(this.occupied[row * 2] | this.occupied[row * 2 + 1])) this.groups[row >> 5] &= ~(1 << (row & 31));
    }
  }
  // Pick the outermost occupied row, then the outermost tick in it.
  best(bid) {
    if (!(this.groups[0] | this.groups[1])) return -1;
    const extreme = (low, high) => (bid
      ? (high ? 63 - Math.clz32(high) : 31 - Math.clz32(low))
      : (low ? 31 - Math.clz32(low & -low) : 63 - Math.clz32(high & -high)));
    const row = extreme(this.groups[0], this.groups[1]);
    return row * 64 + extreme(this.occupied[row * 2], this.occupied[row * 2 + 1]);
  }
  // The slow way, used to check the fast one: walk the prices from one end.
  scan(bid) {
    if (bid) { for (let i = TICKS - 1; i >= 0; i--) if (this.sizes[i]) return i; }
    else { for (let i = 0; i < TICKS; i++) if (this.sizes[i]) return i; }
    return -1;
  }
}

export function ladder(figure) {
  const canvas = figure.querySelector('canvas');
  const context = canvas.getContext('2d');
  const readout = figure.querySelector('.readout');
  const quote = Object.fromEntries([...figure.querySelectorAll('[data-q]')].map(node => [node.dataset.q, node]));
  const button = Object.fromEntries([...figure.querySelectorAll('[data-do]')].map(node => [node.dataset.do, node]));
  const still = reducedMotion();

  let bids, asks, random, mid, checked, agreed, updates;
  let effects = [], frame = 0, playing = false, lastUpdate = 0, hover = -1;
  let pitch = 8, left = 0, colours = {};

  function reset() {
    bids = new Ladder(); asks = new Ladder();
    random = seededRandom(3367);
    mid = 2000.5; checked = agreed = updates = 0;
    for (let i = 0; i < 90; i++) step(true);
    checked = agreed = updates = 0;
    effects = [];
    readout.textContent = 'Cancel the best bid to see where the next one is.';
  }

  function apply(bid, offset, size, quiet) {
    (bid ? bids : asks).set(offset, size);
    updates += 1;
    checked += 2;
    agreed += (bids.best(true) === bids.scan(true)) + (asks.best(false) === asks.scan(false));
    if (!quiet) effects.push({ offset, born: performance.now(), kind: size ? 'set' : 'gone' });
  }

  // One line of a made-up tape. Prices cluster near a drifting middle, with a long tail.
  function step(quiet) {
    mid = Math.min(3400, Math.max(700, mid + (random() - .5) * 5));
    const bid = random() < .5, book = bid ? bids : asks;
    const crossed = bid ? asks.best(false) : bids.best(true);
    const roll = random();
    if (roll < .27 && book.count > 6) {
      apply(bid, book.best(bid), 0, quiet);
    } else if (roll < (book.count > 34 ? .6 : .3) && book.count > 6) {
      let offset = Math.floor(mid + (bid ? -1 : 1) * (1 + random() * 900));
      const dir = bid ? -1 : 1;
      for (let n = 0; n < TICKS && !book.sizes[offset]; n++) offset = ((offset + dir) % TICKS + TICKS) % TICKS;
      if (book.sizes[offset]) apply(bid, offset, 0, quiet);
    } else {
      const far = 1 + Math.floor(-Math.log(1 - random()) * (random() < .3 ? 620 : 110));
      let offset = Math.floor(mid) + (bid ? -far : far);
      offset = Math.min(TICKS - 1, Math.max(0, offset));
      if (crossed >= 0 && (bid ? offset >= crossed : offset <= crossed)) return;
      apply(bid, offset, 1 + Math.floor(random() * 500), quiet);
    }
  }

  // ---------- drawing ----------
  function measure() {
    const width = canvas.clientWidth || 560, ratio = Math.min(2, devicePixelRatio || 1);
    pitch = (width - 14) / 66.4;
    left = pitch * 2.4 + 14;
    const height = pitch * 64;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.aspectRatio = width + ' / ' + height;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function palette() {
    colours = Object.fromEntries(['bench', 'ink', 'wire', 'aqua-fill', 'violet-fill', 'yellow', 'orange'].map(name => [name, css('--' + name)]));
  }
  function draw() {
    const now = performance.now(), box = pitch * .84;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const bestBid = bids.best(true), bestAsk = asks.best(false);

    // The row bitmaps: one column for bids, one for asks.
    for (let row = 0; row < 64; row++) {
      for (const [column, book, colour] of [[0, bids, 'aqua-fill'], [1, asks, 'violet-fill']]) {
        const on = book.groups[row >> 5] >>> (row & 31) & 1;
        context.globalAlpha = on ? 1 : .5;
        context.fillStyle = colours[on ? colour : 'wire'];
        context.fillRect(column * pitch * 1.2, row * pitch, pitch, box);
      }
    }
    // The 4,096 prices.
    context.globalAlpha = .42;
    context.fillStyle = colours.wire;
    for (let offset = 0; offset < TICKS; offset++) {
      if (!bids.sizes[offset] && !asks.sizes[offset]) context.fillRect(left + (offset & 63) * pitch, (offset >> 6) * pitch, box, box);
    }
    context.globalAlpha = 1;
    for (const [book, colour] of [[bids, 'aqua-fill'], [asks, 'violet-fill']]) {
      context.fillStyle = colours[colour];
      for (let offset = 0; offset < TICKS; offset++) {
        if (book.sizes[offset]) context.fillRect(left + (offset & 63) * pitch, (offset >> 6) * pitch, box, box);
      }
    }
    // Things that just happened.
    effects = effects.filter(effect => now - effect.born < (effect.life || 520));
    for (const effect of effects) {
      const age = (now - effect.born) / (effect.life || 520);
      if (age < 0) continue;
      const x = left + (effect.offset & 63) * pitch, y = (effect.offset >> 6) * pitch;
      if (effect.kind === 'row') {
        context.globalAlpha = .34 * (1 - age);
        context.fillStyle = colours.yellow;
        context.fillRect(left - 4, y - 1, pitch * 64 + 4, pitch + 1);
        context.globalAlpha = 1 - age;
        context.fillRect((effect.bid ? 0 : pitch * 1.2) - 1, y - 1, pitch + 2, box + 2);
      } else {
        const grow = pitch * (.6 + age * 2.4);
        context.globalAlpha = 1 - age;
        context.strokeStyle = colours[effect.kind === 'gone' ? 'orange' : 'yellow'];
        context.lineWidth = 2;
        context.strokeRect(x + box / 2 - grow, y + box / 2 - grow, grow * 2, grow * 2);
      }
    }
    context.globalAlpha = 1;
    // The two prices a trader would see.
    context.lineWidth = 2;
    context.strokeStyle = colours.ink;
    for (const offset of [bestBid, bestAsk]) {
      if (offset >= 0) context.strokeRect(left + (offset & 63) * pitch - 2.5, (offset >> 6) * pitch - 2.5, box + 5, box + 5);
    }
    if (hover >= 0) {
      context.strokeStyle = colours.yellow;
      context.strokeRect(left + (hover & 63) * pitch - 1, (hover >> 6) * pitch - 1, box + 2, box + 2);
    }
    paintQuote(bestBid, bestAsk);
  }
  function paintQuote(bestBid, bestAsk) {
    const side = (offset, book) => (offset < 0 ? ['none']
      : [String(FIRST_TICK + offset), ' ', el('small', { text: book.sizes[offset] + ' lots' })]);
    quote.bid.replaceChildren(...side(bestBid, bids));
    quote.ask.replaceChildren(...side(bestAsk, asks));
    quote.spread.replaceChildren(...(bestBid >= 0 && bestAsk >= 0 ? [String(bestAsk - bestBid), ' ', el('small', { text: 'ticks' })] : ['none']));
    button['cancel-bid'].disabled = bestBid < 0;
    button['cancel-ask'].disabled = bestAsk < 0;
  }

  function loop(now) {
    if (playing && now - lastUpdate > 32) { lastUpdate = now; step(false); report(); }
    draw();
    frame = playing || effects.length ? requestAnimationFrame(loop) : 0;
  }
  const wake = () => { if (!frame) frame = requestAnimationFrame(loop); };

  function report() {
    readout.textContent = `${group(updates)} updates. The two bit scans and the plain walk agree on ${group(agreed)} of ${group(checked)} quotes.`;
  }

  function cancelBest(bid) {
    const book = bid ? bids : asks, was = book.best(bid);
    if (was < 0) return;
    apply(bid, was, 0, false);
    const now = performance.now(), next = book.best(bid), name = bid ? 'bid' : 'ask';
    if (next < 0) {
      readout.textContent = `That was the last ${name}. The row bitmap is zero, so the lookup stops there.`;
    } else {
      const gap = Math.abs(next - was) - 1, rows = Math.abs((next >> 6) - (was >> 6));
      effects.push({ offset: next, born: now + (still ? 0 : 260), kind: 'row', bid, life: 900 });
      effects.push({ offset: next, born: now + (still ? 0 : 520), kind: 'set', life: 700 });
      readout.textContent = `The best ${name} was ${FIRST_TICK + was}. The next is ${FIRST_TICK + next}, in row ${next >> 6} at bit ${next & 63}. `
        + (gap ? `Two bit scans found it. Walking one price at a time would have passed ${group(gap)} empty price${gap > 1 ? 's' : ''}${rows > 1 ? ` across ${rows} rows` : ''}.`
               : 'It was the very next price.');
    }
    wake();
  }

  function cellAt(event) {
    const box = canvas.getBoundingClientRect();
    const column = Math.floor((event.clientX - box.left - left) / pitch), row = Math.floor((event.clientY - box.top) / pitch);
    return column < 0 || column > 63 || row < 0 || row > 63 ? -1 : row * 64 + column;
  }
  canvas.addEventListener('pointermove', event => {
    const cell = cellAt(event);
    if (cell !== hover) { hover = cell; wake(); }
  });
  canvas.addEventListener('pointerleave', () => { hover = -1; wake(); });
  canvas.addEventListener('click', event => {
    const offset = cellAt(event);
    if (offset < 0) return;
    const tick = FIRST_TICK + offset;
    if (bids.sizes[offset] || asks.sizes[offset]) {
      const bid = Boolean(bids.sizes[offset]);
      apply(bid, offset, 0, false);
      readout.textContent = `Removed the ${bid ? 'bid' : 'ask'} at ${tick}.`;
    } else {
      const bestBid = bids.best(true), bestAsk = asks.best(false);
      const middle = bestBid >= 0 && bestAsk >= 0 ? (bestBid + bestAsk) / 2 : bestBid >= 0 ? bestBid + .5 : bestAsk >= 0 ? bestAsk - .5 : TICKS / 2;
      const bid = offset < middle, size = 1 + Math.floor(Math.random() * 500);
      apply(bid, offset, size, false);
      readout.textContent = `Added ${bid ? 'a bid' : 'an ask'} for ${size} lots at ${tick}.`;
    }
    wake();
  });
  button['cancel-bid'].addEventListener('click', () => cancelBest(true));
  button['cancel-ask'].addEventListener('click', () => cancelBest(false));
  button.tape.addEventListener('click', () => {
    playing = !playing;
    button.tape.setAttribute('aria-pressed', playing);
    button.tape.textContent = playing ? 'Stop the tape' : 'Play a random tape';
    wake();
  });
  button.reset.addEventListener('click', () => { reset(); wake(); });

  new IntersectionObserver(entries => {
    if (!entries.at(-1).isIntersecting && playing) button.tape.click();
  }).observe(figure);
  palette();
  onThemeChange(() => { palette(); draw(); });
  reset();
  new ResizeObserver(measure).observe(canvas.parentElement);
  measure();
}

// ---------- the eight-update example on the TickLadder page ----------
const TAPE = [
  ['B', 12000, 75, 'The first bid is 75 lots at 12000. No one is asking to sell yet.'],
  ['A', 12004, 40, 'The first ask arrives at 12004. The spread is four ticks.'],
  ['B', 11998, 60, 'A bid at 11998 joins the book, behind the bid at 12000.'],
  ['B', 12000, 25, 'The best bid shrinks from 75 lots to 25. Its price stays the same.'],
  ['A', 12002, 30, 'The highest bid is 12000. The lowest ask is 12002.'],
  ['B', 12000, 0, 'The 25 lots at 12000 are gone. The bid at 11998 is now the best.'],
  ['A', 12002, 0, 'The ask at 12002 is gone. The lowest ask moves back to 12004.'],
  ['B', 11998, 0, 'The last bid disappears. Only the 40 lots offered at 12004 remain.'],
];
const SHOWN = Array.from({ length: 13 }, (_, i) => 11995 + i);

export function replay(figure) {
  const strip = figure.querySelector('.strip'), bits = figure.querySelector('.bits'), ticks = figure.querySelector('.ticks');
  const stepLabel = figure.querySelector('.step'), event = figure.querySelector('.event'), line = figure.querySelector('.line');
  const previous = figure.querySelector('[data-do="prev"]'), next = figure.querySelector('[data-do="next"]');
  const levels = SHOWN.map(tick => {
    const lots = el('span', { class: 'lots' }), bar = el('span', { class: 'bar' });
    const level = el('div', { class: 'lvl' }, lots, bar);
    strip.append(level);
    const bit = el('span', { text: '0', title: `bit ${(tick - FIRST_TICK) & 63} of row ${(tick - FIRST_TICK) >> 6}` });
    bits.append(bit);
    ticks.append(el('span', { text: tick }));
    return { tick, level, lots, bar, bit };
  });
  let current = 4;

  function show() {
    const sides = new Map();
    const both = [new Ladder(), new Ladder()];
    for (const [side, tick, size] of TAPE.slice(0, current + 1)) {
      both[side === 'B' ? 0 : 1].set(tick - FIRST_TICK, size);
      sides.set(tick, side);
    }
    const bestBid = both[0].best(true), bestAsk = both[1].best(false);
    for (const item of levels) {
      const offset = item.tick - FIRST_TICK, size = both[0].sizes[offset] || both[1].sizes[offset];
      item.level.classList.toggle('ask', sides.get(item.tick) === 'A');
      item.level.classList.toggle('on', size > 0);
      item.level.classList.toggle('best', offset === bestBid || offset === bestAsk);
      item.bar.style.height = size / 75 * 78 + '%';
      if (size) item.lots.textContent = size + ' lots';
      item.bit.textContent = size ? '1' : '0';
      item.bit.classList.toggle('on', size > 0);
    }
    const field = (offset, ladder) => (offset < 0 ? ',' : `${FIRST_TICK + offset},${ladder.sizes[offset]}`);
    line.textContent = `${current + 1},${field(bestBid, both[0])},${field(bestAsk, both[1])}`;
    stepLabel.textContent = `Update ${current + 1} of ${TAPE.length}`;
    event.textContent = TAPE[current][3];
    previous.disabled = current === 0;
    next.textContent = current === TAPE.length - 1 ? 'Replay from the start' : current === 4 ? 'Remove the bid' : 'Next update';
  }
  previous.addEventListener('click', () => { current -= 1; show(); });
  next.addEventListener('click', () => { current = (current + 1) % TAPE.length; show(); });
  show();
  figure.querySelector('.buttons').hidden = false;
}
