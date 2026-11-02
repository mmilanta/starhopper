# Photographic Milky Way background

Credit: **ESO/S. Brunier**

Source: [The Milky Way panorama (eso0932a)](https://www.eso.org/public/images/eso0932a/)

Downloaded image: https://cdn.eso.org/images/large/eso0932a.jpg (6000 × 3000)

License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

ESO usage terms: https://www.eso.org/public/outreach/copyright/

This is a real photographic mosaic covering the northern and southern sky.
The distributed image retains the 6000 × 3000 source resolution, median-filtered
to reduce individual star points, lightly blurred and encoded as WebP. In the game it is dimmed and
reprojected with the star catalogue, using a fitted rotation to register the
panorama's axes. No generative image processing is used in this asset.

Reproduce the texture from the source JPEG with ImageMagick:

```sh
magick eso0932a.jpg -statistic Median 3x3 -blur 0x0.6 -quality 88 src/assets/milky-way-eso.webp
```

The source panorama combines photographs taken over several months and includes
some Solar System objects. Softening reduces these points but does not remove
all of them. Angular sizes and large-scale structures are preserved; no nebulae
are enlarged or invented.
