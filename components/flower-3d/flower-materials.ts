import * as THREE from "three";

/**
 * Custom GLSL Shader for the Fractal Petals:
 * Recreates the glossy, iridescent, translucent purple/magenta/pink aesthetic
 * seen in the reference photos and video.
 */
export function createPetalShaderMaterial(tierIndex: number = 0, totalTiers: number = 6): THREE.ShaderMaterial {
  // Color configuration per tier from inner to outer
  // Inner: bright luminous lavender/pink -> Outer: deep purple with magenta glowing rims
  const tierRatio = tierIndex / Math.max(1, totalTiers - 1);

  const baseColors = [
    new THREE.Color("#4a0e68"), // tier 0
    new THREE.Color("#360854"),
    new THREE.Color("#260540"),
    new THREE.Color("#1c0330"),
    new THREE.Color("#130122"),
    new THREE.Color("#0c0017"), // tier 5
  ];

  const midColors = [
    new THREE.Color("#ff79e6"), // inner: bright glowing pink
    new THREE.Color("#f142c9"),
    new THREE.Color("#dc26b0"),
    new THREE.Color("#bf1aa1"),
    new THREE.Color("#9d148e"),
    new THREE.Color("#7b0f74"), // outer: rich magenta
  ];

  const rimColors = [
    new THREE.Color("#ffffff"), // inner rim: radiant white-lavender
    new THREE.Color("#ffd2fa"),
    new THREE.Color("#ff94eb"),
    new THREE.Color("#d568ff"),
    new THREE.Color("#9b5cf6"),
    new THREE.Color("#8040f0"), // outer rim: luminous violet
  ];

  const baseColor = baseColors[Math.min(tierIndex, baseColors.length - 1)];
  const midColor = midColors[Math.min(tierIndex, midColors.length - 1)];
  const rimColor = rimColors[Math.min(tierIndex, rimColors.length - 1)];

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: baseColor },
      uMidColor: { value: midColor },
      uRimColor: { value: rimColor },
      uCoreLightPos: { value: new THREE.Vector3(0, 0.5, 0) },
      uLightIntensity: { value: 1.0 },
      uBloomProgress: { value: 0.0 },
      uFresnelPower: { value: 2.2 - tierRatio * 0.4 },
      uOpacity: { value: 0.92 },
      uSubsurfaceStrength: { value: 0.65 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      
      uniform float uTime;
      uniform float uBloomProgress;

      void main() {
        vUv = uv;
        
        // Gentle organic micro-flutter
        vec3 pos = position;
        float flutter = sin(uTime * 2.0 + uv.y * 6.0 + uv.x * 4.0) * 0.015 * uv.y;
        pos.z += flutter;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPosition = worldPos.xyz;

        vec4 mvPosition = viewMatrix * worldPos;
        vViewPosition = -mvPosition.xyz;

        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uMidColor;
      uniform vec3 uRimColor;
      uniform vec3 uCoreLightPos;
      uniform float uTime;
      uniform float uLightIntensity;
      uniform float uBloomProgress;
      uniform float uFresnelPower;
      uniform float uOpacity;
      uniform float uSubsurfaceStrength;

      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Two-sided normal adjustment
        if (!gl_FrontFacing) {
          normal = -normal;
        }

        // 1. Longitudinal & Transverse Color Gradient
        // Base -> Mid -> Tip
        float tipFactor = smoothstep(0.08, 0.95, vUv.y);
        vec3 surfaceColor = mix(uBaseColor, uMidColor, tipFactor);

        // Edge luminous accent and glowing neon rim stroke
        float edgeDist = abs(vUv.x - 0.5) * 2.0; // 0 at center rib, 1 at petal edges
        float edgeLuminance = smoothstep(0.35, 0.98, edgeDist);
        surfaceColor = mix(surfaceColor, uRimColor, edgeLuminance * 0.7);

        // Crisp luminous rim outline (matching fractal reference images)
        float rimStroke = smoothstep(0.85, 0.99, edgeDist) * smoothstep(0.1, 0.9, vUv.y);
        vec3 neonEdge = uRimColor * rimStroke * 2.5;

        // 2. Fresnel Rim Lighting (Crystal / Glassy translucency)
        float NdotV = max(0.0, dot(normal, viewDir));
        float fresnel = pow(1.0 - NdotV, uFresnelPower);
        
        // Iridescent color shift on extreme rim
        vec3 iridescence = mix(uRimColor, vec3(0.8, 0.9, 1.0), sin(uTime + vUv.y * 4.0) * 0.3 + 0.3);
        vec3 rimGlow = iridescence * fresnel * 2.2;

        // 3. Subsurface Scattering from glowing flower center
        vec3 lightDir = normalize(uCoreLightPos - vWorldPosition);
        float sss = max(0.0, dot(viewDir, -lightDir)) * uSubsurfaceStrength * (1.0 - edgeDist * 0.25);
        vec3 sssColor = uMidColor * sss * 1.8;

        // 4. Specular glint
        vec3 halfVec = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(normal, halfVec)), 32.0) * 0.9;

        // Combine lighting
        vec3 finalColor = (surfaceColor + sssColor) * uLightIntensity + rimGlow + neonEdge + vec3(spec);

        // Bloom radiance boost
        finalColor += uRimColor * (0.15 + 0.1 * sin(uTime * 3.0));

        // Alpha calculation: translucent body with brighter glowing rims
        float alpha = uOpacity * (0.75 + 0.25 * fresnel);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

