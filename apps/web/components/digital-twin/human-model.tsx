"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getBodyGeometry } from "./body-geometry";
import type { Sex } from "./anatomy";

/* --------------------------------------------------------------------------
   Body shell
   The silhouette is lathed from an anatomical profile rather than assembled
   from primitives, so the torso tapers at the waist and widens at the chest.
   A Fresnel term lights only the grazing edges, which reads as clinical glass
   and keeps the organs inside legible.
   -------------------------------------------------------------------------- */

const SHELL_VERTEX = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SHELL_FRAGMENT = /* glsl */ `
  uniform vec3 uSkin;
  uniform vec3 uEdge;
  uniform vec3 uLight;
  uniform float uOpacity;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 view = normalize(vViewDir);

    // abs(), not clamp(): back faces point away from the camera, and clamping
    // their negative dot product to zero made every one of them fully opaque.
    float facing = abs(dot(normal, view));
    float fresnel = pow(1.0 - facing, 2.0);

    // Wrapped diffuse gives the form its light and shade. Fresnel alone draws
    // an outline around a hollow middle, which reads as a flat cutout.
    vec3 light = normalize(uLight);
    float diffuse = pow(clamp(dot(normal, light) * 0.5 + 0.5, 0.0, 1.0), 1.4);

    vec3 halfway = normalize(light + view);
    float sheen = pow(max(dot(normal, halfway), 0.0), 36.0) * 0.16;

    // On a light ground the silhouette has to DARKEN at grazing angles. A
    // glowing rim is a dark-theme idiom and disappears against white.
    vec3 color = mix(uSkin * (0.78 + diffuse * 0.32), uEdge, fresnel * 0.85) + sheen;

    // Skin stays translucent enough to read the organs through it, and firms
    // up at the edges so the body still has a definite outline.
    float alpha = uOpacity * (0.46 + fresnel * 0.5);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

function useShellMaterials() {
  return useMemo(() => {
    const uniforms = {
      uSkin: { value: new THREE.Color("#f4f7fb") },
      uEdge: { value: new THREE.Color("#8fa8bd") },
      uLight: { value: new THREE.Vector3(0.45, 0.68, 0.9).normalize() },
      uOpacity: { value: 0.96 },
    };

    const shell = new THREE.ShaderMaterial({
      vertexShader: SHELL_VERTEX,
      fragmentShader: SHELL_FRAGMENT,
      uniforms,
      transparent: true,
      depthWrite: false,
      // Only fragments at exactly the depth laid down by the prepass survive,
      // so the shell shades the frontmost surface alone. Without this, every
      // overlapping part draws its own silhouette and the body reads as a
      // stack of separate pieces.
      depthTest: true,
      depthFunc: THREE.EqualDepth,
      side: THREE.FrontSide,
    });

    // Depth-only prepass. It must run the *same* vertex shader as the shell:
    // a different one computes gl_Position through different arithmetic, and
    // the depths no longer compare equal, which showed up as banding across
    // the arms and legs where fragments failed the EqualDepth test.
    const prepass = new THREE.ShaderMaterial({
      vertexShader: SHELL_VERTEX,
      fragmentShader: `void main() { gl_FragColor = vec4(0.0); }`,
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
      // Opaque materials all draw before any transparent one, which would put
      // this ahead of the organs and depth-reject them. Flagging it transparent
      // puts it in the same pass, where renderOrder decides.
      transparent: true,
    });

    return { shell, prepass };
  }, []);
}

/** The body never intercepts pointer events — the organs inside are the targets. */
const IGNORE_RAYCAST = () => null;

/**
 * `dissect` runs 0 → 1 as the camera closes in. At 1 the skin is gone: close
 * up, a translucent body over separated organs reads as fog rather than as
 * anatomy, so the shell gets out of the way entirely and the organs carry the
 * frame. The depth prepass is switched off with it — left on, it would keep
 * writing a silhouette that nothing draws into.
 */
export function BodyShell({ sex, dissectRef }: { sex: Sex; dissectRef?: MutableRefObject<number> }) {
  const geometry = useMemo(() => getBodyGeometry(sex), [sex]);
  const { shell, prepass } = useShellMaterials();
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const dissect = dissectRef?.current ?? 0;
    const opacity = 0.96 * (1 - dissect);
    shell.uniforms.uOpacity.value = opacity;
    if (groupRef.current) groupRef.current.visible = opacity > 0.02;
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} material={prepass} renderOrder={1} raycast={IGNORE_RAYCAST} />
      <mesh geometry={geometry} material={shell} renderOrder={2} raycast={IGNORE_RAYCAST} />
    </group>
  );
}

/* --------------------------------------------------------------------------
   Vascular tree
   Drawn as tubes along the great vessels so the twin reads as anatomy rather
   than as a capsule with dots. It takes the cardiovascular signal colour.
   -------------------------------------------------------------------------- */

const VESSEL_PATHS: Array<Array<[number, number, number]>> = [
  // Aortic arch and descending aorta
  [
    [-0.02, 1.3, 0.03],
    [0.0, 1.37, 0.0],
    [0.025, 1.33, -0.02],
    [0.012, 1.15, -0.03],
    [0.0, 0.95, -0.025],
  ],
  // Carotids
  [
    [-0.018, 1.36, 0.0],
    [-0.03, 1.46, 0.008],
    [-0.032, 1.55, 0.014],
  ],
  [
    [0.018, 1.36, 0.0],
    [0.03, 1.46, 0.008],
    [0.032, 1.55, 0.014],
  ],
  // Iliac branches
  [
    [0.0, 0.95, -0.025],
    [-0.055, 0.89, -0.01],
    [-0.085, 0.78, 0.0],
  ],
  [
    [0.0, 0.95, -0.025],
    [0.055, 0.89, -0.01],
    [0.085, 0.78, 0.0],
  ],
];

export function VascularTree({ color, intensity }: { color: THREE.Color; intensity: number }) {
  const materials = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    for (const material of materials.current) {
      material.color.copy(color);
      material.emissive.copy(color);
      material.emissiveIntensity = intensity;
    }
  });
  const geometries = useMemo(
    () =>
      VESSEL_PATHS.map((path) => {
        const curve = new THREE.CatmullRomCurve3(
          path.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        );
        return new THREE.TubeGeometry(curve, 40, 0.0065, 10, false);
      }),
    [],
  );

  materials.current = [];

  return (
    <group renderOrder={0}>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial
            ref={(material: THREE.MeshStandardMaterial | null) => {
              if (material) materials.current.push(material);
            }}
            roughness={0.35}
            metalness={0.1}
            transparent
            opacity={0.95}
          />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------------------------------------------------
   Skeleton hint: a faint ribcage so the chest cavity has depth behind the heart.
   -------------------------------------------------------------------------- */

export function Ribcage({ dissectRef }: { dissectRef?: MutableRefObject<number> }) {
  const ribs = useMemo(() => [1.16, 1.22, 1.28, 1.34], []);
  const materials = useRef<THREE.MeshBasicMaterial[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  // The cage opens as the view closes in: ribs thin out and lift apart, so the
  // heart behind them is read directly rather than through a grille.
  useFrame(() => {
    const dissect = dissectRef?.current ?? 0;
    for (const material of materials.current) material.opacity = 0.5 * (1 - dissect * 0.88);
    if (groupRef.current) groupRef.current.scale.setScalar(1 + dissect * 0.16);
  });

  materials.current = [];

  return (
    <group ref={groupRef} renderOrder={0}>
      {ribs.map((y, index) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.66, 1]}>
          <torusGeometry args={[0.136 - index * 0.004, 0.005, 8, 40, Math.PI * 1.55]} />
          <meshBasicMaterial
            ref={(material: THREE.MeshBasicMaterial | null) => {
              if (material) materials.current.push(material);
            }}
            color="#b9c6d4"
            transparent
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
