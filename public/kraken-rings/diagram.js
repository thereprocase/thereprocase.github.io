// Live fit diagram for the ring generator. Pure string output so node checks can render it.
// Wide layout: top view with leaders, detail and legend to the right, sections below.
// Narrow layout (phones): the same parts stacked, with numbered markers and a legend.
import {RING, SPRING, mm} from './kernel.js?v=rings-3';
import {coreOutline} from './core-outline.js';

const C = {ink: '#101010', rule: '#666', blue: '#0000a8', gear: '#e8a45f', gearLine: '#9a5a17', ring: '#5da3ad', ringLine: '#243c40',
  core: '#c6c6c6', coreLine: '#4d4d4d', hole: '#8a5a2b', bite: '#c4320a', paper: '#ffffff'};
const BORE = 18.25; // smallest radius of humebeam's holder bore (snap ribs), from the core slice
const f = x => Number(x).toFixed(2);
const d = x => `Ø${mm(Math.round(x * 100) / 100)}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, s, a = '') => `<text x="${f(x)}" y="${f(y)}" ${a}>${esc(s)}</text>`;
const circle = (cx, cy, r, a) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${a}/>`;
const line = (x1, y1, x2, y2, a) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ${a}/>`;
const path = (points, a) => `<path d="${points.map(([x, y], i) => (i ? 'L' : 'M') + f(x) + ' ' + f(y)).join('')}Z" ${a}/>`;
// Spring fingers as drawn: SPRING.fingers arcs at the peak radius, first one centred on +Y.
const fingerArcs = (p, phase0 = 90) => Array.from({length: SPRING.fingers}, (_, i) => {
  const c = phase0 + 360 / SPRING.fingers * i, h = SPRING.finger_degrees / 2, pts = [];
  for (let j = 0; j <= 16; j++) { const t = (c - h + 2 * h * j / 16) * Math.PI / 180; pts.push([(p.radius + SPRING.bow) * Math.cos(t), (p.radius + SPRING.bow) * Math.sin(t)]); }
  for (let j = 16; j >= 0; j--) { const t = (c - h + 2 * h * j / 16) * Math.PI / 180; pts.push([p.fingerInner * Math.cos(t), p.fingerInner * Math.sin(t)]); }
  return pts;
});
const pentagon = r => Array.from({length: RING.corners}, (_, i) => { const t = (RING.phase_degrees + 72 * i) * Math.PI / 180; return [r * Math.cos(t), r * Math.sin(t)]; });

/** Features labelled on the top view: name, value, note, colour, marker radius, marker angle. */
function features(p) {
  return [
    ['Flange OD · gear side', d(p.flangeOD), `hole + ${mm(2 * RING.flange_radial_reach)}`, C.gear, p.flangeOD / 2, 18],
    ['Cap lip · cap side', d(p.lipDiameter), p.stock === p.hole ? 'hole + 5' : `${p.stock} mm stock lip`, C.ringLine, p.lipDiameter / 2, 8],
    ['Spool hole', d(p.hole), 'your measurement', C.hole, p.radius, -2],
    ['Holder core · from humebeam', d(2 * p.preserve), 'bore and snap ribs unchanged', C.core, p.preserve * .985, -14],
  ];
}
const fitRows = p => p.core === 'spring'
  ? [['Finger peak', d(p.peakDiameter), `hole + ${mm(2 * SPRING.bow)}`, C.bite], ['Spool hole', d(p.hole), 'nominal', C.hole], ['Support core', d(2 * p.support), `hole − ${mm(2 * SPRING.clearance)}`, C.ringLine]]
  : [['Pentagon point', d(2 * p.corner), `hole + ${mm(2 * p.bite)}`, C.bite], ['Spool hole', d(p.hole), 'nominal', C.hole], ['Support core', d(2 * p.support), `hole − ${mm(2 * p.clearance)}`, C.ringLine]];
const grip = (p, X, Y, a) => p.core === 'spring'
  ? fingerArcs(p).map(arc => path(arc.map(([x, y]) => [X(x), Y(y)]), a)).join('')
  : path(pentagon(p.corner).map(([x, y]) => [X(x), Y(y)]), a);

function topView(out, p, cx, cy, radiusPx, numbered) {
  const R = p.flangeOD / 2, s = radiusPx / R, X = x => cx + x * s, Y = y => cy - y * s;
  out.push(circle(cx, cy, R * s, `fill="${C.gear}" fill-opacity=".55" stroke="${C.gearLine}" stroke-width="1.5"`));
  out.push(circle(cx, cy, p.lipDiameter / 2 * s, `fill="none" stroke="${C.ringLine}" stroke-width="1.2" stroke-dasharray="7 5"`));
  out.push(circle(cx, cy, p.support * s, `fill="${C.ring}" stroke="none"`), grip(p, X, Y, `fill="${C.ring}" stroke="${p.core === 'spring' ? C.ringLine : 'none'}"`));
  out.push(circle(cx, cy, p.radius * s, `fill="none" stroke="${C.hole}" stroke-width="1.6" stroke-dasharray="3 3"`));
  const coreD = coreOutline.map(poly => poly.map(([x, y], i) => (i ? 'L' : 'M') + f(X(x)) + ' ' + f(Y(y))).join('') + 'Z').join('');
  out.push(circle(cx, cy, p.preserve * s, `fill="url(#dg-hatch)" stroke="${C.coreLine}" stroke-width="1"`));
  out.push(`<path d="${coreD}" fill="${C.paper}" fill-rule="evenodd" stroke="${C.coreLine}" stroke-width="1"/>`);
  const at = (r, deg) => [X(r * Math.cos(deg * Math.PI / 180)), Y(r * Math.sin(deg * Math.PI / 180))];
  const points = features(p).map(([, , , , r, deg], i) => {
    const pt = at(r, deg);
    if (numbered) out.push(circle(pt[0], pt[1], 11, `fill="${C.paper}" stroke="${C.ink}" stroke-width="1.2"`), text(pt[0], pt[1] + 4.5, String(i + 1), 'class="dg-mark" text-anchor="middle"'));
    return pt;
  });
  return {s, X, Y, points};
}

function detail(out, p, ix, iy, iw, ih, k, view, leader) {
  // Magnified +Y pentagon point or spring finger: the spool hole edge sits 62% down the window.
  const half = iw / 2 / k, above = ih * .62 / k, ox = ix + iw / 2, oy = iy + ih * .62 + p.radius * k, x2 = x => ox + x * k, y2 = y => oy - y * k;
  out.push(`<rect x="${f(view.X(-half))}" y="${f(view.Y(p.radius + above))}" width="${f(2 * half * view.s)}" height="${f(ih / k * view.s)}" fill="none" stroke="${C.blue}" stroke-width="1.5"/>`);
  if (leader) out.push(line(view.X(half), view.Y(p.radius + above), ix, iy, `stroke="${C.blue}" stroke-width="1" stroke-dasharray="4 4"`));
  out.push(`<clipPath id="dg-clip"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}"/></clipPath>`, `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="${C.paper}" stroke="${C.blue}" stroke-width="1.5"/>`);
  out.push(`<g clip-path="url(#dg-clip)">`, circle(ox, oy, p.radius * k, `fill="${C.hole}" fill-opacity=".14" stroke="none"`));
  out.push(circle(ox, oy, p.support * k, `fill="${C.ring}" stroke="${C.ringLine}" stroke-width="1"`), grip(p, x2, y2, `fill="${C.ring}" stroke="${C.ringLine}" stroke-width="1"`));
  out.push(circle(ox, oy, p.support * k - .5, `fill="${C.ring}" stroke="none"`));
  out.push(circle(ox, oy, p.radius * k, `fill="none" stroke="${C.hole}" stroke-width="2" stroke-dasharray="6 4"`), circle(ox, oy, (p.core === 'spring' ? p.peakDiameter / 2 : p.corner) * k, `fill="none" stroke="${C.bite}" stroke-width="1" stroke-dasharray="2 4"`), `</g>`);
  const dim = (r1, r2, x, color, name) => {
    const ya = y2(r1), yb = y2(r2), arrow = `url(#dg-arrow-${color.slice(1)})`;
    out.push(line(x, ya, x, yb, `stroke="${color}" stroke-width="2" marker-start="${arrow}" marker-end="${arrow}"`));
    out.push(line(ox, ya, x + 6, ya, `stroke="${color}" stroke-width=".8"`), line(ox, yb, x + 6, yb, `stroke="${color}" stroke-width=".8"`));
    out.push(text(x + (x < ox ? -8 : 10), (ya + yb) / 2 + 5, name, `class="dg-dim dg-halo" fill="${color}"${x < ox ? ' text-anchor="end"' : ''}`));
  };
  const spring = p.core === 'spring', under = spring ? SPRING.clearance : p.clearance;
  if (spring) dim(p.radius, p.peakDiameter / 2, ox + 70, C.bite, `finger ${mm(SPRING.bow)} out`);
  else if (p.bite > 0) dim(p.radius, p.corner, ox + 70, C.bite, `bite ${mm(p.bite)}`);
  if (under > 0) dim(p.support, p.radius, ox - 60, C.ringLine, `${mm(under)} under`);
  out.push(`<rect x="${ix + 1}" y="${iy + 1}" width="${iw - 2}" height="26" fill="${C.paper}" fill-opacity=".9"/>`, text(ix + 12, iy + 19, `${spring ? 'SPRING FINGER' : 'PENTAGON POINT'} · ${Math.round(k / view.s)}× DETAIL`, 'class="dg-head"'));
}

