// Crude-cartoon toolkit: oval heads, dot eyes, stick arms, flat colors. Every scene is 1920x1080.
const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('s');
function el(name, attrs, parent) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  (parent || svg).appendChild(e);
  return e;
}
function g(attrs, parent) { return el('g', attrs || {}, parent); }
const INK = '#1a1410';
const SKIN = '#f6cf9a';

// Backdrop: a plain wall with a soft spotlight and a teal floor.
function wallAndFloor(floorY) {
  floorY = floorY || 760;
  const defs = el('defs', {});
  const grad = el('radialGradient', { id: 'wall', cx: '50%', cy: '35%', r: '75%' }, defs);
  el('stop', { offset: '0', 'stop-color': '#f1ebdf' }, grad);
  el('stop', { offset: '1', 'stop-color': '#cdc3b1' }, grad);
  el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: 'url(#wall)' });
  el('rect', { x: 0, y: floorY, width: 1920, height: 1080 - floorY, fill: '#5fa39f' });
  el('rect', { x: 0, y: floorY, width: 1920, height: 14, fill: '#3f7f7b' });
}

// The checkout set: snack shelves, a sign that says nothing, the counter with register and card reader.
function checkoutBack() {
  el('rect', { x: 1340, y: 250, width: 420, height: 16, fill: '#9c8a6c' });
  ['#e2473b', '#f2b134', '#4f8fd6', '#7cbf5a', '#e2473b', '#c96bd1'].forEach((c, i) => el('rect', { x: 1356 + i * 68, y: 186, width: 50, height: 64, rx: 6, fill: c, class: 'ink' }));
  el('rect', { x: 1340, y: 420, width: 420, height: 16, fill: '#9c8a6c' });
  ['#f2b134', '#4f8fd6', '#e2473b', '#7cbf5a', '#c96bd1', '#f2b134'].forEach((c, i) => el('rect', { x: 1356 + i * 68, y: 356, width: 50, height: 64, rx: 6, fill: c, class: 'ink' }));
  el('rect', { x: 120, y: 120, width: 520, height: 110, rx: 10, fill: '#2f6f6b', class: 'ink' });
  el('rect', { x: 150, y: 150, width: 300, height: 22, rx: 11, fill: '#dff1ef' });
  el('rect', { x: 150, y: 186, width: 190, height: 22, rx: 11, fill: '#dff1ef' });
}
function counter() {
  el('rect', { x: 1040, y: 660, width: 880, height: 240, fill: '#c98f3a', class: 'ink' });
  el('rect', { x: 1040, y: 660, width: 880, height: 28, fill: '#e0ad5c' });
  el('rect', { x: 1400, y: 500, width: 220, height: 170, rx: 10, fill: '#4a4a52', class: 'ink' });
  el('rect', { x: 1432, y: 528, width: 156, height: 70, rx: 6, fill: '#9fe3a1' });
  el('rect', { x: 1150, y: 560, width: 120, height: 110, rx: 10, fill: '#2b2b30', class: 'ink' });
  el('rect', { x: 1172, y: 580, width: 76, height: 40, rx: 4, fill: '#9fe3a1' });
  el('circle', { cx: 1210, cy: 645, r: 7, fill: '#777' });
}
function basket(x, y) {
  el('path', { d: `M ${x} ${y} L ${x + 40} ${y + 90} L ${x + 150} ${y + 90} L ${x + 190} ${y} Z`, fill: '#d9a521', class: 'ink' });
  el('path', { d: `M ${x + 20} ${y} Q ${x + 95} ${y - 80} ${x + 170} ${y}`, fill: 'none', class: 'ink' });
  el('circle', { cx: x + 60, cy: y, r: 26, fill: '#e2473b', class: 'ink' });
  el('rect', { x: x + 100, y: y - 48, width: 40, height: 60, rx: 6, fill: '#4f8fd6', class: 'ink' });
}

