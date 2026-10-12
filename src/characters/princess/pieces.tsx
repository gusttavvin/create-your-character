import type { ReactNode } from 'react';
import type { PartSvgProps } from '../types';
import BOXES from './pieces.json';

/**
 * The princess's pieces are pictures: Clara's four princesses (art-source/princess/reference)
 * cut into hair, dress, eyes, mouth and so on by art-source/princess/cut.cjs, every piece in
 * public/princess/ on the same 1024 by 1536 canvas, so stacked they make a whole princess.
 * pieces.json holds each piece's box on that canvas, which a card zooms in on.
 */
export const CANVAS = { w: 1024, h: 1536 };

export type SkinTone = 'light' | 'tan' | 'brown' | 'dark';
export const TONES: SkinTone[] = ['light', 'tan', 'brown', 'dark'];

const url = (file: string) => `/princess/${file}.webp`;

/** The files that make a piece, in the skin she is drawn in (only dresses and her head have skin). */
export function filesOf(row: string, id: string, tone: SkinTone): string[] {
  if (row === 'hair') return [url(`hair-${id}-back`), url(`hair-${id}-front`)];
  if (row === 'dress') return [url(`dress-${id}-${tone}`)];
  if (row === 'accessory') return [url(`power-${id}`)];
  return [url(`${row}-${id}`)];
}
export const headFile = (tone: SkinTone) => url(`head-${tone}`);
export const hairBack = (id: string) => url(`hair-${id}-back`);
export const hairFront = (id: string) => url(`hair-${id}-front`);

export function boxOf(row: string, id: string): [number, number, number, number] {
  const box = (BOXES as Record<string, number[]>)[`${row}:${id}`];
  return box ? [box[0], box[1], box[2], box[3]] : [0, 0, CANVAS.w, CANVAS.h];
}

function Picture({ box, files, children }: { box: number[]; files: string[]; children?: ReactNode }) {
  // a little room round the piece, so its outline is not cut off on the card
  const pad = Math.max(box[2], box[3]) * 0.04;
  return (
    <svg
      viewBox={`${box[0] - pad} ${box[1] - pad} ${box[2] + 2 * pad} ${box[3] + 2 * pad}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {files.map((f) => (
        <image key={f} href={f} x="0" y="0" width={CANVAS.w} height={CANVAS.h} />
      ))}
      {children}
    </svg>
  );
}

/** The card of a piece: the piece alone, zoomed in on (a dress in the skin the child picked). */
export function pieceCard(row: string, id: string) {
  return function PieceCard({ colors = {} }: PartSvgProps) {
    const tone = (TONES as string[]).includes(colors.tone) ? (colors.tone as SkinTone) : 'light';
    const box = boxOf(row, id);
    // her eyes and mouth are small: on the card they sit on her face, so they read as hers
    if (row === 'eyes' || row === 'mouth')
      return <Picture box={row === 'eyes' ? [340, 380, 344, 200] : [450, 520, 128, 100]} files={[headFile(tone), ...filesOf(row, id, tone)]} />;
    // a hairstyle is shown on her head, or its card has a hole where her face goes
    if (row === 'hair') return <Picture box={box} files={[hairBack(id), headFile(tone), hairFront(id)]} />;
    return <Picture box={box} files={filesOf(row, id, tone)} />;
  };
}
