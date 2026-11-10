// Four small instruments for the Software section. The numbers and rules come from the
// repositories they describe: ClaimFence, CanaryLedger, BTC-Execution-Lab and parcel-invoice-audit.
import { el, svg, tween, lerp, group, reducedMotion } from './kit.js';

const possessive = name => name[0].toUpperCase() + name.slice(1) + '’s';
const cap = name => name[0].toUpperCase() + name.slice(1);

// ---------- ClaimFence: checks/policy.csv and evidence/mutations.json ----------
const PEOPLE = { lee: ['north', 'employee'], mara: ['north', 'reviewer'], oren: ['north', 'employee'], vale: ['south', 'reviewer'] };
const ACTORS = ['lee', 'mara', 'oren', 'vale', 'guest'];
const OWNERS = ['lee', 'mara', 'oren', 'vale', 'missing'];
// [read, approve] for each actor and claim owner, in the order above.
const POLICY = {
  lee: [[200, 403], [404, 404], [404, 404], [404, 404], [404, 404]],
  mara: [[200, 200], [200, 403], [200, 200], [404, 404], [404, 404]],
  oren: [[404, 404], [404, 404], [200, 403], [404, 404], [404, 404]],
  vale: [[404, 404], [404, 404], [404, 404], [200, 403], [404, 404]],
  guest: [[401, 401], [401, 401], [401, 401], [401, 401], [401, 401]],
};
const FAULTS = {
  'unscoped-item': { fails: 8, witness: 'mara/read/vale', got: 200, text: 'Mara reads Vale’s claim and gets it back with a 200. Vale works at South, so it should have been a 404.' },
  'unscoped-list': { fails: 2, witness: 'mara/list/all', got: 200, text: 'Mara lists claims and Vale’s airport transfer from South is in there. The status is still 200, so only the check on the body notices.' },
  'self-approval': { fails: 2, witness: 'mara/approve/mara', got: 200, text: 'Mara approves her own client lunch and gets a 200 where the policy says 403. The claim and the approval journal changed too.' },
  'private-field': { fails: 10, witness: 'lee/read/lee', got: 200, text: 'Lee reads his own claim and the response includes the reviewer’s internal note. The status is still 200.' },
};

function explain(actor, kind, owner, status) {
  const who = cap(actor);
  if (kind === 'list') return status === 401 ? 'A guest has no token, so the list is refused.' : `${who} gets the claims ${actor === 'mara' || actor === 'vale' ? 'in their organisation' : 'they own'} and nothing else.`;
  const whose = owner === 'missing' ? 'a claim that doesn’t exist' : owner === actor ? 'their own claim' : possessive(owner) + ' claim';
  const verb = kind === 'read' ? 'reads' : 'tries to approve';
  const lead = `${who} ${verb} ${whose}: ${status}. `;
  if (status === 401) return lead + 'No token, no answer.';
  if (status === 404) return lead + (owner === 'missing' ? 'Nothing there.' : 'They aren’t allowed to see it, so it looks exactly like a claim that doesn’t exist.');
  if (status === 403) return lead + (PEOPLE[actor][1] === 'employee' ? 'They can see it, but employees never approve.' : 'A reviewer can’t sign off their own expense.');
  return lead + (kind === 'read' ? 'Allowed.' : 'A reviewer approving someone else in their organisation.');
}