// Rows of [name, value, note, colour, marker]; cols = [name x, value x, note x or undefined to put the note below].
function legend(out, rows, x, y, step, cols) {
  rows.forEach(([n, v, note, color, marker], i) => {
    const yy = y + i * step;
    if (marker) out.push(circle(x + 8, yy - 5, 11, `fill="${C.paper}" stroke="${C.ink}" stroke-width="1.2"`), text(x + 8, yy - .5, marker, 'class="dg-mark" text-anchor="middle"'));
    else out.push(`<rect x="${x}" y="${yy - 12}" width="15" height="15" fill="${color}"/>`);
    out.push(text(x + cols[0], yy, n, 'class="dg-name"'), text(x + cols[1], yy, v, 'class="dg-value"'));
    out.push(cols[2] !== undefined ? text(x + cols[2], yy, note, 'class="dg-note"') : text(x + cols[0], yy + 19, note, 'class="dg-note"'));
  });
}

function section(out, p, px, top, width, gear, kk) {
  const R = p.flangeOD / 2, r0 = 15.5, base = top + 56 + 11.5 * kk, Z = z => base - z * kk, Rr = r => px + (r - r0) * kk;
  const lipT = gear ? p.gearT : p.capT, h = 10.4 + lipT - RING.lip_thickness, lipR = gear ? R : p.lipDiameter / 2, z1 = h - RING.lead_height;
  const spring = p.core === 'spring', zRoot = lipT + SPRING.root_above_base, peakR = p.peakDiameter / 2, zPeak = zRoot + SPRING.peak_fraction * (z1 - zRoot);
  const tag = (x, y, s, a = 'class="dg-note dg-halo"') => out.push(text(x, y, s, a));
  out.push(text(px, top + 18, gear ? `Gear side · ${mm(p.gearT)} mm flange` : `Cap side · ${mm(p.capT)} mm lip`, 'class="dg-name"'));
  out.push(path([[Rr(p.preserve), Z(lipT)], [Rr(lipR), Z(lipT)], [Rr(lipR), Z(0)], [Rr(p.preserve), Z(0)]], `fill="${gear ? C.gear : C.ring}" stroke="${C.ink}" stroke-width="1"`));
  out.push(path([[Rr(p.preserve), Z(lipT)], [Rr(p.support), Z(lipT)], [Rr(p.support), Z(z1)], [Rr(p.support * p.scale), Z(h)], [Rr(p.preserve), Z(h)]], `fill="${C.ring}" stroke="${C.ink}" stroke-width="1"`));
  const gripLine = spring ? [[p.support, zRoot], [peakR, zPeak], [peakR, z1], [p.support - RING.lead_radial_reduction + 0.2, h]] : [[p.corner, lipT], [p.corner, z1], [p.corner * p.scale, h]];
  out.push(`<polyline points="${gripLine.map(([r, z]) => `${f(Rr(r))},${f(Z(z))}`).join(' ')}" fill="none" stroke="${C.bite}" stroke-width="1.2" stroke-dasharray="4 3"/>`);
  out.push(`<rect x="${f(Rr(BORE))}" y="${f(Z(h))}" width="${f((p.preserve - BORE) * kk)}" height="${f(h * kk)}" fill="url(#dg-hatch)" stroke="${C.coreLine}" stroke-width="1"/>`);
  out.push(line(Rr(p.radius), Z(h + 1.2), Rr(p.radius), Z(-.6), `stroke="${C.hole}" stroke-width="1.4" stroke-dasharray="3 3"`), line(px, base, px + width, base, `stroke="${C.ink}" stroke-width="1"`));
  out.push(line(Rr(BORE) - 3, Z(h), Rr(BORE) - 3, Z(0), `stroke="${C.rule}" stroke-width="1"`));
  tag(Rr(p.radius) + 8, Z(h + .9), `spool hole ${d(p.hole)}`);
  const gripR = spring ? peakR : p.corner;
  tag(Rr(gripR) + 8, Z(z1 + 1), `lead-in ${mm(RING.lead_height)} mm`);
  tag(Rr(gripR) + 8, Z(spring ? zPeak - 1 : z1 / 2), spring ? `finger ${d(p.peakDiameter)}` : `point ${d(2 * p.corner)}`, `class="dg-note dg-halo" fill="${C.bite}"`);
  tag(Rr(lipR) - 4, Z(lipT) - 6, gear ? `${mm(lipT)} mm flange · ${d(p.flangeOD)}` : `${mm(lipT)} mm lip · ${d(p.lipDiameter)}`, 'class="dg-note dg-halo" text-anchor="end"');
  tag(Rr(BORE) - 6, Z(h / 2) + 4, `${mm(h)} mm`, 'class="dg-note dg-halo" text-anchor="end"');
  tag(Rr(BORE) + 4, Z(h) + 14, 'holder core');
  return base;
}

