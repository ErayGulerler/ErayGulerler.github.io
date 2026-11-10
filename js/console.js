// The command line under the network figure. It runs on whichever router is selected,
// and the figure writes its own events here too, like a router's log.
import { el } from './kit.js';

const HELP = [
  ['traceroute r7', 'follow the tables hop by hop from this router'],
  ['ping r7', 'send one packet and wait to see if it arrives'],
  ['show route', 'this router’s table'],
  ['show links', 'this router’s neighbours, as it believes them'],
  ['cut r5 r7', 'take a link down'],
  ['restore r5 r7', 'bring it back, or restore all'],
  ['ssh r4', 'move to another router'],
  ['clear', 'empty this log'],
];
const WORDS = ['help', 'traceroute', 'ping', 'show', 'cut', 'restore', 'ssh', 'clear', 'whoami'];

export function attachConsole(form, net) {
  const log = form.querySelector('.cli-log');
  const input = form.querySelector('input');
  const prompt = form.querySelector('.prompt');
  const past = [];
  let at = 0;

  function print(text, kind = 'out') {
    const line = el('div', { class: kind, text });
    log.append(line);
    while (log.children.length > 80) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  const pad = (text, width) => String(text).padEnd(width);
  const isRouter = name => net.names.includes(name);
  const setPrompt = () => { prompt.textContent = `A:${net.here()}#`; };

  const commands = {
    help() {
      for (const [example, about] of HELP) print(`${pad(example, 15)}${about}`);
    },
    '?'() { commands.help(); },
    whoami() {
      print('eray. I study in Warsaw and work on networks at Nokia.');
    },
    clear() { log.replaceChildren(); },
    ssh(name) {
      if (!isRouter(name)) return print(`Usage: ssh r1 to r${net.names.length}`);
      net.select(name);
    },
    show(what = '') {
      const here = net.here();
      if ('route'.startsWith(what) && what) {
        const { dist, first } = net.table(here);
        for (const name of net.names) {
          if (name === here) continue;
          print(dist[name] < Infinity ? `${pad(name, 5)}via ${pad(first[name], 5)}cost ${dist[name]}` : `${pad(name, 5)}no route`);
        }
      } else if ('links'.startsWith(what) && what) {
        for (const link of net.neighbours(here)) print(`${pad(link.to, 5)}cost ${pad(link.cost, 4)}${link.up ? 'up' : 'down'}`);
      } else print('Usage: show route, or show links');
    },
    traceroute(to) {
      const here = net.here();
      if (!isRouter(to) || to === here) return print('Usage: traceroute and a router other than this one');
      const { hops, fate } = net.trace(here, to);
      let cost = 0;
      hops.slice(1).forEach((name, i) => {
        cost += net.cost(hops[i], name);
        print(`${pad(' ' + (i + 1), 4)}${pad(name, 5)}${cost}`);
      });
      if (fate === 'bouncing') print(`    ${hops.at(-1)} and ${hops.at(-2)} are sending it back and forth. One of them hasn’t heard yet.`);
      else if (fate) print(`    ${fate}`);
    },
    ping(to) {
      const here = net.here();
      if (!isRouter(to) || to === here) return print('Usage: ping and a router other than this one');
      net.ping(here, to, result => {
        print(result.ok
          ? `${to} got it after ${result.hops} hop${result.hops > 1 ? 's' : ''}${result.seconds ? ` and ${result.seconds.toFixed(1)} seconds` : ''}`
          : result.looped ? `lost: it went round in a loop until it ran out of hops at ${result.at}` : `lost: dropped at ${result.at}`);
      });
    },
    cut(a, b) { changeLink(a, b, false); },
    restore(a, b) {
      if (a === 'all') return net.restoreAll() || print('Every link is already up.');
      changeLink(a, b, true);
    },
  };
  function changeLink(a, b, up) {
    const result = net.setLink(a, b, up);
    if (result === 'none') print(`There’s no link between those. Try ${up ? 'restore' : 'cut'} r5 r7.`);
    if (result === 'same') print(`That link is already ${up ? 'up' : 'down'}.`);
  }

  function run(text) {
    const line = text.trim().toLowerCase();
    if (!line) return;
    print(`${prompt.textContent} ${line}`, 'cmd');
    past.push(line);
    at = past.length;
    const [word, ...rest] = line.split(/\s+/);
    const matches = Object.keys(commands).filter(name => name.startsWith(word));
    const command = Object.hasOwn(commands, word) ? commands[word] : matches.length === 1 && commands[matches[0]];
    if (command) command(...rest);
    else print(`No command called ${word}. Type help.`);
    setPrompt();
  }

  // Tab completes the word being typed: commands first, then router names.
  function complete() {
    const words = input.value.toLowerCase().split(/\s+/), last = words.pop();
    const pool = words.length ? (words[0] === 'show' ? ['route', 'links'] : [...net.names, 'all']) : WORDS;
    const matches = pool.filter(name => name.startsWith(last));
    if (matches.length === 1) input.value = [...words, matches[0]].join(' ') + ' ';
    else if (matches.length > 1 && last) print(matches.join('  '));
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    run(input.value);
    input.value = '';
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Tab' && input.value) { event.preventDefault(); complete(); }
    if (event.key === 'ArrowUp' && at > 0) { event.preventDefault(); input.value = past[--at]; }
    if (event.key === 'ArrowDown' && at < past.length) { event.preventDefault(); input.value = past[++at] || ''; }
    if (event.key === 'Escape') input.blur();
  });
  for (const chip of form.querySelectorAll('[data-run]')) chip.addEventListener('click', () => run(chip.dataset.run));
  log.addEventListener('click', () => { if (!String(getSelection())) input.focus({ preventScroll: true }); });

  setPrompt();
  log.scrollTop = log.scrollHeight;
  return { note: text => print(text, 'event'), setPrompt };
}
