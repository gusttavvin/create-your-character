import { useMemo, useRef, type ReactElement } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSvgTexture } from '../../lib/three';
import {
  Bird, BIRDS, CX, CY, FLAKES, FlowerBlossom, FlowerStem, FLOWERS, Moon, Planet, RX, RY,
  Snowflake, SNOW_DUR, SNOW_SPARKLES, SPACE_ORBITERS, SPACE_STARS, Sparkle,
} from './abilities';
import { CANVAS } from './pieces';
import rawLibrary from './model-library.json';

/** Metres per pixel of her sheet, as the models are built. */
const U = (rawLibrary as { unit: number }).unit;

/**
 * Her abilities in 3D: the same birds, snowflakes, planet, moon, stars and flowers as on the
 * sheet (abilities.tsx draws them), going round her for real. On the sheet the far side of the
 * way round is hidden behind her by drawing it twice; here the way round is a ring in space,
 * so whatever is behind her is simply behind her, from any side she is turned to.
 */

/** How far in front of her and behind her the way round reaches (pixels of her picture). */
const RZ = 420;

function world(x: number, y: number, z = 0): [number, number, number] {
  return [(x - CANVAS.w / 2) * U, (CANVAS.h / 2 - y) * U, z * U];
}

/** The way round her, as on the sheet (from her left, over her head, down her right and under her skirt), with the top of it behind her and the bottom in front. */
function orbit(t: number): [number, number, number] {
  const a = Math.PI + 2 * Math.PI * t;
  return world(CX + RX * Math.cos(a), CY + RY * Math.sin(a), RZ * Math.sin(a));
}