/**
 * Dark metallic / lacquered bark material with purple specular highlights and energy pulses
 */
export function createBarkMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLightPos: { value: new THREE.Vector3(0, 3, 2) },
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
      uniform vec3 uLightPos;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Deep lacquered dark bark base
        vec3 darkBark = vec3(0.045, 0.025, 0.075);
        
        // Purple specular sheen
        vec3 lightDir = normalize(uLightPos - vWorldPosition);
        vec3 halfVec = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(normal, halfVec)), 24.0);
        vec3 purpleHighlight = vec3(0.65, 0.25, 0.95) * spec * 1.2;

        // Glowing vein energy wave descending through the stem
        float energyPulse = sin(vUv.x * 20.0 - uTime * 2.5) * 0.5 + 0.5;
        float energyWave = pow(energyPulse, 8.0);
        vec3 pulseColor = vec3(0.7, 0.15, 0.9) * energyWave * 0.6;

        // Rim fresnel on branch contours
        float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 3.0);
        vec3 rim = vec3(0.45, 0.18, 0.75) * fresnel * 0.8;

        vec3 color = darkBark + purpleHighlight + pulseColor + rim;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

/**
 * Botanical Leaf Shader Material with luminous purple veins and glowing rim
 */
export function createLeafMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
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
        pos.z += sin(uTime * 1.8 + uv.y * 4.0) * 0.02 * uv.y;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewPosition = -mvPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec2 vUv;

      void main() {
        vec3 normal = normalize(vNormal);
        if (!gl_FrontFacing) normal = -normal;
        vec3 viewDir = normalize(vViewPosition);

        // Deep rich violet-black base
        vec3 leafBase = vec3(0.07, 0.04, 0.12);

        // Delicate purple/magenta veins
        float midrib = 1.0 - smoothstep(0.0, 0.06, abs(vUv.x - 0.5));
        float lateralVeins = sin((vUv.y - abs(vUv.x - 0.5) * 0.5) * 35.0);
        lateralVeins = smoothstep(0.8, 1.0, lateralVeins) * 0.45;

        vec3 veinColor = vec3(0.85, 0.25, 0.95) * (midrib * 0.8 + lateralVeins);

        // Glowing margin
        float margin = smoothstep(0.82, 0.98, abs(vUv.x - 0.5) * 2.0);
        vec3 marginGlow = vec3(0.75, 0.35, 1.0) * margin * 0.7;

        // Fresnel sheen
        float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.5);
        vec3 sheen = vec3(0.5, 0.2, 0.8) * fresnel * 0.5;

        vec3 finalColor = leafBase + veinColor + marginGlow + sheen;
        gl_FragColor = vec4(finalColor, 0.92);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/**
 * Radiant Stamen / Pistil Core Material
 */
export function createStamenMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#ffd1fc"),
    emissive: new THREE.Color("#e63acb"),
    emissiveIntensity: 1.8,
    roughness: 0.15,
    metalness: 0.2,
  });
}

/**
 * Botanical spore / firefly floating particle material
 */
export function createSporeParticleMaterial(): THREE.ShaderMaterial {
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
        // Drifting sinusoidal float
        pos.y += sin(uTime * 0.8 + aPhase) * 0.35;
        pos.x += cos(uTime * 0.6 + aPhase * 1.5) * 0.25;
        pos.z += sin(uTime * 0.5 + aPhase * 2.0) * 0.25;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Size attenuation
        gl_PointSize = (aScale * 35.0 / -mvPosition.z) * (0.8 + 0.3 * sin(uTime * 3.0 + aPhase));

        // Color shifting between lavender, magenta and cyan-violet
        float t = sin(uTime * 1.2 + aPhase) * 0.5 + 0.5;
        vColor = mix(vec3(0.9, 0.4, 1.0), vec3(0.6, 0.8, 1.0), t);
        vAlpha = 0.5 + 0.4 * sin(uTime * 2.0 + aPhase);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        // Soft circular gaussian bokeh
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float intensity = pow(1.0 - (dist * 2.0), 2.2);

        gl_FragColor = vec4(vColor, vAlpha * intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

