/** How wide a picture is kept: sharp on a card, small enough for the browser to keep many. */
const KEEP = 220;

/** The empty border left round every picture, as a share of the card picture's side. */
const PAD = 0.07;

/**
 * What counts as background. A picture with see-through parts is measured by them alone,
 * so a white cloud or a white square is still a drawing. A picture with none (a photo, a
 * scan, clip art on white) is measured by how close to white it is — loosely, because a
 * JPEG smudges the edge of everything it stores.
 */
const SEE_THROUGH = 16;
const PAPER = 235;

/** Where the drawing is in a picture: everything that is not background. */
function inkBox(px: Uint8ClampedArray, w0: number, h0: number, paper = PAPER) {
  let x0 = w0;
  let y0 = h0;
  let x1 = -1;
  let y1 = -1;
  let seeThrough = false;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] < 250) {
      seeThrough = true;
      break;
    }
  }
  for (let y = 0; y < h0; y++) {
    for (let x = 0; x < w0; x++) {
      const i = (y * w0 + x) * 4;
      if (seeThrough ? px[i + 3] <= SEE_THROUGH : px[i] > paper && px[i + 1] > paper && px[i + 2] > paper) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  // nothing drawn at all (a blank picture): the whole of it
  if (x1 < 0) return { x0: 0, y0: 0, x1: w0 - 1, y1: h0 - 1, seeThrough };
  return { x0, y0, x1, y1, seeThrough };
}

/** A pixel of a plain light background: white, or the light grey of a drawn "see-through" checkerboard. */
function plain(px: Uint8ClampedArray, i: number) {
  const r = px[i];
  const g = px[i + 1];
  const b = px[i + 2];
  const max = Math.max(r, g, b);
  return max > 204 && max - Math.min(r, g, b) < max * 0.1;
}

/**
 * Takes the background out of a picture that has none see-through: the white, or the grey and
 * white checkerboard that many clip-art sites draw to look see-through (Clara's starfish), that
 * reaches the edge of the picture, with the drawing's outline softened against it; the big
 * patches of the same white closed in by the drawing (inside a bicycle's wheels); and the small
 * writing near an edge (a site's name under her bear). A photo, with no plain background round
 * it, is left as it is. Works on the pixels in place; says whether anything was taken out.
 */
function clearBackground(px: Uint8ClampedArray, w: number, h: number): boolean {
  const n = w * h;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return false;
  // most of the picture's edge must be plain: otherwise it is a photo, or a drawing that fills it
  let edge = 0;
  let plainEdge = 0;
  for (let x = 0; x < w; x++)
    for (const y of [0, h - 1]) {
      edge++;
      if (plain(px, (y * w + x) * 4)) plainEdge++;
    }
  for (let y = 0; y < h; y++)
    for (const x of [0, w - 1]) {
      edge++;
      if (plain(px, (y * w + x) * 4)) plainEdge++;
    }
  if (plainEdge < edge * 0.6) return false;

  // the background: plain pixels joined to the edge
  const bg = new Uint8Array(n);
  const stack: number[] = [];
  const push = (j: number) => {
    if (!bg[j] && plain(px, j * 4)) {
      bg[j] = 1;
      stack.push(j);
    }
  };
  for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
  for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
  while (stack.length) {
    const j = stack.pop()!;
    const x = j % w;
    if (x > 0) push(j - 1);
    if (x < w - 1) push(j + 1);
    if (j >= w) push(j - w);
    if (j < n - w) push(j + w);
  }

  // parts of a mask (4-neighbours): a label for each pixel and each part's size and box
  const parts = (mask: (j: number) => boolean) => {
    const label = new Int32Array(n).fill(-1);
    const info: { size: number; x0: number; y0: number; x1: number; y1: number }[] = [];
    for (let s = 0; s < n; s++) {
      if (label[s] >= 0 || !mask(s)) continue;
      const p = { size: 0, x0: w, y0: h, x1: 0, y1: 0 };
      label[s] = info.length;
      const todo = [s];
      while (todo.length) {
        const j = todo.pop()!;
        const x = j % w;
        const y = (j / w) | 0;
        p.size++;
        p.x0 = Math.min(p.x0, x);
        p.x1 = Math.max(p.x1, x);
        p.y0 = Math.min(p.y0, y);
        p.y1 = Math.max(p.y1, y);
        for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w])
          if (k >= 0 && k < n && label[k] < 0 && mask(k)) {
            label[k] = info.length;
            todo.push(k);
          }
      }
      info.push(p);
    }
    return { label, info };
  };

  // big patches of pure white closed in by the drawing (small ones are eyes, shine and the
  // white writing on a photo, and stay)
  const white = (j: number) => {
    const i = j * 4;
    return !bg[j] && Math.min(px[i], px[i + 1], px[i + 2]) > 238;
  };
  const holes = parts(white);
  for (let j = 0; j < n; j++) if (holes.label[j] >= 0 && holes.info[holes.label[j]].size > n * 0.004) bg[j] = 1;

  // small bits apart from the drawing, near the edge of the picture: writing, a watermark
  const ink = parts((j) => !bg[j]);
  let big = 0;
  for (const p of ink.info) big = Math.max(big, p.size);
  if (!big) return false;
  const band = 0.18;
  for (let j = 0; j < n; j++) {
    const p = ink.info[ink.label[j]];
    if (!p || p.size > big * 0.02) continue;
    const nearEdge = p.y0 > h * (1 - band) || p.y1 < h * band || p.x0 > w * (1 - band) || p.x1 < w * band;
    if (nearEdge) bg[j] = 1;
  }

  let cleared = 0;
  for (let j = 0; j < n; j++) if (bg[j]) cleared++;
  if (cleared < n * 0.05) return false;

  // the drawing's outline against the background: as see-through as it is close to white
  const alpha = new Uint8ClampedArray(n);
  for (let j = 0; j < n; j++) {
    if (bg[j]) continue;
    const x = j % w;
    let next = false;
    for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) if (k >= 0 && k < n && bg[k]) next = true;
    if (!next) {
      alpha[j] = 255;
      continue;
    }
    const i = j * 4;
    const dist = 765 - px[i] - px[i + 1] - px[i + 2];
    alpha[j] = Math.min(255, (dist / 90) * 255);
  }
  for (let j = 0; j < n; j++) px[j * 4 + 3] = alpha[j];
  return true;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
}

