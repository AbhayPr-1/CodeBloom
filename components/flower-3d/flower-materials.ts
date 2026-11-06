import * as THREE from "three";

/**
 * Custom GLSL Shader for the Fractal Petals:
 * Soothing, toned-down Electric/Sapphire Blue with fine pearlescent micro-sparkle texture
 * matching the user's liquid glitter swirl reference.
 * Calibrated to be calm, velvety, and soothing in both dark and light modes.
 */
export function createPetalShaderMaterial(tierIndex: number = 0, totalTiers: number = 6): THREE.ShaderMaterial {
  const tierRatio = tierIndex / Math.max(1, totalTiers - 1);

  // Soothing, toned-down Sapphire / Cerulean palette
  // Base: deep, calm midnight sapphire shadows
  const baseColors = [
    new THREE.Color("#08142b"), // tier 0 — deep velvety midnight sapphire
    new THREE.Color("#0b1a37"),
    new THREE.Color("#0e2144"),
    new THREE.Color("#122852"),
    new THREE.Color("#173062"),
    new THREE.Color("#1d3a73"), // tier 5 — rich soothing cobalt base
  ];

  // Mid: calming, silky cerulean/sapphire petal body (soothing to the eyes)
  const midColors = [
    new THREE.Color("#193a73"), // inner: muted royal blue
    new THREE.Color("#1f4689"),
    new THREE.Color("#2653a0"),
    new THREE.Color("#3062b6"),
    new THREE.Color("#3c72cd"),
    new THREE.Color("#4a83e0"), // outer: soft cerulean blue
  ];

  // Rims: gentle ice-azure highlights
  const rimColors = [
    new THREE.Color("#1e40af"), // tier 0: sapphire rim
    new THREE.Color("#2563eb"),
    new THREE.Color("#3b82f6"),
    new THREE.Color("#60a5fa"),
    new THREE.Color("#7dd3fc"),
    new THREE.Color("#93c5fd"), // tier 5: soft ice-blue rim
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
      uCoreLightPos: { value: new THREE.Vector3(0, 3.2, 0.8) },
      uBackLightPos: { value: new THREE.Vector3(0, 3.2, -1.8) },
      uBackLightColor: { value: new THREE.Color("#2563eb") }, // Soft, calm sapphire backlight
      uLightIntensity: { value: 0.70 },
      uBloomProgress: { value: 0.0 },
      uFresnelPower: { value: 2.4 - tierRatio * 0.4 },
      uOpacity: { value: 0.95 },
      uSubsurfaceStrength: { value: 0.38 },
      uThemeMode: { value: 0.0 },
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
        float flutter = sin(uTime * 2.0 + uv.y * 6.0 + uv.x * 4.0) * 0.012 * uv.y;
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
      uniform vec3 uBackLightPos;
      uniform vec3 uBackLightColor;
      uniform float uTime;
      uniform float uLightIntensity;
      uniform float uBloomProgress;
      uniform float uFresnelPower;
      uniform float uOpacity;
      uniform float uSubsurfaceStrength;
      uniform float uThemeMode;

      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      // Pseudo-random 2D hash for fine micro-flake glitter
      float sparkleHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      // Procedural micro-sparkle texture matching user's glitter swirl reference
      float getMicroSparkle(vec2 uv, vec3 viewDir, vec3 normal, float time) {
        vec2 grid = uv * 240.0;
        vec2 id = floor(grid);
        float n = sparkleHash(id);

        // Isolated fine diamond/mica specks
        if (n < 0.94) return 0.0;

        // Randomized facet normal for twinkling gleams
        vec3 randFacet = vec3(
          sparkleHash(id + 1.3) - 0.5,
          sparkleHash(id + 3.7) - 0.5,
          sparkleHash(id + 6.1) - 0.5
        );
        vec3 flakeNormal = normalize(normal + randFacet * 0.65);
        float flakeSpec = pow(max(0.0, dot(flakeNormal, viewDir)), 32.0);

        // Gentle sinusoidal twinkle
        float twinkle = sin(time * 2.0 + n * 6.28) * 0.35 + 0.65;

        return flakeSpec * twinkle * 1.5;
      }

      // Soft mica shimmer grain across liquid paint swirls
      float getMicaGrain(vec2 uv) {
        vec2 grid = uv * 140.0;
        float h = sparkleHash(floor(grid));
        return (h - 0.5) * 0.032;
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Two-sided normal adjustment
        if (!gl_FrontFacing) {
          normal = -normal;
        }

        // 1. Soothing Blue Curvature Shading (soft, calm, silky)
        float tipFactor = smoothstep(0.04, 0.96, vUv.y);
        vec3 surfaceColor = mix(uBaseColor, uMidColor, tipFactor);

        // Soft curvature depth along petal rib
        float edgeDist = abs(vUv.x - 0.5) * 2.0; // 0 at center, 1 at edges
        surfaceColor = mix(surfaceColor, uBaseColor * 0.88, (1.0 - edgeDist) * 0.25);

        // Subtle mica swirl texture
        float mica = getMicaGrain(vUv);
        surfaceColor += vec3(mica * 0.6, mica * 0.9, mica * 1.3);

        // 2. SOFT BLUE RIM & BACKLIGHT (Toned down, soothing)
        vec3 backLightDir = normalize(uBackLightPos - vWorldPosition);
        
        // Smooth Fresnel rim outlining the petals in soft blue light
        float NdotV = max(0.0, dot(normal, viewDir));
        float fresnel = pow(1.0 - NdotV, uFresnelPower);
        
        // Gentle backlight transmission along thin petal edges
        float backScatter = max(0.0, dot(viewDir, backLightDir)) * uSubsurfaceStrength * smoothstep(0.38, 0.98, edgeDist);
        vec3 backlightGlow = uBackLightColor * backScatter * 0.78;

        // Clean subtle electric blue bevel groove outline
        float rimStroke = smoothstep(0.86, 0.995, edgeDist) * smoothstep(0.05, 0.96, vUv.y);
        vec3 blueRim = uRimColor * rimStroke * 0.70;

        // Soft ice-blue Fresnel edge reflection
        vec3 rimFresnel = uRimColor * fresnel * 0.52;

        // 3. Satin Specular Sheen (soft, pleasing to the eyes)
        vec3 frontLightDir = normalize(uCoreLightPos - vWorldPosition);
        vec3 halfVec = normalize(frontLightDir + viewDir);
        float bodySpec = pow(max(0.0, dot(normal, halfVec)), 28.0) * 0.35;
        vec3 electricSheen = mix(vec3(0.85, 0.92, 1.0), uRimColor, 0.35) * bodySpec;

        // 4. PEARLESCENT MICRO-SPARKLE TEXTURE (Matching user reference image)
        // "Just a little bit of sparkle around the petals"
        float sparkle = getMicroSparkle(vUv, viewDir, normal, uTime);
        float sparkleMask = smoothstep(0.06, 0.92, vUv.y) * (0.55 + 0.45 * edgeDist);
        vec3 diamondSparkle = mix(vec3(0.65, 0.85, 1.0), vec3(1.0), 0.75) * sparkle * sparkleMask;

        // 5. Balanced composition: soothing sapphire body with soft sparkling highlights
        vec3 diffuse = surfaceColor * uLightIntensity;
        vec3 ambient = surfaceColor * 0.30;

        vec3 combined = diffuse + ambient + rimFresnel + blueRim + backlightGlow + electricSheen + diamondSparkle;

        // In Light Mode:
        // Luminous mild electric sky-blue petal interior with crisp midnight-navy ink outlines
        // matching the user's reference blueprint where each petal is distinct and easily distinguishable
        if (uThemeMode > 0.5) {
          // Petal perimeter margins and tip
          float lateralStroke = smoothstep(0.70, 0.985, edgeDist);
          float tipStroke = smoothstep(0.86, 0.998, vUv.y);
          // Silhouette glancing edge contour
          float silhouette = pow(1.0 - NdotV, 1.8);
          // Base fold crease
          float baseStroke = (1.0 - smoothstep(0.0, 0.15, vUv.y)) * 0.85;
          // Center ridge fold
          float centerSpine = (1.0 - smoothstep(0.0, 0.04, abs(vUv.x - 0.5))) * 0.35;

          float inkOutline = clamp(max(lateralStroke, max(tipStroke, silhouette * 0.95)), 0.0, 1.0);
          inkOutline = max(inkOutline, max(baseStroke, centerSpine));

          // Mild electric sky-blue petal body with luminous highlights
          vec3 baseShadow = vec3(0.12, 0.32, 0.75); // rich sapphire crease
          vec3 midBody    = vec3(0.35, 0.62, 0.94); // mild electric blue
          vec3 tipGlow    = vec3(0.60, 0.82, 0.98); // ice-azure tip

          vec3 lightBody = mix(baseShadow, midBody, smoothstep(0.05, 0.50, vUv.y));
          lightBody = mix(lightBody, tipGlow, smoothstep(0.50, 0.98, vUv.y));

          // Soft satin sheen & subtle mica twinkle
          lightBody += electricSheen * 0.40 + diamondSparkle * 0.30;

          // Crisp deep royal midnight-navy outline (lum ~0.08)
          vec3 inkOutlineColor = vec3(0.02, 0.06, 0.20);
          combined = mix(lightBody, inkOutlineColor, inkOutline);
        }
        
        // Smooth highlight rolloff to avoid harsh glare
        vec3 finalColor = clamp(combined, 0.0, 0.96);

        float alpha = uOpacity * (0.88 + 0.12 * fresnel);

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
 * Dark liquid titanium / polished chrome bark material with subtle sapphire blue starlight pulses
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

        // Deep sapphire-cobalt bark base
        vec3 darkBark = vec3(0.08, 0.15, 0.30);
        
        // Soft electric satin specular sheen
        vec3 lightDir = normalize(uLightPos - vWorldPosition);
        vec3 halfVec = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(normal, halfVec)), 26.0);
        vec3 platinumHighlight = vec3(0.75, 0.88, 1.0) * spec * 0.50;

        // Mild electric blue energy pulse travelling down the stem
        float energyPulse = sin(vUv.x * 20.0 - uTime * 2.5) * 0.5 + 0.5;
        float energyWave = pow(energyPulse, 5.0);
        vec3 pulseColor = vec3(0.22, 0.62, 1.0) * energyWave * 0.45;

        // Soft electric blue rim fresnel outlining tubular contours
        float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.5);
        vec3 rim = vec3(0.25, 0.68, 1.0) * fresnel * 0.55;

        vec3 color = darkBark + platinumHighlight + pulseColor + rim;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