export function matrix(figure) {
  const wrap = figure.querySelector('.matrix-wrap'), readout = figure.querySelector('.readout');
  const cells = [];
  const make = (actor, kind, owner, status) => {
    const button = el('button', { type: 'button', class: 'pending', text: status, 'aria-label': explain(actor, kind, owner, status) });
    const cell = { button, status, id: `${actor}/${kind}/${kind === 'list' ? 'all' : owner}`, note: explain(actor, kind, owner, status) };
    const tell = () => { readout.textContent = cell.bad ? cell.bad : cell.note; };
    button.addEventListener('pointerenter', tell);
    button.addEventListener('focus', tell);
    button.addEventListener('click', tell);
    cells.push(cell);
    return button;
  };
  const table = el('table', { class: 'matrix' },
    el('thead', {}, el('tr', {}, el('th'), el('th', { scope: 'col', text: 'list' }), ...OWNERS.map(owner => el('th', { scope: 'col', text: owner })))),
    el('tbody', {}, ...ACTORS.map(actor => el('tr', {},
      el('th', { scope: 'row', text: actor }),
      el('td', {}, make(actor, 'list', null, actor === 'guest' ? 401 : 200)),
      ...OWNERS.map((owner, i) => el('td', {}, el('div', { class: 'pair' }, make(actor, 'read', owner, POLICY[actor][i][0]), make(actor, 'approve', owner, POLICY[actor][i][1]))))))));
  wrap.append(table);
  figure.querySelector('.controls').before(el('p', { class: 'cap', text: 'Rows are who is asking and columns are whose claim. In each pair the left request reads the claim and the right one tries to approve it.' }));

  let run = 0;
  function check(faultName) {
    const mine = ++run, fault = FAULTS[faultName];
    const gap = reducedMotion() ? 0 : fault ? 9 : 26;
    for (const cell of cells) { cell.button.className = 'pending'; cell.button.textContent = cell.status; cell.bad = null; }
    const finish = () => {
      readout.textContent = fault ? `${fault.fails} of 55 checks fail. One of them: ${fault.text}` : '55 of 55 checks pass on the reference policy.';
    };
    cells.forEach((cell, i) => {
      const reveal = () => {
        if (mine !== run) return;
        const bad = fault && fault.witness === cell.id;
        cell.button.className = (bad ? 'bad' : 's' + cell.status) + ' pop';
        if (bad) { cell.button.textContent = fault.got; cell.bad = fault.text; }
        if (!fault) readout.textContent = `${i + 1} of 55 checks pass`;
        if (i === cells.length - 1) finish();
      };
      if (gap) setTimeout(reveal, i * gap); else reveal();
    });
  }
  const buttons = [...figure.querySelectorAll('[data-fault]')];
  for (const button of buttons) {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const on = button.getAttribute('aria-pressed') !== 'true';
      for (const other of buttons) other.setAttribute('aria-pressed', other === button && on);
      check(on ? button.dataset.fault : null);
    });
  }
  new IntersectionObserver((entries, self) => {
    if (entries.at(-1).isIntersecting) { self.disconnect(); check(null); }
  }, { threshold: .4 }).observe(table);
}

// ---------- CanaryLedger: examples/*.csv, policy/release.conf and the rules in src/gate.cpp ----------
const EXAMPLES = {
  healthy: `w01,browse,baseline,95000,95,950
w01,browse,candidate,95000,95,950
w01,checkout,baseline,1000,2,15
w01,checkout,candidate,1000,3,20
w02,checkout,baseline,1000,2,15
w02,checkout,candidate,1000,3,20`,
  regression: `w01,browse,baseline,95000,95,950
w01,browse,candidate,95000,95,950
w01,checkout,baseline,1000,2,15
w01,checkout,candidate,1000,15,80
w02,checkout,baseline,1000,2,15
w02,checkout,candidate,1000,15,80`,
  incomplete: `w01,browse,baseline,95000,95,950
w01,browse,candidate,95000,95,950
w01,checkout,baseline,1000,2,15
w01,checkout,candidate,200,0,2
w02,checkout,baseline,1000,2,15`,
};
const RELEASE = { minimum_requests: 500, error_limit_bps: 100, slow_limit_bps: 500, error_increase_bps: 50, slow_increase_bps: 200 };
const REASONS = {
  unpaired_windows: 'the two versions were measured over different windows',
  low_baseline_volume: 'the baseline has fewer than 500 requests',
  low_candidate_volume: 'the candidate has fewer than 500 requests',
  candidate_error_limit: 'errors are over the 1% limit',
  candidate_slow_limit: 'slow requests are over the 5% limit',
  error_regression: 'errors rose by more than 0.5 points',
  latency_regression: 'slow requests rose by more than 2 points',
};
const bps = (part, whole) => (whole ? Math.ceil(part * 10000 / whole) : null);   // round up to a whole basis point
const percent = points => (points / 100).toFixed(2) + '%';

