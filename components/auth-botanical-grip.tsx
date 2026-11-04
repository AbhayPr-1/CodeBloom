"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "@/components/theme-provider";
import { createLeafGeometry, createBudGeometry } from "@/components/flower-3d/flower-geometry";

interface AuthBotanicalGripProps {
  cardRef: React.RefObject<HTMLElement | null>;
}

/**
 * Procedural tapered tube geometry for organic vine branches
 */
function createTaperedTubeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radiusStart: number,
  radiusEnd: number,
  radialSegments: number
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const p = curve.getPointAt(u);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    // Gentle natural organic taper curve
    const r = radiusStart + (radiusEnd - radiusStart) * Math.pow(u, 0.78);

    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = -Math.cos(theta);

      const normal = new THREE.Vector3()
        .addScaledVector(N, cos)
        .addScaledVector(B, sin)
        .normalize();

      positions.push(
        p.x + r * normal.x,
        p.y + r * normal.y,
        p.z + r * normal.z
      );
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = (i + 1) * (radialSegments + 1) + j;
      const c = (i + 1) * (radialSegments + 1) + (j + 1);
      const d = i * (radialSegments + 1) + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  return geom;
}

/**
 * Translucent glass-botanical bark shader matching home page flower colors
 */
function createTranslucentVineBarkMaterial(isLight: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGrowProgress: { value: 0 },
      uLightPos: { value: new THREE.Vector3(0, 0, 260) },
      uIsLight: { value: isLight ? 1.0 : 0.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        vViewPosition = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uGrowProgress;
      uniform float uIsLight;
      uniform vec3 uLightPos;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        if (vUv.x > uGrowProgress) discard;

        // Smooth fade-in from screen edge
        float edgeFade = smoothstep(0.0, 0.08, vUv.x);

        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Growing tip glow
        float tipDist = abs(vUv.x - uGrowProgress);
        float tipGlow = smoothstep(0.09, 0.0, tipDist) * step(0.01, uGrowProgress) * step(uGrowProgress, 0.995);

        // Home page bark base: deep near-black with warm crimson undertone
        vec3 darkBark = mix(vec3(0.12, 0.05, 0.07), vec3(0.28, 0.08, 0.15), uIsLight);

        // Home page rose-crimson specular sheen
        vec3 lightDir = normalize(uLightPos - vWorldPosition);
        vec3 halfVec = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(normal, halfVec)), 20.0);
        vec3 highlight = mix(vec3(0.85, 0.24, 0.42), vec3(0.78, 0.20, 0.38), uIsLight) * spec * 0.75;

        // Home page glowing crimson vein energy pulse descending through the stem
        float energyPulse = sin(vUv.x * 20.0 - uTime * 2.5) * 0.5 + 0.5;
        float energyWave = pow(energyPulse, 5.0);
        vec3 pulseColor = mix(vec3(0.95, 0.26, 0.52), vec3(0.85, 0.22, 0.45), uIsLight) * energyWave * 0.85;

        // Home page rim fresnel on branch contours — metallic rose-gold
        float NdotV = max(0.0, dot(normal, viewDir));
        float fresnel = pow(1.0 - NdotV, 2.4);
        vec3 rim = mix(vec3(0.96, 0.46, 0.68), vec3(0.88, 0.40, 0.60), uIsLight) * fresnel * 0.85;

        // Subsurface inner radiance
        vec3 innerRadiance = mix(vec3(0.45, 0.08, 0.22), vec3(0.60, 0.14, 0.30), uIsLight) * (1.0 - NdotV * 0.5) * 0.4;

        // Tip glow bloom
        vec3 tipColor = vec3(1.0, 0.88, 0.94) * tipGlow * 1.8;

        vec3 color = darkBark + innerRadiance + highlight + pulseColor + rim + tipColor;

        // Translucent alpha: body is see-through, edges catch glowing rim light
        float baseAlpha = mix(0.80, 0.72, uIsLight);
        float alpha = edgeFade * (baseAlpha + 0.18 * fresnel);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: true,
  });
}

/**
 * Translucent botanical leaf shader matching home page leaf colors
 */
