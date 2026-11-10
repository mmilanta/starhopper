# Deep-sky catalogue

`deep-sky.json` is a curated, transformed subset of **OpenNGC**, by Mattia Verga
and the OpenNGC contributors, licensed under **CC BY-SA 4.0**.

Source: https://github.com/mattiaverga/OpenNGC

Pinned revision: `be3cd6c5498806a2fbb2f7e0452ef802dbb02be0`

Source files: `database_files/NGC.csv`, `database_files/addendum.csv` and `outlines/surfaces_catgen.dat`, retrieved 2026-11-06.

License text: `LICENSE-openngc.txt`.

Changes: selected 66 nebulae, galaxies and open/globular clusters, converted J2000 coordinates into
decimal degrees, selected readable common names, added shortened common-name
aliases and Messier/NGC/IC designations, and converted blank V magnitudes to null.
Eighteen selected nebulae also include traced contours from the same revision. Coordinates in the surface file are in degrees. Only the brightest available contour level is retained for each object (level 3 where available, otherwise level 2). Separate components within that level are preserved. The chosen level is recorded in `outlineLevel`. The Large Magellanic Cloud uses the centre and angular axes of `ESO056-115` from the addendum. OpenNGC’s outline file named `LMC` traces only a small off-centre emission region and is not used for the galaxy boundary. The Rosette Nebula entry uses the enclosing NGC2237 complex outline, recorded in `outlineSource`. These are approximate photographic contours, not sharply defined physical boundaries.

Angular axes are in arcminutes. Missing position angles default to zero.
The adapted catalogue remains available under CC BY-SA 4.0.

Reproduce with `python3 scripts/build_deep_sky.py`. The script pins the source
revision; it also accepts a local copy of the source CSV as its first argument.

# Survey photography

The optional detailed sky layer requests Digitized Sky Survey 2 color cutouts
from CDS's HiPS2FITS service using `CDS/P/DSS2/color`, with NASA SkyView's
`DSS2 Red` survey as a monochrome fallback.

Credit: **DSS2 / STScI / CDS**. The Digitized Sky Surveys were produced at the
Space Telescope Science Institute under U.S. Government grant NAG W-2166.
The survey images are based on photographic data obtained using the Oschin
Schmidt Telescope on Palomar Mountain and the UK Schmidt Telescope.

Survey information: https://aladin.cds.unistra.fr/hips/

Service documentation: https://alasky.cds.unistra.fr/hips-image-services/hips2fits

NASA SkyView documentation: https://skyview.gsfc.nasa.gov/current/docs/skyviewinajar.html

Survey images are fetched at runtime and are not included in this repository.
Requests disclose the viewport's sky coordinates and the visitor's IP address
to CDS or NASA. They do not include guesses or player IDs. Switching off HD disables
these requests. No names or annotations are requested from the image service.
