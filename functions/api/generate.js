/**
 * Cloudflare Pages Function: POST /api/generate
 * Generates a TI4 Faction Reference DOCX from faction-data.json
 * Compatible with the Cloudflare Workers runtime.
 */

import {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, BorderStyle, WidthType,
  Table, TableRow, TableCell, ShadingType,
  PageNumber, NumberFormat, convertInchesToTwip,
} from 'docx';

// ── Colour palette ────────────────────────────────────────────────────────────
const GOLD   = 'C9A845';
const WHITE  = 'EFEFEF';
const MUTED  = 'AAAABC';
const DIM    = '888899';
const BG2    = '262630';
const BG3    = '2C2F48';
const BORDER = '3C3C50';

const PT  = (n) => n * 20;          // points → half-points (OOXML twips)
const IN  = convertInchesToTwip;

// ── Helpers ───────────────────────────────────────────────────────────────────
function gold(text, size = 22) {
  return new TextRun({ text, color: GOLD, size: PT(size / 10), bold: true });
}
function white(text, size = 20) {
  return new TextRun({ text, color: WHITE, size: PT(size / 10) });
}
function muted(text, size = 18) {
  return new TextRun({ text, color: MUTED, size: PT(size / 10), italics: true });
}
function dim(text, size = 16) {
  return new TextRun({ text, color: DIM, size: PT(size / 10) });
}

function para(children, opts = {}) {
  return new Paragraph({
    spacing: { before: PT(3), after: PT(3), line: PT(1.2) },
    ...opts,
    children: Array.isArray(children) ? children : [children],
  });
}

function heading(text, level = 2) {
  const sizes = { 1: 32, 2: 24, 3: 20 };
  const sz = sizes[level] || 20;
  return new Paragraph({
    spacing: { before: PT(6), after: PT(2) },
    children: [new TextRun({ text, color: GOLD, size: PT(sz / 10), bold: true })],
    border: level === 2 ? {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD },
    } : undefined,
  });
}

function rule() {
  return new Paragraph({
    spacing: { before: PT(4), after: PT(4) },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER } },
    children: [],
  });
}

function labelVal(label, value) {
  return para([
    new TextRun({ text: label + ': ', color: DIM, size: PT(1.7), bold: true }),
    new TextRun({ text: String(value ?? '—'), color: WHITE, size: PT(1.7) }),
  ]);
}

function badge(text, color) {
  return new TextRun({ text: ` [${text}] `, color: color || MUTED, size: PT(1.6), bold: true });
}

function techColor(colorStr = '') {
  const c = colorStr.toLowerCase();
  if (c.includes('biotic') || c.includes('green'))      return '6fcf97';
  if (c.includes('propulsion') || c.includes('blue'))   return '7ec8e3';
  if (c.includes('cybernetic') || c.includes('yellow')) return 'f6dd6e';
  if (c.includes('warfare') || c.includes('red'))       return 'f08080';
  return MUTED;
}

function makeCell(children, opts = {}) {
  return new TableCell({
    shading: opts.shading,
    margins: { top: IN(0.04), bottom: IN(0.04), left: IN(0.06), right: IN(0.06) },
    children: Array.isArray(children) ? children : [children],
    ...opts,
  });
}