// A person: oval head, dot eyes, stick arms, flat body. Poses are drawn by the caller through arms().
function person(o) {
  const p = g({ transform: `translate(${o.x} ${o.y}) scale(${o.scale || 1})` });
  const skin = o.skin || SKIN;
  if (!o.noLegs) {
    el('line', { x1: -22, y1: 150, x2: -26, y2: 250, class: 'ink' }, p);
    el('line', { x1: 22, y1: 150, x2: 26, y2: 250, class: 'ink' }, p);
    el('ellipse', { cx: -30, cy: 254, rx: 24, ry: 10, fill: INK }, p);
    el('ellipse', { cx: 30, cy: 254, rx: 24, ry: 10, fill: INK }, p);
  }
  el('path', { d: 'M -62 40 Q -70 160 -40 160 L 40 160 Q 70 160 62 40 Q 0 20 -62 40 Z', fill: o.shirt, class: 'ink' }, p);
  if (o.armsBehind) o.armsBehind(p);
  el('ellipse', { cx: 0, cy: -60, rx: 78, ry: 92, fill: skin, class: 'ink' }, p);
  if (o.hair) o.hair(p);
  const ey = o.eyeY == null ? -70 : o.eyeY;
  const ex = o.eyeShift || 0;
  el('circle', { cx: -26 + ex, cy: ey, r: 7, fill: INK }, p);
  el('circle', { cx: 26 + ex, cy: ey, r: 7, fill: INK }, p);
  if (o.lids) {
    el('rect', { x: -40, y: ey - 20, width: 28, height: 16, fill: skin }, p);
    el('rect', { x: 12, y: ey - 20, width: 28, height: 16, fill: skin }, p);
    el('line', { x1: -40, y1: ey - 4, x2: -12, y2: ey - 4, class: 'ink' }, p);
    el('line', { x1: 12, y1: ey - 4, x2: 40, y2: ey - 4, class: 'ink' }, p);
  }
  if (o.brows) o.brows(p);
  el('path', { d: o.mouth || 'M -16 -22 Q 0 -14 16 -22', fill: 'none', class: 'ink' }, p);
  if (o.arms) o.arms(p);
  return p;
}
const hairShort = (color) => (p) => el('path', { d: 'M -74 -92 Q -40 -170 10 -150 Q 60 -165 76 -96 Q 40 -126 0 -118 Q -40 -126 -74 -92 Z', fill: color, class: 'ink' }, p);
const hairBun = (color) => (p) => { el('path', { d: 'M -78 -70 Q -70 -160 0 -150 Q 70 -160 78 -70 Q 40 -112 0 -112 Q -40 -112 -78 -70 Z', fill: color, class: 'ink' }, p); el('circle', { cx: 0, cy: -158, r: 30, fill: color, class: 'ink' }, p); };
const hairCap = (color) => (p) => { el('path', { d: 'M -80 -110 Q 0 -175 80 -110 Z', fill: color, class: 'ink' }, p); el('path', { d: 'M 40 -112 L 120 -104 L 44 -88 Z', fill: color, class: 'ink' }, p); };
const hairKid = (color) => (p) => el('path', { d: 'M -70 -100 Q -30 -150 0 -130 Q 20 -170 40 -130 Q 70 -140 72 -96 Q 0 -120 -70 -100 Z', fill: color, class: 'ink' }, p);

const CARD_COLORS = ['#2d5bd1', '#2f9e5a', '#d9a521', '#8d8d94', '#d14b3a'];
// A fan of credit cards held at (x, y) inside group p.
function cardFan(p, x, y, k) {
  k = k || 1;
  const fan = g({ transform: `translate(${x} ${y}) scale(${k})` }, p);
  CARD_COLORS.forEach((c, i) => {
    el('rect', { x: -32, y: -104, width: 64, height: 104, rx: 7, fill: c, class: 'ink', transform: `rotate(${-40 + i * 20})` }, fan);
    el('rect', { x: -22, y: -94, width: 22, height: 16, rx: 3, fill: '#f3d27a', class: 'ink', 'stroke-width': 3, transform: `rotate(${-40 + i * 20})` }, fan);
  });
  el('circle', { cx: 0, cy: 0, r: 16, fill: SKIN, class: 'ink' }, fan);
  return fan;
}
function sweat(list) {
  list.forEach(([x, y, r, k]) => el('path', { d: 'M 0 -26 Q 16 0 0 18 Q -16 0 0 -26 Z', fill: '#8fd3f4', class: 'ink', transform: `translate(${x} ${y}) rotate(${r}) scale(${k || 1})` }));
}

