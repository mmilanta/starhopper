# Starhopper

A browser game for learning the names of stars, nebulae, galaxies and star clusters. Explore the entire celestial sphere, select an object, and enter its name. Each correct name earns one point and leaves a label on the sky. Includes 652 named stars and 66 deep-sky objects (718 total). No difficulty levels, accounts, or timers.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173. `npm run build` creates the static site in `dist`; `npm run preview` serves that build. `npm test` runs catalogue, matching, persistence, and projection tests. With the dev server running, `npx playwright install chromium` followed by `npm run test:browser` checks gameplay and mobile layout in Chromium.

## Controls

- Drag or use arrow keys with the sky focused to pan; scroll, pinch, or use +/− to zoom.
- **Z** opens observer settings. New browsers start at 45°N for the current month. Enter latitude (positive north, negative south) and choose a month, then select **Set navigation zenith**. This rotates the navigation sphere: upward panning stops at your zenith, downward panning stops at your nadir, and horizontal panning turns around this new vertical axis. The seasonal preview uses the 15th at 10 pm local mean solar time, without time zones or daylight saving. A cross marks the zenith; panning and star selection still work across the full sphere. The view starts at the zenith, and coordinate readouts continue to show equatorial RA/Dec. Settings persist across reloads and restarts.
- Use the sidebar button below the coordinates to hide or show the sidebar. When hidden, a compact score remains visible and the sky fills the space.
- The grid button shows equatorial coordinate lines and the J2000 ecliptic, drawn as a dashed gold line.
- Click a named star, nebula, galaxy or cluster to guess. At sufficient zoom, 18 nebulae follow the brightest available photographic contour level traced by OpenNGC; galaxies and other nebulae use catalogue angular axes and position angles. Selected and hovered outlines follow those shapes. Click inside an outline to select the object. When unresolved, galaxies use oval markers and nebulae use diamond markers. Clusters appear in lavender: open clusters have dashed outlines, while globular clusters have solid outlines and a crossed-circle marker when unresolved. Unnamed background stars are scenery. Deep-sky objects accept common names, shortened names (such as Andromeda), and catalogue IDs (such as M31, Messier 31 or NGC 224).
- On a focused sky, Tab cycles visible objects; Enter focuses the answer field; Escape leaves the sky controls. Shift+Tab also moves focus out.
- Correct names are accent-, case-, punctuation-, and space-insensitive. Official alternative spellings are accepted; arbitrary typos are not, but a guess within one or two letters of the name gets a “So close” hint (no point).
- Clicking a star with a mouse focuses the answer field; Escape there closes the panel and returns focus to the sky.
- Nearby-star buttons let you choose overlapping catalogue entries independently.
- **Done · reveal sky** opens a review of all objects sorted by apparent magnitude, brightest first (unknown magnitudes last). Got labels are green and missed labels are orange; the stars themselves retain their natural colors. Each list entry shows J2000 right ascension and declination beneath its name. Clicking a result flies to it and highlights it in the sky (instant with reduced motion). The bottom sidebar controls show **Resume** and **Restart** in review mode. Resume preserves discoveries; Restart asks for confirmation, then clears discoveries and saved score and returns to the initial sky. Review mode is saved across reloads and awards no points.
- Field notes return to discovered stars. Progress persists in localStorage on this browser and origin, with one point per catalogue object. Existing star discoveries are preserved when adding the deep-sky catalogue.

## Catalogue and attribution

