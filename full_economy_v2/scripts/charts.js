/* Deterministic SVG chart primitives for the Full Economy V2 figures.
 *
 * Same visual language as V1's portfolio figures. Colours follow a validated
 * categorical palette in fixed order (checked with the dataviz validator in
 * light and dark), with selected dark-mode steps; an ordinal blue ramp for
 * ordered groups and a sequential blue ramp for the heatmap. Marks are thin
 * (2px lines, bars at most 24px with a 4px rounded data end), gridlines are
 * solid hairlines, every chart with two or more series has a legend, and text
 * never wears a series colour. Every mark carries a <title> so values show
 * on hover when the SVG is opened directly; every figure has a CSV beside it.
 * Output is byte-identical between runs.
 */
"use strict";

const CAT = [ // [light, dark]
  ["#2a78d6", "#3987e5"], ["#eb6834", "#d95926"], ["#1baf7a", "#199e70"], ["#eda100", "#c98500"],
  ["#e87ba4", "#d55181"], ["#008300", "#008300"], ["#6250d6", "#9085e9"], ["#e34948", "#e66767"],
];
const ORD = [["#86b6ef", "#256abf"], ["#2a78d6", "#5598e7"], ["#104281", "#9ec5f4"]]; // ordinal: light end first
const SEQ_LIGHT = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const SEQ_DARK = ["#183049", "#184f95", "#1c5cab", "#256abf", "#3987e5", "#6da7ec", "#b7d3f6"];

function style() {
  const light = [], dark = [];
  CAT.forEach(([l, d], i) => { light.push(`.c${i + 1}{fill:${l}}.l${i + 1}{stroke:${l}}`); dark.push(`.c${i + 1}{fill:${d}}.l${i + 1}{stroke:${d}}`); });
  ORD.forEach(([l, d], i) => { light.push(`.o${i + 1}{fill:${l}}.ol${i + 1}{stroke:${l}}`); dark.push(`.o${i + 1}{fill:${d}}.ol${i + 1}{stroke:${d}}`); });
  SEQ_LIGHT.forEach((c, i) => light.push(`.h${i + 1}{fill:${c}}.ht${i + 1}{fill:${i < 3 ? "#0b0b0b" : "#ffffff"}}`));
  SEQ_DARK.forEach((c, i) => dark.push(`.h${i + 1}{fill:${c}}.ht${i + 1}{fill:${i < 5 ? "#ffffff" : "#0b0b0b"}}`));
  return `<style>
.bg{fill:#fcfcfb}.t1{fill:#0b0b0b}.t2{fill:#52514e}.mu{fill:#898781}.ring{stroke:#fcfcfb}
.grid{stroke:#e1e0d9;stroke-width:1}.axis{stroke:#c3c2b7;stroke-width:1}.zero{stroke:#898781;stroke-width:1}
.tw{fill:#ffffff}.tb{fill:#0b0b0b}.lp{stroke:#52514e}.fp{fill:#52514e}
${light.join("\n")}
text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
@media (prefers-color-scheme: dark){
.bg{fill:#1a1a19}.t1{fill:#f0efec}.t2{fill:#c3c2b7}.ring{stroke:#1a1a19}.grid{stroke:#2c2c2a}.axis{stroke:#383835}.lp{stroke:#c3c2b7}.fp{fill:#c3c2b7}
${dark.join("\n")}}
</style>`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (x) => Math.round(x * 10) / 10;
const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "n/a");
const textWidth = (s, size = 12) => String(s).length * size * 0.56;

function svgDoc(width, height, title, desc, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title>
<desc id="desc">${esc(desc)}</desc>
${style()}
<rect class="bg" width="${width}" height="${height}" rx="8"/>
${body}
</svg>
`;
}

function text(x, y, s, cls, o = {}) {
  const anchor = o.anchor ? ` text-anchor="${o.anchor}"` : "";
  const weight = o.bold ? ` font-weight="600"` : "";
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${o.size || 12}" class="${cls}"${anchor}${weight}>${esc(s)}</text>`;
}

/** Greedy word wrap to a pixel width at a font size. */
function wrap(str, maxWidth, size) {
  const words = String(str).split(/\s+/).filter(Boolean), lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && textWidth(next, size) > maxWidth) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Title block: the title, then the subtitle paragraphs wrapped to the
 * figure width; returns { parts, y } where y is the last line's baseline. */