// Dave: blue shirt, brown hair, and a decision he is not equipped to make.
function dave(o) {
  return person(Object.assign({
    shirt: '#3d79d8', hair: hairShort('#8a4b22'), eyeY: -66,
    mouth: 'M -18 -16 Q -9 -26 0 -16 Q 9 -6 18 -16',
    brows: (p) => { el('line', { x1: -44, y1: -92, x2: -16, y2: -104, class: 'ink' }, p); el('line', { x1: 16, y1: -104, x2: 44, y2: -92, class: 'ink' }, p); },
  }, o));
}
function cashier(o) {
  return person(Object.assign({
    x: 1700, y: 420, scale: 1.15, shirt: '#2f6f6b', hair: hairBun('#2b1b12'), lids: true, eyeY: -66,
    mouth: 'M -14 -18 L 14 -18',
    arms: (p) => { el('line', { x1: -56, y1: 60, x2: -110, y2: 160, class: 'ink' }, p); el('line', { x1: 56, y1: 60, x2: 90, y2: 165, class: 'ink' }, p); }
  }, o));
}
function theLine() {
  person({ x: 560, y: 520, scale: 1.15, shirt: '#c96bd1', hair: hairBun('#d8842a'), eyeY: -66, mouth: 'M -14 -16 L 14 -16',
    brows: (p) => { el('line', { x1: -42, y1: -92, x2: -14, y2: -100, class: 'ink' }, p); el('line', { x1: 14, y1: -100, x2: 42, y2: -92, class: 'ink' }, p); },
    arms: (p) => { el('line', { x1: -56, y1: 60, x2: -40, y2: 150, class: 'ink' }, p); el('line', { x1: 56, y1: 60, x2: 30, y2: 150, class: 'ink' }, p); el('line', { x1: -40, y1: 150, x2: 40, y2: 150, class: 'ink' }, p); }
  });
  person({ x: 300, y: 470, scale: 1.25, shirt: '#e06b2f', hair: hairCap('#2d3f6b'), eyeY: -66, mouth: 'M -12 -14 L 12 -14',
    brows: (p) => { el('line', { x1: -42, y1: -96, x2: -14, y2: -92, class: 'ink' }, p); el('line', { x1: 14, y1: -92, x2: 42, y2: -96, class: 'ink' }, p); },
    arms: (p) => { el('line', { x1: -56, y1: 60, x2: -100, y2: 150, class: 'ink' }, p); el('line', { x1: 56, y1: 60, x2: 100, y2: 150, class: 'ink' }, p); }
  });
  person({ x: 120, y: 640, scale: .8, shirt: '#e2473b', hair: hairKid(INK), eyeY: -62, mouth: 'M -8 -18 Q 0 -10 8 -18',
    arms: (p) => { el('line', { x1: -56, y1: 60, x2: -70, y2: 150, class: 'ink' }, p); el('line', { x1: 56, y1: 60, x2: 70, y2: 150, class: 'ink' }, p); }
  });
}

// A phone, drawn big, with a screen the caller fills in.
function phone(x, y, w, h, fill) {
  const ph = g({ transform: `translate(${x} ${y})` });
  el('rect', { x: 0, y: 0, width: w, height: h, rx: w * .12, fill: '#2b2b30', class: 'ink' }, ph);
  el('rect', { x: w * .06, y: h * .04, width: w * .88, height: h * .92, rx: w * .08, fill: fill || '#F5F2F8' }, ph);
  return ph;
}
