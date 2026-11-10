const radians = Math.PI / 180;
const vector = ({ra, dec}) => [Math.cos(dec*radians)*Math.cos(ra*radians), Math.cos(dec*radians)*Math.sin(ra*radians), Math.sin(dec*radians)];
const dot = (a, b) => a.reduce((sum, n, i) => sum + n*b[i], 0);

// An explicit TAN WCS matches the game's perspective, including the observer's
// rotated navigation pole. FITS pixels run upward; canvas pixels run downward.
export function surveyWcs(view, frame, width, height) {
  const center = frame.toEquatorial(view.ra, view.dec);
  const east = vector({ra:center.ra+90, dec:0});
  const north = vector({ra:center.ra, dec:center.dec+90});
  const localEast = vector(frame.toEquatorial(view.ra+90, 0));
  const localNorth = vector(frame.toEquatorial(view.ra, view.dec+90));
  const scale = 2*Math.tan(view.fov*radians/2)/Math.min(width,height)/radians;
  return {
    NAXIS:2, NAXIS1:width, NAXIS2:height,
    CTYPE1:'RA---TAN', CTYPE2:'DEC--TAN', CUNIT1:'deg', CUNIT2:'deg',
    CRVAL1:center.ra, CRVAL2:center.dec, CRPIX1:width/2+.5, CRPIX2:height/2+.5,
    CD1_1:-dot(localEast,east)*scale, CD1_2:dot(localNorth,east)*scale,
    CD2_1:-dot(localEast,north)*scale, CD2_2:dot(localNorth,north)*scale,
  };
}

export function skyViewUrl(wcs) {
  const scale = Math.hypot(wcs.CD1_1, wcs.CD2_1);
  // SkyView's positive rotation has negative off-diagonal CD elements.
  const rotation = Math.atan2(-wcs.CD1_2, wcs.CD2_2)/radians;
  const params = new URLSearchParams({
    Position:`${wcs.CRVAL1},${wcs.CRVAL2}`, Survey:'DSS2 Red',
    Coordinates:'J2000', Projection:'Tan', Rotation:String(rotation),
    Pixels:`${wcs.NAXIS1},${wcs.NAXIS2}`,
    Size:`${scale*wcs.NAXIS1},${scale*wcs.NAXIS2}`,
    Return:'JPEG', Scaling:'Log', Sampler:'LI',
  });
  return `https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl?${params}`;
}

function loadRemoteImage(url, signal) {
  return new Promise((resolve,reject) => {
    const image = new Image(); image.referrerPolicy = 'no-referrer';
    const cleanup = () => { image.onload = null; image.onerror = null; signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); image.src = ''; reject(Error('Survey request cancelled')); };
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(Error('Survey unavailable')); };
    signal.addEventListener('abort', abort, {once:true});
    if (signal.aborted) { abort(); return; }
    image.src = url;
  });
}

export function createSurveySky(onChange) {
  let timer, controller, requested = '', ready = '', image, enabled = true;
  let state = 'wide', provider = 'CDS';
  const cache = new Map();
  function update(view, frame, width, height) {
    if (!width || !height) return;
    const factor = Math.min(1, 1600/width, 1200/height);
    const wcs = surveyWcs(view, frame, Math.max(1,Math.round(width*factor)), Math.max(1,Math.round(height*factor)));
    const key = enabled && view.fov <= 35 ? JSON.stringify(wcs) : '';
    if (key === requested) return;
    requested = key;
    clearTimeout(timer); controller?.abort();
    if (!key) { state = enabled ? 'wide' : 'off'; return; }
    if (cache.has(key)) { ({image,provider} = cache.get(key)); ready = key; state = 'ready'; return; }
    state = 'loading';
    timer = setTimeout(async () => {
      const request = new AbortController(); controller = request;
      let timeout = setTimeout(() => request.abort(), 20000);
      let url;
      try {
        const params = new URLSearchParams({hips:'CDS/P/DSS2/color', wcs:key, format:'jpg'});
        let next, source = 'CDS';
        try {
          const response = await fetch(`https://alasky.cds.unistra.fr/hips-image-services/hips2fits?${params}`, {signal:AbortSignal.any([request.signal,AbortSignal.timeout(4000)]), referrerPolicy:'no-referrer'});
          if (!response.ok) throw Error('Survey unavailable');
          url = URL.createObjectURL(await response.blob());
          next = new Image(); next.src = url; await next.decode();
        } catch {
          if (request.signal.aborted) throw Error('Survey request cancelled');
          clearTimeout(timeout); timeout = setTimeout(() => request.abort(), 20000);
          next = await loadRemoteImage(skyViewUrl(wcs), request.signal);
          source = 'NASA';
        }
        if (requested !== key || controller !== request || request.signal.aborted) return;
        image = next; provider = source; ready = key; state = 'ready';
        cache.set(key, {image,provider});
        if (cache.size > 6) cache.delete(cache.keys().next().value);
        onChange();
      } catch {
        if (requested === key && controller === request) { state = 'unavailable'; onChange(); }
      } finally { clearTimeout(timeout); if (url) URL.revokeObjectURL(url); }
    }, 650);
  }
  return {
    update,
    setEnabled(value) { enabled = value; requested = undefined; },
    get state() { return state; },
    get provider() { return provider; },
    draw(ctx, width, height) {
      if (!enabled || !requested || ready !== requested || state !== 'ready') return false;
      ctx.save(); ctx.globalAlpha = provider === 'NASA' ? .45 : .75; ctx.drawImage(image, 0, 0, width, height); ctx.restore();
      return true;
    },
  };
}
