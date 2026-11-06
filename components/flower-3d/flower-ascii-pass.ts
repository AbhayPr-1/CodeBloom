import * as THREE from "three";

/**
 * Character ramp ordered strictly by optical fill density,
 * perfectly matching the ASCII code flower in the user's recording:
 *   [0..3]:   ' ', '.', '\'', ','  (faint outer particles / atmosphere)
 *   [4..7]:   ':', ';', '!', '?'  (silhouette boundaries, feather edges)
 *   [8..11]:  '|', '/', '[', ']'  (petal contour lines and folds)
 *   [12..14]: 'n', 'Y', '&'       (petal body and mid-tones)
 *   [15]:     '@'                 (high-luminance petal centers & core)
 */
const ASCII_CHARACTERS = [
  " ",
  ".",
  ":",
  ";",
  "!",
  "1",
  "I",
  "|",
  "/",
  "[",
  "]",
  "n",
  "X",
  "8",
  "&",
  "@",
];

/**
 * Generate an offscreen texture atlas containing the monospace ASCII glyphs.
 */
function createAsciiAtlas(): { texture: THREE.CanvasTexture; count: number } | null {
  if (typeof document === "undefined") return null;

  const charWidth = 32;
  const charHeight = 48;
  const count = ASCII_CHARACTERS.length;

  const canvas = document.createElement("canvas");
  canvas.width = charWidth * count;
  canvas.height = charHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) return null;

  // Solid black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Classic technical monospace font for unmistakable ASCII character silhouettes
  ctx.font = `bold 32px "Courier New", "Consolas", "SF Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";

  for (let i = 0; i < count; i++) {
    const char = ASCII_CHARACTERS[i];
    if (char !== " ") {
      ctx.fillText(char, i * charWidth + charWidth / 2, charHeight / 2 + 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return { texture, count };
}

/**
 * High-performance WebGL Fullscreen Post-Processing ASCII Effect.
 * Converts the 3D botanical world into an interactive real-time ASCII code sculpture,
 * directly matching the user's video recording in character ramp, electric sapphire accents,
 * and screen-space monospace quantization.
 */
export class AsciiPostProcessor {
  private renderer: THREE.WebGLRenderer;
  public renderTarget: THREE.WebGLRenderTarget;
  private postScene: THREE.Scene;
  private postCamera: THREE.OrthographicCamera;
  private postMaterial: THREE.ShaderMaterial;
  private atlasInfo: { texture: THREE.CanvasTexture; count: number } | null = null;
  private isDisposed = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    dpr: number,
    theme: string = "dark"
  ) {
    this.renderer = renderer;

    const renderWidth = Math.max(1, Math.floor(width * dpr));
    const renderHeight = Math.max(1, Math.floor(height * dpr));

    // High precision render target for the 3D scene
    this.renderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      stencilBuffer: false,
      depthBuffer: true,
    });

    this.atlasInfo = createAsciiAtlas();

    const isMobile = width < 768;
    const baseCellX = isMobile ? 7 : 8.5;
    const baseCellY = isMobile ? 12 : 14.5;

    // Fullscreen quad shader material
    this.postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSceneTexture: { value: this.renderTarget.texture },
        uAsciiAtlas: { value: this.atlasInfo?.texture ?? null },
        uNumChars: { value: this.atlasInfo?.count ?? 16 },
        uResolution: { value: new THREE.Vector2(renderWidth, renderHeight) },
        uCellSize: { value: new THREE.Vector2(baseCellX * dpr, baseCellY * dpr) },
        uThemeMode: { value: theme === "light" ? 1.0 : 0.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uSceneTexture;
        uniform sampler2D uAsciiAtlas;
        uniform float uNumChars;
        uniform vec2 uResolution;
        uniform vec2 uCellSize;
        uniform float uThemeMode;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 fragCoord = vUv * uResolution;

          // Align to screen-space monospace character grid
          vec2 cellIndex = floor(fragCoord / uCellSize);
          vec2 cellCenterUv = ((cellIndex + 0.5) * uCellSize) / uResolution;

          // Sample scene at the center of the cell
          vec4 sceneColor = texture2D(uSceneTexture, cellCenterUv);

          // Discard empty background outside the 3D botanical scene.
          // Robust alpha cutoff eliminates drifting spore particles, subpixel edge noise,
          // and characters flickering or popping in and out around the flower boundary.
          if (sceneColor.a < 0.22) {
            discard;
          }

          // Perceived luminance and channel intensity
          float lum = dot(sceneColor.rgb, vec3(0.299, 0.587, 0.114));
          float maxChannel = max(sceneColor.r, max(sceneColor.g, sceneColor.b));
          float intensity = max(lum, maxChannel * 0.88);

          // Discard very low intensity fringes
          if (intensity < 0.03) {
            discard;
          }

          // Dynamic range shaping:
          // Low lighting [0.03..0.15] -> punctuation: ., ', :, ;, !
          // Mid lighting [0.15..0.38] -> structure: |, [, ], n
          // High lighting [0.38..0.62] -> typography: Y, &
          // Peak lighting [> 0.62] -> solid dense bloom: @
          float norm = smoothstep(0.03, 0.66, intensity);
          float density = pow(norm, 0.88) * clamp(sceneColor.a * 1.15, 0.0, 1.0);

          // Multi-tap neighbor sampling for edge detection (petal boundaries & silhouettes)
          vec2 cellStep = uCellSize / uResolution;
          vec4 cL  = texture2D(uSceneTexture, cellCenterUv - vec2(cellStep.x, 0.0));
          vec4 cR  = texture2D(uSceneTexture, cellCenterUv + vec2(cellStep.x, 0.0));
          vec4 cU  = texture2D(uSceneTexture, cellCenterUv + vec2(0.0, cellStep.y));
          vec4 cD  = texture2D(uSceneTexture, cellCenterUv - vec2(0.0, cellStep.y));
          vec4 cLU = texture2D(uSceneTexture, cellCenterUv + vec2(-cellStep.x, cellStep.y));
          vec4 cRU = texture2D(uSceneTexture, cellCenterUv + vec2(cellStep.x, cellStep.y));
          vec4 cLD = texture2D(uSceneTexture, cellCenterUv - vec2(cellStep.x, -cellStep.y));
          vec4 cRD = texture2D(uSceneTexture, cellCenterUv + vec2(cellStep.x, -cellStep.y));

          // 5-point intra-cell sampling to detect if any part of the cell intersects an ink outline:
          vec2 d = cellStep * 0.28;
          vec4 s1 = texture2D(uSceneTexture, cellCenterUv + vec2( d.x,  d.y));
          vec4 s2 = texture2D(uSceneTexture, cellCenterUv + vec2(-d.x,  d.y));
          vec4 s3 = texture2D(uSceneTexture, cellCenterUv + vec2( d.x, -d.y));
          vec4 s4 = texture2D(uSceneTexture, cellCenterUv + vec2(-d.x, -d.y));

          float minCellLum = min(lum, min(min(dot(s1.rgb, vec3(0.299, 0.587, 0.114)),
                                              dot(s2.rgb, vec3(0.299, 0.587, 0.114))),
                                          min(dot(s3.rgb, vec3(0.299, 0.587, 0.114)),
                                              dot(s4.rgb, vec3(0.299, 0.587, 0.114)))));

          float minNeighborAlpha = min(min(min(cL.a, cR.a), min(cU.a, cD.a)), min(min(cLU.a, cRU.a), min(cLD.a, cRD.a)));
          bool isSilhouetteBorder = (sceneColor.a >= 0.25 && minNeighborAlpha < 0.18);

          // Internal edge: samples the dark navy ink outline painted on each petal (lum < 0.22)
          bool isInternalEdge = (minCellLum < 0.22 && sceneColor.a > 0.35);

          bool isPetalOutline = (isSilhouetteBorder || isInternalEdge);

          // Flower central core: center region of screen where flower originates
          vec2 screenCenter = vec2(0.5, 0.44);
          float distToCenter = length((cellCenterUv - screenCenter) * vec2(1.0, uResolution.y / uResolution.x));
          float isFlowerCore = (1.0 - smoothstep(0.04, 0.12, distToCenter)) * smoothstep(0.30, 0.70, sceneColor.a);

          // In Light Mode:
          // Match the user reference blueprint where each petal is clearly delineated:
          // - Petal outlines & creases: rich variety of structural glyphs (X, 8, [, ], |, /) in deep cobalt/navy
          // - Petal interiors: light, open linework (1, I, !, :, .) letting white background breathe through
          // - Central core: rich, dense cluster where petals originate
          if (uThemeMode > 0.5) {
            if (isPetalOutline) {
              float edgeJitter = sin(cellIndex.x * 0.75 + cellIndex.y * 1.25) * 0.10;
              density = clamp(0.74 + edgeJitter + norm * 0.12, 0.62, 0.92);
            } else if (isFlowerCore > 0.22) {
              density = mix(0.55, 0.88, isFlowerCore);
            } else {
              // Delicate interior line shading (maps to ;, !, 1, I)
              float intJitter = sin(cellIndex.x * 1.1 - cellIndex.y * 0.9) * 0.05;
              density = clamp(0.24 + smoothstep(0.40, 0.95, intensity) * 0.12 + intJitter, 0.18, 0.42);
            }
          }

          density = clamp(density, 0.0, 1.0);

          // Calculate character index in the atlas
          float charIdx = floor(density * (uNumChars - 0.001));
          charIdx = clamp(charIdx, 0.0, uNumChars - 1.0);

          // Local UV inside the current character cell: [0, 1]
          vec2 localUv = fract(fragCoord / uCellSize);
          localUv.y = 1.0 - localUv.y; // Flip Y for canvas texture coordinate convention

          // Sample glyph alpha from horizontal atlas
          vec2 atlasUv = vec2((charIdx + localUv.x) / uNumChars, localUv.y);
          float glyphSample = texture2D(uAsciiAtlas, atlasUv).r;

          if (glyphSample < 0.20) {
            discard;
          }

          vec3 charColor;

          if (uThemeMode > 0.5) {
            // LIGHT MODE:
            // Rich royal cobalt/navy (#081d66) outline around petal perimeters,
            // framing delicate sky-blue and ice-blue characters on the petal interior
            // against the pure white background.
            if (isPetalOutline) {
              charColor = vec3(0.03, 0.11, 0.40); // Rich royal cobalt/navy outline
            } else if (isFlowerCore > 0.22) {
              charColor = mix(vec3(0.08, 0.26, 0.78), vec3(0.14, 0.45, 0.92), isFlowerCore);
            } else {
              vec3 lMid  = vec3(0.32, 0.60, 0.95); // soothing sky blue (#5299f2)
              vec3 lHigh = vec3(0.55, 0.78, 0.99); // luminous ice blue (#8cc7fc)
              float t = smoothstep(0.40, 0.90, lum);
              charColor = mix(lMid, lHigh, t);

              // Subtle specular gleam
              charColor += sceneColor.rgb * 0.08;
            }
          } else {
            // DARK MODE:
            // Exact Color Palette derived from reference video:
            // Low:  #072138 -> deep midnight cobalt / navy (borders, punctuation)
            // Mid:  #1b3480 -> rich electric sapphire (body, Y, &)
            // High: #3658bf -> vibrant electric blue (@ petals)
            // Peak: #8b9bcd / #93c5fd -> soothing ice-blue tip / core highlights
            vec3 cLow  = vec3(0.027, 0.129, 0.220); // #072138
            vec3 cMid  = vec3(0.106, 0.204, 0.502); // #1b3480
            vec3 cHigh = vec3(0.212, 0.345, 0.749); // #3658bf
            vec3 cPeak = vec3(0.576, 0.773, 0.992); // #93c5fd

            if (density > 0.75) {
              float t = (density - 0.75) / 0.25;
              charColor = mix(cHigh, cPeak, t);
            } else if (density > 0.30) {
              float t = (density - 0.30) / 0.45;
              charColor = mix(cMid, cHigh, t);
            } else {
              float t = density / 0.30;
              charColor = mix(cLow, cMid, t);
            }

            // Subtle blend with original 3D specular glints for dynamic sparkle
            charColor += sceneColor.rgb * 0.22;
          }

          // Smooth antialiased glyph boundary
          float alpha = smoothstep(0.20, 0.55, glyphSample);
          if (uThemeMode <= 0.5) {
            alpha *= sceneColor.a;
          }

          gl_FragColor = vec4(charColor, alpha);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    // Orthographic fullscreen camera and quad
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    const postQuad = new THREE.Mesh(quadGeometry, this.postMaterial);
    this.postScene.add(postQuad);
  }

  public setTheme(theme: string) {
    if (this.postMaterial) {
      this.postMaterial.uniforms.uThemeMode.value = theme === "light" ? 1.0 : 0.0;
    }
  }

  public setSize(width: number, height: number, dpr: number) {
    const renderWidth = Math.max(1, Math.floor(width * dpr));
    const renderHeight = Math.max(1, Math.floor(height * dpr));

    this.renderTarget.setSize(renderWidth, renderHeight);
    this.postMaterial.uniforms.uResolution.value.set(renderWidth, renderHeight);

    const isMobile = width < 768;
    const baseCellX = isMobile ? 7 : 8.5;
    const baseCellY = isMobile ? 12 : 14.5;
    this.postMaterial.uniforms.uCellSize.value.set(baseCellX * dpr, baseCellY * dpr);
  }

  /**
   * Render the 3D scene to the offscreen target and then display the ASCII character grid.
   */
  public render(scene: THREE.Scene, camera: THREE.Camera, elapsedTime: number) {
    if (this.isDisposed) return;

    // 1. Render 3D botanical world to offscreen target
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    // 2. Render ASCII post-processing pass to the main canvas
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.postMaterial.uniforms.uTime.value = elapsedTime;
    this.postMaterial.uniforms.uSceneTexture.value = this.renderTarget.texture;
    this.renderer.render(this.postScene, this.postCamera);
  }

  public dispose() {
    this.isDisposed = true;
    this.renderTarget.dispose();
    this.postMaterial.dispose();
    if (this.atlasInfo?.texture) {
      this.atlasInfo.texture.dispose();
    }
  }
}
