'use strict';
/**
 * generate-filtered.js
 * Generates a TI4 Faction Reference .docx containing only the specified factions.
 * Returns a Buffer with the complete post-processed .docx bytes.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, LevelFormat, InternalHyperlink,
  Bookmark, PageNumber, BorderStyle, WidthType, ImageRun,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType
} = require('docx');

// The faction helpers and data live one directory up (the main project root)
const ROOT = path.resolve(__dirname, '..');
const { para, bullet, h1, h2, h3, rule, labelVal, factionSection, W } = require(path.join(ROOT, 'faction-helpers'));

const ALL_FACTIONS = [
  ...require(path.join(ROOT, 'factions-base')),
  ...require(path.join(ROOT, 'factions-pok')),
  ...require(path.join(ROOT, 'factions-codex')),
  ...require(path.join(ROOT, 'factions-te')),
  ...require(path.join(ROOT, 'factions-ds1')),
  ...require(path.join(ROOT, 'factions-ds2')),
  ...require(path.join(ROOT, 'factions-ds3')),
];

// Expansion ordering (preserves the original grouping for TOC display)
const EXPANSION_ORDER = [
  'Base Game (TI4)',
  'Prophecy of Kings',
  'Codex Volume III: Decree',
  "Thunder's Edge",
  'Discordant Stars (Fan Expansion)',
];

function buildCoverSection() {
  const coverPath = path.join(ROOT, 'cover_page.jpg');
  const coverData = fs.readFileSync(coverPath);
  const zeroPara  = new Paragraph({
    spacing: { before: 0, after: 0, line: 1, lineRule: 'exact' },
    children: [new TextRun({ size: 2 })]
  });
  return {
    properties: {
      page: {
        size:   { width: 12240, height: 15840 },
        margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0 },
      }
    },
    headers: { default: new Header({ children: [zeroPara] }) },
    footers: { default: new Footer({ children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })] }) },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            data: coverData,
            transformation: { width: 816, height: 1056 },
            type: 'jpg',
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
              verticalPosition:   { relative: VerticalPositionRelativeFrom.PAGE,   offset: 0 },
              wrap: { type: TextWrappingType.NONE },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            },
          }),
        ],
      }),
    ],
  };
}

/**
 * @param {string[]} factionIds  - e.g. ['arborec', 'letnev', 'saar']
 * @returns {Promise<Buffer>}    - the complete .docx as a Buffer
 */
async function generateFiltered(factionIds) {
  const selected = ALL_FACTIONS.filter(f => factionIds.includes(f.id));
  if (selected.length === 0) throw new Error('No matching factions found');

  // Group selected factions by expansion, preserving expansion order
  const byExpansion = EXPANSION_ORDER
    .map(title => ({
      title,
      factions: selected.filter(f => f.expansion === title),
    }))
    .filter(e => e.factions.length > 0);

  // Build TOC
  const mainContent = [];
  mainContent.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 0, after: 240 },
    children: [new Bookmark({ id: 'toc', children: [new TextRun({ text: 'Table of Contents', font: 'Arial', bold: true })] })]
  }));
  for (const exp of byExpansion) {
    mainContent.push(new Paragraph({
      spacing: { before: 180, after: 60 },
      children: [new TextRun({ text: exp.title, font: 'Arial', size: 24, bold: true, color: 'C9A845' })]
    }));
    const skipInToc = new Set();
    for (const f of exp.factions) {
      if (skipInToc.has(f.id)) continue;
      if (f.dualWith) {
        const paired = exp.factions.find(x => x.id === f.dualWith);
        if (paired) skipInToc.add(paired.id);
        mainContent.push(new Paragraph({
          spacing: { before: 30, after: 30 }, indent: { left: 480 },
          children: [
            new InternalHyperlink({ anchor: f.id, children: [new TextRun({ text: f.name, font: 'Arial', size: 22, style: 'Hyperlink' })] }),
            new TextRun({ text: ' / ', font: 'Arial', size: 22, color: 'AAAABC' }),
            ...(paired ? [new InternalHyperlink({ anchor: paired.id, children: [new TextRun({ text: paired.name, font: 'Arial', size: 22, style: 'Hyperlink' })] })] : []),
          ]
        }));
      } else {
        mainContent.push(new Paragraph({
          spacing: { before: 30, after: 30 }, indent: { left: 480 },
          children: [new InternalHyperlink({ anchor: f.id, children: [new TextRun({ text: f.name, font: 'Arial', size: 22, style: 'Hyperlink' })] })]
        }));
      }
    }
  }

  // Build faction content
  for (const exp of byExpansion) {
    mainContent.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true, keepNext: true,
        children: [new Bookmark({ id: 'exp_' + exp.title.replace(/\W+/g, '_'), children: [new TextRun({ text: exp.title, font: 'Arial' })] })]
      }),
      new Paragraph({
        spacing: { before: 0, after: 200 }, keepNext: true,
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'C9A845', space: 1 } },
        children: [new TextRun('')]
      })
    );
    exp.factions.forEach((f, i) => {
      mainContent.push(...factionSection(f, { firstInExpansion: i === 0 }));
    });
  }

  const mainHeader = new Header({
    children: [new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C9A845', space: 1 } },
      spacing: { before: 0, after: 100 },
      children: [new TextRun({ text: 'Twilight Imperium 4th Edition — Faction Reference', font: 'Arial', size: 18, color: '888899' })]
    })]
  });
  const mainFooter = new Footer({
    children: [new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'C9A845', space: 1 } },
      spacing: { before: 100, after: 0 }, alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({ text: 'Page ', font: 'Arial', size: 18, color: '888899' }),
        new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: '888899' }),
        new TextRun({ text: ' of ', font: 'Arial', size: 18, color: '888899' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 18, color: '888899' }),
      ]
    })]
  });

  const doc = new Document({
    creator: 'TI4 Faction Reference Generator',
    title: 'TI4 Faction Reference — Selected Factions',
    background: { color: '1E1E24' },
    styles: {
      default: { document: { run: { font: 'Arial', size: 22, color: 'EFEFEF' } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Arial', color: 'C9A845' },
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: 'C9A845' },
          paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: 'C9A845' },
          paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2, keepNext: true } },
        { id: 'Hyperlink', name: 'Hyperlink', basedOn: 'Normal',
          run: { color: 'D4B84E', underline: { type: 'single' } } },
      ]
    },
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
      }]
    },
    sections: [
      buildCoverSection(),
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: { default: mainHeader },
        footers: { default: mainFooter },
        children: mainContent,
      }
    ]
  });

  // Generate initial docx buffer
  const rawBuffer = await Packer.toBuffer(doc);

  // Post-process: unzip → fix_bookmarks → rezip
  const tmpDir  = path.join(os.tmpdir(), `ti4-${process.pid}-${Date.now()}`);
  const tmpDocx = tmpDir + '.docx';
  const tmpOut  = tmpDir + '-fixed.zip';
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(tmpDocx, rawBuffer);
    execSync(`cd "${tmpDir}" && unzip -q "${tmpDocx}" && rm "${tmpDocx}"`);
    const pyScript = path.join(__dirname, 'fix_bookmarks_api.py');
    execSync(`python3 "${pyScript}" "${tmpDir}"`, { stdio: 'pipe' });
    execSync(`cd "${tmpDir}" && zip -r -q "${tmpOut}" .`);
    return fs.readFileSync(tmpOut);
  } finally {
    try { execSync(`rm -rf "${tmpDir}" "${tmpOut}"`); } catch (_) {}
  }
}

module.exports = generateFiltered;
