# Photographic Milky Way background

Credit: **ESO/S. Brunier**

Source: [The Milky Way panorama (eso0932a)](https://www.eso.org/public/images/eso0932a/)

Downloaded image: https://cdn.eso.org/images/large/eso0932a.jpg (6000 × 3000)

License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

ESO usage terms: https://www.eso.org/public/outreach/copyright/

This is a real photographic mosaic covering the northern and southern sky.
The distributed `src/assets/milky-way-detail.webp` retains the 6000 × 3000
source resolution, encoded at WebP quality 94 without median filtering or blur.
This replaces the previous softened texture in the running app and preserves
faint structure and photographic stars. The older softened asset is retained
in the repository for reference. A smooth spherical correction fitted to 159 bright-star centroids rectifies local stitching offsets against the catalogue; see `milky-way-registration.json`. The panorama is displayed at 45% opacity.
It follows the star catalogue using the existing fitted registration rotation.
No generative image processing is used.

Reproduce the active texture and calibration metadata from the source JPEG with NumPy and Pillow:

```sh
python3 scripts/register_panorama.py eso0932a.jpg
```

This is a sharper encoding of the same 18-megapixel source, not a
higher-resolution astronomical survey. At high zoom, the optional DSS2 layer
provides finer spatial detail; see `LICENSE-deep-sky.md`.

The source panorama combines photographs taken over several months and includes
some Solar System objects. The panorama retains these photographic points. The registration adjusts local positions smoothly; no nebulae are enlarged for display or invented.
