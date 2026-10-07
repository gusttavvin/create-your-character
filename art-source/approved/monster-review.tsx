import React, { Suspense, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree } from "@react-three/fiber";
import { Box3, Group, Mesh, Vector3 } from "three";
import Monster3D from "../../src/characters/monster/Monster3D";
import OldMonster from "../../src/characters/monster/Monster3DFallback";
import Monster2D from "../../src/characters/monster/Monster2D";
import { MONSTER } from "../../src/characters/monster/config";
import type { PartMap } from "../../src/characters/types";

const bodies = ["round", "egg", "square", "hourglass"];
const options = {
  eyes: ["stalks", "multiple", "one", "angry"],
  mouth: ["smile", "tongue", "fangs", "beak"],
  arms: ["claw", "tentacle", "pincher", "fuzzy"],
  legs: ["paws", "bird", "long", "snake"],
};
const angles = {
  Front: 0,
  "Three quarters": 0.65,
  Side: Math.PI / 2,
  Back: Math.PI,
};
function Capture({
  report,
  setReport,
}: {
  report: number;
  setReport: (s: string) => void;
}) {
  const { scene, gl, camera } = useThree();
  useEffect(() => {
    if (!report) return;
    const roots: Group[] = [];
    scene.traverse((o) => {
      if (o.name === "monster-model-library") roots.push(o as Group);
    });
    let invalid = 0,
      triangles = 0;
    const materials = new Map<string, Set<string>>();
    for (const root of roots) {
      const owned = new Set<string>();
      root.traverse((o) => {
        if (o instanceof Mesh) {
          const p = o.geometry.attributes.position;
          triangles += (o.geometry.index?.count ?? p.count) / 3;
          for (let i = 0; i < p.array.length; i++)
            if (!Number.isFinite(p.array[i])) invalid++;
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            owned.add(m.uuid);
        }
      });
      materials.set(root.uuid, owned);
    }
    let shared = 0;
    const sets = [...materials.values()];
    for (let a = 0; a < sets.length; a++)
      for (let b = a + 1; b < sets.length; b++)
        for (const id of sets[a]) if (sets[b].has(id)) shared++;
    const b = new Box3().setFromObject(scene);
    setReport(
      JSON.stringify({
        characters: roots.length,
        invalidCoordinates: invalid,
        sharedMaterials: shared,
        triangles,
        bounds: b.getSize(new Vector3()).toArray(),
      }),
    );
    gl.render(scene, camera);
  }, [report]);
  return null;
}
function App() {
  const [row, setRow] = useState<keyof typeof options>("eyes"),
    [angle, setAngle] = useState("Front");
  const [mode, setMode] = useState("Single"),
    [body, setBody] = useState("egg"),
    [eye, setEye] = useState("one"),
    [mouth, setMouth] = useState("tongue"),
    [arms, setArms] = useState("claw"),
    [legs, setLegs] = useState("long");
  const [capture, setCapture] = useState(0),
    [report, setReport] = useState("Ready");
  const parts = { body, eyes: eye, mouth, arms, legs };
  const grid = mode === "Matrix";
  return (
    <div
      style={{
        fontFamily: "system-ui",
        padding: 12,
        color: "#14224a",
        background: "#eef3f8",
        minHeight: "95vh",
      }}
    >
      <h2 style={{ margin: 0 }}>Monster 3D — local review</h2>
      <p>Front, side and back · approved 2D preserved · no publishing</p>
      <label>
        Mode{" "}
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {["Single", "Matrix", "Before"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>{" "}
      <label>
        View{" "}
        <select value={angle} onChange={(e) => setAngle(e.target.value)}>
          {Object.keys(angles).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>{" "}
      {grid ? (
        <label>
          Category{" "}
          <select
            value={row}
            onChange={(e) => setRow(e.target.value as keyof typeof options)}
          >
            {Object.keys(options).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      ) : (
        <>
          {(
            [
              ["Body", body, setBody, bodies],
              ["Eyes", eye, setEye, options.eyes],
              ["Mouth", mouth, setMouth, options.mouth],
              ["Arms", arms, setArms, options.arms],
              ["Legs", legs, setLegs, options.legs],
            ] as const
          ).map(([label, value, set, opts]) => (
            <label key={label}>
              {label}{" "}
              <select value={value} onChange={(e) => set(e.target.value)}>
                {[...opts, ""].map((v) => (
                  <option key={v} value={v}>
                    {v || "None"}
                  </option>
                ))}
              </select>{" "}
            </label>
          ))}
        </>
      )}
      <button onClick={() => setCapture((v) => v + 1)}>
        Check model instances
      </button>
      <div style={{ display: "flex", height: 640, marginTop: 8 }}>
        {!grid && (
          <div style={{ width: "35%", background: "white" }}>
            <Monster2D parts={parts} colors={{}} animate={false} />
          </div>
        )}
        <div style={{ flex: 1, background: "white" }}>
          <Canvas
            key={grid ? "grid" : "single"}
            orthographic
            gl={{ preserveDrawingBuffer: true, antialias: true }}
            camera={{ position: [0, 0, 20], zoom: grid ? 32 : 98 }}
            flat
          >
            <color attach="background" args={["#ffffff"]} />
            <ambientLight intensity={0.9} />
            <hemisphereLight args={["#ffffff", "#fff3e4", 0.4]} />
            <directionalLight position={[3, 5, 8]} intensity={1.64} />
            <directionalLight position={[-4, 2, -5]} intensity={0.5} />
            <Suspense fallback={null}>
              {grid ? (
                bodies.flatMap((b, bi) =>
                  options[row].map((id, oi) => {
                    const p = { ...MONSTER.defaultParts, body: b, [row]: id };
                    return (
                      <group
                        key={`${b}-${id}`}
                        position={[(oi - 1.5) * 4.2, (1.5 - bi) * 4.5, 0]}
                        rotation={[0, angles[angle as keyof typeof angles], 0]}
                      >
                        <Monster3D parts={p} />
                      </group>
                    );
                  }),
                )
              ) : (
                <group
                  position={[0, 0.3, 0]}
                  rotation={[0, angles[angle as keyof typeof angles], 0]}
                >
                  {mode === "Before" ? (
                    <OldMonster parts={parts} />
                  ) : (
                    <Monster3D parts={parts} />
                  )}
                </group>
              )}
            </Suspense>
            <Capture report={capture} setReport={setReport} />
          </Canvas>
        </div>
      </div>
      {grid && (
        <p>
          Rows: {bodies.join(" · ")}. Columns: {options[row].join(" · ")}
        </p>
      )}
      <output>{report}</output>
    </div>
  );
}
const host = document.getElementById("root")!;
const appRoot = createRoot(host);
appRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (import.meta.hot) import.meta.hot.dispose(() => appRoot.unmount());