/**
 * Botanical Leaf Shader Material with dark titanium surface & delicate sapphire blue veins
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

        // Mild electric blue leaf base
        vec3 leafBase = vec3(0.10, 0.22, 0.46);

        // Luminous cerulean veins
        float midrib = 1.0 - smoothstep(0.0, 0.06, abs(vUv.x - 0.5));
        float lateralVeins = sin((vUv.y - abs(vUv.x - 0.5) * 0.5) * 35.0);
        lateralVeins = smoothstep(0.75, 1.0, lateralVeins) * 0.55;

        vec3 veinColor = vec3(0.24, 0.68, 1.0) * (midrib * 0.70 + lateralVeins * 0.45);

        // Delicate electric blue margin glow
        float margin = smoothstep(0.78, 0.98, abs(vUv.x - 0.5) * 2.0);
        vec3 marginGlow = vec3(0.28, 0.72, 1.0) * margin * 0.65;

        // Soft electric blue fresnel sheen
        float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.3);
        vec3 sheen = vec3(0.70, 0.85, 1.0) * fresnel * 0.45;

        vec3 finalColor = leafBase + veinColor + marginGlow + sheen;
        gl_FragColor = vec4(finalColor, 0.96);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/**
 * Radiant Stamen / Pistil Core Material: Soft Satin Platinum with Subtle Sapphire Center
 */