function evaluate(csv) {
  const routes = new Map();
  for (const row of csv.split('\n')) {
    const [window, name, cohort, requests, errors, slow] = row.split(',');
    if (!routes.has(name)) routes.set(name, { name, baseline: { windows: new Set(), requests: 0, errors: 0, slow: 0 }, candidate: { windows: new Set(), requests: 0, errors: 0, slow: 0 } });
    const side = routes.get(name)[cohort];
    side.windows.add(window);
    side.requests += +requests; side.errors += +errors; side.slow += +slow;
  }
  const rank = { PROMOTE: 0, HOLD: 1, ROLLBACK: 2 };
  let overall = 'PROMOTE';
  const list = [...routes.values()].map(route => {
    const { baseline, candidate } = route, reasons = [];
    for (const side of [baseline, candidate]) { side.error = bps(side.errors, side.requests); side.slowRate = bps(side.slow, side.requests); }
    if (baseline.windows.size !== candidate.windows.size || [...baseline.windows].some(w => !candidate.windows.has(w))) reasons.push('unpaired_windows');
    if (baseline.requests < RELEASE.minimum_requests) reasons.push('low_baseline_volume');
    if (candidate.requests < RELEASE.minimum_requests) reasons.push('low_candidate_volume');
    let decision = 'HOLD';
    if (!reasons.length) {
      if (candidate.error > RELEASE.error_limit_bps) reasons.push('candidate_error_limit');
      if (candidate.slowRate > RELEASE.slow_limit_bps) reasons.push('candidate_slow_limit');
      if (candidate.error - baseline.error > RELEASE.error_increase_bps) reasons.push('error_regression');
      if (candidate.slowRate - baseline.slowRate > RELEASE.slow_increase_bps) reasons.push('latency_regression');
      decision = reasons.length ? 'ROLLBACK' : 'PROMOTE';
    }
    if (rank[decision] > rank[overall]) overall = decision;
    return { ...route, decision, reasons };
  });
  return { decision: overall, routes: list };
}

export function gate(figure) {
  const body = figure.querySelector('.gate'), readout = figure.querySelector('.readout');
  const KINDS = [['error', 'errors', 200, RELEASE.error_limit_bps], ['slowRate', 'slower than 250 ms', 1000, RELEASE.slow_limit_bps]];
  const rows = {};
  for (const name of ['browse', 'checkout']) {
    const bars = KINDS.map(([key, label, max, limit]) => {
      const base = el('i', { class: 'base' }), cand = el('i', { class: 'cand' }), value = el('span', { class: 'val' });
      const bar = el('div', { class: 'bar' }, el('span', { class: 'track' }), el('i', { class: 'limit', style: `left:${limit / max * 100}%` }),
        el('span', { class: 'lab', text: `${label}, limit ${percent(limit)}` }), base, cand, value);
      return { key, max, base, cand, value, bar };
    });
    const verdict = el('span', { class: 'verdict small' });
    body.append(el('div', { class: 'route' }, el('b', {}, name, el('br'), verdict), ...bars.map(item => item.bar)));
    rows[name] = { bars, verdict };
  }
  body.append(el('p', { class: 'cap', style: 'margin-top:0', text: 'Aqua is the version running now, violet is the candidate, and the tall mark is the limit.' }));
  const overall = el('span', { class: 'verdict' });

  function show(name) {
    const report = evaluate(EXAMPLES[name]);
    for (const route of report.routes) {
      const row = rows[route.name];
      row.verdict.className = 'verdict small ' + route.decision;
      row.verdict.textContent = route.decision;
      for (const item of row.bars) {
        const at = side => Math.min(100, side[item.key] / item.max * 100) + '%';
        item.base.style.left = at(route.baseline);
        item.cand.style.left = at(route.candidate);
        item.cand.style.opacity = route.decision === 'HOLD' ? .35 : 1;
        item.value.style.left = at(route.candidate);
        item.value.textContent = route.decision === 'HOLD' ? `${group(route.candidate.requests)} requests` : percent(route.candidate[item.key]);
      }
    }
    const checkout = report.routes.find(route => route.name === 'checkout'), { baseline, candidate } = checkout;
    const all = report.routes.reduce((sum, route) => ({ requests: sum.requests + route.candidate.requests, errors: sum.errors + route.candidate.errors }), { requests: 0, errors: 0 });
    overall.className = 'verdict ' + report.decision;
    overall.textContent = report.decision;
    const why = checkout.reasons.map(reason => REASONS[reason]);
    const sentence = report.decision === 'PROMOTE'
      ? `Checkout fails ${candidate.errors} of ${group(candidate.requests)} candidate requests, ${percent(candidate.error)} against ${percent(baseline.error)} before. Everything is inside the limits.`
      : report.decision === 'HOLD'
        ? `No decision on checkout yet: ${why.join(', and ')}.`
        : `Across the site the candidate fails ${all.errors} of ${group(all.requests)} requests, ${(all.errors / all.requests * 100).toFixed(2)}%. Checkout alone fails ${candidate.errors} of ${group(candidate.requests)}, ${percent(candidate.error)} against ${percent(baseline.error)} before.`;
    readout.replaceChildren(overall, ' ', sentence);
    overall.classList.remove('stamp');
    void overall.offsetWidth;
    overall.classList.add('stamp');
  }
  for (const input of figure.querySelectorAll('input[name="gate-file"]')) {
    input.addEventListener('change', () => show(input.value));
    if (input.checked) show(input.value);
  }
}

