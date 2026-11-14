import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
type OrbitImpl = React.ComponentRef<typeof OrbitControls>;

/* ---------- Procedural terrain (schematic, illustrative only) ---------- */
const CRATERS: [number, number, number, number][] = [
  // x, z, radius, depth
  [3, -8, 7.5, 3.2],
  [-16, -22, 5, 2.2],
  [16, 4, 4, 1.6],
  [12, -26, 3.2, 1.2],
  [-6, 10, 2.4, 0.8],
];

function crater(dx: number, dz: number, r: number, d: number) {
  const q = Math.sqrt(dx * dx + dz * dz) / r;
  const bowl = q < 1 ? -d * (1 - q * q) : 0;
  const rim = d * 0.75 * Math.exp(-((q - 1) * (q - 1)) / 0.05);
  return bowl + rim;
}

export function heightAt(x: number, z: number) {
  let h =
    Math.sin(x * 0.11) * Math.cos(z * 0.09) * 0.9 +
    Math.sin(x * 0.31 + z * 0.17) * 0.35 +
    Math.cos(x * 0.73 - z * 0.51) * 0.12 +
    Math.sin(x * 1.7 + z * 1.3) * 0.04;
  // distant ridge (Mount Sharp-like layered rise) beyond z=-30
  const ridge = 1 / (1 + Math.exp((z + 36) * 0.35));
  h += ridge * (7 + Math.sin(x * 0.18) * 2.2 + Math.abs(Math.sin(x * 0.6 + z * 0.2)) * 1.1);
  // rocky side ridges
  h += Math.exp(-((x - 24) ** 2) / 30) * (2.5 + Math.sin(z * 0.3) * 1.2);
  h += Math.exp(-((x + 28) ** 2) / 40) * (3 + Math.cos(z * 0.25) * 1.4);
  for (const [cx, cz, r, d] of CRATERS) h += crater(x - cx, z - cz, r, d);
  return h;
}

const START = new THREE.Vector3(0, 0, 18);
const GOAL = new THREE.Vector3(4, 0, -38);
START.y = heightAt(START.x, START.z);
GOAL.y = heightAt(GOAL.x, GOAL.z);

function sampled(ctrl: [number, number][], n = 220, lift = 0.35) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  return curve.getSpacedPoints(n).map((p) => new THREE.Vector3(p.x, heightAt(p.x, p.z) + lift, p.z));
}

