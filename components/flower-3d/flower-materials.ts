import * as THREE from "three";

/**
 * Custom GLSL Shader for the Fractal Petals:
 * Creates translucent sage petals with focused spring-green rim lighting.
 */
export function createPetalShaderMaterial(tierIndex: number = 0, totalTiers: number = 6): THREE.ShaderMaterial {
  // Keep petal faces subdued; reserve brighter crimsons/rose-golds for the rim and core.
  const tierRatio = tierIndex / Math.max(1, totalTiers - 1);

  const baseColors = [
    new THREE.Color("#3a1a22"), // tier 0 — deep burgundy shadow
    new THREE.Color("#35161f"),
    new THREE.Color("#30121c"),
    new THREE.Color("#2b0f18"),
    new THREE.Color("#260c15"),
    new THREE.Color("#220913"), // tier 5 — near-black crimson
  ];

  const midColors = [
    new THREE.Color("#b84470"), // inner: rich rose-metallic
    new THREE.Color("#aa3865"),
    new THREE.Color("#9c2c5a"),
    new THREE.Color("#8e2050"),
    new THREE.Color("#801445"),
    new THREE.Color("#72083a"), // outer: deep carmine
  ];

  const rimColors = [
    new THREE.Color("#f7c4d8"), // inner rim: pale rose-gold sparkle
    new THREE.Color("#f0a8c4"),
    new THREE.Color("#e888af"),
    new THREE.Color("#e0689a"),
    new THREE.Color("#d84886"),
    new THREE.Color("#cc2872"), // outer rim: vivid magenta-crimson edge
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
      uLightIntensity: { value: 0.45 },
      uBloomProgress: { value: 0.0 },
      uFresnelPower: { value: 2.2 - tierRatio * 0.4 },
      uOpacity: { value: 0.8 },
      uSubsurfaceStrength: { value: 0.45 },
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
        float edgeLuminance = smoothstep(0.72, 0.97, edgeDist);
        surfaceColor = mix(surfaceColor, uRimColor, edgeLuminance * 0.55);

        // Crisp luminous rim outline (matching fractal reference images)
        float rimStroke = smoothstep(0.92, 0.998, edgeDist) * smoothstep(0.1, 0.9, vUv.y);
        vec3 neonEdge = uRimColor * rimStroke * 1.0;

        // 2. Fresnel Rim Lighting (Crystal / Glassy translucency)
        float NdotV = max(0.0, dot(normal, viewDir));
        float fresnel = pow(1.0 - NdotV, uFresnelPower);
        
        // Iridescent color shift on extreme rim — rose-gold to pale champagne shimmer
        vec3 iridescence = mix(uRimColor, vec3(1.0, 0.82, 0.78), sin(uTime + vUv.y * 4.0) * 0.22 + 0.22);
        vec3 rimGlow = iridescence * fresnel * 0.65;

        // 3. Subsurface Scattering from glowing flower center
        vec3 lightDir = normalize(uCoreLightPos - vWorldPosition);
        float sss = max(0.0, dot(viewDir, -lightDir)) * uSubsurfaceStrength * (1.0 - edgeDist * 0.25);
        vec3 sssColor = uMidColor * sss * 0.55;

        // 4. Specular glint & Metallic sparkle / glitter flake effect
        vec3 halfVec = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(normal, halfVec)), 28.0) * 0.45;

        // Procedural metallic glitter/sparkle flakes based on micro-noise
        vec2 flakeUv = vUv * 85.0;
        float flakeHash = fract(sin(dot(floor(flakeUv), vec2(127.1, 311.7))) * 43758.5453123);
        vec2 flakeFract = fract(flakeUv) - 0.5;
        float flakeDot = clamp(1.0 - length(flakeFract) * 2.5, 0.0, 1.0);
        
        // Random normal perturbation for metallic flake orientation
        vec3 flakeNormal = normalize(normal + vec3(
          (fract(flakeHash * 23.1) - 0.5) * 0.65,
          (fract(flakeHash * 47.3) - 0.5) * 0.65,
          (fract(flakeHash * 89.7) - 0.5) * 0.4
        ));
        float flakeSpec = pow(max(0.0, dot(flakeNormal, halfVec)), 42.0);
        float sparkleGlint = step(0.68, flakeHash) * flakeDot * flakeSpec * (0.8 + 0.4 * sin(uTime * 4.0 + flakeHash * 6.28));
        vec3 metallicSparkle = mix(uRimColor, vec3(1.0, 0.88, 0.94), 0.7) * sparkleGlint * 2.2;

        // Metallic reflection sheen
        vec3 metallicSheen = mix(uMidColor, uRimColor, 0.5) * pow(max(0.0, dot(normal, halfVec)), 8.0) * 0.35;

        // Combine lighting with metallic texture & glints
        vec3 finalColor = (surfaceColor + sssColor) * uLightIntensity + rimGlow + neonEdge + vec3(spec) + metallicSheen + metallicSparkle;

        // Bloom radiance boost
        finalColor += uRimColor * (0.012 + 0.008 * sin(uTime * 3.0));

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
 * Dark metallic / lacquered bark material with soft jade specular highlights and energy pulses
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

        // Deep lacquered dark bark base — near-black with warm crimson undertone
        vec3 darkBark = vec3(0.12, 0.05, 0.07);
        
        // Rose-crimson specular sheen
        vec3 lightDir = normalize(uLightPos - vWorldPosition);
        vec3 halfVec = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(normal, halfVec)), 20.0);
        vec3 jadeHighlight = vec3(0.85, 0.24, 0.42) * spec * 0.7;

        // Glowing crimson vein energy wave descending through the stem
        float energyPulse = sin(vUv.x * 20.0 - uTime * 2.5) * 0.5 + 0.5;
        float energyWave = pow(energyPulse, 6.0);
        vec3 pulseColor = vec3(0.95, 0.26, 0.52) * energyWave * 0.85;

        // Rim fresnel on branch contours — metallic rose-gold
        float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.6);
        vec3 rim = vec3(0.96, 0.46, 0.68) * fresnel * 0.85;

        vec3 color = darkBark + jadeHighlight + pulseColor + rim;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

