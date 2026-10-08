/** How wide a picture is kept: sharp on a card, small enough for the browser to keep many. */
const KEEP = 220;

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = url;
  });
}

/**
 * Redraws a picture at card size and returns it as a data URL, ready to keep in a pack.
 *
 * A phone photo is several megabytes and the browser keeps only a few for the whole site,
 * so everything is redrawn small first. A photo goes on white and is kept as a JPEG, which
 * is what photos compress best as. A drawing keeps its see-through background, so it sits
 * on the card the way it was drawn, and a drawing made of lines (an SVG) is drawn at full
 * card size whatever size it says it is, since lines stay sharp at any size.
 */
async function redraw(blob: Blob, photo: boolean): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const w0 = img.naturalWidth || KEEP;
    const h0 = img.naturalHeight || KEEP;
    const vector = blob.type.includes('svg');
    const k = vector ? KEEP / Math.max(w0, h0) : Math.min(1, KEEP / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k));
    const h = Math.max(1, Math.round(h0 * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    if (photo) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    // a browser that cannot write WebP hands back a PNG, which keeps the see-through parts too
    return photo ? canvas.toDataURL('image/jpeg', 0.8) : canvas.toDataURL('image/webp', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A picture from the teacher's computer. */
export function fromFile(file: File) {
  return redraw(file, true);
}

/** A picture from one of the collections, copied into the pack so the lesson never needs the internet. */
export async function fromCollection(src: string) {
  const r = await fetch(src);
  if (!r.ok) throw new Error(`could not fetch ${src}`);
  return redraw(await r.blob(), false);
}