function createTranslucentVineLeafMaterial(isLight: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIsLight: { value: isLight ? 1.0 : 0.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec2 vUv;
      uniform float uTime;

      void main() {
        vUv = uv;
        vec3 pos = position;
        // Breeze flutter
        float flutter = sin(uTime * 2.0 + uv.y * 3.5) * 2.0 * uv.y + cos(uTime * 1.3 + uv.x * 2.5) * 0.8;
        pos.z += flutter;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewPosition = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIsLight;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec2 vUv;

      void main() {
        vec3 normal = normalize(vNormal);
        if (!gl_FrontFacing) normal = -normal;
        vec3 viewDir = normalize(vViewPosition);

        // Home page leaf base: deep crimson-velvet
        vec3 leafBase = mix(vec3(0.14, 0.04, 0.08), vec3(0.28, 0.07, 0.14), uIsLight);

        // Home page delicate rose-metallic veins
        float midrib = 1.0 - smoothstep(0.0, 0.06, abs(vUv.x - 0.5));
        float lateralVeins = sin((vUv.y - abs(vUv.x - 0.5) * 0.5) * 35.0);
        lateralVeins = smoothstep(0.75, 1.0, lateralVeins) * 0.6;
        
        // Pulsing vein glow
        float veinPulse = 1.0 + 0.18 * sin(uTime * 2.2 + vUv.y * 3.0);
        vec3 veinColor = mix(vec3(0.88, 0.28, 0.52), vec3(0.80, 0.22, 0.45), uIsLight) * (midrib * 1.1 + lateralVeins * 0.9) * veinPulse;

        // Home page softly lit margin — pale rose-gold shimmer
        float margin = smoothstep(0.78, 0.98, abs(vUv.x - 0.5) * 2.0);
        vec3 marginGlow = mix(vec3(0.98, 0.55, 0.72), vec3(0.88, 0.44, 0.64), uIsLight) * margin * 0.9;

        // Home page fresnel sheen — metallic pink
        float NdotV = max(0.0, dot(normal, viewDir));
        float fresnel = pow(1.0 - NdotV, 2.2);
        vec3 sheen = mix(vec3(0.92, 0.38, 0.58), vec3(0.82, 0.30, 0.50), uIsLight) * fresnel * 0.55;

        // Subsurface scattering radiance
        vec3 sss = mix(vec3(0.55, 0.12, 0.28), vec3(0.70, 0.18, 0.38), uIsLight) * 0.35;

        vec3 finalColor = leafBase + sss + veinColor + marginGlow + sheen;

        // Translucent alpha: glassy body allows background to softly show through
        float baseAlpha = mix(0.74, 0.68, uIsLight);
        float alpha = baseAlpha + 0.22 * fresnel + 0.15 * (midrib + margin);

        gl_FragColor = vec4(finalColor, min(0.95, alpha));
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

/**
 * Glowing stamen / bud material matching home page colors
 */
function createLivelyBudMaterial(isLight: boolean): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: isLight ? new THREE.Color("#aa3865") : new THREE.Color("#f0c8d8"),
    emissive: new THREE.Color("#c84878"),
    emissiveIntensity: isLight ? 1.0 : 1.3,
    roughness: 0.22,
    metalness: 0.72,
    transparent: true,
    opacity: 0.90,
  });
}

/**
 * Botanical spore particle material drifting gently around the card corners
 */
function createSporeParticleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      attribute float aScale;
      attribute float aPhase;
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        vec3 pos = position;
        pos.y += sin(uTime * 0.8 + aPhase) * 16.0;
        pos.x += cos(uTime * 0.6 + aPhase * 1.5) * 12.0;
        pos.z += sin(uTime * 0.5 + aPhase * 2.0) * 8.0;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        gl_PointSize = (aScale * 6.5) * (0.8 + 0.35 * sin(uTime * 2.6 + aPhase));

        // Warm crimson-to-rose-gold tones matching home page spores
        float t = sin(uTime * 1.2 + aPhase) * 0.5 + 0.5;
        vColor = mix(vec3(0.82, 0.18, 0.42), vec3(1.0, 0.72, 0.82), t);
        vAlpha = 0.36 + 0.22 * sin(uTime * 2.0 + aPhase);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float core = 1.0 - smoothstep(0.04, 0.25, dist);
        float halo = exp(-dist * 5.5);
        float intensity = core * 0.85 + halo * 0.45;
        gl_FragColor = vec4(vColor, vAlpha * intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
}

export function AuthBotanicalGrip({ cardRef }: AuthBotanicalGripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const isLight = theme === "light";

  useEffect(() => {
    const canvas = canvasRef.current;
    const cardEl = cardRef.current;
    if (!canvas || !cardEl) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
    } catch (e) {
      console.warn("WebGL not available for AuthBotanicalGrip", e);
      return;
    }

    const scene = new THREE.Scene();
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Warm ambient point light for 3D depth
    const gripLight = new THREE.PointLight(0xff5588, 2.0, 1400);
    gripLight.position.set(0, 0, 240);
    scene.add(gripLight);

    let viewW = window.innerWidth;
    let viewH = window.innerHeight;
    renderer.setSize(viewW, viewH);

    const camera = new THREE.OrthographicCamera(
      -viewW / 2,
      viewW / 2,
      viewH / 2,
      -viewH / 2,
      0.1,
      1000
    );
    camera.position.set(0, 0, 200);

    // Materials
    const barkMaterial = createTranslucentVineBarkMaterial(isLight);
    const leafMaterial = createTranslucentVineLeafMaterial(isLight);
    const budMaterial = createLivelyBudMaterial(isLight);
    const sporeMaterial = createSporeParticleMaterial();

    interface LeafInstance {
      mesh: THREE.Group;
      targetScale: number;
      attachU: number;
      baseRot: THREE.Euler;
      swayPhase: number;
      swaySpeed: number;
    }

    let leaves: LeafInstance[] = [];
    const vineGroups: THREE.Group[] = [];
    const buds: THREE.Mesh[] = [];

    // Rebuild branches that travel from screen edges to card corners
    const buildScreenEdgeVines = () => {
      // Explicitly dispose all geometries to prevent WebGL memory leaks during resize
      rootGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
      while (rootGroup.children.length > 0) {
        rootGroup.remove(rootGroup.children[0]);
      }
      leaves = [];
      vineGroups.length = 0;
      buds.length = 0;

      const rect = cardEl.getBoundingClientRect();
      const hw = rect.width / 2;
      const hh = rect.height / 2;

      // Card center in Three.js coordinates
      const cardCenterX = rect.left + hw - viewW / 2;
      const cardCenterY = -(rect.top + hh - viewH / 2);

      const sw = viewW / 2;
      const sh = viewH / 2;

      // Card corner coordinates
      const tlCornerX = cardCenterX - hw;
      const tlCornerY = cardCenterY + hh;

      const trCornerX = cardCenterX + hw;
      const trCornerY = cardCenterY + hh;

      const blCornerX = cardCenterX - hw;
      const blCornerY = cardCenterY - hh;

      const brCornerX = cardCenterX + hw;
      const brCornerY = cardCenterY - hh;

      const trEdgeX = sw + 30;
      const trEdgeY = sh * 0.90;
      const brEdgeX = sw + 30;
      const brEdgeY = -sh * 0.90;
      const tlEdgeX = -sw - 30;
      const tlEdgeY = sh * 0.78;
      const blEdgeX = -sw - 30;
      const blEdgeY = -sh * 0.86;

      // 4 Clean, monotonic vine paths starting at physical screen edges:
      const cornerDefinitions = [
        // 1. TOP-LEFT: starts from screen left edge between header and headline, grips top-left corner
        {
          name: "top-left",
          sx: -1,
          sy: 1,
          phase: 0.0,
          cornerPos: new THREE.Vector3(tlCornerX, tlCornerY, 7),
          points: [
            new THREE.Vector3(tlEdgeX, tlEdgeY, -20),
            new THREE.Vector3(tlEdgeX + (tlCornerX - tlEdgeX) * 0.36, tlEdgeY - 4, -14),
            new THREE.Vector3(tlEdgeX + (tlCornerX - tlEdgeX) * 0.70, tlEdgeY - 8, -8),
            new THREE.Vector3(tlCornerX - 60, tlCornerY + 28, -4),
            new THREE.Vector3(tlCornerX - 16, tlCornerY + 10, 2),
            new THREE.Vector3(tlCornerX, tlCornerY, 7),
            // Corner hugging tendril 1 (creeping along top edge to the right)
            new THREE.Vector3(tlCornerX + 26, tlCornerY + 3.5, 8),
            new THREE.Vector3(tlCornerX + 65, tlCornerY - 1.0, 7),
            new THREE.Vector3(tlCornerX + 105, tlCornerY - 5.0, 4),
          ],
          forkPoints: [
            new THREE.Vector3(tlCornerX, tlCornerY, 7),
            // Corner hugging tendril 2 (creeping down the left edge)
            new THREE.Vector3(tlCornerX - 3.5, tlCornerY - 26, 8),
            new THREE.Vector3(tlCornerX + 1.5, tlCornerY - 65, 7),
            new THREE.Vector3(tlCornerX - 5.0, tlCornerY - 105, 4),
          ],
          curlPoints: [
            new THREE.Vector3(tlCornerX + 65, tlCornerY - 1.0, 7),
            new THREE.Vector3(tlCornerX + 85, tlCornerY + 16, 9),
            new THREE.Vector3(tlCornerX + 105, tlCornerY + 10, 10),
            new THREE.Vector3(tlCornerX + 98, tlCornerY - 4, 8),
          ],
        },

        // 2. TOP-RIGHT: starts from screen top-right edge, swoops gracefully into top-right corner
        {
          name: "top-right",
          sx: 1,
          sy: 1,
          phase: 1.5,
          cornerPos: new THREE.Vector3(trCornerX, trCornerY, 7),
          points: [
            new THREE.Vector3(trEdgeX, trEdgeY, -20),
            new THREE.Vector3(trEdgeX - (trEdgeX - trCornerX) * 0.35, trCornerY + (trEdgeY - trCornerY) * 0.65, -14),
            new THREE.Vector3(trCornerX + (trEdgeX - trCornerX) * 0.28, trCornerY + 38, -8),
            new THREE.Vector3(trCornerX + 18, trCornerY + 10, 2),
            new THREE.Vector3(trCornerX, trCornerY, 7),
            // Corner hugging tendril 1 (creeping along top edge to the left)
            new THREE.Vector3(trCornerX - 26, trCornerY + 3.5, 8),
            new THREE.Vector3(trCornerX - 65, trCornerY - 1.0, 7),
            new THREE.Vector3(trCornerX - 105, trCornerY - 5.0, 4),
          ],
          forkPoints: [
            new THREE.Vector3(trCornerX, trCornerY, 7),
            // Corner hugging tendril 2 (creeping down the right edge)
            new THREE.Vector3(trCornerX + 3.5, trCornerY - 26, 8),
            new THREE.Vector3(trCornerX - 1.5, trCornerY - 65, 7),
            new THREE.Vector3(trCornerX + 5.0, trCornerY - 105, 4),
          ],
          curlPoints: [
            new THREE.Vector3(trCornerX - 65, trCornerY - 1.0, 7),
            new THREE.Vector3(trCornerX - 85, trCornerY + 16, 9),
            new THREE.Vector3(trCornerX - 105, trCornerY + 10, 10),
            new THREE.Vector3(trCornerX - 98, trCornerY - 4, 8),
          ],
        },

        // 3. BOTTOM-LEFT: starts from screen bottom-left edge, glides through lower margin, grips bottom-left corner
        {
          name: "bottom-left",
          sx: -1,
          sy: -1,
          phase: 3.0,
          cornerPos: new THREE.Vector3(blCornerX, blCornerY, 7),
          points: [
            new THREE.Vector3(blEdgeX, blEdgeY, -20),
            new THREE.Vector3(blEdgeX + (blCornerX - blEdgeX) * 0.36, blEdgeY + 8, -14),
            new THREE.Vector3(blEdgeX + (blCornerX - blEdgeX) * 0.70, blEdgeY + 22, -8),
            new THREE.Vector3(blCornerX - 60, blCornerY - 34, -4),
            new THREE.Vector3(blCornerX - 16, blCornerY - 10, 2),
            new THREE.Vector3(blCornerX, blCornerY, 7),
            // Corner hugging tendril 1 (creeping along bottom edge to the right)
            new THREE.Vector3(blCornerX + 26, blCornerY - 3.5, 8),
            new THREE.Vector3(blCornerX + 65, blCornerY + 1.0, 7),
            new THREE.Vector3(blCornerX + 105, blCornerY + 5.0, 4),
          ],
          forkPoints: [
            new THREE.Vector3(blCornerX, blCornerY, 7),
            // Corner hugging tendril 2 (creeping up the left edge)
            new THREE.Vector3(blCornerX - 3.5, blCornerY + 26, 8),
            new THREE.Vector3(blCornerX + 1.5, blCornerY + 65, 7),
            new THREE.Vector3(blCornerX - 5.0, blCornerY + 105, 4),
          ],
          curlPoints: [
            new THREE.Vector3(blCornerX + 65, blCornerY + 1.0, 7),
            new THREE.Vector3(blCornerX + 85, blCornerY - 16, 9),
            new THREE.Vector3(blCornerX + 105, blCornerY - 10, 10),
            new THREE.Vector3(blCornerX + 98, blCornerY + 4, 8),
          ],
        },

        // 4. BOTTOM-RIGHT: starts from screen bottom-right edge, swoops up into bottom-right corner
        {
          name: "bottom-right",
          sx: 1,
          sy: -1,
          phase: 4.5,
          cornerPos: new THREE.Vector3(brCornerX, brCornerY, 7),
          points: [
            new THREE.Vector3(brEdgeX, brEdgeY, -20),
            new THREE.Vector3(brEdgeX - (brEdgeX - brCornerX) * 0.35, brCornerY - (Math.abs(brEdgeY) - Math.abs(brCornerY)) * 0.65, -14),
            new THREE.Vector3(brCornerX + (brEdgeX - brCornerX) * 0.28, brCornerY - 38, -8),
            new THREE.Vector3(brCornerX + 18, brCornerY - 10, 2),
            new THREE.Vector3(brCornerX, brCornerY, 7),
            // Corner hugging tendril 1 (creeping along bottom edge to the left)
            new THREE.Vector3(brCornerX - 26, brCornerY - 3.5, 8),
            new THREE.Vector3(brCornerX - 65, brCornerY + 1.0, 7),
            new THREE.Vector3(brCornerX - 105, brCornerY + 5.0, 4),
          ],
          forkPoints: [
            new THREE.Vector3(brCornerX, brCornerY, 7),
            // Corner hugging tendril 2 (creeping up the right edge)
            new THREE.Vector3(brCornerX + 3.5, brCornerY + 26, 8),
            new THREE.Vector3(brCornerX - 1.5, brCornerY + 65, 7),
            new THREE.Vector3(brCornerX + 5.0, brCornerY + 105, 4),
          ],
          curlPoints: [
            new THREE.Vector3(brCornerX - 65, brCornerY + 1.0, 7),
            new THREE.Vector3(brCornerX - 85, brCornerY - 16, 9),
            new THREE.Vector3(brCornerX - 105, brCornerY - 10, 10),
            new THREE.Vector3(brCornerX - 98, brCornerY + 4, 8),
          ],
        },
      ];

      const sporePositions: number[] = [];
      const sporeScales: number[] = [];
      const sporePhases: number[] = [];

      cornerDefinitions.forEach(({ sx, sy, phase, points, forkPoints, curlPoints, cornerPos }) => {
        const branchGroup = new THREE.Group();
        rootGroup.add(branchGroup);
        vineGroups.push(branchGroup);

        // 1. Primary main stem — even more prominent (16.0px base tapering down to 6.8px near card and 4.6px along hug)
        const mainCurve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
        const mainTubeGeom = createTaperedTubeGeometry(mainCurve, 84, 16.0, 4.6, 14);
        const mainMesh = new THREE.Mesh(mainTubeGeom, barkMaterial);
        branchGroup.add(mainMesh);

        // 2. Secondary hugging tendril (7.5px down to 3.2px)
        const forkCurve = new THREE.CatmullRomCurve3(forkPoints, false, "centripetal", 0.5);
        const forkTubeGeom = createTaperedTubeGeometry(forkCurve, 42, 7.5, 3.2, 12);
        const forkMesh = new THREE.Mesh(forkTubeGeom, barkMaterial);
        branchGroup.add(forkMesh);

        // 3. Delicate curling ivy coil (4.8px down to 2.0px)
        const curlCurve = new THREE.CatmullRomCurve3(curlPoints, false, "centripetal", 0.5);
        const curlTubeGeom = createTaperedTubeGeometry(curlCurve, 28, 4.8, 2.0, 10);
        const curlMesh = new THREE.Mesh(curlTubeGeom, barkMaterial);
        branchGroup.add(curlMesh);

        // 4. Large, prominent translucent botanical leaves (length 78px down to 48px, width 38px down to 23px)
        const leafSpecs = [
          { u: 0.24, len: 78, wid: 38, rotZ: -0.42 * sx * sy, rotX: 0.25, targetScale: 1.0 },
          { u: 0.44, len: 70, wid: 34, rotZ: 0.45 * sx * sy, rotX: -0.22, targetScale: 0.96 },
          { u: 0.64, len: 62, wid: 30, rotZ: -0.32 * sx, rotX: 0.18, targetScale: 0.92 },
          { u: 0.80, len: 54, wid: 26, rotZ: 0.28 * sx, rotX: -0.15, targetScale: 0.86 },
          { u: 0.94, len: 46, wid: 22, rotZ: -0.22 * sx * sy, rotX: 0.12, targetScale: 0.80 },
        ];

        leafSpecs.forEach((spec, lIdx) => {
          const pt = mainCurve.getPoint(spec.u);
          const tangent = mainCurve.getTangent(spec.u);

          const leafGeom = createLeafGeometry(spec.len, spec.wid, 18, 12);
          const leafMesh = new THREE.Mesh(leafGeom, leafMaterial);

          const leafPivot = new THREE.Group();
          leafPivot.position.copy(pt);
          leafPivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
          leafMesh.rotation.z = spec.rotZ;
          leafMesh.rotation.x = spec.rotX;

          leafPivot.scale.setScalar(0.001);
          leafPivot.add(leafMesh);
          branchGroup.add(leafPivot);

          leaves.push({
            mesh: leafPivot,
            targetScale: spec.targetScale,
            attachU: spec.u,
            baseRot: leafPivot.rotation.clone(),
            swayPhase: phase + lIdx * 1.4,
            swaySpeed: 1.4 + (lIdx % 3) * 0.25,
          });
        });

        // 5. Clasping leaves on the secondary tendril
        const forkLeafSpecs = [
          { u: 0.38, len: 44, wid: 22, rotZ: 0.38 * sy, rotX: 0.16, targetScale: 0.85 },
          { u: 0.78, len: 34, wid: 17, rotZ: -0.32 * sy, rotX: -0.14, targetScale: 0.78 },
        ];

        forkLeafSpecs.forEach((fSpec, fIdx) => {
          const forkPt = forkCurve.getPoint(fSpec.u);
          const forkTangent = forkCurve.getTangent(fSpec.u);
          const forkLeafGeom = createLeafGeometry(fSpec.len, fSpec.wid, 16, 10);
          const forkLeafMesh = new THREE.Mesh(forkLeafGeom, leafMaterial);
          const forkLeafPivot = new THREE.Group();
          forkLeafPivot.position.copy(forkPt);
          forkLeafPivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forkTangent);
          forkLeafMesh.rotation.z = fSpec.rotZ;
          forkLeafMesh.rotation.x = fSpec.rotX;
          forkLeafPivot.scale.setScalar(0.001);
          forkLeafPivot.add(forkLeafMesh);
          branchGroup.add(forkLeafPivot);

          leaves.push({
            mesh: forkLeafPivot,
            targetScale: fSpec.targetScale,
            attachU: 0.76 + fIdx * 0.12,
            baseRot: forkLeafPivot.rotation.clone(),
            swayPhase: phase + 3.2 + fIdx * 1.2,
            swaySpeed: 1.6,
          });
        });

        // 6. Glowing botanical bud node at the corner grip anchor (radius 8.0, height 16)
        const budGeom = createBudGeometry(8.0, 16.0);
        const budMesh = new THREE.Mesh(budGeom, budMaterial);
        budMesh.position.copy(cornerPos);
        budMesh.position.z += 4;
        budMesh.rotation.z = phase * 0.6;
        budMesh.rotation.x = 0.4 * sy;
        branchGroup.add(budMesh);
        buds.push(budMesh);

        // 7. Ambient firefly spores around each corner
        for (let s = 0; s < 14; s++) {
          const spreadX = (Math.random() - 0.5) * 190;
          const spreadY = (Math.random() - 0.5) * 170;
          sporePositions.push(cornerPos.x + spreadX, cornerPos.y + spreadY, 15 + Math.random() * 30);
          sporeScales.push(0.9 + Math.random() * 1.5);
          sporePhases.push(Math.random() * Math.PI * 2);
        }
      });

      // Build spore particles
      const sporeGeom = new THREE.BufferGeometry();
      sporeGeom.setAttribute("position", new THREE.Float32BufferAttribute(sporePositions, 3));
      sporeGeom.setAttribute("aScale", new THREE.Float32BufferAttribute(sporeScales, 1));
      sporeGeom.setAttribute("aPhase", new THREE.Float32BufferAttribute(sporePhases, 1));
      const sporeMesh = new THREE.Points(sporeGeom, sporeMaterial);
      rootGroup.add(sporeMesh);
    };

    buildScreenEdgeVines();

    // Window resize handler
    const handleResize = () => {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      renderer.setSize(viewW, viewH);

      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();

      buildScreenEdgeVines();
    };
    window.addEventListener("resize", handleResize);

    // Resize observer on card
    const ro = new ResizeObserver(() => {
      buildScreenEdgeVines();
    });
    ro.observe(cardEl);

    // Mouse parallax and interactive reactivity
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = (e.clientX / viewW - 0.5) * 2.0;
      mouse.targetY = (e.clientY / viewH - 0.5) * 2.0;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Smooth, slow, graceful growth animation (3.4 seconds for cinematic timelapse feel)
    let growProgress = 0.0;
    const startTime = performance.now();
    const GROW_DURATION = 3400; // ms

    // Animation Loop
    let animId: number;
    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);

      const elapsed = time - startTime;
      const t = Math.min(1.0, elapsed / GROW_DURATION);
      // Gentle organic growth ease-out
      growProgress = 1.0 - Math.pow(1.0 - t, 2.6);

      const seconds = time * 0.001;

      // Update materials
      barkMaterial.uniforms.uTime.value = seconds;
      barkMaterial.uniforms.uGrowProgress.value = growProgress;
      barkMaterial.uniforms.uIsLight.value = isLight ? 1.0 : 0.0;

      leafMaterial.uniforms.uTime.value = seconds;
      leafMaterial.uniforms.uIsLight.value = isLight ? 1.0 : 0.0;

      sporeMaterial.uniforms.uTime.value = seconds;

      // Unfurl leaves with lively spring bounce as branch passes their attachment point
      leaves.forEach((l) => {
        if (growProgress > l.attachU) {
          const leafProgress = Math.min(1.0, (growProgress - l.attachU) / 0.16);
          const ease = 1.0 + 0.16 * Math.sin(leafProgress * Math.PI) * (1.0 - leafProgress);
          const currentScale = leafProgress * l.targetScale * ease;
          l.mesh.scale.setScalar(currentScale);

          // Lively organic breeze sway
          const sway = Math.sin(seconds * l.swaySpeed + l.swayPhase) * 0.06;
          const tilt = Math.cos(seconds * 1.2 + l.swayPhase) * 0.03;
          l.mesh.rotation.z = l.baseRot.z + sway;
          l.mesh.rotation.x = l.baseRot.x + tilt;
        } else {
          l.mesh.scale.setScalar(0.001);
        }
      });

      // Lively breathing on buds
      buds.forEach((bud, bIdx) => {
        const pulse = 1.0 + 0.08 * Math.sin(seconds * 2.2 + bIdx * 1.5);
        bud.scale.setScalar(growProgress * pulse);
      });

      // Subtle living sway on branch groups
      vineGroups.forEach((vg, idx) => {
        vg.rotation.z = Math.sin(seconds * 1.2 + idx * 1.4) * 0.008;
      });

      // Smooth mouse parallax lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.045;
      mouse.y += (mouse.targetY - mouse.y) * 0.045;
      rootGroup.rotation.y = mouse.x * 0.035;
      rootGroup.rotation.x = -mouse.y * 0.035;

      // Pulsing light intensity
      gripLight.intensity = 1.8 + 0.35 * Math.sin(seconds * 2.0);

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      ro.disconnect();
      rootGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
      renderer.dispose();
      barkMaterial.dispose();
      leafMaterial.dispose();
      budMaterial.dispose();
      sporeMaterial.dispose();
    };
  }, [cardRef, isLight]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-20"
      aria-hidden="true"
    />
  );
}