/**
 * Puts the drawing in the middle of a square, with the same border all round.
 *
 * The collections do not centre their drawings: Microsoft's fish sits low in its square,
 * with three times as much room above it as below, and Twemoji's touches the bottom edge.
 * On a card that read as a fish cut off at the bottom. So the empty part round a picture —
 * see-through, or plain white paper — is trimmed off, and what is left is centred, every
 * picture the same size on its card whichever collection it came from.
 *
 * A photo has no empty border, so it is only centred. A picture that had see-through parts
 * keeps them (WebP); one that had none is kept on white as a JPEG, which suits photos best.
 */
function centred(source: CanvasImageSource, w0: number, h0: number): string {
  const work = document.createElement('canvas');
  work.width = w0;
  work.height = h0;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  if (!wctx) throw new Error('no canvas');
  wctx.drawImage(source, 0, 0, w0, h0);
  // a plain background is taken out first, so the drawing alone is centred and kept see-through
  const pixels = wctx.getImageData(0, 0, w0, h0);
  if (clearBackground(pixels.data, w0, h0)) wctx.putImageData(pixels, 0, 0);
  const { x0, y0, x1, y1, seeThrough } = inkBox(pixels.data, w0, h0);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;

  const out = document.createElement('canvas');
  out.width = KEEP;
  out.height = KEEP;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  if (!seeThrough) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, KEEP, KEEP);
  }
  ctx.imageSmoothingQuality = 'high';
  const k = (KEEP * (1 - 2 * PAD)) / Math.max(bw, bh);
  const w = bw * k;
  const h = bh * k;
  ctx.drawImage(work, x0, y0, bw, bh, (KEEP - w) / 2, (KEEP - h) / 2, w, h);
  // a browser that cannot write WebP hands back a PNG, which keeps the see-through parts too
  return seeThrough ? out.toDataURL('image/webp', 0.9) : out.toDataURL('image/jpeg', 0.85);
}

/**
 * Draws a picture at a size worth trimming, then centres it.
 *
 * A phone photo is several megabytes, so nothing is worked on at full size: at most twice
 * the card picture. A drawing made of lines (an SVG) is drawn at that size whatever size
 * it says it is, since lines stay sharp at any size.
 */
async function prepare(url: string, vector: boolean): Promise<string> {
  const img = await loadImage(url);
  const nw = img.naturalWidth || KEEP;
  const nh = img.naturalHeight || KEEP;
  const most = 2 * KEEP;
  const k = vector ? most / Math.max(nw, nh) : Math.min(1, most / Math.max(nw, nh));
  return centred(img, Math.max(1, Math.round(nw * k)), Math.max(1, Math.round(nh * k)));
}

async function fromBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    return await prepare(url, blob.type.includes('svg'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A picture from the teacher's computer. */
export function fromFile(file: File) {
  return fromBlob(file);
}

/** A picture from one of the collections, copied into the pack so the lesson never needs the internet. */
export async function fromCollection(src: string) {
  const r = await fetch(src);
  if (!r.ok) throw new Error(`could not fetch ${src}`);
  return fromBlob(await r.blob());
}

/** A picture already kept in a pack, chosen before pictures were centred. */
export function recentre(dataUrl: string) {
  return prepare(dataUrl, false);
}

/**
 * Whether a picture kept in a pack still needs centring: pictures chosen before this was
 * done sit wherever their collection drew them. A centred one is square, with the same
 * border left and right, the same top and bottom, and the narrower of the two is the border
 * `centred` leaves. Measuring it means nothing has to be written down about each picture.
 */
export async function needsCentring(dataUrl: string) {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w !== KEEP || h !== KEEP) return true;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0);
  // (a picture with a plain background still on it, chosen before backgrounds were taken out)
  const copy = ctx.getImageData(0, 0, w, h);
  if (clearBackground(copy.data, w, h)) return true;
  // a JPEG smudges its edges a little more each time it is saved, so a photo is measured
  // more loosely: told it is off-centre by its own smudge, it would be redrawn every visit
  const b = inkBox(ctx.getImageData(0, 0, w, h).data, w, h, 225);
  const slack = b.seeThrough ? 3 : 7;
  const left = b.x0;
  const right = w - 1 - b.x1;
  const top = b.y0;
  const bottom = h - 1 - b.y1;
  const even = Math.abs(left - right) <= slack && Math.abs(top - bottom) <= slack;
  return !even || Math.abs(Math.min(left, top) - KEEP * PAD) > slack + 1;
}
