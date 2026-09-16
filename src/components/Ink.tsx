import { Outlines } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { INK3D } from '../lib/three';

/**
 * Cartoon ink outline with a constant on-screen width.
 * drei's <Outlines> (default mode) measures thickness in drawing-buffer pixels,
 * so we scale by the device pixel ratio to keep the line the same on every screen.
 */
export default function Ink({ px = 6, thin = false }: { px?: number; thin?: boolean }) {
  const dpr = useThree((s) => s.viewport.dpr);
  return <Outlines thickness={(thin ? px * 0.65 : px) * dpr} color={INK3D} />;
}