function wrap(W, H, p, body, narrow) {
  const grip = p.core === 'spring' ? `spring finger peak ${d(p.peakDiameter)}` : `pentagon point ${d(2 * p.corner)}`;
  const desc = `Spool hole ${d(p.hole)}; support core ${d(2 * p.support)}; ${grip}; flange OD ${d(p.flangeOD)}, ${mm(p.gearT)} mm thick; cap lip ${d(p.lipDiameter)}, ${mm(p.capT)} mm thick; holder core ${d(2 * p.preserve)}; millimetres.`;
  const arrows = [C.bite, C.ringLine].map(c => `<marker id="dg-arrow-${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${c}"/></marker>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="dg-title dg-desc" class="ring-diagram${narrow ? ' narrow' : ''}"><title id="dg-title">Kraken spool ring fit diagram, ${mm(p.hole)} mm</title><desc id="dg-desc">${esc(desc)}</desc><defs><pattern id="dg-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${C.core}"/><line x1="0" y1="0" x2="0" y2="7" stroke="${C.coreLine}" stroke-width="1.2"/></pattern>${arrows}</defs><rect x="0" y="0" width="${W}" height="${H}" fill="${C.paper}"/>${body.join('')}</svg>`;
}

/** Top view to scale, a magnified pentagon point and both half sections. */
export function ringDiagram(p, {narrow = false} = {}) {
  const out = [];
  if (narrow) {
    const W = 480, view = topView(out, p, W / 2, 268, 205, true);
    out.push(text(16, 26, 'TOP VIEW · TO SCALE', 'class="dg-head"'), text(16, 46, `${mm(p.hole)} mm hole · gear-side flange behind`, 'class="dg-sub"'));
    legend(out, features(p).map(([n, v, note, color], i) => [n, v, note, color, String(i + 1)]), 16, 512, 50, [30, 340]);
    detail(out, p, 16, 714, W - 32, 210, 110, view, false);
    legend(out, fitRows(p), 16, 956, 28, [24, 180, 290]);
    out.push(line(16, 1050, W - 16, 1050, `stroke="${C.rule}"`), text(16, 1076, p.core === 'spring' ? 'HALF SECTIONS · THROUGH A FINGER' : 'HALF SECTIONS · THROUGH A POINT', 'class="dg-head"'));
    const kk = Math.min((W - 60) / (p.flangeOD / 2 + 1.5 - 15.5), 13);
    const b1 = section(out, p, 44, 1086, W - 60, true, kk), b2 = section(out, p, 44, b1 + 20, W - 60, false, kk);
    const H = b2 + 44;
    out.push(text(16, H - 14, `Hatched: humebeam holder core. Dashed red: ${p.core === 'spring' ? 'fingers' : 'points'}.`, 'class="dg-sub"'));
    return wrap(W, H, p, out, true);
  }
  const W = 1000, H = 930, view = topView(out, p, 300, 330, 255, false);
  out.push(text(24, 34, 'TOP VIEW · TO SCALE', 'class="dg-head"'), text(24, 54, `${mm(p.hole)} mm spool hole · gear-side flange behind`, 'class="dg-sub"'));
  features(p).forEach(([name, value, note, color], i) => {
    const y = 110 + 65 * i, from = view.points[i], lx = 610;
    out.push(line(from[0], from[1], lx - 12, y - 5, `stroke="${C.rule}" stroke-width="1"`), circle(from[0], from[1], 3, `fill="${color}" stroke="${C.ink}" stroke-width="1"`));
    out.push(text(lx, y - 8, name, 'class="dg-name"'), text(lx, y + 13, value, 'class="dg-value"'), text(lx + 150, y + 13, note, 'class="dg-note"'));
  });
  detail(out, p, 610, 340, 370, 210, 110, view, true);
  legend(out, fitRows(p), 610, 576, 24, [22, 170, 262]);
  const kk = Math.min(430 / (p.flangeOD / 2 + 1.5 - 15.5), 150 / 11.5);
  out.push(line(20, 650, 980, 650, `stroke="${C.rule}"`), text(24, 674, p.core === 'spring' ? 'HALF SECTIONS · THROUGH A SPRING FINGER' : 'HALF SECTIONS · THROUGH A PENTAGON POINT', 'class="dg-head"'));
  section(out, p, 28, 680, 440, true, kk); section(out, p, 530, 680, 440, false, kk);
  out.push(text(24, H - 14, p.core === 'spring' ? 'Hatched: humebeam\'s holder core. Teal: support circle and spring fingers. Dashed red: finger profile. Dashed brown: spool hole. Millimetres.' : 'Hatched: humebeam\'s holder core. Teal: support circle and pentagon. Dashed red: pentagon points. Dashed brown: spool hole. Millimetres.', 'class="dg-sub"'));
  return wrap(W, H, p, out, false);
}

/** Live gear top view: windows from the kernel outline (corners shown sharp; the model rounds them). */
export function gearDiagram(input, {narrow = false, error = ''} = {}) {
  const p = {...input}, out = [], W = narrow ? 480 : 1000, cx = narrow ? 240 : 290, cy = narrow ? 290 : 334, s = (narrow ? 222 : 268) / 100.5;
  const X = x => cx + x * s, Y = y => cy - y * s, bad = !!error, G = {teeth: 99.32, band: 95, limit: 90, hub: 18.13, web: 18};
  out.push(text(16, 26, 'GEAR TOP VIEW · TO SCALE', 'class="dg-head"'), text(16, 46, p.plain ? 'Plain web' : `${p.count} spokes`, 'class="dg-sub"'));
  out.push(circle(cx, cy, G.teeth * s, `fill="${C.core}" stroke="${C.coreLine}" stroke-width="1"`), circle(cx, cy, G.band * s, `fill="${C.ring}" stroke="${C.ringLine}" stroke-width="1"`));
  out.push(circle(cx, cy, G.limit * s, `fill="none" stroke="${C.bite}" stroke-width="1" stroke-dasharray="2 4"`));
  const pitch = 2 * Math.PI / p.count, ai = Math.asin(p.root / 2 / p.pad), ao = Math.asin(p.tip / 2 / p.outer);
  const drawable = !p.plain && [ai, ao, pitch].every(Number.isFinite) && p.outer > p.pad && 2 * ai < pitch && 2 * ao < pitch;
  if (drawable) {
    const ri = p.pad, ro = p.outer, arc = (r, a0, a1) => Array.from({length: 41}, (_, i) => { const a = a0 + (a1 - a0) * i / 40; return [r * Math.cos(a), r * Math.sin(a)]; });
    const poly = [...arc(ro, ao, pitch - ao), ...arc(ri, pitch - ai, ai)];
    for (let i = 0; i < p.count; i++) { const c = Math.cos(i * pitch), sn = Math.sin(i * pitch);
      out.push(path(poly.map(([x, y]) => [X(x * c - y * sn), Y(x * sn + y * c)]), `fill="${bad ? '#fde3dc' : C.paper}" stroke="${bad ? C.bite : C.ink}" stroke-width="1.2" stroke-linejoin="round"`)); }
    out.push(circle(cx, cy, ri * s, `fill="none" stroke="${C.blue}" stroke-width="1" stroke-dasharray="6 4"`), circle(cx, cy, ro * s, `fill="none" stroke="${C.blue}" stroke-width="1" stroke-dasharray="6 4"`));
    // Root and tip width across spoke 1 (+X), measured perpendicular to its centre line.
    const xr = Math.sqrt(ri * ri - p.root * p.root / 4), xt = Math.sqrt(ro * ro - p.tip * p.tip / 4);
    out.push(line(X(xr), Y(p.root / 2), X(xr), Y(-p.root / 2), `stroke="${C.bite}" stroke-width="2.5"`), line(X(xt), Y(p.tip / 2), X(xt), Y(-p.tip / 2), `stroke="${C.bite}" stroke-width="2.5"`));
    out.push(text(X(xr) + 4, Y(-p.root / 2) + 16, `root ${mm(p.root)}`, 'class="dg-note dg-halo"'), text(X(xt) - 4, Y(-p.tip / 2) + 16, `tip ${mm(p.tip)}`, 'class="dg-note dg-halo" text-anchor="end"'));
  }
  out.push(circle(cx, cy, G.hub * s, `fill="${C.core}" stroke="${C.coreLine}" stroke-width="1"`), circle(cx, cy, 12 * s, `fill="${C.paper}" stroke="${C.coreLine}" stroke-width="1"`));
  const hubGap = 2 * p.pad * Math.sin(pitch / 2 - ai), rimGap = 2 * p.outer * Math.sin(pitch / 2 - ao), narrowest = Math.min(p.root, p.tip), rim = G.band - p.outer;
  const fmt = x => Number.isFinite(x) && x > 0 ? `${x.toFixed(2)} mm` : 'closed';
  const rows = p.plain ? [['Web', 'solid, as humebeam\'s outline', '', true]] : [
    ['Hub pad radius', `R${mm(p.pad)}`, 'windows start here', true], ['Window outer radius', `R${mm(p.outer)}`, 'changes stay inside R90', p.outer <= 90],
    ['Root / tip width', `${mm(p.root)} / ${mm(p.tip)}`, 'linear taper', true], ['Corner fillet', `${mm(p.fillet)} mm`, 'drawn sharp here', true],
    ['Narrowest spoke', `${mm(narrowest)} mm`, 'minimum 1.35', narrowest >= 1.35], ['Hub-side opening', fmt(hubGap), 'minimum 4', hubGap >= 4],
    ['Rim-side opening', fmt(rimGap), 'minimum 4', rimGap >= 4], ['Rim inside teeth', `${mm(Math.round(rim * 100) / 100)} mm`, 'minimum 3', rim >= 3]];
  const lx = narrow ? 16 : 590, ly = narrow ? 540 : 110, step = narrow ? 44 : 50;
  rows.forEach(([n, v, note, ok], i) => {
    const y = ly + i * step;
    out.push(text(lx, y, n, `class="dg-name"${ok ? '' : ` fill="${C.bite}"`}`), text(lx + (narrow ? 250 : 200), y, v, `class="dg-value"${ok ? '' : ` fill="${C.bite}"`}`), text(lx, y + 18, note, 'class="dg-note"'));
  });
  const H = narrow ? ly + rows.length * step + 30 : 2 * cy + 30;
  out.push(text(16, H - 12, narrow ? 'Grey: humebeam teeth and hub. Red dots: R90 limit.' : 'Grey: humebeam\'s teeth (R95 and out) and hub. Teal: web. Dotted red: R90 change limit.', 'class="dg-sub"'));
  const desc = p.plain ? 'Plain gear web.' : `${p.count} spokes, hub pad R${mm(p.pad)}, root ${mm(p.root)} mm, tip ${mm(p.tip)} mm, window outer R${mm(p.outer)}, fillet ${mm(p.fillet)} mm.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc('Kraken spool gear spoke layout. ' + desc)}" class="ring-diagram${narrow ? ' narrow' : ''}"><rect x="0" y="0" width="${W}" height="${H}" fill="${C.paper}"/>${out.join('')}</svg>`;
}
