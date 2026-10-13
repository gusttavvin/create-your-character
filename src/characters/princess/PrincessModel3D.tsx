import { useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { buildPortrait, type PortraitChoice, type PortraitModel } from './portrait3d';

/** Owns one model instance. Source artwork is cached; GPU resources never are. */
export function PrincessModel3D({ tone, dress, hair, eyes, mouth, still = false }: PortraitChoice & { still?: boolean }) {
  const [model, setModel] = useState<PortraitModel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let live = true;
    buildPortrait({ tone, dress, hair, eyes, mouth }).then((next) => {
      if (!live) { next.dispose(); return; }
      setModel(next);
    }).catch((reason: unknown) => {
      if (live) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => { live = false; };
  }, [tone, dress, hair, eyes, mouth]);
  useEffect(() => () => model?.dispose(), [model]);
  useFrame(({ clock }) => {
    const lids = model?.eyes;
    if (!lids) return;
    const p = (clock.getElapsedTime() % 4.5) / 4.5;
    lids.scale.y = still || p < 0.92 ? 1 : p < 0.95 ? 1 - 0.88 * (p - 0.92) / 0.03 : 0.12 + 0.88 * (p - 0.95) / 0.05;
  });
  // Let the existing application boundary present a recoverable error, not a blank model.
  if (error) throw error;
  return model ? <primitive object={model.root} dispose={null} /> : null;
}