export function createStamenMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#3b82f6"),      // mild electric blue
    emissive: new THREE.Color("#2563eb"),   // mild electric sapphire core glow
    emissiveIntensity: 1.1,
    roughness: 0.22,
    metalness: 0.85,
  });
}

/**
 * Botanical spore / firefly floating particle material: Gentle sapphire & starlight motes
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
        gl_PointSize = (aScale * 50.0 / -mvPosition.z) * (0.8 + 0.3 * sin(uTime * 3.0 + aPhase));

        // Gentle sapphire blue & soft starlight motes
        float t = sin(uTime * 1.2 + aPhase) * 0.5 + 0.5;
        vColor = mix(vec3(0.16, 0.55, 0.95), vec3(0.82, 0.88, 0.96), t);
        vAlpha = 0.26 + 0.14 * sin(uTime * 2.0 + aPhase);
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
        float intensity = core * 0.78 + halo * 0.32;

        gl_FragColor = vec4(vColor, vAlpha * intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
}

/**
 * 3D Background Illumination Corona Material:
 * Soft, atmospheric deep cobalt/sapphire halo pleasing to the eyes
 */
export function createBackgroundHaloMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGlowColor: { value: new THREE.Color("#0c152e") }, // Deep cosmic midnight blue
      uCoreColor: { value: new THREE.Color("#1e40af") }, // Soft royal sapphire core
      uBloomProgress: { value: 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uGlowColor;
      uniform vec3 uCoreColor;
      uniform float uBloomProgress;
      varying vec2 vUv;

      void main() {
        vec2 center = vUv - 0.5;
        float dist = length(center) * 2.0;
        if (dist > 1.0) discard;

        // Gentle, soft radial diffusion
        float pulse = sin(uTime * 1.4) * 0.04 + 0.96;
        float coreFalloff = pow(clamp(1.0 - dist, 0.0, 1.0), 2.6) * pulse;
        float softAura = pow(clamp(1.0 - dist, 0.0, 1.0), 4.0);

        vec3 haloColor = mix(uGlowColor, uCoreColor, pow(clamp(1.0 - dist * 1.2, 0.0, 1.0), 1.8));
        float alpha = (coreFalloff * 0.28 + softAura * 0.16) * (0.55 + 0.25 * uBloomProgress);

        gl_FragColor = vec4(haloColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
