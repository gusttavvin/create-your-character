import type { CSSProperties, ReactNode } from 'react';
import PartArt from '../../components/PartArt';
import { DRAGON, dragonColors } from './config';
import { DRAGON_OWN, DRAGON_PIECES, type DragonPiece } from './parts';
import { pickOption, type ColorMap, type PartMap, type PartOption, type SlotLayout } from '../types';

/**
 * Lays the dragon out on the sheet.
 *
 * Every piece is a slice of one of the four dragons Clara approved (art-source/dragon) and
 * keeps the coordinates it was drawn in; every body says, through its own pieces, where its
 * wings and tail grow and where its face is. A dragon wearing its own pieces comes back
 * exactly as she approved it. A piece borrowed from another dragon is placed by what it is:
 *
 *   eyes and a mouth are centred where the body's own were — by the eyeballs and the mouth
 *   itself, so the fire and the bubbles coming out of a mouth do not pull it off-centre —
 *   and eyes are made the width of the body's own pair; the red one has two heads, and
 *   wears them on both (TWIN_HEADS);
 *
 *   wings and a tail keep the size they were drawn at, so baby wings stay little and big
 *   ones stay big, and grow from the very place this body's own did: hung by their root,
 *   they always meet the body.
 *
 * Back to front: tail, wings, body, mouth, eyes.
 */
const VW = 600;
const VH = 720;
/** Where the drawings (520 by 620) sit on the sheet. */
const OX = 40;
const OY = 50;
/** The middle of every drawing, which every pair of wings is mirrored about. */
const MID = 260;
const Z = { tail: 0, wings: 1, body: 3, mouth: 4, eyes: 5 };

type Rect = { left: number; top: number; width: number; height: number };

function pct(r: Rect, z: number): CSSProperties {
  return {
    position: 'absolute',
    left: `${(r.left / VW) * 100}%`,
    top: `${(r.top / VH) * 100}%`,
    width: `${(r.width / VW) * 100}%`,
    height: `${(r.height / VH) * 100}%`,
    zIndex: z,
  };
}

function bodyOf(parts: PartMap) {
  return DRAGON_OWN[parts.body] ? parts.body : 'classic';
}

/** The piece a body was drawn with for a row: where that row goes on it. */
function slotOf(body: string, row: string): DragonPiece {
  return DRAGON_PIECES[`${row}:${DRAGON_OWN[body][row]}`];
}

/**
 * Wings and tails keep the size they were drawn at: the four dragons are drawn at one scale,
 * so baby wings stay little and big ones stay big on any body. (Scaled by how wide the
 * bodies are, the blue one's ear fins made every borrowed wing on it far too big.)
 */
const KEEP_SIZE = 1;

type Core = [number, number, number, number];

/**
 * The red dragon has two heads, as Clara asked. Each one wears the eyes and the mouth the
 * child picked: the right head at the face below, the left head its mirror image, so a fire
 * or bubbles blow away from the other head. The heads are smaller than a whole dragon's
 * face, so a mouth is made smaller on them too, and a big puff of fire stays on the sheet.
 */
const TWIN_HEADS: Record<string, { eyes: Core; mouth: Core; mouthK: number }> = {
  chubby: { eyes: [300, 130, 96, 44], mouth: [326, 206, 44, 24], mouthK: 0.7 },
};

export function hasTwinHeads(body: string) {
  return !!TWIN_HEADS[body];
}

/** The same place on the sheet, seen in a mirror down the middle of the dragon. */
function mirrored(r: Rect): Rect {
  return { ...r, left: 2 * (OX + MID) - r.left - r.width };
}

/** Eyes or a mouth: centred on this face. */
function facePlace(body: string, row: 'eyes' | 'mouth', id: string): Rect {
  const piece = DRAGON_PIECES[`${row}:${id}`];
  const twin = TWIN_HEADS[body];
  const [px, py, pw, ph] = piece.core!;
  const [sx, sy, sw, sh] = twin ? twin[row] : slotOf(body, row).core!;
  // eyes are made the width of the face's own pair; a mouth keeps the size it was drawn at —
  // fitted to the blue one's little round mouth, every other mouth came out tiny on it
  let k = row === 'eyes' ? sw / pw : (twin?.mouthK ?? 1);
  // a piece much taller than the face's own is kept from running over the rest of the face
  if (row === 'eyes' && ph * k > sh * 1.6) k = (sh * 1.6) / ph;
  const [bx, by, bw, bh] = piece.box;
  return {
    left: OX + sx + sw / 2 - (px + pw / 2 - bx) * k,
    top: OY + sy + sh / 2 - (py + ph / 2 - by) * k,
    width: bw * k,
    height: bh * k,
  };
}

/**
 * A tail, at the height of this body's own tail root, reaching out as far as this body's own
 * tail did. Hung by the root alone, a short tail on the wide red body stayed hidden behind
 * its belly; reaching as far as the body's own, it shows, and a tail is long enough that its
 * root is still inside the body.
 */
