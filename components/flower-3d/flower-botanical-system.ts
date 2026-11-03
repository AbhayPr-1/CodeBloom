import * as THREE from "three";
import {
  createPetalGeometry,
  createLeafGeometry,
  createBudGeometry,
} from "./flower-geometry";
import {
  createPetalShaderMaterial,
  createBarkMaterial,
  createLeafMaterial,
  createStamenMaterial,
  createSporeParticleMaterial,
} from "./flower-materials";

// Reusable vectors for zero-allocation hot render loop
const _vPetalPos = new THREE.Vector3();
const _vToMouse = new THREE.Vector3();
const _vSpringForce = new THREE.Vector3();
const _vDampingForce = new THREE.Vector3();
const _vAccel = new THREE.Vector3();

interface PetalData {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  tier: number;
  closedRot: THREE.Euler;
  openRot: THREE.Euler;
  closedScale: number;
  openScale: number;
  openDelay: number;
  openDuration: number;
  // Physics springs for cursor interaction
  deflection: THREE.Vector3;
  targetDeflection: THREE.Vector3;
  velocity: THREE.Vector3;
  responsiveness: number;
}

interface LeafData {
  pivot: THREE.Group;
  baseRot: THREE.Euler;
  swayPhase: number;
}

interface BranchData {
  group: THREE.Group;
  baseRot: THREE.Euler;
  phase: number;
}

export class BotanicalWorld {
  public rootGroup: THREE.Group;
  public mainFlowerGroup: THREE.Group;
  public stemGroup: THREE.Group;
  public particlesMesh: THREE.Points | null = null;
  public coreLight: THREE.PointLight;
  public ambientLight: THREE.AmbientLight;
  public rimLight: THREE.DirectionalLight;

  private petals: PetalData[] = [];
  private leaves: LeafData[] = [];
  private branches: BranchData[] = [];
  private sideFlowers: { group: THREE.Group; petals: PetalData[] }[] = [];
  private stemTubes: { mesh: THREE.Mesh; originalScaleY: number }[] = [];
  private materials: THREE.ShaderMaterial[] = [];

  public bloomProgress: number = 0.0; // Begin as a closed bud so the flower blooms automatically on load
  public targetBloomProgress: number = 1.0;
  public bloomSpeed: number = 0.28; // takes ~3.5 seconds for complete cinematic bloom

  private mouse3D: THREE.Vector3 = new THREE.Vector3(999, 999, 0);
  private smoothedMouse3D: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  constructor() {
    this.rootGroup = new THREE.Group();
    this.mainFlowerGroup = new THREE.Group();
    this.stemGroup = new THREE.Group();

    this.rootGroup.add(this.stemGroup);
    this.rootGroup.add(this.mainFlowerGroup);

    // Position main flower in upper hero viewport area, scaled elegantly
    this.mainFlowerGroup.position.set(0, 3.2, 0);
    this.mainFlowerGroup.scale.set(0.72, 0.72, 0.72);
    // Orient flower face directly toward the screen/camera (+Z) as seen in reference images
    this.mainFlowerGroup.rotation.x = 1.44;

    // Lighting setup — crimson/rose-gold metallic palette
    this.ambientLight = new THREE.AmbientLight(0x3a1a22, 0.55);
    this.rootGroup.add(this.ambientLight);

    this.coreLight = new THREE.PointLight(0xe8507a, 2.2, 10, 1.2); // deep rose glow from center
    this.coreLight.position.set(0, 3.2, 0.9);
    this.rootGroup.add(this.coreLight);

    this.rimLight = new THREE.DirectionalLight(0xd83868, 1.3); // crimson rim accent
    this.rimLight.position.set(4, 8, 5);
    this.rootGroup.add(this.rimLight);

    // Build the botanical world
    this.buildMainFlower();
    this.buildVerticalBotanicalTree();
    this.buildSporeParticles();
  }