// ---------- BTC Execution Lab: volume_weights() and simulate() from engine/replay.hpp ----------
// BTCUSDT one-minute volume for 08:00 to 08:59 UTC on 8 June 2024, and the share of the hour
// each minute had on average over the seven days before. Source bars: Binance Vision.
const VOLUME = [16.398,20.068,8.586,11.228,11.362,11.192,2.291,2.674,8.035,5.825,14.183,16.791,1.769,10.397,2.906,2.589,4.039,9.2,1.53,5.396,5.738,2.778,4.144,2.159,4.717,2.174,1.697,4.348,1.792,0.99,10.548,1.271,1.204,7.759,7.335,15.5,4.223,4.605,1.704,1.287,1.384,2.472,11.74,14.944,3.6,10.893,4.108,5.122,1.841,2.049,2.078,4.895,5.451,2.613,7.121,11.971,12.388,3.43,2.307,1.404];
const FORECAST = [0.01785,0.02943,0.01911,0.02319,0.01682,0.02977,0.02409,0.01386,0.01271,0.02195,0.02083,0.01534,0.01389,0.01686,0.01447,0.01686,0.01583,0.01756,0.01914,0.01871,0.01208,0.01106,0.01643,0.0293,0.01519,0.01101,0.01686,0.00818,0.01353,0.01949,0.01751,0.00865,0.01665,0.01267,0.01244,0.01482,0.01704,0.01065,0.01004,0.01417,0.01309,0.02714,0.01876,0.0126,0.0128,0.01476,0.01133,0.01828,0.00793,0.01142,0.02884,0.0232,0.01449,0.02577,0.01652,0.01244,0.01405,0.01528,0.01678,0.01846];
const PARTICIPATION = 0.05;

function simulate(quantity, weights) {
  let executed = 0, cumulative = 0;
  const target = [], filled = [], fills = [];
  for (let minute = 0; minute < 60; minute++) {
    cumulative += weights[minute];
    const goal = minute === 59 ? quantity : quantity * Math.min(1, cumulative);
    const requested = Math.max(0, goal - executed);
    const fill = Math.min(requested, PARTICIPATION * VOLUME[minute]);   // the request is set before the minute's volume is known
    executed += fill;
    target.push(goal); filled.push(executed); fills.push(fill);
  }
  return { target, filled, fills, done: executed / quantity };
}

