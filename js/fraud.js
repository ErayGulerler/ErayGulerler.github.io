// Daily counts from research/monthly_thresholds/results/daily.csv and monthly.csv in
// ErayGulerler/fraud-detection-api (branch research/monthly-thresholds). 1 July to 31 December 2020.
import { svg, tween, lerp, reducedMotion } from './kit.js';

const FIXED_CAUGHT = [0,0,5,1,0,1,0,2,0,0,4,6,0,0,1,0,0,2,4,8,1,3,3,1,1,1,1,4,0,2,3,2,2,1,5,3,1,2,1,1,0,3,4,1,0,0,0,0,0,1,3,2,1,2,2,3,1,3,1,0,1,2,3,2,2,2,1,0,4,1,3,3,0,0,3,2,2,0,3,2,0,0,0,3,5,3,4,0,1,6,0,2,1,2,0,5,3,3,1,2,2,0,0,0,0,3,4,3,2,2,1,0,0,0,1,2,8,2,2,0,0,0,1,0,0,2,3,4,1,1,2,1,3,2,1,4,0,1,0,0,4,2,6,1,0,3,2,3,7,2,1,0,0,0,6,1,1,1,2,1,4,2,0,1,0,0,2,3,4,4,1,2,0,1,1,0,0,0,0,0,0,0,0,0];
const FIXED_REVIEWS = [0,0,6,1,0,1,0,2,0,0,5,6,0,0,1,0,0,3,4,8,2,3,3,1,2,1,1,4,0,2,4,2,2,1,5,3,1,2,1,1,1,3,4,1,0,1,1,1,0,1,3,2,1,2,3,3,1,3,2,0,1,2,3,2,2,2,1,0,4,3,3,3,0,0,3,2,2,0,3,2,0,0,1,3,5,3,4,0,1,6,0,2,1,2,0,5,3,3,1,2,2,0,0,0,0,3,4,3,2,3,1,0,0,0,1,2,8,2,2,0,0,1,1,1,0,2,4,5,1,1,2,1,4,2,1,5,0,1,0,1,4,2,6,1,0,3,2,3,7,2,1,0,0,0,6,1,1,1,3,2,4,2,0,1,0,0,3,3,4,5,1,2,0,1,1,0,0,0,0,0,0,0,0,2];
const MONTHLY_CAUGHT = [0,0,5,1,0,1,0,2,0,0,4,6,0,0,1,0,0,2,4,8,1,3,3,1,1,1,1,4,0,2,3,2,2,1,6,3,2,3,2,2,0,4,6,1,0,0,0,0,0,1,4,2,2,4,3,5,2,5,1,0,1,2,3,2,2,2,1,0,4,4,1,2,0,2,3,3,4,1,2,2,0,0,0,4,5,4,2,0,4,3,3,2,1,2,0,5,3,3,1,2,2,0,0,0,0,3,4,3,2,1,1,0,0,0,1,2,8,2,2,0,0,0,1,0,0,2,3,4,1,1,3,1,3,2,1,4,0,1,0,0,4,2,6,1,0,3,2,3,6,2,1,0,0,0,6,1,1,1,2,1,4,2,0,1,0,1,3,3,5,4,1,2,0,1,1,0,0,0,0,0,0,0,0,0];
const MONTHLY_REVIEWS = [0,0,6,1,0,1,0,2,0,0,5,6,0,0,1,0,0,3,4,8,2,3,3,1,2,1,1,4,0,2,4,2,2,1,6,3,2,3,2,3,1,4,6,1,0,1,1,1,0,1,4,2,2,4,4,5,2,5,2,0,1,2,3,2,2,2,1,0,4,5,2,2,0,3,3,3,4,1,2,2,0,0,1,4,5,4,2,0,4,3,3,2,1,2,0,5,3,3,1,2,2,0,0,0,0,3,4,3,2,2,1,0,0,0,1,2,8,2,2,0,0,1,1,1,0,2,4,5,1,1,3,1,4,2,1,5,0,1,0,1,4,2,6,1,0,3,2,3,6,2,1,0,0,0,6,1,1,1,3,2,4,2,0,1,0,2,4,3,5,5,1,2,0,1,1,0,0,0,0,0,0,0,0,2];
const MONTHS = [['Jul', 0], ['Aug', 31], ['Sep', 62], ['Oct', 92], ['Nov', 123], ['Dec', 153]];
const FIXED_CUTOFF = 0.9780;
const MONTHLY_CUTOFF = [0.9780, 0.9679, 0.9597, 0.9785, 0.9767, 0.9756];
const DAYS = 184;

