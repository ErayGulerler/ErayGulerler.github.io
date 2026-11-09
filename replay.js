// Each line replaces the size at a price in TickLadder's public session.csv.
const tape = [
  [12000, 75, 'The first bid is 75 lots at 12000. No one is asking to sell yet.'],
  [12004, 40, 'The first ask arrives at 12004. The spread is four ticks.'],
  [11998, 60, 'A bid at 11998 joins the book, behind the bid at 12000.'],
  [12000, 25, 'The best bid shrinks from 75 lots to 25. Its price stays the same.'],
  [12002, 30, 'The highest bid is 12000. The lowest ask is 12002.'],
  [12000, 0, 'The 25 lots at 12000 are gone. The bid at 11998 is now the best.'],
  [12002, 0, 'The ask at 12002 is gone. The lowest ask moves back to 12004.'],
  [11998, 0, 'The last bid disappears. Only the 40 lots offered at 12004 remain.']
];
const prices = [11998, 12000, 12002, 12004];
const drawing = document.querySelector('#drawing');
const previous = document.querySelector('#prev');
const next = document.querySelector('#next');
let current = 4;

function showUpdate() {
  const book = new Map();
  for (const [price, lots] of tape.slice(0, current + 1)) book.set(price, lots);
  const quantities = prices.map(price => (book.get(price) || 0) + ' lots at ' + price);
  const sequence = current + 1;
  document.querySelector('#handheld').srcset = 'handheld-' + sequence + '.webp';
  drawing.src = 'tape-' + sequence + '.webp';
  drawing.alt = 'Update ' + sequence + '. Bids: ' + quantities.slice(0, 2).join(', ') + '. Asks: ' + quantities.slice(2).join(', ') + '.';
  document.querySelector('#step').textContent = 'Update ' + sequence + ' of ' + tape.length;
  document.querySelector('#event').textContent = tape[current][2];
  previous.disabled = current === 0;
  if (current === tape.length - 1) next.textContent = 'Replay from start ↺';
  else if (current === 4) next.textContent = 'Remove the bid →';
  else next.textContent = 'Next update →';
}

previous.addEventListener('click', () => { current -= 1; showUpdate(); });
next.addEventListener('click', () => { current = (current + 1) % tape.length; showUpdate(); });
showUpdate();
document.querySelector('#buttons').hidden = false;