export function schedule(figure) {
  const readout = figure.querySelector('.readout'), chart = figure.querySelector('.chart');
  const isNarrow = () => chart.clientWidth < 480;
  let shown = null, stop = () => {}, draw = () => {};

  function build(narrow) {
    const W = narrow ? 380 : 640, H = narrow ? 250 : 270;
    const box = { left: 4, right: W - (narrow ? 62 : 80), top: 12, bottom: H - 92, band: H - 20 };
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Order filled over one hour against the schedule it was following' });
    const x = minute => lerp(box.left, box.right, minute / 60);
    const capMax = Math.max(...VOLUME) * PARTICIPATION, bandHeight = box.band - box.bottom - 16, wide = x(1) - x(0);
    const bar = (kind, minute, height) => svg('rect', { class: kind, x: x(minute) + wide * .1, width: wide * .8, y: box.band - height, height });
    const capBars = VOLUME.map((volume, minute) => bar('vol', minute, volume * PARTICIPATION / capMax * bandHeight));
    const fillBars = VOLUME.map((_, minute) => bar('fill', minute, 0));
    const want = svg('path', { class: 'want', 'stroke-dasharray': '4 4' }), got = svg('path', { class: 'got' });
    const end = svg('text', { class: 'end' }), wantEnd = svg('text', {});
    root.append(svg('line', { class: 'axis', x1: box.left, x2: box.right, y1: box.bottom, y2: box.bottom }),
      svg('line', { class: 'axis', x1: box.left, x2: box.right, y1: box.band, y2: box.band }),
      ...capBars, ...fillBars, want, got, end, wantEnd,
      svg('text', { x: box.left, y: H - 4, text: '08:00' }), svg('text', { x: box.right, y: H - 4, 'text-anchor': 'end', text: '09:00' }),
      svg('text', { x: box.right + 7, y: box.band - 2, text: '5% cap' }));
    chart.replaceChildren(root);

    draw = state => {
      const y = value => lerp(box.bottom, box.top, value / state.quantity);
      const path = values => 'M' + x(0) + ' ' + y(0) + values.map((value, minute) => `L${x(minute + 1).toFixed(1)} ${y(value).toFixed(1)}`).join('');
      want.setAttribute('d', path(state.target));
      got.setAttribute('d', path(state.filled));
      state.fills.forEach((fill, minute) => {
        const height = fill / capMax * bandHeight;
        fillBars[minute].setAttribute('y', box.band - height);
        fillBars[minute].setAttribute('height', height);
      });
      end.setAttribute('x', box.right + 7);
      end.setAttribute('y', y(state.filled[59]) + 4);
      end.textContent = (state.filled[59] / state.quantity * 100).toFixed(1) + '%';
      wantEnd.setAttribute('x', box.right + 7);
      wantEnd.setAttribute('y', y(state.quantity) + 4);
      wantEnd.textContent = Math.round(state.quantity) + ' BTC';
    };
    if (shown) draw(shown);
  }

  function update() {
    const policy = figure.querySelector('input[name="sched-policy"]:checked').value;
    const quantity = Number(figure.querySelector('input[name="sched-size"]:checked').value);
    const even = Array(60).fill(1 / 60);
    const next = { quantity, ...simulate(quantity, policy === 'twap' ? even : FORECAST) };
    const rival = simulate(quantity, policy === 'twap' ? FORECAST : even);
    const from = shown || { ...next, target: next.target.map(() => 0), filled: next.filled.map(() => 0), fills: next.fills.map(() => 0) };
    stop();
    stop = tween(800, t => {
      const mix = (a, b) => a.map((value, i) => lerp(value, b[i], t));
      shown = { quantity: lerp(from.quantity, next.quantity, t), target: mix(from.target, next.target), filled: mix(from.filled, next.filled), fills: mix(from.fills, next.fills) };
      draw(shown);
    });
    readout.textContent = `${next.filled[59].toFixed(1)} of ${quantity} BTC filled by 09:00, ${(next.done * 100).toFixed(1)}%. `
      + `${policy === 'twap' ? 'The volume schedule' : 'Even slices'} would have reached ${(rival.done * 100).toFixed(1)}%.`;
  }
  for (const input of figure.querySelectorAll('input')) input.addEventListener('change', update);

  let narrow = isNarrow();
  new IntersectionObserver((entries, self) => {
    if (!entries.at(-1).isIntersecting) return;
    self.disconnect();
    build(narrow);
    update();
    new ResizeObserver(() => { if (isNarrow() !== narrow) { narrow = isNarrow(); build(narrow); } }).observe(chart);
  }, { threshold: .3 }).observe(chart);
}