Bundled snapshot retrieved 2026-10-26: **652 names** from the [IAU Catalog of Star Names](https://exopla.net/star-names/modern-iau-star-names/), linked by the [IAU](https://www.iau.org/IAU/IAU/News/Ann2026/New-Star-Names-2026.aspx). The count is derived from the data, not imposed as a game limit. Twenty-one rows lack coordinates in the official table; their coordinates come from [Cora Schneck's iau-star-names](https://github.com/cyschneck/iau-star-names) (MIT). Each entry records its coordinate source. Verified coordinate corrections are retained in `scripts/coordinate-corrections.json`; Mizar uses [SIMBAD J2000 coordinates](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Mizar) to correct an erroneous right ascension in the source table. Non-numeric visual magnitudes are stored as null.

Background stars (to magnitude 6) and constellation lines come from [D3 Celestial](https://github.com/ofrohn/d3-celestial) (BSD-3-Clause). Stars use measured B−V color indices with the D3 Celestial RGB palette: 579 named stars have color data from its XHIP-based catalogue. Missing values use neutral white. These are screen approximations of stellar colors; green/orange result colors apply to labels and list entries, never to the stars themselves. Third-party licenses are in `public/data/`.

The **HD** button enables DSS2 color survey photography at fields of view of 35° or narrower. The survey loads 650 ms after navigation stops, matches the current perspective and observer rotation through a TAN WCS, and allows zooming to 0.1°. A small in-memory cache avoids repeating recent requests. Survey images need internet access. The app first requests CDS HiPS2FITS color photography; if it fails or takes over 4 seconds, it requests DSS2 red-band photography from NASA SkyView. NASA images are monochrome. If that request fails or takes over 20 seconds, the bundled panorama remains visible. Pan, zoom, or turn off HD to cancel a pending request. The credit line indicates loading, survey imagery, or an unavailable survey. A loaded survey replaces the panorama, so offset photographic star images are not blended together.

The review list can be filtered by stars, nebulae, galaxies or clusters, and searched by names or catalogue IDs. Clicking a deep-sky result frames it at a scale based on its angular diameter.

The deep-sky snapshot is a curated subset of [OpenNGC](https://github.com/mattiaverga/OpenNGC) at revision `be3cd6c5498806a2fbb2f7e0452ef802dbb02be0`. Its 66 objects include Andromeda, Triangulum, the Small and Large Magellanic Clouds, Orion, Lagoon, the Ring and the Crab, plus 26 star clusters (10 globular and 16 open). Clusters include M13, M3, M5, M15, M22, M92, 47 Tucanae, Omega Centauri, the Pleiades, Hyades, Beehive, Wild Duck, Jewel Box and both members of the Double Cluster (h and Chi Persei). The Pleiades and Hyades come from the same pinned revision’s `database_files/addendum.csv`. Cluster answers accept common names and catalogue IDs; the Pleiades also accept Seven Sisters. Coordinates are J2000, sizes are in arcminutes, and magnitudes use V-band values where available (otherwise unknown). Common names are curated rather than an official IAU name list. `python3 scripts/build_deep_sky.py` reproduces the snapshot. Attribution and the CC BY-SA 4.0 catalogue license are in `public/data/LICENSE-deep-sky.md` and `LICENSE-openngc.txt`. Survey credits are also documented there.

The photographic backdrop is [ESO/S. Brunier's Milky Way panorama](https://www.eso.org/public/images/eso0932a/) (CC BY 4.0), encoded at WebP quality 94 without the previous median filtering or blur, rectified against the star catalogue, and displayed at 45% opacity for readability. Its spherical projection follows the same observer frame, pan and zoom as the catalogue stars. A fitted rotation and a smooth local rectification register 159 bright photographed stars. Deneb Algedi and Nashira are verified within half a source pixel in the corrected image. This remains an approximate photographic mosaic rather than an astrometric survey. `scripts/register_panorama.py` reproduces the correction from the source JPEG with NumPy and Pillow. It loads independently, so gameplay still works if the image is unavailable. See `public/data/LICENSE-milky-way.md` for source and processing details.

`python3 scripts/build_catalogue.py` refreshes the named catalogue using Python's standard library and an internet connection. Review the resulting changes and update the snapshot test/count documentation when the official catalogue grows. All gameplay catalogue data is bundled locally; detailed survey imagery is fetched from CDS or NASA SkyView when HD is on and the view is zoomed in. Google Fonts are optional with system-font fallbacks.

## Scope

Static J2000 equatorial positions with a perspective projection, including both hemispheres. Observer settings provide an approximate seasonal zenith using J2000 mean sidereal time ([USNO formula](https://aa.usno.navy.mil/faq/GAST)), with declination equal to latitude. The representative year is 2000 to match the catalogue equinox; this is an educational preview rather than a precise live planetarium. Star size, opacity, and glow follow a compressed exponential magnitude response shared by named and background stars. Zooming reveals faint stars more clearly; selection hit areas remain generous regardless of rendered size. Faint named stars retain a small minimum display size; non-visual objects are represented as map markers. Names for close components can occupy essentially the same point. Constellation lines appear only in reveal mode and remain hidden while guessing.

## Deployment

Live at https://mmilanta.github.io/starhopper/. Every push to `main` runs tests, builds the site, and deploys to GitHub Pages using `.github/workflows/pages.yml`. To redeploy without a push, run `gh workflow run pages.yml --ref main`. Production assets and catalogue URLs use the `/starhopper/` base path. Local development still uses `/`.
# Variable magnitudes

The checked-in visual magnitude ranges are a snapshot of the [AAVSO International Variable Star Index via HEASARC](https://heasarc.gsfc.nasa.gov/W3Browse/all/aavsovsx.html), matched to catalogue stars within 5 arcseconds. The snapshot covers confirmed variables with a visual-band maximum brighter than magnitude 8 and usable visual-band bounds; other stars use the IAU catalogue's single magnitude. A single value does not imply the star is constant. Ranges smaller than 0.2 magnitude are displayed as a single catalogue value.

## Analytics

Pageviews go to the existing [mmilanta GoatCounter dashboard](https://mmilanta.goatcounter.com). Production pageviews appear under `/starhopper/`; GoatCounter filters localhost by default.

Each submitted, nonblank guess sends one [custom event](https://www.goatcounter.com/help/events):

```
starhopper/guess/Betelgeuse/correct/player/550e8400-e29b-41d4-a716-446655440000
```

The path contains the URL-encoded catalogue object ID (star or deep-sky object), outcome (`correct`, `near-miss`, or `incorrect`), and a random browser UUID. Event titles also include the readable star name, outcome, and player ID. `no_session: true` counts repeated attempts independently. Revealing stars, revisiting discoveries, restoring progress, or submitting an already solved star does not send a guess event. Typed answers are never sent.

In GoatCounter, show events and filter paths by `starhopper/guess/` for all guesses, by `starhopper/guess/Betelgeuse/` for one star, or by `player/<UUID>` for one player. Select the date range to compare counts. These are event totals, not unique-player counts or a timestamped attempt history. CSV exports can be grouped by the star, outcome, and player components for further analysis. This deliberately uses event names because GoatCounter has no custom player-property field; a dedicated event database would be a better fit for large-scale player analysis.

The `starhopper.player-id` localStorage entry is independent of score, so Restart keeps the player identity. Clearing site data creates a new identity, as does using another browser/device. If storage is unavailable, an in-memory ID lasts only until reload. These are pseudonymous browser IDs, not verified people. The help panel explains the collection. The player ID is only attached to guess events, not regular pageviews.

Guesses made before the tracker loads are queued in memory (up to 100), then flushed on script load. Blocked analytics never prevent gameplay; blocked requests, offline visits, or closing a page before delivery can lose events. No historical guesses are backfilled and no retry loop bypasses blockers.