function header(title, subtitle, maxWidth = 712) {
  const parts = [];
  let y = 34;
  wrap(title, maxWidth, 17).forEach((l, i) => { parts.push(text(24, y, l, "t1", { size: 17, bold: true })); y += i ? 0 : 0; y += 22; });
  y -= 22;
  const paras = Array.isArray(subtitle) ? subtitle : subtitle ? [subtitle] : [];
  const lines = paras.flatMap((p) => wrap(p, maxWidth, 12.5));
  lines.forEach((l, i) => parts.push(text(24, y + 22 + i * 18, l, "t2", { size: 12.5 })));
  return { parts, y: y + 22 + (lines.length - 1) * 18 + (lines.length ? 0 : -22) };
}

/** Wrapped footnotes below `bottom`; returns { parts, height }. */
function footer(notes, bottom, maxWidth = 712) {
  const lines = (Array.isArray(notes) ? notes : [notes]).flatMap((n) => wrap(n, maxWidth, 11));
  const parts = lines.map((l, i) => text(24, bottom + 22 + i * 15, l, "mu", { size: 11 }));
  return { parts, height: bottom + 22 + (lines.length - 1) * 15 + 18 };
}

/** One legend row (wraps). items: [{ label, cls, kind: "line" | "box" }]. */
function legend(items, x, y, maxWidth) {
  const parts = [];
  let cx = x, cy = y;
  for (const it of items) {
    const w = 22 + textWidth(it.label, 12) + 18;
    if (cx + w > x + maxWidth && cx > x) { cx = x; cy += 20; }
    if (it.kind === "box") parts.push(`<rect class="${it.cls}" x="${r1(cx)}" y="${r1(cy - 9)}" width="12" height="12" rx="3"/>`);
    else parts.push(`<rect class="${it.cls}" x="${r1(cx)}" y="${r1(cy - 5)}" width="16" height="4" rx="2"/>`);
    parts.push(text(cx + 22, cy + 1, it.label, "t2", { size: 12 }));
    cx += w;
  }
  return { parts, y: cy };
}

function niceTicks(max, count = 5) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** A line panel inside { x, y, w, h }. series: [{ label, cls (stroke class), fillCls, points: [[x, y]], endLabel, dots }] */
function linePanel(o) {
  const { x, y, w, h } = o;
  const [x0, x1] = o.xDomain, yTicks = o.yTicks, y1 = yTicks[yTicks.length - 1], y0 = yTicks[0];
  const X = (v) => x + ((v - x0) / (x1 - x0)) * w;
  const Y = (v) => y + h - ((Math.max(y0, Math.min(v, y1)) - y0) / (y1 - y0)) * h;
  const parts = [];
  for (const t of yTicks) {
    parts.push(`<line class="${t === y0 ? "axis" : "grid"}" x1="${r1(x)}" y1="${r1(Y(t))}" x2="${r1(x + w)}" y2="${r1(Y(t))}"/>`);
    parts.push(text(x - 8, Y(t) + 4, (o.yFmt || fmt)(t), "mu", { size: 11, anchor: "end" }));
  }
  for (const t of o.xTicks) parts.push(text(X(t), y + h + 18, (o.xFmt || fmt)(t), "mu", { size: 11, anchor: "middle" }));
  if (o.xLabel) parts.push(text(x + w, y + h + 36, o.xLabel, "mu", { size: 11, anchor: "end" }));
  if (o.yLabel) parts.push(text(x, y - 12, o.yLabel, "mu", { size: 11 }));
  for (const band of o.bands || []) {
    const up = band.points.map(([a, b]) => `${r1(X(a))},${r1(Y(b[1]))}`), down = band.points.map(([a, b]) => `${r1(X(a))},${r1(Y(b[0]))}`).reverse();
    parts.push(`<polygon class="${band.fillCls}" fill-opacity="0.12" points="${up.concat(down).join(" ")}"/>`);
  }
  for (const s of o.series) {
    const pts = s.points.filter(([, v]) => v !== null && Number.isFinite(v));
    if (!pts.length) continue;
    const d = pts.map(([a, b], i) => `${i ? "L" : "M"}${r1(X(a))},${r1(Y(b))}`).join("");
    parts.push(`<path class="${s.cls}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" d="${d}"><title>${esc(s.label)}</title></path>`);
    for (const p of s.dots || []) {
      parts.push(`<circle class="${s.fillCls} ring" stroke-width="2" cx="${r1(X(p[0]))}" cy="${r1(Y(p[1]))}" r="4.5"><title>${esc(p[2] || `${s.label}: ${fmt(p[1], 1)}`)}</title></circle>`);
    }
  }
  const ends = o.series.filter((s) => s.endLabel).map((s) => {
    const pts = s.points.filter(([, v]) => v !== null && Number.isFinite(v));
    const last = s.endLabelAt || pts[pts.length - 1];
    return { s, x: X(last[0]), y: Y(last[1]) };
  }).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (Math.abs(ends[k].x - ends[k - 1].x) < 120) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 15);
  for (const e of ends) parts.push(text(e.x + 8, e.y + 4, e.s.endLabel, "t1", { size: 12 }));
  return parts;
}

