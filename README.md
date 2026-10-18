# Mahalaxmi Granites — Website

Marketing site for **Mahalaxmi Granites**, premium granite wholesaler in North India.
Dark-luxury theme in Marcellus + Outfit, with a procedural granite engine so every slab
is rendered live in the browser — no image assets needed.

## Highlights

- **3D hero** — a fan of polished granite slabs lit by a PMREM-filtered studio environment,
  with real reflections, a procedural roughness map derived from the mineral grain, and
  scroll-driven dispersal as the hero leaves the viewport.
- **Slab inspector** — every product card opens an interactive modal where the slab can be
  dragged to rotate and scrolled to zoom.
- **Procedural granite engine** (`src/textures.js`) — seeded value noise + mineral speckles
  + organic veins, so eight varieties are generated from palette data alone.
- **Trade-focused content** — wholesale pricing, origins, finishes, service regions, and a
  quote form that opens WhatsApp with the enquiry pre-filled.
- **Accessibility** — `prefers-reduced-motion` support, focus-visible rings, keyboard-closable
  modal, and a static fallback when WebGL is unavailable.

## Structure

```
index.html          # page + slab inspector markup
src/
├── main.js         # nav, product grid, counters, quote form, inspector wiring
├── scene.js        # 3D hero scene
├── inspector.js    # interactive 3D slab modal
├── stone.js        # shared env map, PBR maps, slab mesh factory
├── textures.js     # procedural granite texture engine
├── products.js     # catalogue + palette data
└── style.css       # dark luxury theme
```

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server (http://localhost:5173)
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

## Editing

- **Products / pricing / regions** — `src/products.js`
- **Colours / fonts** — `:root` in `src/style.css`
- **Phone / WhatsApp / email / address** — `CONTACT` at the top of `src/main.js`
- **Sections & copy** — `index.html`

## Deployment

Pushes to `main` build and deploy to **GitHub Pages** via `.github/workflows/deploy.yml`.
