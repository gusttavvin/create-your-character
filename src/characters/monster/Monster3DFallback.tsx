import { Component, Suspense, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import Part3D from '../../components/Part3D';
import { Monstrinho, type MonstrinhoPart, type PartOverride } from '../../components/Monstrinho';
import ToonInk from '../../components/ToonInk';
import { useGradientMap, pickPart } from '../../lib/three';
import { domeAt, drawnLines, drawnShapes, inflated, inkRim, layOn, rod, svgOf, type DrawnShape } from '../../lib/svg3d';
import { MONSTER_PIECES, MONSTER_PART_RECT, type DrawnPiece } from './paths3d';
import { MONSTER_PART_SPAN } from './parts';
import { MONSTRINHO_ROWS } from '../../components/monstrinho-rows';
import { MONSTER_BODY_LAYOUT, MONSTER_SHEET, type SlotRect } from './layout';
import { MONSTER } from './config';
import type { PartMap } from '../types';

/**
 * The monster, modelled.
 *
 * Nothing here is arranged to resemble a drawing. Every piece IS the drawn piece: its
 * outline is read straight out of one of the six pictures Clara approved, given thickness,
 * and then inflated so it swells in the middle and thins away at its edge, the way a soft
 * toy does. The silhouette of the model is the silhouette of the drawing because it is the
 * same outline; what makes it a model rather than a picture standing up is the volume put
 * into it and the light falling across it.
 *
 * An earlier version built these monsters out of spheres, cones and tubes pushed around
 * until they looked roughly right. They did not look right, and could not: a cone is not a
 * horn, and no amount of nudging a cone makes it one.
 *
 * Where a piece goes is decided by the same numbers the flat sheet uses — see layout.ts —
 * so turning the model round and looking at the sheet show one creature, not two.
 */

const { vw: SHEET_W, vh: SHEET_H } = MONSTER_SHEET;
/** How tall the sheet is in the scene. The stage scales the model to the frame afterwards. */
const WORLD = 4.4 / SHEET_H;
/** Matches the flat compositor: a borrowed piece is fitted by width, its height capped. */
const TALLEST = 2.2;

/**
 * How round each row of the worksheet comes out, from flat to as deep as it is wide.
 *
 * A body, a limb, a horn and an eyeball are things with volume, so they are modelled as
 * such: a drawn circle becomes a ball, a drawn arm a tube. A mouth is a hole in a face, so
 * it stays shallow — blown up like the rest it becomes a muzzle stuck on the front.
 */
/**
 * How deep each row swells, as a share of how thick it is across.
 *
 * These are not guesses any more: they are measured off Clara's own sculpted monster,
 * `public/models/monstrinho.glb`, by `art-source/approved/read-model.cjs`. She asked for
 * the modelled one to be carried over to the other pieces; his shapes cannot be copied,
 * because the file holds one of each and they are his, but his PROPORTIONS can, and they
 * are what makes a piece read as modelled rather than as a puffed-up sticker.
 *
 *   body  0.462 deep / 0.752 wide = 0.61   — he is flatter than a ball
 *   arms  0.229 / 0.358            = 0.64
 *   legs  0.239 / 0.178            = 1.34  — a leg is narrow from the front and deep
 *   eyes  0.227 / 0.251            = 0.90  — very nearly a ball, but HIS are sunk into his
 *                                        face and a built pair sits on the skin, so 0.55
 *   mouth 0.076 / 0.430            = 0.18, taken up to 0.35 so the teeth keep their relief
 */
const ROUND: Record<string, number> = { body: 0.61, arms: 0.64, legs: 1.34, eyes: 0.55, mouth: 0.35 };
/** How far a marking lying on another piece rises, as a share of its own smaller side. */
const RELIEF = 0.14;
/** The hair of depth each step of the painting order is worth, in drawing units. */
const STACK = 1.6;

/**
 * How far a marking floats above what it is painted on, as a share of that piece's size.
 *
 * Nought means the two surfaces touch all along the marking's rim, and a card cannot say
 * which of two surfaces at the same depth is in front: the iris and the eyeball it lies on
 * came out mottled, in patches that crawled as the monster turned.
 */
const CLEAR = 0.035;

/**
 * How far a piece that sits on the body sinks into it, as a share of its own depth.
 *
 * Nought glues the piece to the skin by its middle, which is right for something flat and
 * wrong for anything with real volume: an eyeball as deep as it is wide then stood entirely
 * clear of the head, a ball beside the face instead of an eye in it.
 */
const SINK = 0.5;

/**
 * How wide the ink line is drawn, as a multiple of the width the artist gave it.
 *
 * A line painted on a surface is seen at an angle wherever the surface turns away, so it
 * needs to be a little fatter than the flat drawing's to read the same.
 */
const LINE = 1.45;

interface Built {
  geo: THREE.BufferGeometry;
  color: string;
  /** Whether the piece's colours are painted on its vertices rather than set on it. */
  painted: boolean;
  /** The line the artist drew round this piece, for the card to draw pixel by pixel. */
  rim?: { w0: number; w1: number; ink: string };
}

function biggest(list: DrawnShape[]) {
  return list.reduce((a, b) => (a.box.getSize(new THREE.Vector2()).length() >= b.box.getSize(new THREE.Vector2()).length() ? a : b));
}

function mergeAll(geos: THREE.BufferGeometry[]) {
  const merged = new THREE.BufferGeometry();
  const pos: number[] = [];
  const nor: number[] = [];
  for (const g of geos) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const idx = g.index;
    const count = idx ? idx.count : p.count;
    for (let i = 0; i < count; i++) {
      const k = idx ? idx.getX(i) : i;
      pos.push(p.getX(k), p.getY(k), p.getZ(k));
      nor.push(n.getX(k), n.getY(k), n.getZ(k));
    }
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return merged;
}

/**
 * Builds every outline of one part into geometry.
 *
 * Each piece is laid on the piece it was drawn on top of. The artist painted an iris on an
 * eyeball, a tooth in a mouth, a blush on a cheek and a belly on a body, so a piece looks
 * back through the ones already placed for the last one whose box holds its middle, asks
 * how high that one's surface has swelled at that exact spot, and sits there. That is what
 * makes the model read as one creature instead of a stack of cut-outs: nothing hovers in
 * front of anything, everything rests on something.
 *
 * The largest piece of all swells both ways, because it is the thing with volume. The rest
 * swell only forwards. A piece painted before the largest one — a horn, an ear — is left at
 * the back, which is what painting it first meant.
 */
/**
 * How finely to cut up each curve of an outline.
 *
 * What matters is how many points the finished outline has, not how many each curve gets. A
 * silhouette drawn as two big arcs needs a great many points per arc to come out round; the
 * traced hand is already a hundred and fifty short curves and needs two each. Asking
 * for seventy either way gave the hand ten thousand points round its edge, and triangulating
 * that hung the page.
 */
function segmentsFor(d: string) {
  const curves = (d.match(/[CSQAcsqa]/g) ?? []).length || 1;
  return Math.max(2, Math.min(72, Math.round(300 / curves)));
}

function usePart(optionId: string | null, round: number): Built[] {
  return useMemo(() => {
    if (!optionId) return [];
    const part = MONSTER_PIECES[optionId];
    if (!part) return [];
    const out: Built[] = [];

    const filled = part.pieces.filter((p) => p.fill);
    const main = filled.reduce<DrawnPiece | null>((best, p) => (!best || p.area > best.area ? p : best), null);
    const mainAt = main ? part.pieces.indexOf(main) : -1;

    const shapeOf = (p: DrawnPiece) => {
      const list = drawnShapes(`${optionId}:${p.i}`, svgOf([p]));
      return list.length ? biggest(list) : null;
    };

    /**
     * What has been placed so far, so a later piece can find what it lies on.
     *
     * `base` is how far out that piece's own surface has already been carried by everything
     * underneath it. It has to be carried forward, or a pupil painted on an iris is lifted
     * only by the iris's own curve and sinks back inside the eyeball the iris is lying on.
     */
    /** The gap a marking keeps from the piece under it, in that piece's own units. */
    const clearOf = (h: DrawnShape) => {
      const size = h.box.getSize(new THREE.Vector2());
      return Math.min(size.x, size.y) * CLEAR;
    };

    const placed: { shape: DrawnShape; base: number; top: number }[] = [];

    part.pieces.forEach((p, order) => {
      const cx = p.cx;
      const cy = p.cy;
      const isMain = order === mainAt;

      /** The last thing already placed whose outline holds this piece's middle. */
      const host = isMain
        ? null
        : [...placed]
            .reverse()
            // inside the outline, not merely inside the box it fits in: by the box, one leg of
            // a pair sat inside the other's box and was built as a marking painted on it —
            // flat, so from the side the pair showed one leg and one black plate edge on
            .find((q) => q.shape.box.containsPoint(new THREE.Vector2(cx, cy)) && domeAt(q.shape, cx, cy, round) > 0) ??
          null;
      const rest = host ? host.top : 0;

      if (!p.fill) {
        if (!p.stroke || !p.sw) return;
        const lines = drawnLines(`${optionId}:${p.i}:line`, svgOf([p]));
        if (!lines.length) return;
        const geo = mergeAll(lines.map((l) => rod(l, p.sw / 2)));
        // a line drawn on something follows it, point by point. Held at one depth — the top
        // of whatever it is drawn on — a line that runs round the edge of a piece leaves the
        // surface and hangs in the air beside it, which is what the outline round the hand did
        if (host) layOn(geo, host.shape, round, host.base + clearOf(host.shape));
        const z = host ? p.sw * 0.4 : order > mainAt ? rest + p.sw * 0.4 : -(rest + p.sw * 0.6);
        geo.translate(p.dx, -p.dy, z);
        out.push({ geo, color: p.stroke, painted: false });
        return;
      }

      const d = shapeOf(p);
      if (!d) return;
      const size = d.box.getSize(new THREE.Vector2());
      const small = Math.max(1e-3, Math.min(size.x, size.y));
      // a piece resting on another one is a marking on it; anything else is a thing in
      // itself and gets real volume
      const geo = inflated(d, { round, relief: host ? RELIEF : 0, curveSegments: segmentsFor(p.d) });
      // a patch of skin follows the body under it, point by point, instead of lying across
      // it as a flat plate
      if (host) layOn(geo, host.shape, round, host.base + clearOf(host.shape));
      // painted before the big piece and resting on nothing: it belongs behind
      const z = isMain || host ? 0 : order > mainAt ? rest : -rest - small * 0.25;
      // and a hair per step of the painting order, so a pupil is always in front of the
      // iris it was painted on and an iris in front of its eyeball, whatever the curves do
      geo.translate(p.dx, -p.dy, z + order * STACK);
      const fill = p.fill;
      // the artist's own line, painted along the artist's own outline, at her own width
      const inked = !!(p.stroke && p.sw) && !isMain;
      if (inked) inkRim(geo, p.stroke!, p.sw * LINE);
      out.push({
        geo,
        color: fill,
        painted: false,
        rim: inked ? (geo.userData.inkLine as Built['rim']) : undefined,
      });
      /**
       * How high this piece now stands, for anything painted on top of it.
       *
       * `base` is the floor its own curve was measured from — where the piece sits before
       * its own swelling — and `top` is the surface a child of it should rest on. Leaving
       * `base` at nought for a piece that itself lies on something sank every pupil back
       * inside the eyeball its iris was painted on.
       */
      const base = host
        ? host.base + clearOf(host.shape) + domeAt(host.shape, cx, cy, round)
        : z + order * STACK;
      const rise = domeAt(d, cx, cy, round) * (host ? Math.min(1, RELIEF * 2) : 1);
      placed.push({ shape: d, base, top: base + rise });
    });

    return out;
  }, [optionId, round]);
}

/** One part, put where the sheet says it goes. */
type Wrap = (
  geo: THREE.BufferGeometry,
  slot: SlotRect,
  partBox: { x: number; y: number; w: number; h: number },
  pk: number,
) => THREE.BufferGeometry;

function Layer({
  optionId,
  slot,
  z,
  round,
  grad,
  wrap,
}: {
  optionId: string | null;
  slot: SlotRect;
  z: number;
  round: number;
  grad: THREE.DataTexture;
  /** Bends the whole part onto the body, for the parts that lie on its face. */
  wrap?: Wrap;
}) {
  const built = usePart(optionId, round);
  /**
   * A pair of arms is fitted by the hole it leaves, not by its box.
   *
   * The slot for that row is the width of the body where the arms meet it, and what has to
   * match it is the gap between the two arms. Fitted by the box, a pair that is mostly hole —
   * two little tentacles — ended up hanging in the air beside the body.
   */
  const box = optionId ? MONSTER_PART_RECT[optionId] : null;
  const span = optionId ? MONSTER_PART_SPAN[optionId] : undefined;
  let k = box ? slot.w / box.w : 1;
  /** Hung by the middle of the hole between the two arms, not the middle of their box. */
  const off = box && span ? (box.x + box.w / 2 - span[1]) * k : 0;
  if (box && box.h * k > slot.h * TALLEST) k = (slot.h * TALLEST) / box.h;
  const bent = useMemo(() => {
    // how much volume this part has, measured before it is bent onto the body
    let deep = 0;
    for (const b of built) {
      b.geo.computeBoundingBox();
      const bb = b.geo.boundingBox;
      if (bb) deep = Math.max(deep, bb.max.z - bb.min.z);
    }
    if (wrap && box) for (const b of built) wrap(b.geo, slot, box, k);
    return { list: built, deep };
  }, [built, wrap, box, slot, k]);
  // a piece that sits on the body beds into it by a share of its own depth
  const sink = wrap ? bent.deep * SINK * k * WORLD : 0;
  if (!optionId || !bent.list.length || !box) return null;
  return (
    <group position={[(slot.cx - SHEET_W / 2 + off) * WORLD, (SHEET_H / 2 - slot.cy) * WORLD, z - sink]} scale={k * WORLD}>
      <group position={[-(box.x + box.w / 2), box.y + box.h / 2, 0]}>
        {bent.list.map((b, i) => (
          <mesh key={i} geometry={b.geo}>
            <ToonInk color={b.color} vertexColors={b.painted} rim={b.rim} gradientMap={grad} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * How far out the body's surface is at a place on the sheet.
 *
 * Now that a body is as deep as it is wide, there is no single "front" to put a face on:
 * the surface at the eyes is a long way forward, the surface near the chin is not. So the
 * body is asked directly how high it has risen at that exact spot, the same question every
 * piece inside a part asks of the piece it lies on.
 */
function useBodyCurve(bodyId: string) {
  return useMemo(() => {
    const part = MONSTER_PIECES[bodyId];
    const box = MONSTER_PART_RECT[bodyId];
    const L = MONSTER_BODY_LAYOUT[bodyId] ?? MONSTER_BODY_LAYOUT.round;
    /**
     * Every lump the body is made of, not just its biggest.
     *
     * Two of these creatures are a head and a body rather than one shape, and asking only
     * the larger of the two how high it is left the face sunk inside a head the question
     * never reached. The surface at a point is simply the highest of them there.
     */
    const filled = (part?.pieces ?? []).filter((q) => q.fill && q.area > box.w * box.h * 0.06);
    const main = filled.reduce<DrawnPiece | null>((best, q) => (!best || q.area > best.area ? q : best), null);
    const lumps = filled
      .map((q) => {
        const list = drawnShapes(`${bodyId}:${q.i}`, svgOf([q]));
        return list.length ? { piece: q, shape: biggest(list) } : null;
      })
      .filter((q): q is { piece: DrawnPiece; shape: DrawnShape } => !!q);
    const k = L.body.w / box.w;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;

    /** How high the body stands at a point of its own drawing. */
    const height = (px: number, py: number) => {
      let best = 0;
      for (const l of lumps) {
        const h = domeAt(l.shape, px - l.piece.dx, py - l.piece.dy, ROUND.body);
        if (h > best) best = h;
      }
      return best;
    };

    /** How high the body has risen under a point of the sheet, in world units. */
    const at = (sheetX: number, sheetY: number) => {
      if (!main) return 0;
      return height((sheetX - L.body.cx) / k + cx, (sheetY - L.body.cy) / k + cy) * k * WORLD;
    };

    /**
     * Bends a whole part onto the body, point by point.
     *
     * A face was being stood at one height in front of the body — right in the middle of the
     * face and wrong everywhere else, so a mouth lifted off the cheek as soon as the monster
     * was turned. Every vertex now asks the body how high it is under that exact spot.
     *
     * The part is drawn in its own creature's coordinates and the body in the body's, so
     * each vertex is carried across: out to the sheet through the part's own placement, and
     * back in through the body's.
     */
    const wrap = (
      geo: THREE.BufferGeometry,
      slot: SlotRect,
      partBox: { x: number; y: number; w: number; h: number },
      pk: number,
    ) => {
      if (!main) return geo;
      const pcx = partBox.x + partBox.w / 2;
      const pcy = partBox.y + partBox.h / 2;
      const pos = geo.attributes.position;
      // the part's units are pk wide where the body's are k, so a height crosses over at pk/k
      const toBody = k / pk;
      for (let i = 0; i < pos.count; i++) {
        // the vertex, on the sheet, then back in the body's own drawing
        const sheetX = slot.cx + (pos.getX(i) - pcx) * pk;
        const sheetY = slot.cy - (pos.getY(i) + pcy) * pk;
        const bx = (sheetX - L.body.cx) / k + cx;
        const by = (sheetY - L.body.cy) / k + cy;
        pos.setZ(i, pos.getZ(i) + height(bx, by) * toBody);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      return geo;
    };
    return { at, wrap };
  }, [bodyId]);
}

/* --------------------------------------------------------------- modelled
 *
 * The orange one is modelled rather than built.
 *
 * Every other body here is the flat drawing given volume, which is the best that can be
 * done from a picture. The orange one has an actual model — public/models/monstrinho.glb,
 * the same creature sculpted — and a sculpted monster beats an inflated drawing every time,
 * so when a child picks him that is what they get.
 *
 * The model carries one of each piece: his own eyes, his own smile, his own paws. Those are
 * exactly the pieces his row of the worksheet starts on, so while the child keeps them the
 * model shows them, and the moment they choose a different mouth his mouth is hidden and
 * the built one takes its place. Nothing in the game is lost by him being modelled.
 */

/** Which groups of the model each row of the worksheet owns. A hand rides on its arm. */
const OWNS: Record<string, MonstrinhoPart[]> = {
  eyes: ['Olhos', 'Sobrancelhas'],
  mouth: ['Boca'],
  arms: ['Braco_E', 'Braco_D'],
  legs: ['Pernas'],
};

/** The worksheet choice each of the model's own pieces is — the outfit he arrives in. */
const MODELLED: Record<string, string> = MONSTER.outfits?.round ?? {};

/** Whether the model can show this row itself, or has to stand aside for a built piece. */
function modelHas(row: string, chosen: string | undefined) {
  return !!chosen && chosen === MODELLED[row];
}

/** The pieces of him that hang straight off the model, one per row and one for his body. */
const MODEL_TOP: MonstrinhoPart[] = [
  'Corpo', 'Juba', 'Rosto', 'Bochechas', 'Pintinhas', 'Chifres', 'Topete',
  'Olhos', 'Sobrancelhas', 'Boca', 'Braco_E', 'Braco_D', 'Pernas',
];

/** Everything hidden but the groups this row switches on. */
function onlyRow(row: string | null) {
  const keep = row ? OWNS[row] ?? [] : MODEL_TOP.filter((g) => !Object.values(OWNS).flat().includes(g));
  const out: Partial<Record<MonstrinhoPart, PartOverride>> = {};
  for (const g of MODEL_TOP) out[g] = { visible: keep.includes(g) };
  if (row === 'eyes') for (const g of OWNS.eyes) out[g] = { visible: true, scale: EYES_SIZE };
  return out;
}

/**
 * One of the modelled monster's own pieces, worn by any body.
 *
 * Clara asked for his sculpted pieces to be used everywhere, not only on him. The file holds
 * ONE of each, so a row shows his only when the child has chosen the option that IS his —
 * his eyes for "angry eyes", his mouth for "a smile with a tongue" — and every other row is
 * whatever the child picked, built from the drawings. Each instance clones its own
 * materials, so two monsters on one page never share a colour.
 */
function ModelPart({ row, slot, z }: { row: string; slot: SlotRect; z: number }) {
  const overrides = useMemo(() => onlyRow(row), [row]);
  const r = MONSTRINHO_ROWS[row];
  if (!r) return null;
  const size = [0, 1, 2].map((i) => r.max[i] - r.min[i]);
  // a pair of arms is fitted by the hole it leaves for the body, like the drawn pairs
  const across = r.gap ?? size[0];
  let k = (slot.w * WORLD) / across;
  if (size[1] * k > slot.h * TALLEST * WORLD) k = (slot.h * TALLEST * WORLD) / size[1];
  const mid = [r.gap != null ? r.mid! : (r.min[0] + r.max[0]) / 2, (r.min[1] + r.max[1]) / 2, (r.min[2] + r.max[2]) / 2];
  return (
    <group position={[(slot.cx - SHEET_W / 2) * WORLD, (SHEET_H / 2 - slot.cy) * WORLD, z]} scale={k}>
      <group position={[-mid[0], -mid[1], -mid[2]]}>
        <Monstrinho parts={overrides} />
      </group>
    </group>
  );
}

/** Where a row sits on the sheet, and how far forward, once the model is standing. */
export type Anchors = Partial<Record<string, SlotRect & { z: number }>>;

/** The modelled monster's eyes are drawn larger than the rest of him; Clara asked for less. */
const EYES_SIZE = 0.82;

/**
 * How tall the model stands on a body, and how far off the floor.
 *
 * He is 1.2 m on his own feet; the sheet wants him as tall as the drawn body is.
 */
function modelStand(layout: (typeof MONSTER_BODY_LAYOUT)['round']) {
  const top = (SHEET_H / 2 - (layout.body.cy - layout.body.h / 2)) * WORLD;
  const floor = (SHEET_H / 2 - (layout.legs.cy + layout.legs.h / 2)) * WORLD;
  return { floor, scale: (top - floor) / 1.2 };
}

/**
 * Where he keeps his own eyes, mouth, arms and legs, in sheet units.
 *
 * A built piece is normally placed by the drawing. He is the same creature in a different
 * hand: his face sits higher and smaller on him. So on his own body a row goes where HIS is,
 * measured off the model rather than off the drawing — and a piece that replaces his lands
 * in the same place, which is what keeps a swapped mouth off the belly.
 *
 * The numbers come from the generated table, so nothing has to be measured on screen.
 */
function modelAnchors(layout: (typeof MONSTER_BODY_LAYOUT)['round']): Anchors {
  const { floor, scale } = modelStand(layout);
  const out: Anchors = {};
  for (const [row, r] of Object.entries(MONSTRINHO_ROWS)) {
    if (row === 'body') continue;
    const mid = [0, 1, 2].map((i2) => ((r.min[i2] + r.max[i2]) / 2) * scale);
    const size = [0, 1, 2].map((i2) => (r.max[i2] - r.min[i2]) * scale);
    out[row] = {
      cx: SHEET_W / 2 + (r.gap != null ? r.mid! * scale : mid[0]) / WORLD,
      cy: SHEET_H / 2 - (mid[1] + floor) / WORLD,
      // the arms are placed by the hole they leave, so that is the width their slot carries
      w: (r.gap != null ? r.gap * scale : size[0]) / WORLD,
      h: size[1] / WORLD,
      z: r.max[2] * scale,
    };
  }
  return out;
}

/** His body and the things that grow out of it; every row he wears is a piece of its own. */
function MonstrinhoBody({ layout }: { layout: (typeof MONSTER_BODY_LAYOUT)['round'] }) {
  const overrides = useMemo(() => onlyRow(null), []);
  const { floor, scale } = modelStand(layout);
  return (
    <group position={[0, floor, 0]} scale={scale}>
      <Monstrinho parts={overrides} />
    </group>
  );
}
/**
 * Falls back to the built body if the model cannot be loaded.
 *
 * A missing or broken GLB would otherwise take the whole page down, and a child in the
 * middle of a lesson would be left looking at a blank sheet rather than at a monster.
 */
class IfModelLoads extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Monster3DFallback({ parts, onlyRow }: { parts: PartMap; onlyRow?: string }) {
  const grad = useGradientMap();
  const bodyId = pickPart(parts.body, 'round') ?? 'round';
  const L = MONSTER_BODY_LAYOUT[bodyId] ?? MONSTER_BODY_LAYOUT.round;
  const body = useBodyCurve(bodyId);
  /**
   * How far a face has to stand off the body to clear whatever is already on it.
   *
   * The face now follows the body's curve point by point, so all that is left to decide is
   * how far it stands off it: a pale muzzle or a belly wraps the body too and stands a
   * little proud, and a face laid exactly on the skin ends up underneath them.
   */
  // his own muzzle stands 0.16 of his body's width proud of it; measured, not guessed
  const clear = L.body.w * 0.14 * WORLD;

  /**
   * The limbs stay on the body's middle plane. Pushed back as well, a whole arm disappeared
   * behind a body that bulges this much and only a hand was left showing.
   */

  const legs = pickPart(parts.legs, 'paws');
  const arms = pickPart(parts.arms, 'claw');
  const mouth = pickPart(parts.mouth, 'tongue');
  const eyes = pickPart(parts.eyes, 'angry');

  /** His body is the round one; his pieces, though, can be worn by any of the four. */
  const sculpted = bodyId === 'round';
  const anchors = useMemo(() => (sculpted ? modelAnchors(L) : {}), [sculpted, L]);
  /** On his own body a row goes where HIS is, whether it is his piece or one built for him. */
  const where = (row: string, fallback: SlotRect) => anchors[row] ?? fallback;
  const depth = (row: string, fallback: number) => anchors[row]?.z ?? fallback;

  /**
   * One row: his own sculpted piece if the child chose the option that is his, and the piece
   * built from the drawings otherwise. Choosing his eyes does not bring his mouth with them.
   */
  const rowOf = (
    row: string,
    chosen: string | null,
    slot: SlotRect,
    z: number,
    round: number,
    wrap?: Wrap,
    /**
     * How high the body has risen where this row sits.
     *
     * A built face piece is bent onto the body vertex by vertex, so it finds the surface by
     * itself. A modelled one is a solid thing and cannot bend, so it is simply stood on top of
     * the body — without this it was buried inside a head half a metre thick.
     */
    lift = 0,
    /**
     * Where a piece built from the drawings goes, when that is not where his own one goes.
     *
     * His arms are stubs and his arm row is sized for them; a drawn pair has to reach round
     * the body, so it keeps the room the sheet gives it.
     */
    drawnSlot = slot,
  ) =>
    modelHas(row, chosen ?? undefined) ? (
      <IfModelLoads fallback={<Layer optionId={chosen} slot={drawnSlot} round={round} z={z} grad={grad} wrap={wrap} />}>
        <Suspense fallback={null}>
          <ModelPart row={row} slot={slot} z={z + lift} />
        </Suspense>
      </IfModelLoads>
    ) : (
      <Layer optionId={chosen} slot={drawnSlot} round={round} z={z} grad={grad} wrap={wrap} />
    );

  /** The body's own surface under a slot — nought on the sculpted one, which is not drawn. */
  const onSkin = (slot: SlotRect) => (sculpted ? 0 : body.at(slot.cx, slot.cy));
  // his face is his own shape, so a piece put on it is not bent to the drawn body's curve
  const bend = sculpted ? undefined : body.wrap;

  // Row-scoped recovery never attempts to reload the failed GLB, or duplicates other rows.
  if (onlyRow) {
    const row = onlyRow as 'body' | 'eyes' | 'mouth' | 'arms' | 'legs';
    const chosen = row === 'body' ? bodyId : parts[row];
    return <Layer optionId={chosen || null} slot={where(row, L[row])} round={ROUND[row]} z={row === 'eyes' || row === 'mouth' ? depth(row, clear) : 0} grad={grad} wrap={row === 'eyes' || row === 'mouth' ? bend : undefined} />;
  }

  const shapes = (
    <>
      <Part3D id="legs">{rowOf('legs', legs, where('legs', L.legs), depth('legs', 0), ROUND.legs)}</Part3D>
      <Part3D id="arms">
        {rowOf('arms', arms, where('arms', L.arms), depth('arms', 0), ROUND.arms, undefined, 0, L.arms)}
      </Part3D>
      <Part3D id="mouth">{rowOf('mouth', mouth, where('mouth', L.mouth), depth('mouth', clear), ROUND.mouth, bend, onSkin(L.mouth))}</Part3D>
      <Part3D id="eyes">{rowOf('eyes', eyes, where('eyes', L.eyes), depth('eyes', clear), ROUND.eyes, bend, onSkin(L.eyes))}</Part3D>
    </>
  );

  const shell = (
    <Part3D id="body">
      <Layer optionId={bodyId} slot={L.body} round={ROUND.body} z={0} grad={grad} />
    </Part3D>
  );

  if (!sculpted) {
    return (
      <group>
        {shapes}
        {shell}
      </group>
    );
  }

  return (
    <group>
      {shapes}
      <Part3D id="body">
        <IfModelLoads fallback={shell}>
          <Suspense fallback={null}>
            <MonstrinhoBody layout={L} />
          </Suspense>
        </IfModelLoads>
      </Part3D>
    </group>
  );
}