const SAFE_PTS = sampled([[0, 17], [-5, 9], [-10, -2], [-9, -12], [-4, -19], [-6, -27], [-1, -33], [4, -37.5]]);
const FAST_PTS = sampled([[0, 17], [1, 6], [3, -8], [3.6, -24], [4, -37.5]]);
const SAFE_MID = SAFE_PTS[95];
const FAST_RIM = FAST_PTS[Math.round(220 * 0.36)];

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(170, 170, 260, 260);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const lo = new THREE.Color("#5a2414");
    const mid = new THREE.Color("#b65a39");
    const hi = new THREE.Color("#d99a6c");
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = heightAt(x, z);
      pos.setY(i, y);
      const slope = Math.min(1, Math.hypot(heightAt(x + 0.5, z) - y, heightAt(x, z + 0.5) - y) * 1.8);
      const t = THREE.MathUtils.clamp((y + 2.5) / 9, 0, 1);
      c.copy(lo).lerp(mid, Math.min(1, t * 1.8)).lerp(hi, Math.max(0, t - 0.55));
      c.lerp(lo, slope * 0.55);
      const grain = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
      c.multiplyScalar(0.92 + grain * 0.08);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const rocks = useMemo(() => {
    const out: { p: [number, number, number]; s: number; r: number }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 160; i++) {
      const x = (rnd() - 0.5) * 70;
      const z = 24 - rnd() * 66;
      out.push({ p: [x, heightAt(x, z), z], s: 0.12 + rnd() * rnd() * 0.7, r: rnd() * 6 });
    }
    return out;
  }, []);
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.96} metalness={0.02} flatShading />
      </mesh>
      {rocks.map((k, i) => (
        <mesh key={i} position={k.p} rotation={[k.r, k.r * 2, 0]} scale={k.s} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#7a3420" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Astronaut() {
  const suit = <meshStandardMaterial color="#eceae4" roughness={0.65} />;
  const dark = <meshStandardMaterial color="#9aa0a8" roughness={0.5} metalness={0.4} />;
  return (
    <group position={[START.x, START.y, START.z]} scale={1}>
      {/* legs */}
      <mesh position={[-0.28, 0.75, 0]} castShadow><capsuleGeometry args={[0.22, 0.9, 6, 12]} />{suit}</mesh>
      <mesh position={[0.28, 0.75, 0.05]} rotation={[0.12, 0, 0]} castShadow><capsuleGeometry args={[0.22, 0.9, 6, 12]} />{suit}</mesh>
      <mesh position={[-0.28, 0.12, -0.08]}><boxGeometry args={[0.38, 0.24, 0.6]} />{dark}</mesh>
      <mesh position={[0.28, 0.12, -0.02]}><boxGeometry args={[0.38, 0.24, 0.6]} />{dark}</mesh>
      {/* torso */}
      <mesh position={[0, 1.9, 0]} castShadow><capsuleGeometry args={[0.52, 0.7, 8, 16]} />{suit}</mesh>
      <mesh position={[0, 1.55, -0.02]}><torusGeometry args={[0.52, 0.06, 8, 24]} />{dark}</mesh>
      {/* chest control unit */}
      <mesh position={[0, 1.95, -0.5]}><boxGeometry args={[0.55, 0.3, 0.14]} />{dark}</mesh>
      {/* arms */}
      <mesh position={[-0.72, 1.85, -0.05]} rotation={[0.2, 0, 0.22]} castShadow><capsuleGeometry args={[0.18, 0.85, 6, 12]} />{suit}</mesh>
      <mesh position={[0.72, 1.85, -0.12]} rotation={[0.45, 0, -0.22]} castShadow><capsuleGeometry args={[0.18, 0.85, 6, 12]} />{suit}</mesh>
      <mesh position={[-0.84, 1.28, -0.1]}><sphereGeometry args={[0.16, 12, 12]} />{dark}</mesh>
      <mesh position={[0.84, 1.33, -0.36]}><sphereGeometry args={[0.16, 12, 12]} />{dark}</mesh>
      {/* mission patch stripe */}
      <mesh position={[-0.53, 2.15, 0]} rotation={[0, 0, 0.22]}><cylinderGeometry args={[0.185, 0.185, 0.08, 16]} /><meshStandardMaterial color="#b65a39" /></mesh>
      {/* helmet + gold visor (faces -z) */}
      <mesh position={[0, 2.85, 0]} castShadow><sphereGeometry args={[0.46, 32, 32]} />{suit}</mesh>
      <mesh position={[0, 2.86, -0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[0.42, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2.3]} />
        <meshStandardMaterial color="#d4a017" metalness={1} roughness={0.12} emissive="#5a3c00" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 2.5, 0]}><torusGeometry args={[0.4, 0.07, 8, 24]} />{dark}</mesh>
      {/* PLSS backpack (faces camera, +z) */}
      <mesh position={[0, 2.05, 0.68]} castShadow><boxGeometry args={[1.0, 1.25, 0.5]} />{suit}</mesh>
      <mesh position={[0, 2.05, 0.94]}><boxGeometry args={[0.78, 0.9, 0.04]} />{dark}</mesh>
      <mesh position={[-0.3, 2.75, 0.8]}><cylinderGeometry args={[0.07, 0.07, 0.3, 10]} />{dark}</mesh>
      <mesh position={[0.3, 2.75, 0.8]}><cylinderGeometry args={[0.07, 0.07, 0.3, 10]} />{dark}</mesh>
      <mesh position={[0.25, 1.6, 0.95]}><boxGeometry args={[0.2, 0.1, 0.04]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.5} /></mesh>
    </group>
  );
}

function Beacon() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = 1 + ((clock.elapsedTime * 0.6) % 1) * 2.4;
    ring.current.scale.set(s, s, s);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - (s - 1) / 2.4);
  });
  return (
    <group position={[GOAL.x, GOAL.y, GOAL.z]}>
      <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.08, 0.35, 8, 16, 1, true]} /><meshBasicMaterial color="#38e1f0" transparent opacity={0.35} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.1, 0]}><octahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color="#38e1f0" emissive="#38e1f0" emissiveIntensity={2.4} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}><ringGeometry args={[0.9, 1.1, 48]} /><meshBasicMaterial color="#38e1f0" transparent opacity={0.9} /></mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}><ringGeometry args={[0.9, 1.0, 48]} /><meshBasicMaterial color="#38e1f0" transparent opacity={0.6} /></mesh>
      <pointLight color="#38e1f0" intensity={60} distance={18} position={[0, 2, 0]} />
    </group>
  );
}

/* ---------- Camera director ---------- */
const SHOULDER_POS = new THREE.Vector3(START.x - 2.4, START.y + 4.6, START.z + 8.5);
const SHOULDER_TGT = new THREE.Vector3(GOAL.x - 4, START.y - 2, -18);
const TAC_TGT = new THREE.Vector3(-9, 0, -5);
const TAC_POS = new THREE.Vector3(20, 42, 30);
const DURATION = 2.5;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type Phase = "shoulder" | "playing" | "tactical";