function tailPlace(body: string, id: string) {
  const piece = DRAGON_PIECES[`tail:${id}`];
  const slot = slotOf(body, 'tail');
  const k = KEEP_SIZE;
  const [bx, by, bw, bh] = piece.box;
  const [rx, ry] = piece.root!;
  const [, sy] = slot.root!;
  // a long tail borrowed by the purple one, whose own is short, comes out at least half way
  const own = DRAGON_OWN[body].tail === id;
  const side = DRAGON_PIECES[`body:${body}`].box;
  const reach = own
    ? slot.box[0] + slot.box[2]
    : Math.max(slot.box[0] + slot.box[2], side[0] + side[2] + (bw * k) / 2);
  const rect: Rect = { left: OX + reach - bw * k, top: OY + sy - (ry - by) * k, width: bw * k, height: bh * k };
  return { rect, origin: `${((rx - bx) / bw) * 100}% ${((ry - by) / bh) * 100}%` };
}

/**
 * A pair of wings, each one hung by its root at this body's: the left wing is the left half
 * of the drawing, the right wing its mirror.
 */
function wingsPlace(body: string, id: string) {
  const piece = DRAGON_PIECES[`wings:${id}`];
  const slot = slotOf(body, 'wings');
  const k = KEEP_SIZE;
  const [bx, by, , bh] = piece.box;
  const [rx, ry] = piece.root!;
  const [sx, sy] = slot.root!;
  const half = (MID - bx) * k;
  const left: Rect = { left: OX + sx - (rx - bx) * k, top: OY + sy - (ry - by) * k, width: half, height: bh * k };
  // the right wing, root at the mirror of this body's, the drawing's right half
  const right: Rect = { left: OX + (2 * MID - sx) - (2 * MID - rx - MID) * k, top: left.top, width: half, height: bh * k };
  const origin = (rx - bx) / (MID - bx);
  return {
    left,
    right,
    viewLeft: `${bx} ${by} ${MID - bx} ${bh}`,
    viewRight: `${MID} ${by} ${MID - bx} ${bh}`,
    originLeft: `${origin * 100}% ${((ry - by) / bh) * 100}%`,
    originRight: `${(1 - origin) * 100}% ${((ry - by) / bh) * 100}%`,
  };
}

/**
 * How a piece is carried from the drawing it was cut from onto the body's: a point (x, y) of
 * the piece lands at (x·k + tx, y·k + ty) in the body's drawing. The 3D dragon puts its
 * pieces where the flat one does, through these.
 */
export interface DragonMove {
  k: number;
  tx: number;
  ty: number;
}

function moveOf(r: Rect, x0: number, y0: number, w0: number): DragonMove {
  const k = r.width / w0;
  return { k, tx: r.left - OX - k * x0, ty: r.top - OY - k * y0 };
}

/** Where every chosen piece goes on the chosen body. */
export function dragonPlacement(parts: PartMap) {
  const body = bodyOf(parts);
  const out: Partial<Record<'tail' | 'wingL' | 'wingR' | 'eyes' | 'mouth', DragonMove>> = {};
  const box = (row: string, id: string) => DRAGON_PIECES[`${row}:${id}`].box;
  if (parts.tail) {
    const b = box('tail', parts.tail);
    out.tail = moveOf(tailPlace(body, parts.tail).rect, b[0], b[1], b[2]);
  }
  if (parts.wings) {
    const b = box('wings', parts.wings);
    const w = wingsPlace(body, parts.wings);
    out.wingL = moveOf(w.left, b[0], b[1], MID - b[0]);
    out.wingR = moveOf(w.right, MID, b[1], MID - b[0]);
  }
  for (const row of ['eyes', 'mouth'] as const)
    if (parts[row]) {
      const b = box(row, parts[row]);
      out[row] = moveOf(facePlace(body, row, parts[row]), b[0], b[1], b[2]);
    }
  return { body, moves: out, twin: hasTwinHeads(body), slots: (row: string) => slotOf(body, row) };
}

function rectOf(box: DragonPiece['box']) {
  return { cx: OX + box[0] + box[2] / 2, cy: OY + box[1] + box[3] / 2, w: box[2], h: box[3] };
}

/** Where each part belongs, so a dragged piece can be dropped on the right spot. */
export function dragonSlots(parts: PartMap): SlotLayout {
  const body = bodyOf(parts);
  const w = wingsPlace(body, DRAGON_OWN[body].wings);
  const wing = (r: Rect) => ({ id: 'wings', cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height });
  return {
    vw: VW,
    vh: VH,
    slots: [
      { id: 'body', ...rectOf(DRAGON_PIECES[`body:${body}`].box) },
      wing(w.left),
      wing(w.right),
      { id: 'tail', ...rectOf(slotOf(body, 'tail').box) },
      { id: 'mouth', ...rectOf(slotOf(body, 'mouth').box) },
      { id: 'eyes', ...rectOf(slotOf(body, 'eyes').box) },
    ],
  };
}