  /**
   * 1. BUILD THE MAIN FRACTAL FLOWER (100+ Petals across 6 Tiers + 80 Stamens)
   */
  private buildMainFlower() {
    const tierConfigs = [
      // Tier 0: Innermost tight core petals (bright mint)
      { count: 14, length: 0.85, width: 0.38, arch: 0.25, cup: 0.35, tiltOpen: 0.45, tiltClosed: 0.08, delay: 0.55, dur: 0.35, scale: 0.9 },
      // Tier 1: Inner delicate petals
      { count: 16, length: 1.25, width: 0.48, arch: 0.35, cup: 0.30, tiltOpen: 0.72, tiltClosed: 0.12, delay: 0.58, dur: 0.35, scale: 1.0 },
      // Tier 2: Mid-inner petals
      { count: 18, length: 1.70, width: 0.62, arch: 0.45, cup: 0.26, tiltOpen: 0.95, tiltClosed: 0.16, delay: 0.62, dur: 0.35, scale: 1.15 },
      // Tier 3: Mid petals (radiant jade)
      { count: 20, length: 2.20, width: 0.76, arch: 0.55, cup: 0.22, tiltOpen: 1.18, tiltClosed: 0.20, delay: 0.68, dur: 0.32, scale: 1.25 },
      // Tier 4: Outer large petals
      { count: 22, length: 2.75, width: 0.92, arch: 0.65, cup: 0.18, tiltOpen: 1.42, tiltClosed: 0.24, delay: 0.74, dur: 0.26, scale: 1.35 },
      // Tier 5: Outermost sweeping petals (deep green with glowing rims)
      { count: 24, length: 3.35, width: 1.08, arch: 0.78, cup: 0.14, tiltOpen: 1.62, tiltClosed: 0.28, delay: 0.80, dur: 0.20, scale: 1.45 },
    ];

    tierConfigs.forEach((tier, tierIdx) => {
      const mat = createPetalShaderMaterial(tierIdx, tierConfigs.length);
      this.materials.push(mat);

      const geom = createPetalGeometry(
        tier.length,
        tier.width,
        tier.arch,
        tier.cup,
        22,
        14,
        0.18
      );

      // Golden ratio angle distribution for organic fractal symmetry
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));

      for (let i = 0; i < tier.count; i++) {
        const pivot = new THREE.Group();
        const mesh = new THREE.Mesh(geom, mat);

        // Petal offset from base
        mesh.position.set(0, 0, 0);
        pivot.add(mesh);

        const azimuth = (i / tier.count) * Math.PI * 2 + tierIdx * 0.45;
        pivot.rotation.y = azimuth;

        // Closed rotation (pointing almost straight up, slightly tucked into bud)
        const closedRot = new THREE.Euler(tier.tiltClosed, azimuth, 0, "YXZ");
        // Open rotation (flaring outward with graceful pitch)
        const openRot = new THREE.Euler(tier.tiltOpen, azimuth, 0, "YXZ");

        const closedScale = 0.35 + tierIdx * 0.04;
        // Start tucked into the bud; update() animates the petals open.
        pivot.rotation.copy(closedRot);
        pivot.scale.setScalar(closedScale);

        this.mainFlowerGroup.add(pivot);

        this.petals.push({
          pivot,
          mesh,
          tier: tierIdx,
          closedRot,
          openRot,
          closedScale,
          openScale: tier.scale,
          openDelay: tier.delay,
          openDuration: tier.dur,
          deflection: new THREE.Vector3(),
          targetDeflection: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          // Outer petals react more vigorously to mouse proximity
          responsiveness: 0.4 + (tierIdx / tierConfigs.length) * 0.8,
        });
      }
    });

    // 2. BUILD CENTRAL RADIANT STAMENS / PISTILS (80 filaments)
    const stamenMat = createStamenMaterial();
    const stamenGroup = new THREE.Group();
    const stamenCount = 75;

    for (let i = 0; i < stamenCount; i++) {
      const radius = 0.15 + (i / stamenCount) * 0.45;
      const angle = i * 2.39996; // Golden spiral
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const height = 0.45 + (1.0 - radius / 0.6) * 0.35;

      const stamenGeom = new THREE.CylinderGeometry(0.012, 0.018, height, 6);
      const stamenMesh = new THREE.Mesh(stamenGeom, stamenMat);
      stamenMesh.position.set(x, height * 0.5, z);
      stamenMesh.rotation.x = (z / radius) * 0.25;
      stamenMesh.rotation.z = (-x / radius) * 0.25;

      // Anther / dewdrop tip
      const antherGeom = new THREE.SphereGeometry(0.035, 8, 8);
      const antherMesh = new THREE.Mesh(antherGeom, stamenMat);
      antherMesh.position.set(x * 1.08, height + 0.02, z * 1.08);

      stamenGroup.add(stamenMesh);
      stamenGroup.add(antherMesh);
    }

    this.mainFlowerGroup.add(stamenGroup);

    // Glowing core aura disc
    const coreGlowGeom = new THREE.CircleGeometry(0.4, 32);
    const coreGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const coreGlowMesh = new THREE.Mesh(coreGlowGeom, coreGlowMat);
    coreGlowMesh.rotation.x = -Math.PI / 2;
    coreGlowMesh.position.y = 0.05;
    this.mainFlowerGroup.add(coreGlowMesh);
  }

  /**
   * 2. BUILD VERTICAL BOTANICAL TREE EXTENDING ACROSS THE ENTIRE PAGE
   */
  private buildVerticalBotanicalTree() {
    const barkMat = createBarkMaterial();
    this.materials.push(barkMat);

    const leafMat = createLeafMaterial();
    this.materials.push(leafMat);

    // Calyx receptacle connecting flower head to stem
    const calyxGeom = new THREE.ConeGeometry(0.32, 0.55, 16);
    const calyxMesh = new THREE.Mesh(calyxGeom, barkMat);
    calyxMesh.rotation.x = Math.PI;
    calyxMesh.position.set(0, -0.22, 0);
    this.mainFlowerGroup.add(calyxMesh);

    // Main central descending stem spline connecting from behind the flower down to footer
    // Coords span Y: +3.0 down to -15.5, strictly behind the flower (Z <= -0.65)
    const mainStemPoints = [
      new THREE.Vector3(0, 3.0, -0.75),
      new THREE.Vector3(0.1, 1.8, -0.75),
      new THREE.Vector3(-0.25, 0.4, -0.7),
      new THREE.Vector3(0.35, -1.8, -0.65),
      new THREE.Vector3(-0.3, -3.8, -0.6),
      new THREE.Vector3(0.4, -6.0, -0.55),
      new THREE.Vector3(-0.45, -8.5, -0.5),
      new THREE.Vector3(0.3, -11.0, -0.45),
      new THREE.Vector3(-0.2, -13.5, -0.4),
      new THREE.Vector3(0.0, -15.5, -0.35),
    ];

    const mainCurve = new THREE.CatmullRomCurve3(mainStemPoints, false, "centripetal", 0.5);
    const mainStemGeom = new THREE.TubeGeometry(mainCurve, 120, 0.16, 12, false);
    const mainStemMesh = new THREE.Mesh(mainStemGeom, barkMat);
    this.stemGroup.add(mainStemMesh);
    this.stemTubes.push({ mesh: mainStemMesh, originalScaleY: 1.0 });

    // Secondary Branches extending gracefully through each landing page section
    // Placed well below the main flower bloom (Y <= 0.6) and strictly behind (Z <= -0.7)
    // so they NEVER overlap the flower or hero text
    const branchConfigs = [
      // 1. Upper Left Branch: starts below main bloom (Y=0.6) and spreads wide to the left
      {
        points: [
          new THREE.Vector3(0.0, 0.6, -0.75),
          new THREE.Vector3(-1.8, 0.4, -0.9),
          new THREE.Vector3(-3.4, 0.2, -1.05),
          new THREE.Vector3(-4.5, 0.3, -1.2),
        ],
        hasSideFlower: true,
        flowerScale: 0.38,
        leafAngles: [0.35, 0.7],
      },
      // 2. Upper Right Branch: starts below main bloom (Y=0.2) and spreads wide to the right
      {
        points: [
          new THREE.Vector3(0.05, 0.2, -0.7),
          new THREE.Vector3(1.8, 0.0, -0.85),
          new THREE.Vector3(3.2, -0.2, -1.0),
          new THREE.Vector3(4.4, 0.0, -1.15),
        ],
        hasSideFlower: false,
        hasBuds: true,
        leafAngles: [0.35, 0.7],
      },
      // 3. Middle Left Branch (Section 01 Story stage)
      {
        points: [
          new THREE.Vector3(-0.2, -1.2, -0.65),
          new THREE.Vector3(-1.6, -1.0, -0.75),
          new THREE.Vector3(-2.8, -0.8, -0.85),
          new THREE.Vector3(-3.8, -0.6, -0.95),
        ],
        hasSideFlower: true,
        flowerScale: 0.35,
        leafAngles: [0.4, 0.75],
      },
      // 4. Middle Right Branch (Section 02 Numbers)
      {
        points: [
          new THREE.Vector3(0.3, -3.2, -0.6),
          new THREE.Vector3(1.6, -3.0, -0.7),
          new THREE.Vector3(2.9, -2.7, -0.8),
          new THREE.Vector3(3.8, -2.5, -0.9),
        ],
        hasSideFlower: false,
        hasBuds: true,
        leafAngles: [0.3, 0.68],
      },
      // 5. Lower Left Branch (Section 03 Works)
      {
        points: [
          new THREE.Vector3(-0.1, -5.6, -0.55),
          new THREE.Vector3(-1.4, -5.4, -0.65),
          new THREE.Vector3(-2.6, -5.0, -0.75),
          new THREE.Vector3(-3.6, -4.8, -0.85),
        ],
        hasSideFlower: true,
        flowerScale: 0.36,
        leafAngles: [0.35, 0.72],
      },
      // 6. Lower Right Branch (Section 04 Discovery)
      {
        points: [
          new THREE.Vector3(0.2, -8.0, -0.5),
          new THREE.Vector3(1.6, -7.8, -0.6),
          new THREE.Vector3(2.9, -7.4, -0.7),
          new THREE.Vector3(3.8, -7.1, -0.8),
        ],
        hasSideFlower: false,
        hasBuds: true,
        leafAngles: [0.38, 0.76],
      },
      // 7. Base Root Extensions framing footer
      {
        points: [
          new THREE.Vector3(0.0, -13.0, -0.4),
          new THREE.Vector3(-1.4, -14.2, -0.5),
          new THREE.Vector3(-2.8, -15.4, -0.6),
        ],
        hasSideFlower: false,
        hasBuds: true,
        leafAngles: [0.5],
      },
      {
        points: [
          new THREE.Vector3(0.1, -13.2, -0.4),
          new THREE.Vector3(1.5, -14.4, -0.5),
          new THREE.Vector3(2.9, -15.6, -0.6),
        ],
        hasSideFlower: false,
        hasBuds: true,
        leafAngles: [0.5],
      },
    ];

    branchConfigs.forEach((cfg, bIdx) => {
      const curve = new THREE.CatmullRomCurve3(cfg.points, false, "centripetal", 0.5);
      const tubeGeom = new THREE.TubeGeometry(curve, 40, 0.08, 8, false);
      const branchMesh = new THREE.Mesh(tubeGeom, barkMat);
      
      const branchGroup = new THREE.Group();
      branchGroup.add(branchMesh);
      this.stemGroup.add(branchGroup);

      this.branches.push({
        group: branchGroup,
        baseRot: branchGroup.rotation.clone(),
        phase: bIdx * 1.1,
      });

      // Add Leaves along the branch
      const leafGeom = createLeafGeometry(0.85, 0.38, 16, 10);
      cfg.leafAngles.forEach((u, leafIdx) => {
        const point = curve.getPoint(u);
        const tangent = curve.getTangent(u);

        const leafPivot = new THREE.Group();
        leafPivot.position.copy(point);

        const leafMesh = new THREE.Mesh(leafGeom, leafMat);
        // Tilt leaf away from branch tangent
        const sideSign = leafIdx % 2 === 0 ? 1 : -1;
        leafMesh.rotation.z = 0.5 * sideSign;
        leafMesh.rotation.x = 0.3;
        leafPivot.add(leafMesh);

        // Orient along tangent
        leafPivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
        branchGroup.add(leafPivot);

        this.leaves.push({
          pivot: leafPivot,
          baseRot: leafPivot.rotation.clone(),
          swayPhase: bIdx * 2.0 + leafIdx * 1.5,
        });
      });

      // Branch tip element: either a blooming mini-flower or glowing bud
      const tipPoint = cfg.points[cfg.points.length - 1];
      const tipTangent = curve.getTangent(1.0);

      if (cfg.hasSideFlower) {
        // Build mini blooming flower on this branch!
        const sideFlowerGroup = new THREE.Group();
        sideFlowerGroup.position.copy(tipPoint);
        sideFlowerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipTangent);
        sideFlowerGroup.scale.setScalar(cfg.flowerScale ?? 0.4);

        const sidePetals = this.buildMiniFlower(sideFlowerGroup);
        branchGroup.add(sideFlowerGroup);
        this.sideFlowers.push({ group: sideFlowerGroup, petals: sidePetals });
      } else {
        // Build glowing bud at tip
        const budGeom = createBudGeometry(0.18, 0.45);
        const budMat = createPetalShaderMaterial(1, 4);
        this.materials.push(budMat);

        const budMesh = new THREE.Mesh(budGeom, budMat);
        budMesh.position.copy(tipPoint);
        budMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipTangent);
        branchGroup.add(budMesh);
      }
    });
  }

  /**
   * Helper to build a mini blooming flower at a branch tip
   */
  private buildMiniFlower(parent: THREE.Group): PetalData[] {
    const petals: PetalData[] = [];
    const tiers = [
      { count: 10, length: 1.0, width: 0.42, tiltOpen: 0.65, tiltClosed: 0.1, delay: 0.45, dur: 0.35, scale: 0.9 },
      { count: 12, length: 1.4, width: 0.55, tiltOpen: 1.15, tiltClosed: 0.18, delay: 0.52, dur: 0.32, scale: 1.1 },
      { count: 14, length: 1.8, width: 0.68, tiltOpen: 1.48, tiltClosed: 0.24, delay: 0.60, dur: 0.28, scale: 1.2 },
    ];

    tiers.forEach((t, tIdx) => {
      const mat = createPetalShaderMaterial(tIdx + 1, 5);
      this.materials.push(mat);
      const geom = createPetalGeometry(t.length, t.width, 0.4, 0.22, 16, 10, 0.15);

      for (let i = 0; i < t.count; i++) {
        const pivot = new THREE.Group();
        const mesh = new THREE.Mesh(geom, mat);
        pivot.add(mesh);

        const azimuth = (i / t.count) * Math.PI * 2 + tIdx * 0.5;
        pivot.rotation.y = azimuth;

        const closedRot = new THREE.Euler(t.tiltClosed, azimuth, 0, "YXZ");
        const openRot = new THREE.Euler(t.tiltOpen, azimuth, 0, "YXZ");

        const closedScale = 0.32;
        pivot.rotation.copy(closedRot);
        pivot.scale.setScalar(closedScale);
        parent.add(pivot);

        petals.push({
          pivot,
          mesh,
          tier: tIdx,
          closedRot,
          openRot,
          closedScale,
          openScale: t.scale,
          openDelay: t.delay,
          openDuration: t.dur,
          deflection: new THREE.Vector3(),
          targetDeflection: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          responsiveness: 0.5,
        });
      }
    });

    return petals;
  }

  /**
   * 3. BUILD LUMINOUS PARTICLES / BOTANICAL FIREFLIES
   */
  private buildSporeParticles() {
    const particleCount = 240;
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // Concentrate a halo around the hero flower; leave the rest drifting along the stem.
      const isHeroParticle = i < 120;
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.2 + Math.random() * 1.1;
      const x = isHeroParticle
        ? Math.cos(angle) * radius
        : (Math.random() - 0.5) * 8.5;
      const y = isHeroParticle
        ? 3.2 + Math.sin(angle) * radius * 0.82 + (Math.random() - 0.5) * 0.6
        : (Math.random() * 22) - 16;
      const z = isHeroParticle
        ? 1.1 + Math.random() * 1.2
        : (Math.random() - 0.5) * 6.0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      scales[i] = isHeroParticle
        ? 0.85 + Math.random() * 0.8
        : 0.45 + Math.random() * 0.65;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    geom.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const mat = createSporeParticleMaterial();
    this.materials.push(mat);

    this.particlesMesh = new THREE.Points(geom, mat);
    this.particlesMesh.renderOrder = 3;
    this.rootGroup.add(this.particlesMesh);
  }

  /**
   * Set target cursor position in 3D world space
   */
  public setMousePosition(x: number, y: number, camera: THREE.Camera) {
    // Project screen mouse (-1 to +1) to 3D plane at z=0
    const vec = new THREE.Vector3(x, y, 0.5);
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    const distance = -camera.position.z / vec.z;
    this.mouse3D.copy(camera.position).add(vec.multiplyScalar(distance));
  }

  /**
   * Trigger replay of the blooming animation from closed bud to full bloom
   */
  public replayBloom() {
    this.bloomProgress = 0.0;
    this.targetBloomProgress = 1.0;
  }

  /**
   * Master Update Frame Loop
   */
  public update(delta: number, elapsedTime: number, scrollProgress: number) {
    // Smooth bloom progression
    if (this.bloomProgress < this.targetBloomProgress) {
      this.bloomProgress = Math.min(
        this.targetBloomProgress,
        this.bloomProgress + delta * this.bloomSpeed
      );
    } else if (this.bloomProgress > this.targetBloomProgress) {
      this.bloomProgress = Math.max(
        this.targetBloomProgress,
        this.bloomProgress - delta * this.bloomSpeed
      );
    }

    // Update uniform values across all materials
    this.materials.forEach((mat) => {
      if (mat.uniforms.uTime) mat.uniforms.uTime.value = elapsedTime;
      if (mat.uniforms.uBloomProgress) mat.uniforms.uBloomProgress.value = this.bloomProgress;
      if (mat.uniforms.uLightIntensity) {
        // Intensity brightens as blooming completes
        mat.uniforms.uLightIntensity.value = 0.7 + 0.6 * this.bloomProgress;
      }
    });

    // Core light pulse
    const corePulse = Math.sin(elapsedTime * 2.8) * 0.4 + 1.0;
    this.coreLight.intensity = (2.0 + corePulse * 1.8) * (0.3 + 0.7 * this.bloomProgress);

    // Smooth mouse coordinates
    this.smoothedMouse3D.lerp(this.mouse3D, 0.08);

    // Update Main Flower Petals
    this.updatePetalsList(this.petals, this.mainFlowerGroup, delta, elapsedTime);

    // Update Side Flowers Petals
    this.sideFlowers.forEach((sf) => {
      this.updatePetalsList(sf.petals, sf.group, delta, elapsedTime);
    });

    // Animate Leaves (gentle breeze flutter + proximity reaction)
    this.leaves.forEach((leaf) => {
      const flutter = Math.sin(elapsedTime * 2.0 + leaf.swayPhase) * 0.06;
      leaf.pivot.rotation.x = leaf.baseRot.x + flutter;
      leaf.pivot.rotation.z = leaf.baseRot.z + flutter * 0.5;
    });

    // Animate Branches (natural organic sway)
    this.branches.forEach((branch) => {
      const sway = Math.sin(elapsedTime * 1.4 + branch.phase) * 0.035;
      branch.group.rotation.z = branch.baseRot.z + sway;
    });

    // Subtle breathing rotation on main flower facing the screen
    const flowerBreath = Math.sin(elapsedTime * 0.8) * 0.02;
    this.mainFlowerGroup.rotation.x = 1.44 + Math.sin(elapsedTime * 0.6) * 0.015;
    this.mainFlowerGroup.rotation.y = flowerBreath;
    this.mainFlowerGroup.rotation.z = Math.cos(elapsedTime * 0.6) * 0.015;

    // Stem growth scaling during bud-to-bloom Stage 1 & 2
    const stemGrowScale = Math.min(1.0, 0.4 + this.bloomProgress * 0.8);
    this.stemGroup.scale.set(stemGrowScale, stemGrowScale, stemGrowScale);
  }

  /**
   * Update petal kinematics and physics
   */
  private updatePetalsList(
    petalList: PetalData[],
    parentGroup: THREE.Group,
    delta: number,
    elapsedTime: number
  ) {
    const isFullyBloomed = this.bloomProgress >= 0.999;

    petalList.forEach((p) => {
      let ease = 1.0;
      let currentPitch = p.openRot.x;
      let currentScale = p.openScale;

      if (!isFullyBloomed) {
        const progress = Math.max(0, Math.min(1, (this.bloomProgress - p.openDelay) / p.openDuration));
        ease = 1 - Math.pow(1 - progress, 3);
        currentPitch = THREE.MathUtils.lerp(p.closedRot.x, p.openRot.x, ease);
        currentScale = THREE.MathUtils.lerp(p.closedScale, p.openScale, ease);
      }

      // Check distance to mouse using reusable vector (zero garbage collection)
      p.mesh.getWorldPosition(_vPetalPos);
      _vToMouse.subVectors(_vPetalPos, this.smoothedMouse3D);
      const dist = _vToMouse.length();
      const interactionRadius = 2.8;

      if (dist < interactionRadius && dist > 0.01) {
        const force = (1.0 - dist / interactionRadius) * 0.45 * p.responsiveness;
        p.targetDeflection.set(
          _vToMouse.x * force * 0.3,
          _vToMouse.y * force * 0.3,
          -force * 0.5
        );
      } else {
        p.targetDeflection.set(0, 0, 0);
      }

      // Spring-damper integration in-place
      const springK = 28.0;
      const damping = 7.5;
      _vSpringForce.subVectors(p.targetDeflection, p.deflection).multiplyScalar(springK);
      _vDampingForce.copy(p.velocity).multiplyScalar(damping);
      _vAccel.subVectors(_vSpringForce, _vDampingForce);

      p.velocity.addScaledVector(_vAccel, delta);
      p.deflection.addScaledVector(p.velocity, delta);

      // Apply combined rotation
      const breezeWave = Math.sin(elapsedTime * 2.2 + p.tier * 0.8) * 0.02 * ease;
      p.pivot.rotation.x = currentPitch + breezeWave + p.deflection.z;
      p.pivot.rotation.z = p.deflection.x * 0.5;
      p.pivot.scale.setScalar(currentScale);
    });
  }

  public setTheme(theme: "dark" | "light") {
    if (theme === "light") {
      this.ambientLight.color.setHex(0xf7d0df);
      this.ambientLight.intensity = 0.88;
      this.coreLight.intensity = 2.4;
      this.rimLight.intensity = 1.35;
    } else {
      this.ambientLight.color.setHex(0x3a1a22);
      this.ambientLight.intensity = 0.55;
      this.coreLight.intensity = 2.2;
      this.rimLight.intensity = 1.3;
    }
  }

  public dispose() {
    this.materials.forEach((m) => m.dispose());
  }
}
