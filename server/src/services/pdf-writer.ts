export type PdfFont = 'regular' | 'bold' | 'serif';

const PAGE_W = 595;
const PAGE_H = 842;

const WINANSI_EXTENDED: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

function sanitizePdfText(input: string): string {
  const normalized = input.replace(/[\r\n\t]+/g, ' ');
  let out = '';
  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7e) {
      if (ch === '\\' || ch === '(' || ch === ')') out += `\\${ch}`;
      else out += ch;
    } else if (code >= 0xa0 && code <= 0xff) {
      out += ch;
    } else if (WINANSI_EXTENDED[ch] !== undefined) {
      out += String.fromCharCode(WINANSI_EXTENDED[ch]);
    } else if (ch === '→') {
      out += '->';
    } else if (ch === '·') {
      out += String.fromCharCode(0xb7);
    } else {
      out += '-';
    }
  }
  return out;
}

function rgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

const FONT_MAP: Record<PdfFont, string> = {
  regular: 'F1',
  bold: 'F2',
  serif: 'F3',
};

export class PdfDocument {
  readonly width = PAGE_W;
  readonly height = PAGE_H;
  private pages: string[][] = [];
  private current: string[] = [];

  constructor() {
    this.addPage();
  }

  addPage(): void {
    const page: string[] = [];
    this.pages.push(page);
    this.current = page;
  }

  private y(topY: number): number {
    return PAGE_H - topY;
  }