function planetTable(planets) {
  const hdrShading = { type: ShadingType.SOLID, color: BG3 };
  const evenShading = { type: ShadingType.SOLID, color: BG2 };

  const headers = ['Planet', 'Res', 'Inf', 'Trait', 'Type'];
  const hdrRow = new TableRow({
    children: headers.map(h =>
      makeCell(para(new TextRun({ text: h, color: GOLD, size: PT(1.6), bold: true })), { shading: hdrShading })
    ),
    tableHeader: true,
  });

  const dataRows = planets.map((p, i) =>
    new TableRow({
      children: [
        makeCell(para(white(p.name, 18)), { shading: i % 2 === 1 ? evenShading : undefined }),
        makeCell(para(new TextRun({ text: String(p.res), color: GOLD, size: PT(1.8), bold: true })), { shading: i % 2 === 1 ? evenShading : undefined }),
        makeCell(para(new TextRun({ text: String(p.inf), color: '7aaff0', size: PT(1.8), bold: true })), { shading: i % 2 === 1 ? evenShading : undefined }),
        makeCell(para(p.trait ? new TextRun({ text: p.trait, color: traitColor(p.trait), size: PT(1.6) }) : dim('—')), { shading: i % 2 === 1 ? evenShading : undefined }),
        makeCell(para(dim(p.type || '—')), { shading: i % 2 === 1 ? evenShading : undefined }),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [hdrRow, ...dataRows],
    borders: {
      top:           { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      bottom:        { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      left:          { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      right:         { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      insideH:       { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      insideV:       { style: BorderStyle.SINGLE, size: 1, color: BORDER },
    },
  });
}

function traitColor(trait = '') {
  const t = trait.toLowerCase();
  if (t === 'cultural')   return '7aaff0';
  if (t === 'industrial') return 'ffc966';
  if (t === 'hazardous')  return 'f08080';
  return MUTED;
}

// ── Build one faction section ─────────────────────────────────────────────────
function buildFactionSection(f) {
  const blocks = [];

  // ── Header ──
  blocks.push(new Paragraph({
    spacing: { before: PT(10), after: PT(2) },
    border: { bottom: { style: BorderStyle.THICK, size: 8, color: GOLD } },
    children: [
      new TextRun({ text: f.name, color: GOLD, size: PT(3.2), bold: true }),
      new TextRun({ text: '  ' + f.expansion, color: DIM, size: PT(1.6) }),
    ],
  }));

  // ── Lore ──
  if (f.lore?.length) {
    f.lore.forEach(lp =>
      blocks.push(para(muted(lp, 17)))
    );
    blocks.push(rule());
  }

  // ── Home System ──
  blocks.push(heading('Home System', 3));
  if (f.planets?.length) {
    blocks.push(planetTable(f.planets));
    blocks.push(para([]));
  }
  blocks.push(labelVal('Commodities', f.commodities));
  blocks.push(labelVal('Starting Units', f.startingUnits?.join(', ') ?? '—'));
  blocks.push(rule());

  // ── Abilities ──
  if (f.abilities?.length) {
    blocks.push(heading('Faction Abilities', 3));
    f.abilities.forEach(a => {
      blocks.push(para([
        new TextRun({ text: a.name + ': ', color: GOLD, size: PT(1.8), bold: true }),
        new TextRun({ text: a.text, color: WHITE, size: PT(1.7) }),
      ]));
    });
    blocks.push(rule());
  }

  // ── Technologies ──
  blocks.push(heading('Technologies', 3));
  blocks.push(labelVal('Starting', f.startingTech?.join(', ') ?? '—'));
  f.factionTech?.forEach(t => {
    const tc = techColor(t.color);
    blocks.push(para([
      new TextRun({ text: `[${t.color?.split(' ')[0] || 'Tech'}] `, color: tc, size: PT(1.6), bold: true }),
      new TextRun({ text: t.name, color: WHITE, size: PT(1.8), bold: true }),
      t.prereqs ? new TextRun({ text: ` (${t.prereqs})`, color: DIM, size: PT(1.6) }) : new TextRun(''),
      new TextRun({ text: '\n  ' + (t.ability || ''), color: MUTED, size: PT(1.65) }),
    ]));
  });
  blocks.push(rule());

  // ── Units ──
  if (f.flagship || f.mech) {
    blocks.push(heading('Faction Units', 3));

    if (f.flagship) {
      const fs_ = f.flagship;
      blocks.push(para([
        new TextRun({ text: '⬡ ' + fs_.name, color: GOLD, size: PT(1.9), bold: true }),
        new TextRun({ text: ' — Flagship', color: DIM, size: PT(1.6) }),
      ]));
      blocks.push(para([
        white(`Cost ${fs_.cost}  `, 17),
        white(`Combat ${fs_.combat}  `, 17),
        white(`Move ${fs_.move}  `, 17),
        white(`Cap ${fs_.cap}  `, 17),
        fs_.sustain ? new TextRun({ text: 'Sustain Damage', color: GOLD, size: PT(1.7) }) : new TextRun(''),
      ]));
      if (fs_.ability) blocks.push(para(muted(fs_.ability)));
    }

    if (f.mech) {
      const m = f.mech;
      blocks.push(para([
        new TextRun({ text: '⬢ ' + m.name, color: '7ec8e3', size: PT(1.9), bold: true }),
        new TextRun({ text: ' — Mech', color: DIM, size: PT(1.6) }),
      ]));
      blocks.push(para([
        white(`Cost ${m.cost}  `, 17),
        white(`Combat ${m.combat}  `, 17),
        m.sustain ? new TextRun({ text: 'Sustain Damage', color: GOLD, size: PT(1.7) }) : new TextRun(''),
      ]));
      if (m.ability) blocks.push(para(muted(m.ability)));
    }
    blocks.push(rule());
  }

  // ── Leaders ──
  if (f.leaders) {
    blocks.push(heading('Leaders', 3));
    const roles = [
      { key: 'agent',      label: 'Agent' },
      { key: 'commander',  label: 'Commander' },
      { key: 'hero',       label: 'Hero' },
    ];
    roles.forEach(({ key, label }) => {
      const l = f.leaders[key];
      if (!l) return;
      blocks.push(para([
        new TextRun({ text: label.toUpperCase() + ' — ', color: GOLD, size: PT(1.6), bold: true }),
        new TextRun({ text: l.name, color: WHITE, size: PT(1.8), bold: true }),
      ]));
      if (l.unlock) blocks.push(para(dim('Unlock: ' + l.unlock)));
      if (l.text)   blocks.push(para(muted(l.text)));
    });
    blocks.push(rule());
  }

  // ── Cards ──
  if (f.promissory || f.breakthrough) {
    blocks.push(heading('Cards', 3));
    if (f.promissory) {
      blocks.push(para([
        new TextRun({ text: '🤝 ' + f.promissory.name + ': ', color: GOLD, size: PT(1.8), bold: true }),
        muted(f.promissory.text),
      ]));
    }
    if (f.breakthrough) {
      blocks.push(para([
        new TextRun({ text: '💥 ' + f.breakthrough.name + ': ', color: GOLD, size: PT(1.8), bold: true }),
        muted(f.breakthrough.text),
      ]));
    }
  }

  return blocks;
}

// ── Build full document ───────────────────────────────────────────────────────
async function buildDoc(factions) {
  const sections = [];

  factions.forEach((f, i) => {
    const children = buildFactionSection(f);
    sections.push({
      properties: {
        page: {
          margin: { top: IN(0.75), right: IN(0.75), bottom: IN(0.75), left: IN(0.75) },
        },
        ...(i > 0 ? { type: 'nextPage' } : {}),
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
            spacing: { after: PT(3) },
            children: [
              new TextRun({ text: 'TI4 Faction Reference', color: GOLD, size: PT(1.8), bold: true }),
              new TextRun({ text: '  |  ' + f.name, color: DIM, size: PT(1.6) }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', color: DIM, size: PT(1.6) }),
              new TextRun({ children: [PageNumber.CURRENT], color: DIM, size: PT(1.6) }),
            ],
          })],
        }),
      },
      children,
    });
  });

  return new Document({
    background: { color: '1E1E24' },
    sections,
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const body = await request.json().catch(() => ({}));
    const { factionIds } = body;

    if (!Array.isArray(factionIds) || factionIds.length < 1) {
      return new Response(JSON.stringify({ error: 'Provide at least 1 faction ID.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Load faction data from the static JSON sitting alongside public/
    const dataUrl = new URL('/faction-data.json', request.url);
    const dataResp = await fetch(dataUrl.toString());
    if (!dataResp.ok) throw new Error('Could not load faction-data.json');
    const allFactions = await dataResp.json();

    const clean    = factionIds.map(id => String(id).replace(/[^a-z0-9_]/gi, ''));
    const selected = allFactions.filter(f => clean.includes(f.id));
    if (!selected.length) {
      return new Response(JSON.stringify({ error: 'No matching factions found.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const doc    = await buildDoc(selected);
    const buffer = await Packer.toBuffer(doc);
    const names  = clean.slice(0, 4).join('-') + (clean.length > 4 ? `-+${clean.length - 4}more` : '');

    return new Response(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="TI4_${names}.docx"`,
        'Content-Length':      String(buffer.byteLength),
      },
    });

  } catch (err) {
    console.error('generate error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
