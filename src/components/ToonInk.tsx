import { useMemo } from 'react';
import * as THREE from 'three';
import { INK3D } from '../lib/three';

/**
 * The cartoon surface, with its own ink line along the silhouette.
 *
 * A drawn line and a modelled silhouette are not the same thing. The line the artist drew
 * is a fixed curve on the object, so it is right from the front and, seen edge on, becomes
 * a seam down the middle of the body. The silhouette is wherever the surface happens to
 * turn away from whoever is looking, and it moves as the monster turns.
 *
 * So the line is worked out per pixel, from how squarely the surface faces the camera: flat
 * on is the creature's colour, edge on is navy, with a short blend between. It needs no
 * second copy of the model — which is what the usual trick uses, and what scribbled all
 * over a ball of fur, because in every notch between the tufts the inflated copy crossed
 * back through the surface it was supposed to be outlining.
 *
 * The artist's own line — the one she drew round a piece — is worked out here too, from how
 * far each pixel is from that piece's outline.
 */
export default function ToonInk({
  color,
  gradientMap,
  vertexColors = false,
  /** How thick the line is, in pixels on the screen. */
  edge = 2.4,
  rim,
}: {
  color: string;
  gradientMap: THREE.Texture;
  vertexColors?: boolean;
  edge?: number;
  /** The artist's own line along this piece's outline, as `inkRim` measured it. */
  rim?: { w0: number; w1: number; ink: string };
}) {
  const material = useMemo(() => {
    const m = new THREE.MeshToonMaterial({ color, gradientMap, vertexColors });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uInk = { value: new THREE.Color(INK3D).convertSRGBToLinear() };
      shader.uniforms.uEdge = { value: edge };
      /**
       * The drawn line: each corner carries how far it is from the outline, not what colour
       * it should come out.
       *
       * Painted into the corners, the line was shaded across whole triangles, and inside a
       * piece those are large — so a line a hair wide on the drawing came out as a grey
       * smear halfway across the body. A distance runs evenly across a triangle, so handing
       * the card the distance and letting it decide keeps the line the width it was drawn.
       */
      if (rim) {
        shader.uniforms.uRimInk = { value: new THREE.Color(rim.ink).convertSRGBToLinear() };
        shader.uniforms.uRimW = { value: new THREE.Vector2(rim.w0, rim.w1) };
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nattribute float rimd;\nvarying float vRimD;\nvarying float vFront;',
          )
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRimD = rimd;')
          // which way this bit of surface looks on the piece itself: out of its face, or
          // round its edge
          .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvFront = normalize(objectNormal).z;');
      }
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 uInk;\nuniform float uEdge;' +
            (rim ? '\nuniform vec3 uRimInk;\nuniform vec2 uRimW;\nvarying float vRimD;\nvarying float vFront;' : ''),
        )
        .replace(
          '#include <dithering_fragment>',
          `
          {
            float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
            // The artist's line, on the face of the piece and facing whoever is looking.
            //
            // It is a fixed curve on the piece, so round a belly it is a ring, and seen edge
            // on a ring is a bar drawn down the middle of the monster. Two things keep it out
            // of the way there: it belongs to the face of the piece and not to the edge it
            // was cut round, and it fades as that face turns away — by which point the
            // silhouette below is drawing the outline instead.
            ${rim ? 'gl_FragColor.rgb = mix(gl_FragColor.rgb, uRimInk, (1.0 - smoothstep(uRimW.x, uRimW.y, vRimD)) * smoothstep(0.15, 0.5, abs(vFront)) * smoothstep(0.28, 0.62, facing));' : ''}
            // how fast the turn-away changes from this pixel to the next, which is what
            // turns a width in pixels into a width in surface angle — without it the line
            // is right at one size and swamps the monster at any other
            float perPixel = max(fwidth(facing), 1e-5);
            float line = smoothstep(perPixel * uEdge * 0.35, perPixel * uEdge, facing);
            // and never on a surface still turned towards the camera, whatever that reading says
            line = max(line, smoothstep(0.18, 0.42, facing));
            gl_FragColor.rgb = mix(uInk, gl_FragColor.rgb, line);
          }
          #include <dithering_fragment>`,
        );
    };
    // a material whose shader was rewritten needs its own program
    m.customProgramCacheKey = () => `toonink-${edge}-${rim ? 'rim' : 'plain'}`;
    return m;
  }, [color, gradientMap, vertexColors, edge, rim]);
  return <primitive object={material} attach="material" />;
}