const running = list => { let sum = 0; return [0, ...list.map(value => (sum += value))]; };
const SERIES = [
  { name: 'Fixed', key: 'fixed', caught: running(FIXED_CAUGHT), reviews: running(FIXED_REVIEWS) },
  { name: 'Monthly', key: 'monthly', caught: running(MONTHLY_CAUGHT), reviews: running(MONTHLY_REVIEWS) },
];
const TEXT = {
  day: 'Monthly updating caught 330 frauds in 362 reviews. The fixed cutoff caught 302 in 331.',
  review: 'The same counts against reviews done. Stop both at the smaller monthly count and each policy has caught 301 frauds in 330 reviews.',
};

export function fraud(figure) {
  const readout = figure.querySelector('.readout'), chart = figure.querySelector('.chart');
  const isNarrow = () => chart.clientWidth < 520;
  let blend = 0, first = true, stop = () => {}, draw = () => {}, hideGuide = () => {};

  // Two sizes, so the labels stay readable on a phone.
  function build(narrow) {
    const W = narrow ? 380 : 680, H = narrow ? 356 : 392;
    const box = narrow ? { left: 30, right: 290, top: 14, bottom: 236 } : { left: 38, right: 600, top: 14, bottom: 268 };
    const x = { day: day => lerp(box.left, box.right, day / DAYS), review: n => lerp(box.left, box.right, n / 362) };
    const y = caught => lerp(box.bottom, box.top, caught / 330);

    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Line chart of frauds caught by the fixed and monthly cutoff policies' });
    const axis = svg('g', { class: 'axis' });
    for (const value of [0, 100, 200, 300]) {
      axis.append(svg('line', { x1: box.left, x2: box.right, y1: y(value), y2: y(value) }),
        svg('text', { x: box.left - 7, y: y(value) + 4, 'text-anchor': 'end', text: value }));
    }
    const dayTicks = svg('g', {}, ...MONTHS.map(([name, day]) => svg('text', { x: x.day(day + 1), y: box.bottom + 18, text: name })));
    const reviewTicks = svg('g', { opacity: 0 }, ...[0, 100, 200, 300].map(n => svg('text', { x: x.review(n), y: box.bottom + 18, 'text-anchor': 'middle', text: n })),
      svg('text', { class: 'xlabel', x: box.right, y: box.bottom + 36, 'text-anchor': 'end', text: 'reviews done' }));
    axis.append(dayTicks, reviewTicks);

    // The cutoff each policy used, month by month. It only makes sense against time.
    const cut = svg('g', { class: 'cut' });
    const cy = value => lerp(H - 8, H - 58, (value - 0.957) / 0.024);
    let step = '';
    MONTHS.forEach(([, day], i) => {
      const from = x.day(day + 1), to = x.day(i < 5 ? MONTHS[i + 1][1] + 1 : DAYS);
      const below = MONTHLY_CUTOFF[i] < FIXED_CUTOFF - .002;
      step += `${i ? 'L' : 'M'}${from} ${cy(MONTHLY_CUTOFF[i])}H${to}`;
      cut.append(svg('text', { x: from + 3, y: cy(MONTHLY_CUTOFF[i]) + (below ? 15 : -7), fill: 'var(--violet)', text: MONTHLY_CUTOFF[i].toFixed(3).slice(1) }));
    });
    cut.append(svg('path', { class: 'step fixed', d: `M${x.day(1)} ${cy(FIXED_CUTOFF)}H${x.day(DAYS)}` }),
      svg('path', { class: 'step monthly', d: step }),
      svg('text', { x: box.right + 9, y: cy(FIXED_CUTOFF) + 4, text: 'cutoff' }));

    const lines = SERIES.map(series => svg('path', { class: 'line ' + series.key }));
    const ends = SERIES.map(series => svg('g', { class: 'end ' + series.key }, svg('circle', { r: 4.5 }), svg('text', {})));
    const guide = svg('g', { class: 'axis', opacity: 0 }, svg('line', { y1: box.top, y2: box.bottom }),
      svg('circle', { r: 4, fill: 'var(--aqua)' }), svg('circle', { r: 4, fill: 'var(--violet)' }), svg('text', { x: box.left + 8, y: box.top + 12 }));
    root.append(axis, cut, ...lines, ...ends, guide);
    chart.replaceChildren(root);

    const pointX = (series, i) => lerp(x.day(i), x.review(series.reviews[i]), blend);
    draw = () => {
      SERIES.forEach((series, s) => {
        let d = '';
        for (let i = 0; i <= DAYS; i++) d += `${i ? 'L' : 'M'}${pointX(series, i).toFixed(1)} ${y(series.caught[i]).toFixed(1)}`;
        lines[s].setAttribute('d', d);
        const ex = pointX(series, DAYS), ey = y(series.caught[DAYS]);
        ends[s].firstChild.setAttribute('cx', ex);
        ends[s].firstChild.setAttribute('cy', ey);
        const label = ends[s].lastChild;
        label.textContent = `${series.name} ${series.caught[DAYS]}`;
        label.setAttribute('x', ex + 9);
        label.setAttribute('y', ey + 4.5 + (s === 0 ? blend * 15 : 0));
      });
      dayTicks.setAttribute('opacity', 1 - blend);
      reviewTicks.setAttribute('opacity', blend);
      cut.setAttribute('opacity', 1 - blend);
    };
    hideGuide = () => guide.setAttribute('opacity', 0);

    // Read off both lines under the pointer.
    root.addEventListener('pointermove', event => {
      const frame = root.getBoundingClientRect();
      const px = (event.clientX - frame.left) * W / frame.width;
      if (px < box.left || px > box.right + 8 || (blend > 0 && blend < 1)) return hideGuide();
      const picks = SERIES.map(series => {
        let best = 0;
        for (let i = 0; i <= DAYS; i++) if (Math.abs(pointX(series, i) - px) <= Math.abs(pointX(series, best) - px)) best = i;
        return best;
      });
      const [line, fixedDot, monthlyDot, label] = guide.children;
      line.setAttribute('x1', px);
      line.setAttribute('x2', px);
      [fixedDot, monthlyDot].forEach((dot, s) => {
        dot.setAttribute('cx', pointX(SERIES[s], picks[s]));
        dot.setAttribute('cy', y(SERIES[s].caught[picks[s]]));
      });
      const counts = `fixed ${SERIES[0].caught[picks[0]]}, monthly ${SERIES[1].caught[picks[1]]}`;
      if (blend === 0) {
        const date = new Date(Date.UTC(2020, 6, Math.max(1, picks[0])));
        label.textContent = `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}: ${counts}`;
      } else {
        label.textContent = `after ${Math.round((px - box.left) / (box.right - box.left) * 362)} reviews: ${counts}`;
      }
      guide.setAttribute('opacity', 1);
    });
    root.addEventListener('pointerleave', hideGuide);

    draw();
    if (reducedMotion() || !first) return;
    first = false;
    for (const line of lines) {
      const length = line.getTotalLength();
      line.animate([{ strokeDasharray: length, strokeDashoffset: length }, { strokeDasharray: length, strokeDashoffset: 0 }], { duration: 1400, easing: 'cubic-bezier(.5,0,.2,1)' });
    }
    for (const end of ends) end.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], { duration: 1500 });
  }

  function show(mode) {
    const from = blend, to = mode === 'review' ? 1 : 0;
    stop();
    stop = tween(900, t => { blend = lerp(from, to, t); draw(); });
    readout.textContent = TEXT[mode];
    hideGuide();
  }
  for (const input of figure.querySelectorAll('input[name="fraud-x"]')) {
    input.addEventListener('change', () => show(input.value));
    if (input.checked && input.value === 'review') { blend = 1; readout.textContent = TEXT.review; }
  }

  // Draw the chart when it comes into view, so the lines are seen arriving.
  let narrow = isNarrow();
  new IntersectionObserver((entries, self) => {
    if (!entries.at(-1).isIntersecting) return;
    self.disconnect();
    build(narrow);
    new ResizeObserver(() => { if (isNarrow() !== narrow) { narrow = isNarrow(); build(narrow); } }).observe(chart);
  }, { threshold: .25 }).observe(chart);
}
