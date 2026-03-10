# TI4 Faction Reference

A Twilight Imperium 4th Edition interactive faction reference web app.

## Features

- **Interactive Viewer** (`TI4_Reactive.html`) — standalone single-file Alpine.js app. Select any combination of factions and render side-by-side reference sheets covering lore, home system, abilities, technologies, units, leaders, and cards.
- **Comprehensive Faction Guide** — full HTML reference document.
- **Node.js Server** (`server.js`) — optional Express server for local hosting.

## Quick Start (standalone)

Just open `public/TI4_Reactive.html` in any browser — no server needed.

## Server Mode

```bash
npm install
npm start
```

Then visit `http://localhost:3000`.

## Project Structure

```
public/
  TI4_Reactive.html          # Standalone interactive viewer (Alpine.js)
  index.html                 # Server-hosted entry point
  art/                       # Faction artwork crops
server.js                    # Express server
generate-filtered.js         # Data generation utility
fix_bookmarks_api.py         # Bookmark utility script
```

## Tech Stack

- [Alpine.js](https://alpinejs.dev/) — reactive UI (no build step)
- [Express](https://expressjs.com/) — optional local server