  rect(x: number, topY: number, w: number, h: number, opts: { fill?: string; stroke?: string; lineWidth?: number } = {}): void {
    const ops: string[] = ['q'];
    if (opts.fill) ops.push(`${rgb(opts.fill)} rg`);
    if (opts.stroke) ops.push(`${rgb(opts.stroke)} RG`);
    if (opts.lineWidth) ops.push(`${opts.lineWidth.toFixed(2)} w`);
    ops.push(`${x.toFixed(2)} ${(PAGE_H - topY - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    if (opts.fill && opts.stroke) ops.push('B');
    else if (opts.fill) ops.push('f');
    else ops.push('S');
    ops.push('Q');
    this.current.push(ops.join('\n'));
  }

  line(x1: number, topY1: number, x2: number, topY2: number, color: string, lineWidth = 1): void {
    this.current.push(
      `q\n${rgb(color)} RG\n${lineWidth.toFixed(2)} w\n${x1.toFixed(2)} ${this.y(topY1).toFixed(2)} m\n${x2.toFixed(2)} ${this.y(topY2).toFixed(2)} l\nS\nQ`,
    );
  }

  polygon(points: { x: number; y: number }[], opts: { fill?: string; stroke?: string; lineWidth?: number } = {}): void {
    if (points.length < 3) return;
    const ops: string[] = ['q'];
    if (opts.fill) ops.push(`${rgb(opts.fill)} rg`);
    if (opts.stroke) ops.push(`${rgb(opts.stroke)} RG`);
    if (opts.lineWidth) ops.push(`${opts.lineWidth.toFixed(2)} w`);
    ops.push(`${points[0].x.toFixed(2)} ${this.y(points[0].y).toFixed(2)} m`);
    for (let i = 1; i < points.length; i++) {
      ops.push(`${points[i].x.toFixed(2)} ${this.y(points[i].y).toFixed(2)} l`);
    }
    ops.push('h');
    if (opts.fill && opts.stroke) ops.push('B');
    else if (opts.fill) ops.push('f');
    else ops.push('S');
    ops.push('Q');
    this.current.push(ops.join('\n'));
  }

  circle(cx: number, topCy: number, r: number, opts: { fill?: string; stroke?: string; lineWidth?: number } = {}): void {
    const k = 0.5522847498 * r;
    const cy = this.y(topCy);
    const ops: string[] = ['q'];
    if (opts.fill) ops.push(`${rgb(opts.fill)} rg`);
    if (opts.stroke) ops.push(`${rgb(opts.stroke)} RG`);
    if (opts.lineWidth) ops.push(`${opts.lineWidth.toFixed(2)} w`);
    ops.push(`${(cx + r).toFixed(2)} ${cy.toFixed(2)} m`);
    ops.push(`${(cx + r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c`);
    ops.push(`${(cx - k).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c`);
    ops.push(`${(cx - r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c`);
    ops.push(`${(cx + k).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c`);
    if (opts.fill && opts.stroke) ops.push('B');
    else if (opts.fill) ops.push('f');
    else ops.push('S');
    ops.push('Q');
    this.current.push(ops.join('\n'));
  }

  text(str: string, x: number, topY: number, opts: { size?: number; color?: string; font?: PdfFont; align?: 'left' | 'center' | 'right' } = {}): void {
    const size = opts.size ?? 11;
    const color = opts.color ?? '#0F172A';
    const font = FONT_MAP[opts.font ?? 'regular'];
    const clean = sanitizePdfText(str);
    const approxWidth = clean.length * size * 0.5;
    let drawX = x;
    if (opts.align === 'center') drawX = x - approxWidth / 2;
    else if (opts.align === 'right') drawX = x - approxWidth;
    this.current.push(
      `BT\n/${font} ${size.toFixed(1)} Tf\n${rgb(color)} rg\n1 0 0 1 ${drawX.toFixed(2)} ${this.y(topY).toFixed(2)} Tm\n(${clean}) Tj\nET`,
    );
  }

  wrappedText(str: string, x: number, topY: number, maxWidth: number, opts: { size?: number; color?: string; font?: PdfFont; lineHeight?: number; maxLines?: number } = {}): number {
    const size = opts.size ?? 10;
    const lineHeight = opts.lineHeight ?? Math.round(size * 1.45);
    const maxChars = Math.max(12, Math.floor(maxWidth / (size * 0.52)));
    const words = str.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = '';
    for (const w of words) {
      const candidate = currentLine ? `${currentLine} ${w}` : w;
      if (candidate.length <= maxChars) currentLine = candidate;
      else {
        if (currentLine) lines.push(currentLine);
        currentLine = w.length > maxChars ? `${w.slice(0, maxChars - 1)}-` : w;
      }
    }
    if (currentLine) lines.push(currentLine);
    const limit = opts.maxLines ?? lines.length;
    const shown = lines.slice(0, limit);
    shown.forEach((line, idx) => {
      const suffix = idx === limit - 1 && lines.length > limit ? '...' : '';
      this.text(`${line}${suffix}`, x, topY + idx * lineHeight, { size, color: opts.color, font: opts.font });
    });
    return topY + shown.length * lineHeight;
  }

  drawRadarChart(cx: number, topCy: number, radius: number, labels: string[], values: number[]): void {
    const count = Math.max(3, labels.length);
    const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / count;

    for (const frac of [0.25, 0.5, 0.75, 1]) {
      const ringPts = Array.from({ length: count }, (_, i) => ({
        x: cx + Math.cos(angleFor(i)) * radius * frac,
        y: topCy + Math.sin(angleFor(i)) * radius * frac,
      }));
      this.polygon(ringPts, { stroke: frac === 1 ? '#CBD5E1' : '#E2E8F0', lineWidth: 0.8 });
    }

    for (let i = 0; i < count; i++) {
      const a = angleFor(i);
      const ex = cx + Math.cos(a) * radius;
      const ey = topCy + Math.sin(a) * radius;
      this.line(cx, topCy, ex, ey, '#CBD5E1', 0.8);

      const lx = cx + Math.cos(a) * (radius + 18);
      const ly = topCy + Math.sin(a) * (radius + 14);
      const align = Math.cos(a) > 0.25 ? 'left' : Math.cos(a) < -0.25 ? 'right' : 'center';
      this.text(labels[i].slice(0, 18), lx, ly, { size: 8.5, font: 'bold', color: '#1E293B', align });
    }

    const dataPts = values.slice(0, count).map((v, i) => {
      const clamped = Math.max(0.06, Math.min(1, v / 100));
      const a = angleFor(i);
      return {
        x: cx + Math.cos(a) * radius * clamped,
        y: topCy + Math.sin(a) * radius * clamped,
      };
    });
    this.polygon(dataPts, { fill: '#CCFBF1', stroke: '#0F766E', lineWidth: 2 });
    dataPts.forEach((pt) => this.circle(pt.x, pt.y, 3.2, { fill: '#C9A24B', stroke: '#0F766E', lineWidth: 1 }));
  }

  drawHeatmapGrid(x: number, topY: number, daysInMonth: number, counts: number[]): void {
    const cols = 7;
    const cellW = 30;
    const cellH = 22;
    const gap = 4;
    for (let d = 0; d < daysInMonth; d++) {
      const col = d % cols;
      const row = Math.floor(d / cols);
      const cx = x + col * (cellW + gap);
      const cy = topY + row * (cellH + gap);
      const count = counts[d] ?? 0;
      const fill = count === 0 ? '#F1F5F9' : count <= 2 ? '#99F6E4' : count <= 4 ? '#2DD4BF' : '#0F766E';
      const fg = count >= 5 ? '#FFFFFF' : '#0F172A';
      this.rect(cx, cy, cellW, cellH, { fill, stroke: '#E2E8F0', lineWidth: 0.6 });
      this.text(String(d + 1), cx + cellW / 2, cy + 14, { size: 8.5, font: count > 0 ? 'bold' : 'regular', color: fg, align: 'center' });
    }
  }

  drawHorizontalBarChart(x: number, topY: number, width: number, items: { label: string; valuePct: number; display: string; color?: string }[]): void {
    const labelW = 145;
    const valW = 55;
    const barW = Math.max(60, width - labelW - valW - 12);
    items.forEach((item, idx) => {
      const rowY = topY + idx * 22;
      this.text(item.label.slice(0, 26), x, rowY + 10, { size: 9, color: '#1E293B' });
      this.rect(x + labelW, rowY + 2, barW, 10, { fill: '#E2E8F0' });
      const fillW = Math.max(0, Math.min(1, item.valuePct / 100)) * barW;
      if (fillW > 0) {
        this.rect(x + labelW, rowY + 2, fillW, 10, { fill: item.color ?? '#14B8A6' });
      }
      this.text(item.display, x + width, rowY + 10, { size: 8.5, font: 'bold', color: '#334155', align: 'right' });
    });
  }

  drawGroupedBarChart(
    x: number,
    topY: number,
    width: number,
    height: number,
    groups: { label: string; current: number; previous: number; currentLabel: string; previousLabel: string }[],
  ): void {
    const maxVal = Math.max(1, ...groups.flatMap((g) => [g.current, g.previous]));
    const plotH = height - 26;
    this.line(x, topY + plotH, x + width, topY + plotH, '#94A3B8', 1);
    const groupW = width / Math.max(1, groups.length);
    const barW = Math.min(28, (groupW - 24) / 2);

    groups.forEach((g, idx) => {
      const gx = x + idx * groupW + groupW / 2;
      const prevH = (Math.max(0, g.previous) / maxVal) * (plotH - 18);
      const currH = (Math.max(0, g.current) / maxVal) * (plotH - 18);
      this.rect(gx - barW - 3, topY + plotH - prevH, barW, prevH, { fill: '#94A3B8' });
      this.rect(gx + 3, topY + plotH - currH, barW, currH, { fill: '#0F766E' });
      this.text(g.previousLabel, gx - barW / 2 - 3, topY + plotH - prevH - 4, { size: 7.5, color: '#64748B', align: 'center' });
      this.text(g.currentLabel, gx + barW / 2 + 3, topY + plotH - currH - 4, { size: 7.5, font: 'bold', color: '#0F766E', align: 'center' });
      this.text(g.label, gx, topY + plotH + 14, { size: 9, font: 'bold', color: '#1E293B', align: 'center' });
    });
  }

  drawLineChart(x: number, topY: number, width: number, height: number, points: { label: string; value: number }[], maxVal: number, color = '#14B8A6'): void {
    const plotH = height - 22;
    this.line(x, topY + plotH, x + width, topY + plotH, '#94A3B8', 1);
    this.line(x, topY, x + width, topY, '#E2E8F0', 0.6);
    this.line(x, topY + plotH / 2, x + width, topY + plotH / 2, '#E2E8F0', 0.6);
    if (!points.length) return;

    const coords = points.map((p, i) => ({
      x: points.length === 1 ? x + width / 2 : x + (i * width) / (points.length - 1),
      y: topY + plotH - (Math.max(0, Math.min(maxVal, p.value)) / Math.max(1, maxVal)) * (plotH - 8),
      label: p.label,
    }));

    for (let i = 1; i < coords.length; i++) {
      this.line(coords[i - 1].x, coords[i - 1].y, coords[i].x, coords[i].y, color, 2);
    }
    const step = Math.max(1, Math.ceil(coords.length / 8));
    coords.forEach((pt, idx) => {
      this.circle(pt.x, pt.y, 2.8, { fill: '#C9A24B', stroke: color, lineWidth: 1 });
      if (idx % step === 0 || idx === coords.length - 1) {
        this.text(pt.label, pt.x, topY + plotH + 13, { size: 7.5, color: '#64748B', align: 'center' });
      }
    });
  }

  toBuffer(): Buffer {
    const objects: string[] = [];
    const addObj = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const fontRegular = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontBold = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const fontSerif = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>');
    const pagesObjId = addObj(''); // placeholder for /Pages

    const pageObjIds: number[] = [];
    for (const ops of this.pages) {
      const stream = ops.join('\n');
      const streamBytes = Buffer.byteLength(stream, 'latin1');
      const contentId = addObj(`<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream`);
      const pageId = addObj(
        `<< /Type /Page /Parent ${pagesObjId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontSerif} 0 R >> >> /Contents ${contentId} 0 R >>`,
      );
      pageObjIds.push(pageId);
    }

    objects[pagesObjId - 1] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`;
    const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`);

    const chunks: string[] = ['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'];
    const offsets: number[] = [0];
    let byteOffset = Buffer.byteLength(chunks[0], 'latin1');

    objects.forEach((body, idx) => {
      offsets.push(byteOffset);
      const entry = `${idx + 1} 0 obj\n${body}\nendobj\n`;
      chunks.push(entry);
      byteOffset += Buffer.byteLength(entry, 'latin1');
    });

    const xrefOffset = byteOffset;
    const xrefLines = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`];
    for (let i = 1; i <= objects.length; i++) {
      xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    }
    xrefLines.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    chunks.push(xrefLines.join(''));

    return Buffer.from(chunks.join(''), 'latin1');
  }
}
