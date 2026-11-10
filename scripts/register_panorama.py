#!/usr/bin/env python3
"""Register the ESO photographic mosaic to catalogue stars, then encode WebP.

Usage: python3 scripts/register_panorama.py /path/to/eso0932a.jpg
Requires NumPy and Pillow. The original image is not downloaded by this script.
A smooth spherical correction handles local stitching distortion; the renderer's
rotation and the catalogue coordinates stay unchanged.
"""
import json
import math
from pathlib import Path
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ROTATION = np.array([
    [-.001059815677, -.891002661138, -.453996844302],
    [.479554000032, -.398840846808, .781635426507],
    [-.877511730887, -.216887613208, .427706587969],
])


def unit(ra, dec):
    a, d = np.radians([ra, dec])
    return np.array([math.cos(d)*math.cos(a), math.cos(d)*math.sin(a), math.sin(d)])


def image_pixel(direction, width, height):
    x, y, z = direction
    return np.array([(.5-math.atan2(y, x)/(2*math.pi)) % 1*width-.5,
                     (.5-math.atan2(z, math.hypot(x, y))/math.pi)*height-.5])


def image_direction(x, y, width, height):
    a = (.5-(x+.5)/width)*2*math.pi
    d = (.5-(y+.5)/height)*math.pi
    return np.stack([np.cos(d)*np.cos(a), np.cos(d)*np.sin(a), np.sin(d)], axis=-1)


def register(source):
    image = np.array(Image.open(source).convert('RGB'))
    height, width = image.shape[:2]
    brightness = image.mean(axis=2)
    stars = json.loads((ROOT/'public/data/stars.json').read_text())
    anchors = []
    for star in stars:
        if star['mag'] is None or (star['mag'] > 3.1 and star['name'] != 'Nashira'):
            continue
        direction = ROTATION @ unit(star['ra'], star['dec'])
        x, y = image_pixel(direction, width, height)
        ix, iy = round(x), round(y)
        if not 16 <= iy < height-16:
            continue
        patch = brightness[np.ix_(np.arange(iy-10, iy+11), np.arange(ix-10, ix+11) % width)]
        dy, dx = np.unravel_index(np.argmax(patch), patch.shape)
        px, py = ix-10+int(dx), iy-10+int(dy)
        flux = np.maximum(0, brightness[np.ix_(np.arange(py-3, py+4), np.arange(px-3, px+4) % width)]-np.median(patch))
        flux[flux < flux.max()*.3] = 0
        if not flux.sum():
            continue
        cx = px-3+(flux.sum(axis=0)*np.arange(7)).sum()/flux.sum()
        cy = py-3+(flux.sum(axis=1)*np.arange(7)).sum()/flux.sum()
        measured = image_direction(cx, cy, width, height)
        separation = math.degrees(math.acos(np.clip(direction @ measured, -1, 1)))
        if separation > .3:
            continue  # Reject a likely match to a different photographic star.
        anchors.append({'star': star['name'], 'sourcePixel': [float(cx % width), float(cy)],
                        'pixel': [float(x), float(y)], 'direction': direction, 'measured': measured})
    centers = np.array([a['direction'] for a in anchors])
    differences = np.array([a['measured']-a['direction'] for a in anchors])
    sigma = math.radians(15)
    kernel = np.exp((np.clip(centers @ centers.T, -1, 1)-1)/sigma**2)
    weights = np.linalg.solve(kernel+np.eye(len(anchors))*.0001, differences)
    fitted = kernel @ weights
    residuals = np.linalg.norm(fitted-differences, axis=1)*180/math.pi
    print(f'{len(anchors)} anchors; median/max fit residual: {np.median(residuals):.5f}/{max(residuals):.5f} degrees')
    # Sample a smooth periodic displacement field; only the photograph is warped.
    # A padded longitude grid avoids any discontinuity at the panorama seam.
    gx, gy = np.meshgrid(np.linspace(-.5, width-.5, 513), np.linspace(-.5, height-.5, 257))
    rays = image_direction(gx, gy, width, height)
    field = (np.exp((np.clip(rays.reshape(-1, 3) @ centers.T, -1, 1)-1)/sigma**2) @ weights).reshape(257, 513, 3)
    displacement = np.stack([np.array(Image.fromarray(field[:, :, i].astype('float32')).resize((width, height), Image.Resampling.BILINEAR)) for i in range(3)], axis=-1)
    result = np.empty_like(image)
    for first in range(0, height, 150):
        last = min(height, first+150)
        xs, ys = np.meshgrid(np.arange(width), np.arange(first, last))
        mapped = image_direction(xs, ys, width, height)+displacement[first:last]
        sx = ((.5-np.arctan2(mapped[..., 1], mapped[..., 0])/(2*math.pi)) % 1)*width-.5
        sy = np.clip((.5-np.arctan2(mapped[..., 2], np.hypot(mapped[..., 0], mapped[..., 1]))/math.pi)*height-.5, 0, height-1)
        ix, iy = np.floor(sx).astype(int), np.floor(sy).astype(int)
        fx, fy = (sx-ix)[..., None], (sy-iy)[..., None]
        values = (image[iy, ix % width]*(1-fx)+image[iy, (ix+1) % width]*fx)*(1-fy)+(image[np.minimum(iy+1, height-1), ix % width]*(1-fx)+image[np.minimum(iy+1, height-1), (ix+1) % width]*fx)*fy
        result[first:last] = np.clip(values, 0, 255).astype('uint8')
    # Verify held photographic centroids in the actual resampled image, including
    # the reported Capricorn stars, rather than only checking the fitted model.
    measured_errors = []
    for anchor in anchors:
        x, y = anchor['pixel']; ix, iy = round(x), round(y)
        patch = result[np.ix_(np.arange(iy-3, iy+4), np.arange(ix-3, ix+4) % width)].mean(axis=2)
        flux = np.maximum(0, patch-np.median(patch)); flux[flux < flux.max()*.3] = 0
        if not flux.sum():
            continue
        cx = ix-3+(flux.sum(axis=0)*np.arange(7)).sum()/flux.sum()
        cy = iy-3+(flux.sum(axis=1)*np.arange(7)).sum()/flux.sum()
        error = math.hypot((cx-x)*math.cos((.5-(y+.5)/height)*math.pi), cy-y)
        anchor['verifiedResidualPixels'] = error
        measured_errors.append(error)
        if anchor['star'] in ['Deneb Algedi', 'Nashira']:
            print(anchor['star'], 'resampled centroid error:', round(error, 3), 'pixels')
            if error > 1:
                raise RuntimeError('Capricorn registration exceeds one source pixel')
    print('Resampled image median centroid error:', round(float(np.median(measured_errors)), 3), 'pixels')
    Image.fromarray(result).save(ROOT/'src/assets/milky-way-detail.webp', quality=94, method=6)
    metadata = {
        'source': 'https://cdn.eso.org/images/large/eso0932a.jpg',
        'measurementSize': [width, height],
        'method': 'Bright-star centroids at original resolution. A regularized spherical Gaussian radial-basis field (15-degree scale, ridge 0.0001) rectifies local stitching offsets in the bundled photograph. Catalogue positions are unchanged. Pixel coordinates refer to the corrected image, with zero-based pixel centers. This remains a photographic mosaic, not an astrometric survey.',
        'rotation': ROTATION.tolist(),
        'landmarks': [{k: v for k, v in a.items() if k not in ['direction', 'measured']} for a in anchors],
    }
    (ROOT/'src/assets/milky-way-registration.json').write_text(json.dumps(metadata, indent=2)+'\n')


if __name__ == '__main__':
    register(sys.argv[1])
