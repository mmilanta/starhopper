# Starhopper

A browser game for learning the names of stars. Explore the entire celestial sphere, select a star, and enter its proper name. Each correct name earns one point and leaves a label on the sky. No difficulty levels, accounts, or timers.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173. `npm run build` creates the static site in `dist`; `npm run preview` serves that build. `npm test` runs catalogue, matching, persistence, and projection tests. With the dev server running, `npx playwright install chromium` followed by `npm run test:browser` checks gameplay and mobile layout in Chromium.

## Controls

- Drag or use arrow keys with the sky focused to pan; scroll, pinch, or use +/− to zoom.
- Click a named star to guess. Unnamed background stars are scenery.
- On a focused sky, Tab cycles visible named stars; Enter focuses the answer field; Escape leaves the sky controls. Shift+Tab also moves focus out.
- Correct names are accent-, case-, punctuation-, and space-insensitive. Official alternative spellings are accepted; arbitrary typos are not, but a guess within one or two letters of the name gets a “So close” hint (no point).
- Clicking a star with a mouse focuses the answer field; Escape there closes the panel and returns focus to the sky.
- Nearby-star buttons let you choose overlapping catalogue entries independently.
- **Done · reveal sky** opens a review of all stars sorted by apparent magnitude, brightest first (unknown magnitudes last). Got labels are green and missed labels are orange; the stars themselves retain their natural colors. Each list entry shows J2000 right ascension and declination beneath its name. Clicking a result flies to it and highlights it in the sky (instant with reduced motion). The bottom sidebar controls show **Resume** and **Restart** in review mode. Resume preserves discoveries; Restart asks for confirmation, then clears discoveries and saved score and returns to the initial sky. Review mode is saved across reloads and awards no points.
- Field notes return to discovered stars. Progress persists in localStorage on this browser and origin, with one point per catalogue name.

## Catalogue and attribution

Bundled snapshot retrieved 2026-10-26: **652 names** from the [IAU Catalog of Star Names](https://exopla.net/star-names/modern-iau-star-names/), linked by the [IAU](https://www.iau.org/IAU/IAU/News/Ann2026/New-Star-Names-2026.aspx). The count is derived from the data, not imposed as a game limit. Twenty-one rows lack coordinates in the official table; their coordinates come from [Cora Schneck's iau-star-names](https://github.com/cyschneck/iau-star-names) (MIT). Each entry records its coordinate source. Verified coordinate corrections are retained in `scripts/coordinate-corrections.json`; Mizar uses [SIMBAD J2000 coordinates](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Mizar) to correct an erroneous right ascension in the source table. Non-numeric visual magnitudes are stored as null.

Background stars (to magnitude 6) and constellation lines come from [D3 Celestial](https://github.com/ofrohn/d3-celestial) (BSD-3-Clause). All stars use measured B−V color indices with the D3 Celestial RGB palette: 579 named stars have color data from its XHIP-based catalogue. Missing values use neutral white. These are screen approximations of stellar colors; green/orange result colors apply to labels and list entries, never to the stars themselves. Third-party licenses are in `public/data/`.

`python3 scripts/build_catalogue.py` refreshes the named catalogue using Python's standard library and an internet connection. Review the resulting changes and update the snapshot test/count documentation when the official catalogue grows. All gameplay data is bundled locally; Google Fonts are optional with system-font fallbacks.

## Scope

Static J2000 equatorial positions with a perspective projection, including both hemispheres. This is an educational star map, not a location/time-aware planetarium. Star size, opacity, and glow follow a compressed exponential magnitude response shared by named and background stars. Zooming reveals faint stars more clearly; selection hit areas remain generous regardless of rendered size. Faint named stars retain a small minimum display size; non-visual objects are represented as map markers. Names for close components can occupy essentially the same point. Constellation lines appear only in reveal mode and remain hidden while guessing.

## Deployment

Live at https://mmilanta.github.io/starhopper/. Deploy only when explicitly requested. Pushes do not deploy. Manually run the Deploy to GitHub Pages workflow (`gh workflow run pages.yml --ref main`) to run tests, build, and deploy using `.github/workflows/pages.yml`. Production assets and catalogue URLs use the `/starhopper/` base path. Local development still uses `/`.
