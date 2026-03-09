'use strict';
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const generateFiltered = require('./generate-filtered');

const app  = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Faction data JSON ──────────────────────────────────────────────────────────
app.get('/faction-data.json', (req, res) => {
  res.sendFile(path.join(ROOT, 'faction-data.json'));
});

// ── Faction art images ─────────────────────────────────────────────────────────
// Serves artcrop_<id>.jpg and artonly_<id>.jpg from the project root
app.get('/art/:filename', (req, res) => {
  const filename = req.params.filename.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  const artPath  = path.join(__dirname, 'public', 'art', filename);
  if (fs.existsSync(artPath)) {
    res.sendFile(artPath);
  } else {
    res.status(404).end();
  }
});

// ── Generate filtered DOCX ─────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { factionIds } = req.body;

  if (!Array.isArray(factionIds) || factionIds.length < 2 || factionIds.length > 8) {
    return res.status(400).json({ error: 'Please select between 2 and 8 factions.' });
  }

  // Sanitise IDs (alphanumeric + underscore only)
  const clean = factionIds.map(id => String(id).replace(/[^a-z0-9_]/gi, ''));

  try {
    console.log(`Generating DOCX for: ${clean.join(', ')}`);
    const buffer = await generateFiltered(clean);
    const names  = clean.join('-');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="TI4_${names}.docx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
    console.log(`Served ${(buffer.length / 1024).toFixed(0)} KB`);
  } catch (err) {
    console.error('Generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate document. ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 TI4 Faction Reference running at http://localhost:${PORT}\n`);
});