interface Props {
  parts: PartMap;
  colors: ColorMap;
  animate?: boolean;
  className?: string;
}

/** A positioned layer. The pop animation owns the element's transform, so anything needing
 *  its own transform (flapping, wagging) goes on a wrapper inside it.
 *  `part` is the category id: a piece being dragged around finds its layers by it. */
function Layer({ part, style, extra, children }: { part: string; style: CSSProperties; extra?: string; children: ReactNode }) {
  return (
    <div className={`part pop${extra ? ` ${extra}` : ''}`} data-part={part} style={style}>
      {children}
    </div>
  );
}

/** A piece drawn through a narrower viewBox: one wing of a pair. */
function Half({ option, colors, view }: { option: PartOption; colors: ColorMap; view: string }) {
  const Svg = option.Svg as unknown as (p: { colors: ColorMap; view: string }) => ReactNode;
  return <Svg colors={colors} view={view} />;
}

export default function Dragon2D({ parts, animate = true, className }: Props) {
  const bodyOpt = pickOption(DRAGON, 'body', parts.body);
  const wings = pickOption(DRAGON, 'wings', parts.wings);
  const eyes = pickOption(DRAGON, 'eyes', parts.eyes);
  const mouth = pickOption(DRAGON, 'mouth', parts.mouth);
  const tail = pickOption(DRAGON, 'tail', parts.tail);

  const body = bodyOf(parts);
  const twin = hasTwinHeads(body);
  // the colours come from the body the child picked, not from a colour they chose
  const eff = dragonColors(parts);
  const anim = animate ? ' is-animated' : '';
  const full: CSSProperties = { width: '100%', height: '100%' };
  const [bx, by, bw, bh] = DRAGON_PIECES[`body:${body}`].box;

  const t = tail ? tailPlace(body, tail.id) : null;
  const w = wings ? wingsPlace(body, wings.id) : null;
  // one layer for the pair, over both wings, each wing placed inside it
  const pair: Rect | null = w
    ? { left: w.left.left, top: w.left.top, width: w.right.left + w.right.width - w.left.left, height: w.left.height }
    : null;
  const inPair = (r: Rect): CSSProperties =>
    pair
      ? {
          position: 'absolute',
          left: `${((r.left - pair.left) / pair.width) * 100}%`,
          top: 0,
          width: `${(r.width / pair.width) * 100}%`,
          height: '100%',
        }
      : {};

  return (
    <div
      className={`char2d dragon2d${anim} ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${VW} / ${VH}` }}
    >
      <div className="char2d-bob" style={{ position: 'absolute', inset: 0 }}>
        {tail && t && (
          <Layer key={`tail-${tail.id}`} part="tail" style={pct(t.rect, Z.tail)}>
            <div className="tail-wag" style={{ ...full, transformOrigin: t.origin }}>
              <PartArt option={tail} colors={eff} />
            </div>
          </Layer>
        )}
        {wings && w && pair && (
          <Layer key={`wings-${wings.id}`} part="wings" style={pct(pair, Z.wings)}>
            <div style={inPair(w.left)}>
              <div className="wing-beat-left" style={{ ...full, transformOrigin: w.originLeft }}>
                <Half option={wings} colors={eff} view={w.viewLeft} />
              </div>
            </div>
            <div style={inPair(w.right)}>
              <div className="wing-beat-right" style={{ ...full, transformOrigin: w.originRight }}>
                <Half option={wings} colors={eff} view={w.viewRight} />
              </div>
            </div>
          </Layer>
        )}
        {bodyOpt && (
          <Layer key={`body-${bodyOpt.id}`} part="body" style={pct({ left: OX + bx, top: OY + by, width: bw, height: bh }, Z.body)}>
            <PartArt option={bodyOpt} colors={eff} />
          </Layer>
        )}
        {mouth && (
          <Layer key={`mouth-${mouth.id}`} part="mouth" style={pct(facePlace(body, 'mouth', mouth.id), Z.mouth)}>
            <PartArt option={mouth} colors={eff} />
          </Layer>
        )}
        {mouth && twin && (
          <Layer key={`mouth2-${mouth.id}`} part="mouth" style={pct(mirrored(facePlace(body, 'mouth', mouth.id)), Z.mouth)}>
            <div style={{ ...full, scale: '-1 1' }}>
              <PartArt option={mouth} colors={eff} />
            </div>
          </Layer>
        )}
        {eyes && (
          <Layer key={`eyes-${eyes.id}`} part="eyes" style={pct(facePlace(body, 'eyes', eyes.id), Z.eyes)} extra="blink">
            <PartArt option={eyes} colors={eff} />
          </Layer>
        )}
        {eyes && twin && (
          <Layer key={`eyes2-${eyes.id}`} part="eyes" style={pct(mirrored(facePlace(body, 'eyes', eyes.id)), Z.eyes)} extra="blink">
            <div style={{ ...full, scale: '-1 1' }}>
              <PartArt option={eyes} colors={eff} />
            </div>
          </Layer>
        )}
      </div>
    </div>
  );
}