/** A drawing of the sheet's, as a texture: `half` is how far it reaches from its middle. */
function useArt(el: ReactElement, half: number, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const svg = useMemo(
    () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`}>
        {el}
      </svg>
    ),
    deps,
  );
  return useSvgTexture(svg, 256);
}

/** A drawing standing still in space, always turned to face us. */
function Flat({ map, size, at, order = 0 }: { map: THREE.Texture | null; size: number; at?: [number, number, number]; order?: number }) {
  if (!map) return null;
  return (
    <sprite position={at} scale={[size * U, size * U, 1]} renderOrder={order}>
      <spriteMaterial map={map} transparent depthWrite={false} />
    </sprite>
  );
}

/* ------------------------------------------------------------------ animals */

function FlyingBird({ body, wing, at }: { body: string; wing: string; at: number }) {
  const up = useArt(<g transform="scale(1.8)"><Bird body={body} wing={wing} animate={false} /></g>, 100, [body, wing]);
  const down = useArt(<g transform="scale(1.8)"><Bird body={body} wing={wing} animate={false} flap={-38} /></g>, 100, [body, wing]);
  const ref = useRef<THREE.Sprite>(null);
  const next = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock, camera }) => {
    const s = ref.current;
    if (!s || !up || !down) return;
    const t = (clock.getElapsedTime() / 9 + at) % 1;
    s.position.set(...orbit(t));
    // it faces the way it flies, as seen from wherever the princess is turned
    next.set(...orbit(t + 0.01)).sub(s.position);
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    const facing = next.dot(right) >= 0 ? 1 : -1;
    s.scale.x = Math.abs(s.scale.x) * facing;
    const mat = s.material as THREE.SpriteMaterial;
    mat.map = clock.getElapsedTime() % 0.32 < 0.16 ? up : down;
  });
  if (!up) return null;
  return (
    <sprite ref={ref} scale={[200 * U, 200 * U, 1]}>
      <spriteMaterial map={up} transparent depthWrite={false} />
    </sprite>
  );
}

function Animals() {
  return (
    <>
      {BIRDS.map((b) => (
        <FlyingBird key={b.at} body={b.body} wing={b.wing} at={b.at} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ twinkles */

function Twinkle({ x, y, z, s, colour, delay, orbitAt }: { x?: number; y?: number; z: number; s: number; colour?: string; delay: number; orbitAt?: number }) {
  const map = useArt(<Sparkle s={s} colour={colour} animate={false} />, s * 1.1, [s, colour]);
  const ref = useRef<THREE.Sprite>(null);
  const size = s * 2.2;
  useFrame(({ clock }) => {
    const sp = ref.current;
    if (!sp) return;
    const t = clock.getElapsedTime();
    const p = (((t + delay) / 1.6) % 1 + 1) % 1;
    const k = 0.3 + 0.8 * Math.sin(Math.PI * p);
    sp.scale.set(size * U * k, size * U * k, 1);
    if (orbitAt !== undefined) sp.position.set(...orbit((t / 12 + orbitAt) % 1));
  });
  if (!map) return null;
  return (
    <sprite ref={ref} position={x !== undefined && y !== undefined ? world(x, y, z) : undefined}>
      <spriteMaterial map={map} transparent depthWrite={false} />
    </sprite>
  );
}

/* ------------------------------------------------------------------ snow */

function Flake({ x, s, delay, z }: { x: number; s: number; delay: number; z: number }) {
  const map = useArt(<Snowflake s={s * 1.6} />, s * 1.6 * 1.25, [s]);
  const ref = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    const sp = ref.current;
    if (!sp) return;
    const t = clock.getElapsedTime();
    const p = ((t + delay) / SNOW_DUR) % 1;
    // it drifts from side to side as it falls, as on the sheet
    sp.position.set(...world(x + 40 * Math.sin(p * Math.PI * 2), 60 + 1420 * p, z));
    (sp.material as THREE.SpriteMaterial).rotation = (t / 5) * Math.PI * 2;
  });
  const size = s * 1.6 * 2.5;
  if (!map) return null;
  return (
    <sprite ref={ref} scale={[size * U, size * U, 1]}>
      <spriteMaterial map={map} transparent depthWrite={false} />
    </sprite>
  );
}

function Snow() {
  return (
    <>
      {FLAKES.map(([x, s, d], k) => (
        <Flake key={x} x={x} s={s} delay={d} z={((k * 173) % 640) - 320} />
      ))}
      {SNOW_SPARKLES.map(([x, y, s], k) => (
        <Twinkle key={k} x={x} y={y} z={k % 2 ? 260 : -260} s={s * 1.5} colour="#E8F6FF" delay={k * 0.37} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ space */

function Orbiting({ at, half, children }: { at: number; half: number; children: ReactElement }) {
  const map = useArt(children, half, [at]);
  const ref = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    ref.current?.position.set(...orbit((clock.getElapsedTime() / 12 + at) % 1));
  });
  if (!map) return null;
  return (
    <sprite ref={ref} scale={[half * 2 * U, half * 2 * U, 1]}>
      <spriteMaterial map={map} transparent depthWrite={false} />
    </sprite>
  );
}

function Space() {
  return (
    <>
      <Orbiting at={0.1} half={150}>
        <g transform="scale(1.35)">
          <Planet />
        </g>
      </Orbiting>
      <Orbiting at={0.6} half={80}>
        <g transform="scale(1.35)">
          <Moon />
        </g>
      </Orbiting>
      {SPACE_STARS.map(([x, y, r], k) => (
        <Twinkle key={`t${k}`} x={x} y={y} z={k % 2 ? 280 : -280} s={r} delay={k * 0.29} />
      ))}
      {SPACE_ORBITERS.map((at, k) => (
        <Twinkle key={at} z={0} s={k % 2 ? 34 : 44} delay={k * 0.4} orbitAt={at} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ flowers */

function Bloom({ x, y, z, petal, inner, delay }: { x: number; y: number; z: number; petal: string; inner: string; delay: number }) {
  // the stem hangs from the middle of the flower, down to 1.4 x 92 below it
  const stem = useArt(<g transform="scale(1.4)"><FlowerStem /></g>, 135, []);
  const blossom = useArt(<g transform="scale(1.4)"><FlowerBlossom petal={petal} inner={inner} /></g>, 70, [petal, inner]);
  const ref = useRef<THREE.Sprite>(null);
  const at = world(x, y, z);
  useFrame(({ clock }) => {
    const sp = ref.current;
    if (!sp) return;
    // it opens out of the bud, stays open, and closes again, as on the sheet
    const p = (((clock.getElapsedTime() + delay) / 4) % 1 + 1) % 1;
    const k = p < 0.3 ? 0.15 + (0.85 * p) / 0.3 : p < 0.8 ? 1 : 1 - (0.85 * (p - 0.8)) / 0.2;
    sp.scale.set(140 * U * k, 140 * U * k, 1);
  });
  return (
    <>
      <Flat map={stem} size={270} at={at} order={1} />
      {blossom && (
        <sprite ref={ref} position={at} renderOrder={2}>
          <spriteMaterial map={blossom} transparent depthWrite={false} />
        </sprite>
      )}
    </>
  );
}

function Flowers() {
  return (
    <>
      {FLOWERS.map(([x, y, p, c], k) => (
        <Bloom key={k} x={x} y={y} z={k % 2 ? 300 : -300} petal={p} inner={c} delay={k * 0.45} />
      ))}
    </>
  );
}

const ABILITY: Record<string, () => ReactElement> = { kitten: Animals, wand: Snow, scepter: Space, book: Flowers };

export function Ability3D({ id }: { id: string | null }) {
  const Draw = id ? ABILITY[id] : null;
  return Draw ? <Draw /> : null;
}