/** Horizontal bars inside { x, y, w }. rows: [{ label, bars: [{ v, cls, title, label }] }]; grouped bars per row. */
function hbarPanel(o) {
  const parts = [], { x, y, w } = o;
  const bar = o.barHeight || 14, gap = 2, groupGap = o.groupGap || 12;
  const max = o.max;
  const X = (v) => x + (Math.max(0, Math.min(v, max)) / max) * w;
  let cy = y;
  for (const t of o.ticks) {
    parts.push(`<line class="${t === 0 ? "axis" : "grid"}" x1="${r1(X(t))}" y1="${r1(y - 6)}" x2="${r1(X(t))}" y2="${r1(y + o.rows.reduce((s, r) => s + r.bars.length * (bar + gap) + groupGap, 0) - groupGap + 4)}"/>`);
  }
  for (const row of o.rows) {
    const rowH = row.bars.length * (bar + gap) - gap;
    parts.push(text(x - 10, cy + rowH / 2 + 4, row.label, "t1", { size: 12, anchor: "end" }));
    row.bars.forEach((b, i) => {
      const by = cy + i * (bar + gap), bw = Math.max(X(b.v) - x, b.v > 0 ? 1.5 : 0);
      if (bw > 0) {
        const r = Math.min(4, bw / 2, bar / 2);
        parts.push(`<path class="${b.cls}" d="M${r1(x)},${r1(by)}H${r1(x + bw - r)}A${r},${r} 0 0 1 ${r1(x + bw)},${r1(by + r)}V${r1(by + bar - r)}A${r},${r} 0 0 1 ${r1(x + bw - r)},${r1(by + bar)}H${r1(x)}Z"><title>${esc(b.title || fmt(b.v))}</title></path>`);
      }
      if (b.label !== undefined) parts.push(text(x + bw + 6, by + bar - 3, b.label, "t2", { size: 11.5 }));
    });
    cy += rowH + groupGap;
  }
  for (const t of o.ticks) parts.push(text(X(t), cy + 10, (o.fmt || fmt)(t), "mu", { size: 11, anchor: "middle" }));
  if (o.axisLabel) parts.push(text(x + w, cy + 28, o.axisLabel, "mu", { size: 11, anchor: "end" }));
  return { parts, bottom: cy + 28 };
}

/** 100% stacked horizontal bars. rows: [{ label, segments: [{ v (share), cls, name, textCls }] }]. */
function stackPanel(o) {
  const parts = [], { x, y, w } = o, bar = o.barHeight || 18, step = bar + (o.rowGap || 10);
  o.rows.forEach((row, i) => {
    const by = y + i * step;
    parts.push(text(x - 10, by + bar / 2 + 4, row.label, "t1", { size: 12, anchor: "end" }));
    let cx = x;
    const segs = row.segments.filter((s) => s.v > 0.0005);
    segs.forEach((s, j) => {
      const sw = s.v * w - (j < segs.length - 1 ? 2 : 0);
      if (sw <= 0) { cx += s.v * w; return; }
      const first = j === 0, last = j === segs.length - 1, r = Math.min(4, sw / 2);
      const d = `M${r1(cx + (first ? r : 0))},${r1(by)}H${r1(cx + sw - (last ? r : 0))}${last ? `A${r},${r} 0 0 1 ${r1(cx + sw)},${r1(by + r)}V${r1(by + bar - r)}A${r},${r} 0 0 1 ${r1(cx + sw - r)},${r1(by + bar)}` : `V${r1(by + bar)}`}H${r1(cx + (first ? r : 0))}${first ? `A${r},${r} 0 0 1 ${r1(cx)},${r1(by + bar - r)}V${r1(by + r)}A${r},${r} 0 0 1 ${r1(cx + r)},${r1(by)}` : `V${r1(by)}`}Z`;
      parts.push(`<path class="${s.cls}" d="${d}"><title>${esc(`${row.label}: ${s.name} ${fmt(100 * s.v, 1)}%`)}</title></path>`);
      const label = `${Math.round(100 * s.v)}%`;
      if (sw >= textWidth(label, 11) + 10) parts.push(text(cx + 5, by + bar / 2 + 4, label, s.textCls || "t1", { size: 11 }));
      cx += s.v * w;
    });
  });
  return { parts, bottom: y + o.rows.length * step };
}

module.exports = { svgDoc, text, header, footer, wrap, legend, linePanel, hbarPanel, stackPanel, niceTicks, fmt, esc, r1, textWidth, CAT, SEQ_LIGHT };