/**
 * Botanical Leaf Shader Material with luminous mint veins and a soft lime rim
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

        // Deep crimson-velvet base
        vec3 leafBase = vec3(0.14, 0.04, 0.08);

        // Delicate rose-metallic veins
        float midrib = 1.0 - smoothstep(0.0, 0.06, abs(vUv.x - 0.5));
        float lateralVeins = sin((vUv.y - abs(vUv.x - 0.5) * 0.5) * 35.0);
        lateralVeins = smoothstep(0.75, 1.0, lateralVeins) * 0.6;

        vec3 veinColor = vec3(0.88, 0.28, 0.52) * (midrib * 0.9 + lateralVeins);

        // Softly lit margin — pale rose-gold shimmer
        float margin = smoothstep(0.78, 0.98, abs(vUv.x - 0.5) * 2.0);
        vec3 marginGlow = vec3(0.98, 0.55, 0.72) * margin * 0.9;

        // Fresnel sheen — metallic pink
        float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.2);
        vec3 sheen = vec3(0.92, 0.38, 0.58) * fresnel * 0.5;

        vec3 finalColor = leafBase + veinColor + marginGlow + sheen;
        gl_FragColor = vec4(finalColor, 0.95);
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
    color: new THREE.Color("#f0c8d8"),      // pale rose-gold
    emissive: new THREE.Color("#c84878"),   // deep crimson radiance
    emissiveIntensity: 1.1,
    roughness: 0.22,
    metalness: 0.72,                        // strong metallic sheen
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
        gl_PointSize = (aScale * 62.0 / -mvPosition.z) * (0.8 + 0.3 * sin(uTime * 3.0 + aPhase));

        // Warm crimson-to-rose-gold metallic sparkle tones
        float t = sin(uTime * 1.2 + aPhase) * 0.5 + 0.5;
        vColor = mix(vec3(0.82, 0.18, 0.42), vec3(1.0, 0.72, 0.82), t);
        vAlpha = 0.26 + 0.18 * sin(uTime * 2.0 + aPhase);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        // Soft circular gaussian bokeh
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float core = 1.0 - smoothstep(0.02, 0.18, dist);
        float halo = exp(-dist * 6.5);
        float intensity = core * 0.8 + halo * 0.38;

        gl_FragColor = vec4(vColor, vAlpha * intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
}