function Director({ phase, playToken, resetToken, onDone, setReveal }: {
  phase: Phase; playToken: number; resetToken: number; onDone: () => void; setReveal: (v: number) => void;
}) {
  const { camera } = useThree();
  const controls = useRef<OrbitImpl>(null);
  const t = useRef(phase === "tactical" ? 1 : 0);
  const fromPos = useRef(SHOULDER_POS.clone());
  const fromTgt = useRef(SHOULDER_TGT.clone());
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const revealRef = useRef(setReveal);
  revealRef.current = setReveal;

  useEffect(() => {
    const target = phase === "tactical" ? TAC_TGT : SHOULDER_TGT;
    camera.position.copy(phase === "tactical" ? TAC_POS : SHOULDER_POS);
    controls.current?.target.copy(target);
    camera.lookAt(target);
    controls.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  useEffect(() => {
    if (playToken === 0) return;
    // Replay always starts from the over-the-shoulder shot
    fromPos.current.copy(SHOULDER_POS);
    fromTgt.current.copy(SHOULDER_TGT);
    camera.position.copy(SHOULDER_POS);
    t.current = 0;
  }, [playToken, camera]);

  useFrame((_, dt) => {
    if (phase !== "playing" || !controls.current) return;
    t.current = Math.min(1, t.current + dt / DURATION);
    const k = ease(t.current);
    const arc = Math.sin(k * Math.PI) * 6;
    camera.position.lerpVectors(fromPos.current, TAC_POS, k).y += arc;
    controls.current.target.lerpVectors(fromTgt.current, TAC_TGT, k);
    camera.lookAt(controls.current.target);
    revealRef.current(THREE.MathUtils.clamp((t.current - 0.25) / 0.6, 0, 1));
    if (t.current >= 1) doneRef.current();
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={phase !== "playing"}
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={110}
      maxPolarAngle={Math.PI / 2.08}
      makeDefault
    />
  );
}

function Tag({ pos, color, label, sub, opacity }: { pos: THREE.Vector3; color: string; label: string; sub: string; opacity: number }) {
  return (
    <Html position={[pos.x, pos.y + 2.2, pos.z]} center zIndexRange={[20, 0]} style={{ opacity, pointerEvents: "none" }}>
      <div className="whitespace-nowrap border-l-2 bg-[#0b0e14]/80 px-[0.7vw] py-[0.4vh] font-mono uppercase" style={{ borderColor: color }}>
        <div className="text-[1.5vw] font-bold leading-tight" style={{ color }}>{label}</div>
        <div className="text-[1.5vw] leading-tight text-[#c9d1dc]">{sub}</div>
      </div>
    </Html>
  );
}

export default function MarsScene({ phase, reveal, playToken, resetToken, onDone, setReveal, onFail }: {
  phase: Phase; reveal: number; playToken: number; resetToken: number;
  onDone: () => void; setReveal: (v: number) => void; onFail: (msg: string) => void;
}) {
  const failRef = useRef(onFail);
  failRef.current = onFail;
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 50, near: 0.1, far: 400, position: phase === "tactical" ? TAC_POS.toArray() : SHOULDER_POS.toArray() }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          failRef.current("The GPU context was lost. Reload the slide to restore the live 3D view.");
        });
      }}
    >
      <color attach="background" args={["#0b0e14"]} />
      <fog attach="fog" args={["#2a1610", 45, 150]} />
      <Stars radius={180} depth={40} count={2500} factor={4} fade speed={0.4} />
      <hemisphereLight args={["#f3c9a8", "#2a0f08", 0.55]} />
      <directionalLight position={[-30, 40, 20]} intensity={2.4} color="#ffe2c4" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-50} shadow-camera-right={50} shadow-camera-top={50} shadow-camera-bottom={-50} />
      <Terrain />
      <Astronaut />
      <Beacon />
      {(
        <group visible={reveal > 0}>
          <Line points={SAFE_PTS} color="#22c55e" lineWidth={7} transparent opacity={0.25 * reveal} />
          <Line points={SAFE_PTS} color="#4ade80" lineWidth={3} transparent opacity={reveal} />
          <Line points={FAST_PTS} color="#f59e0b" lineWidth={3.5} dashed dashSize={1.1} gapSize={0.7} transparent opacity={reveal} />
          <Tag pos={SAFE_MID} color="#22c55e" label="WP-S2 · Safest" sub="low-slope corridor" opacity={reveal} />
          <Tag pos={FAST_RIM} color="#f59e0b" label="WP-F1 · Crater rim" sub="steep descent hazard" opacity={reveal} />
          <Tag pos={GOAL} color="#38e1f0" label="Target · Ridge" sub="destination beacon" opacity={reveal} />
        </group>
      )}
      <Director phase={phase} playToken={playToken} resetToken={resetToken} onDone={onDone} setReveal={setReveal} />
    </Canvas>
  );
}
