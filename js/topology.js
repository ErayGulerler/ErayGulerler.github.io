// A toy link-state network. Every router keeps its own copy of the link database,
// runs Dijkstra on it, and forwards packets hop by hop from its own table.
// News about a link travels between neighbours, slower than the packets, so the
// routers disagree for a while after a change. That disagreement is the interesting part.
import { svg, el, reducedMotion, whileVisible } from './kit.js';
import { attachConsole } from './console.js';

const ROUTERS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'];
const LINKS = [
  ['r1', 'r2', 10], ['r1', 'r3', 10], ['r2', 'r4', 10], ['r3', 'r4', 15],
  ['r2', 'r5', 25], ['r3', 'r6', 20], ['r4', 'r5', 10], ['r4', 'r6', 10],
  ['r5', 'r7', 10], ['r6', 'r7', 20], ['r4', 'r7', 30],
].map(([a, b, cost], id) => ({ id, a, b, cost, up: true, seq: 0 }));
const FLOWS = [
  { from: 'r1', to: 'r7', colour: 'var(--yellow)' },
  { from: 'r7', to: 'r3', colour: 'var(--aqua-fill)' },
  { from: 'r6', to: 'r2', colour: 'var(--violet-fill)' },
];
const LAYOUTS = {
  wide: { w: 900, h: 470, at: { r1: [70, 235], r2: [262, 100], r3: [258, 378], r4: [448, 232], r5: [630, 92], r6: [636, 384], r7: [830, 232] }, hint: [716, 30] },
  tall: { w: 480, h: 590, at: { r1: [240, 62], r2: [92, 176], r3: [388, 176], r4: [240, 296], r5: [92, 420], r6: [388, 420], r7: [240, 536] }, hint: [22, 520] },
};
const PACKET_SPEED = 170;   // pixels a second
const NEWS_SPEED = 90;      // link-state updates crawl so you can watch them
const EVERY = 0.72;         // seconds between packets of one flow
const TTL = 14;

const other = (link, name) => (link.a === name ? link.b : link.a);
const linksOf = name => LINKS.filter(link => link.a === name || link.b === name);

function shortestPaths(source, database) {
  const dist = Object.fromEntries(ROUTERS.map(name => [name, Infinity]));
  const first = {};
  dist[source] = 0;
  const open = new Set(ROUTERS);
  while (open.size) {
    let here = null;
    for (const name of open) if (here === null || dist[name] < dist[here]) here = name;
    if (dist[here] === Infinity) break;
    open.delete(here);
    for (const link of linksOf(here)) {
      if (!database[link.id].up) continue;
      const there = other(link, here);
      const cost = dist[here] + link.cost;
      const hop = here === source ? there : first[here];
      if (cost < dist[there] || (cost === dist[there] && hop < first[there])) {
        dist[there] = cost;
        first[there] = hop;
      }
    }
  }
  return { dist, first };
}

