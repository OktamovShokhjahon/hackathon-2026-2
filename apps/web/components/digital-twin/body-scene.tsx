"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BodyShell, Ribcage, VascularTree } from "./human-model";
import { organGeometry } from "./organ-shapes";
import {
  organsFor,
  STATE_GLYPH,
  STATE_HEX,
  STATE_HEX_3D,
  STATE_LABEL,
  type OrganDef,
  type Sex,
} from "./anatomy";
import type { Projection } from "./organ-labels";
import type { OrganSignal, RiskColor } from "./types";

export type TwinView = "front" | "back" | "left" | "right";

/** Organ present in the model but carrying no signal in this scenario. */
const UNASSESSED_HEX = "#c3b0ad";

const CAMERA_PRESETS: Record<TwinView, [number, number, number]> = {
  front: [0, 0.95, 2.45],
  back: [0, 0.95, -2.45],
  left: [-2.45, 0.95, 0.01],
  right: [2.45, 0.95, 0.01],
};

const TARGET = new THREE.Vector3(0, 0.9, 0);

interface OrganState {
  before: RiskColor | null;
  after: RiskColor | null;
  beforeSignal: OrganSignal | null;
  afterSignal: OrganSignal | null;
}

function buildStates(
  organs: OrganDef[],
  beforeSignals: OrganSignal[],
  afterSignals: OrganSignal[],
): Record<string, OrganState> {
  const states: Record<string, OrganState> = {};
  for (const organ of organs) {
    const before = beforeSignals.find((signal) => signal.organ === organ.key) ?? null;
    const after = afterSignals.find((signal) => signal.organ === organ.key) ?? null;
    states[organ.key] = {
      before: before?.color ?? null,
      after: after?.color ?? null,
      beforeSignal: before,
      afterSignal: after,
    };
  }
  return states;
}

function colorFor(state: RiskColor | null): THREE.Color {
  return new THREE.Color(state ? STATE_HEX_3D[state] : UNASSESSED_HEX);
}