// ---------- Parcel invoice audit: data/invoice_events.jsonl, data/tariffs.csv, audit/reconcile.py ----------
// Each event is [line in the file, revision, billed grosz].
const TARIFF = { 'Vistula B': [1250, 140], 'Baltic B': [1100, 150] };
const PARCELS = {
  PK00017: { carrier: 'Vistula B', grams: 2400, events: [[260, 2, 1430], [528, 1, 1530]] },
  PK00211: { carrier: 'Baltic B', grams: 2400, events: [[684, 1, 1430], [974, 1, 1400]] },
  PK00036: { carrier: 'Baltic B', grams: 3500, events: [[0, 1, 2000]] },
};
const pln = cents => (cents / 100).toFixed(2);

export function parcel(figure) {
  const out = figure.querySelector('.trace');
  function show(id) {
    const { carrier, grams, events } = PARCELS[id];
    const [base, extra] = TARIFF[carrier], [name, zone] = carrier.split(' ');
    const rows = [];
    const top = Math.max(...events.map(event => event[1]));
    const winners = events.filter(event => event[1] === top);
    const conflict = new Set(winners.map(event => event[2])).size > 1;
    const bills = el('span', { class: 'v' });
    events.forEach(([line, revision, cents], i) => {
      const text = `revision ${revision}, PLN ${pln(cents)}`;
      bills.append(i ? el('br') : '', revision === top ? text : el('s', { text }));
    });
    rows.push(['Invoices', bills]);
    if (conflict) {
      rows.push(['Problem', 'Two different bills both say they are revision 1. Taking whichever line came last would make the answer depend on upload order.']);
      rows.push(['Result', el('span', {}, el('mark', { text: 'Held' }), ' Both records are kept as evidence and the parcel is left out of the priced totals.')]);
    } else {
      const billed = winners[0][2];
      if (events.length > 1) {
        const apart = events.find(event => event[1] !== top)[0] - winners[0][0];
        rows.push(['Which one', `The highest revision wins, wherever it sits in the file. Here it turns up ${Math.abs(apart)} lines ${apart > 0 ? 'before' : 'after'} the bill it replaces.`]);
      }
      const started = Math.floor((grams - 1) / 1000) + 1, more = started - 1;   // the first started kilogram is in the base charge
      const expected = base + more * extra, variance = billed - expected;
      rows.push(['Tariff', `${name}, zone ${zone}: PLN ${pln(base)}, then PLN ${pln(extra)} for each extra started kilogram`]);
      rows.push(['Weight', `${group(grams)} g is ${started} started kilograms, so ${more} extra`]);
      rows.push(['Expected', el('span', { class: 'v', text: `${pln(base)} + ${more} × ${pln(extra)} = ${pln(expected)}` })]);
      rows.push(['Result', variance > 0
        ? el('span', {}, el('mark', { text: `PLN ${pln(variance)} over` }), ` Billed ${pln(billed)}, so it joins the dispute queue. The sample month ends with 121 of those, worth PLN 361.50.`)
        : el('span', {}, el('mark', { text: `PLN ${pln(-variance)} under` }), ` Billed ${pln(billed)}. Undercharges are reported separately and stay out of the dispute queue.`)]);
    }
    out.replaceChildren(...rows.map(([label, value], i) => el('div', { class: 'row', style: `animation-delay:${reducedMotion() ? 0 : i * 130}ms` },
      el('span', { text: label }), typeof value === 'string' ? el('span', { text: value }) : value)));
  }
  for (const input of figure.querySelectorAll('input[name="parcel-id"]')) {
    input.addEventListener('change', () => show(input.value));
    if (input.checked) show(input.value);
  }
}
