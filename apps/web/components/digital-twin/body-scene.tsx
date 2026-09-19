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

/** Camera work the surrounding chrome can drive from outside the canvas. */
export interface ZoomApi {
  zoomBy: (factor: number) => void;
  reset: () => void;
}

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
  dissectRef,
  siteRegistry,
  showAfter,
  reducedMotion,
  selected,
  onSelect,
}: {
  organ: OrganDef;
  state: OrganState;
  mixRef: MutableRefObject<number>;
  /** 0 at full-body distance, 1 fully dissected. Drives the exploded view. */
  dissectRef: MutableRefObject<number>;
  siteRegistry: MutableRefObject<Record<string, Array<THREE.Group | null>>>;
  showAfter: boolean;
  reducedMotion: boolean;
  selected: boolean;
  onSelect: (key: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const materials = useRef<THREE.MeshStandardMaterial[]>([]);
  const halos = useRef<THREE.MeshBasicMaterial[]>([]);
  const siteRefs = useRef<Array<THREE.Group | null>>([]);
  const cardRef = useRef<THREE.Group>(null);
  // Published so the label projector can follow the exploded positions.
  siteRegistry.current[organ.key] = siteRefs.current;

  const beforeColor = useMemo(() => colorFor(state.before), [state.before]);
  const afterColor = useMemo(() => colorFor(state.after), [state.after]);
  const scratch = useMemo(() => new THREE.Color(), []);
  const goalScale = useMemo(() => new THREE.Vector3(), []);
  const scratchVector = useMemo(() => new THREE.Vector3(), []);

  /**
   * Where each site travels to when the body opens up. The direction is the
   * site's own offset from the body axis, so an organ moves out along the line
   * it already sits on and the arrangement still reads anatomically — an
   * exploded plate, not a scatter. Paired organs push apart symmetrically
   * because their offsets are already mirrored.
   */
  const explode = useMemo(
    () =>
      organ.sites.map((site) => {
        const [x, y, z] = site.position;
        const radial = new THREE.Vector3(x, 0, z);
        // A site sitting on the axis has no direction of its own; send it
        // forward, out of the torso, rather than leaving it buried.
        if (radial.lengthSq() < 1e-6) radial.set(0, 0, 1);
        radial.normalize();
        // Lift with height so the stack fans open instead of forming a ring.
        return radial.multiplyScalar(0.3).setY((y - 1.05) * 0.22);
      }),
    [organ.sites],
  );

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
    const dissect = dissectRef.current;

    // Close up the glow becomes the problem it solved: at full-body distance
    // the emissive bloom is what makes a 2cm organ findable, but against a
    // separated organ filling a third of the frame it is just haze over the
    // surface. Both fall away as the view closes in.
    const intensity = (assessed ? 0.22 + beat * 0.5 : 0.06) * emphasis * (1 - dissect * 0.72);

    for (const material of materials.current) {
      material.color.copy(scratch);
      material.emissive.copy(scratch);
      material.emissiveIntensity = intensity;
      material.opacity = assessed ? 1 : 0.85;
      // A tighter, drier surface holds an edge that reads as a form.
      material.roughness = 0.28 + dissect * 0.3;
    }
    for (const halo of halos.current) {
      halo.color.copy(scratch);
      halo.opacity = (assessed ? 0.05 + beat * 0.08 : 0) * emphasis * (1 - dissect);
    }

    // Each site drifts out along its own line. Lerping rather than assigning
    // means a flick of the wheel opens the body smoothly instead of snapping.
    for (let index = 0; index < siteRefs.current.length; index += 1) {
      const site = siteRefs.current[index];
      const offset = explode[index];
      if (!site || !offset) continue;
      const base = organ.sites[index].position;
      site.position.lerp(
        scratchVector.set(
          base[0] + offset.x * dissect,
          base[1] + offset.y * dissect,
          base[2] + offset.z * dissect,
        ),
        0.18,
      );
      // The hover card rides the first site.
      if (index === 0) cardRef.current?.position.copy(site.position);
    }

    if (groupRef.current) {
      // Only an explicit selection resizes an organ. Hover leaves the geometry
      // still — a body that flinches under the cursor reads as an animation,
      // not as anatomy, and it makes small organs harder to aim at.
      const goal = selected ? 1.14 : 1;
      goalScale.set(goal, goal, goal);
      groupRef.current.scale.lerp(goalScale, 0.15);
    }
  });

  materials.current = [];
  halos.current = [];
  siteRefs.current = [];

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
        <group
          key={index}
          ref={(node: THREE.Group | null) => {
            siteRefs.current[index] = node;
          }}
          position={site.position}
          rotation={site.rotation ?? [0, 0, 0]}
        >
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

      {/* Tracks the first site, so the card travels with its organ once the
          body opens up rather than staying at the authored coordinate. */}
      {hovered && (
        <group ref={cardRef} position={organ.sites[0].position}>
        <Html
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
        </group>
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
  sites,
}: {
  organs: OrganDef[];
  groupRef: MutableRefObject<THREE.Group | null>;
  projection: MutableRefObject<Projection>;
  /** Live site groups per organ, so labels track the exploded positions. */
  sites: MutableRefObject<Record<string, Array<THREE.Group | null>>>;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    for (const organ of organs) {
      // Paired organs report their midpoint, so one label serves both.
      const live = sites.current[organ.key];
      const usable = live?.filter(Boolean) as THREE.Group[] | undefined;

      if (usable && usable.length === organ.sites.length) {
        // Read where the organ actually is, not where it was authored: the
        // body opens up as the camera closes in, and a label left at the
        // original coordinate would point into empty space.
        point.set(0, 0, 0);
        for (const site of usable) {
          site.getWorldPosition(world);
          point.addScaledVector(world, 1 / usable.length);
        }
      } else {
        point.set(0, 0, 0);
        for (const site of organ.sites) {
          point.x += site.position[0] / organ.sites.length;
          point.y += site.position[1] / organ.sites.length;
          point.z += site.position[2] / organ.sites.length;
        }
        group.localToWorld(point);
      }
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

/** Distance at which the body is whole, and the closest the camera may come. */
export const FULL_BODY_DISTANCE = 2.45;
export const CLOSEST_DISTANCE = 0.85;

/** 0 while the whole body is in frame, easing to 1 once it is fully opened. */
function dissectionFor(distance: number): number {
  const start = 1.95;
  const end = 1.15;
  const t = (start - distance) / (start - end);
  const clamped = Math.min(1, Math.max(0, t));
  // Smoothstep, so the body does not lurch open the instant you touch the wheel.
  return clamped * clamped * (3 - 2 * clamped);
}

function CameraRig({ view }: { view: TwinView }) {
  const { camera } = useThree();
  const goal = useMemo(() => new THREE.Vector3(...CAMERA_PRESETS.front), []);
  const settling = useRef(false);

  useEffect(() => {
    // Turning the body must not undo the zoom, so a view change re-aims the
    // camera along the new axis while keeping the distance the viewer chose.
    const preset = new THREE.Vector3(...CAMERA_PRESETS[view]);
    const distance = camera.position.distanceTo(TARGET) || FULL_BODY_DISTANCE;
    goal.copy(preset).sub(TARGET).normalize().multiplyScalar(distance).add(TARGET);
    settling.current = true;
  }, [view, goal, camera]);

  useFrame(() => {
    if (!settling.current) return;
    camera.position.lerp(goal, 0.08);
    camera.lookAt(TARGET);
    if (camera.position.distanceTo(goal) < 0.02) settling.current = false;
  });

  return null;
}

/**
 * Publishes how far in the camera is, as both the raw dissection value the
 * scene animates against and a rounded step the surrounding UI can label.
 */
function ZoomReporter({
  dissectRef,
  onZoomChange,
  controlsRef,
}: {
  dissectRef: MutableRefObject<number>;
  onZoomChange?: (zoom: number) => void;
  controlsRef: MutableRefObject<ZoomApi | null>;
}) {
  const { camera } = useThree();
  const lastReported = useRef(-1);

  useFrame(() => {
    const distance = camera.position.distanceTo(TARGET);
    dissectRef.current = dissectionFor(distance);

    const zoom = FULL_BODY_DISTANCE / Math.max(distance, 0.0001);
    const rounded = Math.round(zoom * 20) / 20;
    if (rounded !== lastReported.current) {
      lastReported.current = rounded;
      onZoomChange?.(rounded);
    }
  });

  // The zoom buttons live in the surrounding chrome, outside the canvas, so
  // the camera work they need is published here rather than duplicated there.
  useEffect(() => {
    controlsRef.current = {
      zoomBy(factor: number) {
        const direction = camera.position.clone().sub(TARGET);
        const next = Math.min(
          FULL_BODY_DISTANCE,
          Math.max(CLOSEST_DISTANCE, direction.length() / factor),
        );
        camera.position.copy(direction.normalize().multiplyScalar(next).add(TARGET));
        camera.lookAt(TARGET);
      },
      reset() {
        const direction = camera.position.clone().sub(TARGET).normalize();
        camera.position.copy(direction.multiplyScalar(FULL_BODY_DISTANCE).add(TARGET));
        camera.lookAt(TARGET);
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [camera, controlsRef]);

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
  zoomApi,
  onZoomChange,
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
  zoomApi?: MutableRefObject<ZoomApi | null>;
  onZoomChange?: (zoom: number) => void;
}) {
  const organs = useMemo(() => organsFor(sex), [sex]);
  const turntableRef = useRef<THREE.Group | null>(null);
  const dissectRef = useRef(0);
  const siteRegistry = useRef<Record<string, Array<THREE.Group | null>>>({});
  const fallbackZoomApi = useRef<ZoomApi | null>(null);

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
      <ZoomReporter
        dissectRef={dissectRef}
        onZoomChange={onZoomChange}
        controlsRef={zoomApi ?? fallbackZoomApi}
      />
      <Projector
        organs={organs}
        groupRef={turntableRef}
        projection={projection}
        sites={siteRegistry}
      />

      <Turntable enabled={autoRotate && !reducedMotion} groupRef={turntableRef}>
        <Ribcage dissectRef={dissectRef} />
        <Vasculature states={states} mixRef={mixRef} />
        {organs.map((organ) => (
          <Organ
            key={organ.key}
            organ={organ}
            state={states[organ.key]}
            mixRef={mixRef}
            dissectRef={dissectRef}
            siteRegistry={siteRegistry}
            showAfter={mix > 0.5}
            reducedMotion={reducedMotion}
            selected={selectedOrgan === organ.key}
            onSelect={onSelectOrgan}
          />
        ))}
        {/* Shell last: it blends additively over the anatomy inside. */}
        <BodyShell sex={sex} dissectRef={dissectRef} />
        <Platform />
      </Turntable>

      <OrbitControls
        target={TARGET}
        enablePan={false}
        enableZoom
        zoomSpeed={0.7}
        minDistance={CLOSEST_DISTANCE}
        maxDistance={FULL_BODY_DISTANCE}
        minPolarAngle={Math.PI / 3.4}
        maxPolarAngle={Math.PI / 1.85}
      />
    </Canvas>
  );
}