function Organ({
  organ,
  state,
  mixRef,
  showAfter,
  reducedMotion,
  selected,
  onSelect,
}: {
  organ: OrganDef;
  state: OrganState;
  mixRef: MutableRefObject<number>;
  showAfter: boolean;
  reducedMotion: boolean;
  selected: boolean;
  onSelect: (key: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const materials = useRef<THREE.MeshStandardMaterial[]>([]);
  const halos = useRef<THREE.MeshBasicMaterial[]>([]);

  const beforeColor = useMemo(() => colorFor(state.before), [state.before]);
  const afterColor = useMemo(() => colorFor(state.after), [state.after]);
  const scratch = useMemo(() => new THREE.Color(), []);
  const goalScale = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const mix = mixRef.current;
    scratch.copy(beforeColor).lerp(afterColor, mix);

    const dominant = mix > 0.5 ? state.after : state.before;
    const assessed = dominant !== null;
    const alerting = dominant === "red" || dominant === "yellow";

    // Alerting organs breathe. Under reduced motion nothing breathes: the
    // colour, glyph and label still carry the state on their own.
    const beat =
      alerting && !reducedMotion
        ? 0.5 + 0.35 * Math.sin(clock.elapsedTime * (dominant === "red" ? 4.2 : 2.6))
        : 0.5;

    const emphasis = selected || hovered ? 1.45 : 1;
    const intensity = (assessed ? 0.22 + beat * 0.5 : 0.06) * emphasis;

    for (const material of materials.current) {
      material.color.copy(scratch);
      material.emissive.copy(scratch);
      material.emissiveIntensity = intensity;
      material.opacity = assessed ? 1 : 0.85;
    }
    for (const halo of halos.current) {
      halo.color.copy(scratch);
      halo.opacity = (assessed ? 0.05 + beat * 0.08 : 0) * emphasis;
    }

    if (groupRef.current) {
      const goal = selected || hovered ? 1.14 : 1;
      goalScale.set(goal, goal, goal);
      groupRef.current.scale.lerp(goalScale, 0.15);
    }
  });

  materials.current = [];
  halos.current = [];

  // The card reports the state the viewer is looking at, not a fixed side of
  // the morph — otherwise it can contradict the organ's own colour.
  const hoveredSignal = showAfter
    ? state.afterSignal ?? state.beforeSignal
    : state.beforeSignal ?? state.afterSignal;
  const hoveredState = hoveredSignal?.color ?? null;


  return (
    <group
      ref={groupRef}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(selected ? null : organ.key);
      }}
    >
      {organ.sites.map((site, index) => (
        <group key={index} position={site.position} rotation={site.rotation ?? [0, 0, 0]}>
          <mesh geometry={organGeometry(organ.key, index === 1)} renderOrder={0}>
            <meshStandardMaterial
              ref={(material: THREE.MeshStandardMaterial | null) => {
                if (material) materials.current.push(material);
              }}
              transparent
              roughness={0.28}
              metalness={0.05}
            />
          </mesh>
          {/* Additive halo so the organ reads through the body shell. */}
          <mesh
            scale={[site.radius[0] * 1.8, site.radius[1] * 1.8, site.radius[2] * 1.8]}
            renderOrder={0}
          >
            <sphereGeometry args={[1, 24, 18]} />
            <meshBasicMaterial
              ref={(material: THREE.MeshBasicMaterial | null) => {
                if (material) halos.current.push(material);
              }}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}

      {hovered && (
        <Html
          position={organ.sites[0].position}
          center
          distanceFactor={2.2}
          zIndexRange={[30, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className="w-[210px] rounded-lg border bg-surface/95 p-3 text-left shadow-lg backdrop-blur"
            style={{
              borderColor: hoveredState ? STATE_HEX[hoveredState] : "var(--line-strong)",
              // Organs high in the body would push the card off the top of the
              // stage, so those flip below the organ instead.
              transform:
                organ.sites[0].position[1] > 1.45 ? "translateY(76px)" : "translateY(-76px)",
            }}
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
              {organ.system}
            </div>
            <div className="mt-0.5 font-display text-[15px] leading-tight text-ink">
              {organ.label}
            </div>

            <div
              className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{ color: hoveredState ? STATE_HEX[hoveredState] : "var(--ink-faint)" }}
            >
              <span aria-hidden>{hoveredState ? STATE_GLYPH[hoveredState] : "–"}</span>
              {hoveredState ? STATE_LABEL[hoveredState] : "Not assessed"}
            </div>

            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              {hoveredSignal
                ? hoveredSignal.explanation
                : "This scenario did not assess this organ. That is not the same as a clear result."}
            </p>

            {hoveredSignal && hoveredSignal.missingData.length > 0 && (
              <p className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-state-amber">
                Missing: {hoveredSignal.missingData.join(" · ")}
              </p>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function Vasculature({
  states,
  mixRef,
}: {
  states: Record<string, OrganState>;
  mixRef: MutableRefObject<number>;
}) {
  const source = states.blood_vessels ?? states.cardiovascular_system;
  const before = useMemo(() => colorFor(source?.before ?? null), [source?.before]);
  const after = useMemo(() => colorFor(source?.after ?? null), [source?.after]);
  const color = useMemo(() => new THREE.Color(), []);
  const assessed = Boolean(source?.after ?? source?.before);

  useFrame(() => {
    color.copy(before).lerp(after, mixRef.current);
  });

  return <VascularTree color={color} intensity={assessed ? 0.7 : 0.22} />;
}

/**
 * Projects each organ to screen space for the leader-line labels. It writes
 * into a ref rather than React state — this runs every frame, and re-rendering
 * the overlay at 60fps to move a few lines would be wasteful.
 */
function Projector({
  organs,
  groupRef,
  projection,
}: {
  organs: OrganDef[];
  groupRef: MutableRefObject<THREE.Group | null>;
  projection: MutableRefObject<Projection>;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    for (const organ of organs) {
      // Paired organs report their midpoint, so one label serves both.
      point.set(0, 0, 0);
      for (const site of organ.sites) {
        point.x += site.position[0] / organ.sites.length;
        point.y += site.position[1] / organ.sites.length;
        point.z += site.position[2] / organ.sites.length;
      }
      group.localToWorld(point);
      point.project(camera);

      projection.current[organ.key] = {
        x: (point.x * 0.5 + 0.5) * size.width,
        y: (-point.y * 0.5 + 0.5) * size.height,
        visible: point.z < 1,
      };
    }
  });

  return null;
}

function CameraRig({ view }: { view: TwinView }) {
  const { camera } = useThree();
  const goal = useMemo(() => new THREE.Vector3(...CAMERA_PRESETS.front), []);
  const settling = useRef(false);

  useEffect(() => {
    goal.set(...CAMERA_PRESETS[view]);
    settling.current = true;
  }, [view, goal]);

  useFrame(() => {
    if (!settling.current) return;
    camera.position.lerp(goal, 0.08);
    camera.lookAt(TARGET);
    if (camera.position.distanceTo(goal) < 0.02) settling.current = false;
  });

  return null;
}

/**
 * Gentle sway rather than a full turntable: the patient stays front-facing and
 * readable, while the parallax still reads as volume. Full rotation is on the
 * view buttons and on drag, where the doctor asks for it deliberately.
 */
function Turntable({
  enabled,
  groupRef,
  children,
}: {
  enabled: boolean;
  groupRef: MutableRefObject<THREE.Group | null>;
  children: React.ReactNode;
}) {
  const ref = groupRef;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const goal = enabled ? Math.sin(clock.elapsedTime * 0.26) * 0.2 : 0;
    ref.current.rotation.y += (goal - ref.current.rotation.y) * 0.05;
  });
  return <group ref={ref}>{children}</group>;
}

function Platform() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[0.34, 0.36, 64]} />
        <meshBasicMaterial color="#0e7f8f" transparent opacity={0.45} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0.52, 0.525, 64]} />
        <meshBasicMaterial color="#2f5fe0" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

export function BodyScene({
  beforeSignals,
  afterSignals,
  mix,
  view,
  sex,
  autoRotate,
  reducedMotion,
  selectedOrgan,
  onSelectOrgan,
  projection,
}: {
  beforeSignals: OrganSignal[];
  afterSignals: OrganSignal[];
  mix: number;
  view: TwinView;
  sex: Sex;
  autoRotate: boolean;
  reducedMotion: boolean;
  selectedOrgan: string | null;
  onSelectOrgan: (key: string | null) => void;
  projection: MutableRefObject<Projection>;
}) {
  const organs = useMemo(() => organsFor(sex), [sex]);
  const turntableRef = useRef<THREE.Group | null>(null);

  const states = useMemo(
    () => buildStates(organs, beforeSignals, afterSignals),
    [organs, beforeSignals, afterSignals],
  );

  // The slider writes here each frame instead of re-rendering the scene graph.
  const mixRef = useRef(mix);
  useEffect(() => {
    mixRef.current = mix;
  }, [mix]);

  return (
    <Canvas
      camera={{ position: CAMERA_PRESETS.front, fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onSelectOrgan(null)}
    >
      <color attach="background" args={["#e6edf5"]} />
      <fog attach="fog" args={["#e6edf5", 4.2, 8.5]} />

      {/* Studio lighting: a bright key with soft fill, as the atlas plate has. */}
      <ambientLight intensity={1.15} />
      <directionalLight position={[2.5, 3.5, 2.5]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[-2.5, 1.5, -1.5]} intensity={0.5} color="#dbe7f3" />

      <CameraRig view={view} />
      <Projector organs={organs} groupRef={turntableRef} projection={projection} />

      <Turntable enabled={autoRotate && !reducedMotion} groupRef={turntableRef}>
        <Ribcage />
        <Vasculature states={states} mixRef={mixRef} />
        {organs.map((organ) => (
          <Organ
            key={organ.key}
            organ={organ}
            state={states[organ.key]}
            mixRef={mixRef}
            showAfter={mix > 0.5}
            reducedMotion={reducedMotion}
            selected={selectedOrgan === organ.key}
            onSelect={onSelectOrgan}
          />
        ))}
        {/* Shell last: it blends additively over the anatomy inside. */}
        <BodyShell sex={sex} />
        <Platform />
      </Turntable>

      <OrbitControls
        target={TARGET}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 1.85}
      />
    </Canvas>
  );
}