export function topology(figure) {
  const still = reducedMotion();
  const stage = figure.querySelector('.stage');
  const flowList = figure.querySelector('.flows');
  const tableBody = figure.querySelector('.routes tbody');
  const tableTitle = figure.querySelector('.routes caption');
  const tally = figure.querySelector('.tally');
  let cli = { note() {}, setPrompt() {} };

  const routers = Object.fromEntries(ROUTERS.map(name => [name, {
    name,
    database: LINKS.map(() => ({ seq: 0, up: true })),
    table: null,
  }]));
  for (const router of Object.values(routers)) router.table = shortestPaths(router.name, router.database);

  let layout, root, layers, nodeEls = {}, linkEls = [];
  let clock = 0, selected = 'r1', hintGone = false;
  let packets = [], news = [], rings = [];
  let delivered = 0, lost = 0, changeBegan = null, lastHeard = 0;
  const nextSend = FLOWS.map((_, i) => 0.9 + i * 0.24);

  const point = name => layout.at[name];
  const length = link => Math.hypot(point(link.b)[0] - point(link.a)[0], point(link.b)[1] - point(link.a)[1]);
  const linkBetween = (a, b) => LINKS.find(link => (link.a === a && link.b === b) || (link.a === b && link.b === a));

  // ---------- drawing ----------
  function build() {
    layout = LAYOUTS[stage.clientWidth < 520 ? 'tall' : 'wide'];
    stage.replaceChildren();
    root = svg('svg', { viewBox: `0 0 ${layout.w} ${layout.h}`, role: 'group', 'aria-label': 'Network of seven routers. Links and routers are buttons.' });
    const fade = svg('radialGradient', { id: 'topo-fade' },
      svg('stop', { offset: '.35', 'stop-color': '#fff' }), svg('stop', { offset: '1', 'stop-color': '#000' }));
    root.append(svg('defs', {}, fade, svg('mask', { id: 'topo-mask' }, svg('rect', { width: layout.w, height: layout.h, fill: 'url(#topo-fade)' }))));
    const grid = svg('g', { class: 'grid', mask: 'url(#topo-mask)', 'aria-hidden': 'true' });
    for (let x = -layout.h * 2; x < layout.w + layout.h * 2; x += 56) {
      grid.append(svg('line', { x1: x, y1: 0, x2: x + layout.h * 2, y2: layout.h }));
      grid.append(svg('line', { x1: x, y1: 0, x2: x - layout.h * 2, y2: layout.h }));
    }
    layers = { links: svg('g'), paths: svg('g'), news: svg('g'), packets: svg('g'), nodes: svg('g'), rings: svg('g') };
    root.append(grid, ...Object.values(layers));

    linkEls = LINKS.map(link => {
      const [x1, y1] = point(link.a), [x2, y2] = point(link.b);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const group = svg('g', { class: 'link', tabindex: 0, role: 'button' },
        svg('line', { class: 'hit', x1, y1, x2, y2 }),
        svg('line', { class: 'wire', x1, y1, x2, y2 }),
        svg('path', { class: 'cut', d: `M${mx - 5} ${my - 5}l10 10M${mx + 5} ${my - 5}l-10 10`, transform: `translate(${(x1 - x2) * .16} ${(y1 - y2) * .16})` }),
        svg('text', { class: 'cost', x: mx, y: my, text: link.cost }));
      group.addEventListener('click', () => toggle(link));
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(link); }
      });
      layers.links.append(group);
      return group;
    });

    nodeEls = {};
    for (const name of ROUTERS) {
      const [x, y] = point(name);
      const w = 33, h = 16.5, t = 11;
      const leds = [0, 1, 2].map(i => svg('path', { class: 'led', d: `M${x + 8 + i * 7} ${y + h + 1.5 - (4 + i * 3.5)}l4 -2v4l-4 2z` }));
      const body = svg('g', { class: 'body' },
        svg('path', { class: 'left', d: `M${x - w} ${y}L${x} ${y + h}v${t}L${x - w} ${y + t}z` }),
        svg('path', { class: 'right', d: `M${x} ${y + h}L${x + w} ${y}v${t}L${x} ${y + h + t}z` }),
        svg('path', { class: 'top', d: `M${x} ${y - h}L${x + w} ${y}L${x} ${y + h}L${x - w} ${y}z` }),
        ...leds,
        svg('text', { x, y: y - h - 9, text: name }));
      const group = svg('g', { class: 'node', tabindex: 0, role: 'button' }, body);
      group.leds = leds;
      group.addEventListener('click', () => select(name));
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(name); }
      });
      for (const type of ['pointerenter', 'focus']) group.addEventListener(type, () => showTree(name));
      for (const type of ['pointerleave', 'blur']) group.addEventListener(type, () => showTree(null));
      layers.nodes.append(group);
      nodeEls[name] = group;
    }

    if (!hintGone) {
      const [hx, hy] = layout.hint;
      const target = LINKS[8];
      const tx = (point(target.a)[0] + point(target.b)[0]) / 2, ty = (point(target.a)[1] + point(target.b)[1]) / 2;
      const sx = hx + (layout === LAYOUTS.wide ? 30 : 70), sy = hy + (layout === LAYOUTS.wide ? 12 : -22);
      const ex = tx + (layout === LAYOUTS.wide ? 12 : -16), ey = ty + (layout === LAYOUTS.wide ? -16 : 14);
      const bend = layout === LAYOUTS.wide ? [sx + 46, (sy + ey) / 2 - 20] : [(sx + ex) / 2, sy - 30];
      const angle = Math.atan2(ey - bend[1], ex - bend[0]);
      const head = [-2.6, 2.6].map(side => `M${ex} ${ey}L${ex - 11 * Math.cos(angle + side / 6)} ${ey - 11 * Math.sin(angle + side / 6)}`).join('');
      root.append(svg('g', { class: 'hint', 'aria-hidden': 'true' },
        svg('text', { x: hx, y: hy, text: 'cut this link' }),
        svg('path', { d: `M${sx} ${sy}Q${bend[0]} ${bend[1]} ${ex} ${ey}${head}` })));
    }
    stage.append(root);
    for (const item of packets) layers.packets.append(item.el);
    for (const item of news) layers.news.append(item.el);
    paint();
  }

  function paint() {
    LINKS.forEach((link, i) => {
      linkEls[i].classList.toggle('down', !link.up);
      linkEls[i].setAttribute('aria-label', `Link ${link.a} to ${link.b}, cost ${link.cost}, ${link.up ? 'up. Press to cut it.' : 'cut. Press to restore it.'}`);
    });
    for (const name of ROUTERS) {
      nodeEls[name].classList.toggle('sel', name === selected);
      nodeEls[name].setAttribute('aria-label', `Router ${name}. Press to show its routes.`);
    }
    paintTable();
    paintFlows();
    if (still) paintStillPaths();
  }

  let oldRows = {};
  function paintTable() {
    const table = routers[selected].table;
    tableTitle.textContent = `What ${selected} believes`;
    const rows = ROUTERS.filter(name => name !== selected).map(name => {
      const reach = table.dist[name] < Infinity;
      const text = reach ? `${table.first[name]} ${table.dist[name]}` : 'none';
      const row = el('tr', { class: reach ? '' : 'none' },
        el('td', { text: name }), el('td', { text: reach ? table.first[name] : 'no route' }), el('td', { text: reach ? table.dist[name] : '' }));
      const key = selected + name;
      if (oldRows[key] !== undefined && oldRows[key] !== text) row.classList.add('changed');
      oldRows[key] = text;
      return row;
    });
    tableBody.replaceChildren(...rows);
  }

  // Follow the tables from router to router, the way a packet would right now.
  function walk(flow) {
    const hops = [flow.from];
    let here = flow.from;
    while (here !== flow.to && hops.length <= TTL) {
      const hop = routers[here].table.first[flow.to];
      if (!hop || !linkBetween(here, hop).up) return { hops, fate: 'dropped at ' + here };
      if (hops.at(-2) === hop) return { hops: [...hops, hop], fate: 'bouncing' };
      hops.push(hop);
      here = hop;
    }
    return here === flow.to ? { hops, fate: null } : { hops, fate: 'looping' };
  }
  const oldPaths = [];
  function paintFlows() {
    FLOWS.forEach((flow, i) => {
      const { hops, fate } = walk(flow);
      const text = hops.join(' ') + (fate ? ', ' + fate : '');
      const line = flowList.children[i].querySelector('.path');
      if (oldPaths[i] !== undefined && oldPaths[i] !== text) {
        line.classList.remove('flash');
        void line.offsetWidth;
        line.classList.add('flash');
      }
      oldPaths[i] = text;
      line.classList.toggle('lost', Boolean(fate));
      line.replaceChildren(el('b', { text: hops.join(' ') }), fate ? ', ' + fate : '');
    });
  }
  function paintStillPaths() {
    layers.paths.replaceChildren(...FLOWS.map((flow, i) => {
      const { hops } = walk(flow);
      const d = hops.map((name, n) => (n ? 'L' : 'M') + (point(name)[0] + (i - 1) * 5) + ' ' + (point(name)[1] + (i - 1) * 5)).join('');
      return svg('path', { class: 'flowpath', d, stroke: flow.colour });
    }));
  }

  function showTree(name) {
    const inTree = new Set();
    if (name) {
      const { dist, first } = routers[name].table;
      for (const link of LINKS) {
        if (!routers[name].database[link.id].up) continue;
        for (const [near, far] of [[link.a, link.b], [link.b, link.a]]) {
          if (dist[far] === dist[near] + link.cost && (near === name ? first[far] === far : first[far] === first[near])) inTree.add(link.id);
        }
      }
    }
    linkEls.forEach((group, i) => group.classList.toggle('tree', inTree.has(i)));
  }

  function select(name) {
    selected = name;
    oldRows = {};
    paint();
    cli.setPrompt();
  }

  // ---------- the protocol ----------
  function ring(name, colour) {
    if (still) return;
    const [x, y] = point(name);
    const circle = svg('circle', { class: 'ring', cx: x, cy: y, r: 8, stroke: colour });
    layers.rings.append(circle);
    rings.push({ el: circle, born: clock });
  }

  function learn(name, linkId, seq, up, from) {
    const router = routers[name];
    if (router.database[linkId].seq >= seq) return;
    router.database[linkId] = { seq, up };
    router.table = shortestPaths(name, router.database);
    lastHeard = clock;
    ring(name, up ? 'var(--aqua)' : 'var(--orange)');
    for (const link of linksOf(name)) {
      const neighbour = other(link, name);
      if (neighbour !== from && link.up) tell(name, neighbour, link, linkId, seq, up);
    }
    paint();
  }

  function tell(from, to, via, linkId, seq, up) {
    if (still) { queueMicrotask(() => learn(to, linkId, seq, up, from)); return; }
    const mark = svg('path', { class: 'lsa', d: 'M0 -5L5 0L0 5L-5 0z', stroke: up ? 'var(--aqua)' : 'var(--orange)' });
    layers.news.append(mark);
    news.push({ el: mark, from, to, via, linkId, seq, up, gone: 0 });
  }

  function toggle(link) {
    link.up = !link.up;
    link.seq += 1;
    changeBegan = clock;
    if (!hintGone) { hintGone = true; root.querySelector('.hint')?.classList.add('gone'); }
    if (!link.up) {
      for (const packet of packets) if (packet.link === link) drop(packet);
      news = news.filter(item => item.via !== link || (item.el.remove(), false));
    }
    learn(link.a, link.id, link.seq, link.up, null);
    learn(link.b, link.id, link.seq, link.up, null);
    if (link.up) {
      // A new adjacency: the two ends compare databases and pass on whatever the other is missing.
      for (const [from, to] of [[link.a, link.b], [link.b, link.a]]) {
        routers[from].database.forEach((entry, id) => {
          if (entry.seq > routers[to].database[id].seq) tell(from, to, link, id, entry.seq, entry.up);
        });
      }
    }
    cli.note(`${link.a} to ${link.b} is ${link.up ? 'back up' : 'down'}`);
    paint();
    if (still) changeBegan = null;
  }

  // ---------- packets ----------
  function send(flow, done) {
    const dot = svg('circle', { class: done ? 'pkt probe' : 'pkt', r: done ? 5.6 : 4.6, fill: flow.colour });
    const packet = { el: dot, flow, at: flow.from, link: null, to: null, gone: 0, hops: 0, dead: 0, done: false, report: done, sent: clock };
    layers.packets.append(dot);
    packets.push(packet);
    forward(packet);
  }
  function forward(packet) {
    const here = packet.at;
    blink(here);
    if (here === packet.flow.to) {
      if (packet.report) packet.report({ ok: true, hops: packet.hops, seconds: clock - packet.sent });
      else delivered += 1;
      packet.el.remove();
      packet.done = true;
      return;
    }
    const hop = routers[here].table.first[packet.flow.to];
    const link = hop && linkBetween(here, hop);
    if (!hop || !link.up || packet.hops >= TTL) { place(packet, ...point(here)); drop(packet); return; }
    packet.link = link; packet.to = hop; packet.gone = 0; packet.hops += 1;
  }
  function drop(packet) {
    if (packet.dead) return;
    packet.dead = clock + 1e-6;
    if (packet.report) packet.report({ ok: false, at: packet.at, looped: packet.hops >= TTL });
    else lost += 1;
    packet.el.setAttribute('fill', 'var(--orange)');
  }
  function place(packet, x, y) { packet.el.setAttribute('cx', x); packet.el.setAttribute('cy', y); }
  function blink(name) {
    const led = nodeEls[name].leds[Math.floor(Math.random() * 3)];
    led.classList.add('on');
    setTimeout(() => led.classList.remove('on'), 140);
  }

  function tick(dt) {
    clock += dt;
    FLOWS.forEach((flow, i) => { if (clock >= nextSend[i]) { nextSend[i] = clock + EVERY; send(flow); } });

    for (const packet of packets) {
      if (packet.dead) {
        const age = (clock - packet.dead) / .45;
        packet.el.setAttribute('r', 4.6 * (1 + age * 1.6));
        packet.el.setAttribute('opacity', 1 - age);
        if (age >= 1) { packet.el.remove(); packet.done = true; }
        continue;
      }
      if (!packet.link) continue;
      const [ax, ay] = point(packet.at), [bx, by] = point(packet.to);
      const len = length(packet.link);
      packet.gone += PACKET_SPEED * dt;
      if (packet.gone >= len) { packet.at = packet.to; packet.link = null; forward(packet); continue; }
      const t = packet.gone / len, nx = -(by - ay) / len, ny = (bx - ax) / len;
      place(packet, ax + (bx - ax) * t + nx * 4.5, ay + (by - ay) * t + ny * 4.5);
    }
    packets = packets.filter(packet => !packet.done);

    for (const item of news) {
      const [ax, ay] = point(item.from), [bx, by] = point(item.to);
      const len = length(item.via);
      item.gone += NEWS_SPEED * dt;
      const t = Math.min(1, item.gone / len);
      item.el.setAttribute('transform', `translate(${ax + (bx - ax) * t} ${ay + (by - ay) * t})`);
      if (t >= 1) { item.done = true; item.el.remove(); }
    }
    const arrived = news.filter(item => item.done);
    news = news.filter(item => !item.done);
    for (const item of arrived) learn(item.to, item.linkId, item.seq, item.up, item.from);

    for (const item of rings) {
      const age = (clock - item.born) / .9;
      item.el.setAttribute('r', 8 + age * 44);
      item.el.setAttribute('opacity', 1 - age);
      if (age >= 1) { item.el.remove(); item.done = true; }
    }
    rings = rings.filter(item => !item.done);

    if (changeBegan !== null && !news.length) {
      const took = lastHeard - changeBegan;
      cli.note(`every router that could hear about it had heard after ${took.toFixed(1)} seconds`);
      changeBegan = null;
    }
    tally.textContent = `${delivered} packets delivered, ${lost} lost`;
  }

  // What the command line is allowed to do.
  cli = attachConsole(figure.querySelector('.cli'), {
    names: ROUTERS,
    here: () => selected,
    select,
    table: name => routers[name].table,
    neighbours: name => linksOf(name).map(link => ({ to: other(link, name), cost: link.cost, up: routers[name].database[link.id].up })),
    cost: (a, b) => linkBetween(a, b).cost,
    trace: (from, to) => walk({ from, to }),
    setLink(a, b, up) {
      const link = linkBetween(a, b);
      if (!link) return 'none';
      if (link.up === up) return 'same';
      toggle(link);
    },
    restoreAll() {
      const down = LINKS.filter(link => !link.up);
      down.forEach(toggle);
      return down.length > 0;
    },
    ping(from, to, done) {
      if (!still) return send({ from, to, colour: 'var(--ink)' }, done);
      const { hops, fate } = walk({ from, to });
      done(fate ? { ok: false, at: hops.at(-1), looped: !fate.startsWith('dropped') } : { ok: true, hops: hops.length - 1 });
    },
  });

  build();
  let wasTall = layout === LAYOUTS.tall;
  new ResizeObserver(() => {
    const tall = stage.clientWidth < 520;
    if (tall !== wasTall) { wasTall = tall; build(); }
  }).observe(stage);

  if (still) { tally.hidden = true; return; }
  // Bring the lab up: links first, then routers outward from the core.
  linkEls.forEach((group, i) => {
    const wire = group.querySelector('.wire'), len = length(LINKS[i]);
    wire.animate([{ strokeDasharray: len, strokeDashoffset: len }, { strokeDasharray: len, strokeDashoffset: 0 }],
      { duration: 620, delay: 120 + i * 45, fill: 'backwards', easing: 'cubic-bezier(.4,0,.2,1)' });
    group.querySelector('.cost').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 600 + i * 45, fill: 'backwards' });
  });
  const depth = shortestPaths('r4', LINKS.map(() => ({ up: true }))).dist;
  for (const name of ROUTERS) {
    nodeEls[name].animate([{ opacity: 0, transform: 'translateY(-16px)' }, { opacity: 1, transform: 'none' }],
      { duration: 480, delay: depth[name] * 14, fill: 'backwards', easing: 'cubic-bezier(.3,1.5,.5,1)' });
  }
  whileVisible(figure, tick);
}
