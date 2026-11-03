import * as THREE from "three";

/**
 * Creates high-detail 3D procedural petal geometry with:
 * - Natural longitudinal arch (curvature from base to tip)
 * - Transverse cupping (cross-sectional curvature)
 * - Organic undulating edges (fractal wave)
 * - Double-sided thickness so it catches specular rim lighting
 */
export function createPetalGeometry(
  length: number = 1.0,
  maxWidth: number = 0.45,
  archAmount: number = 0.35,
  cupAmount: number = 0.25,
  segmentsU: number = 24,
  segmentsV: number = 16,
  curlAmount: number = 0.15
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Front surface grid
  for (let i = 0; i <= segmentsU; i++) {
    const u = i / segmentsU; // 0 = base, 1 = tip

    // Width envelope: narrow base, wide middle, tapered tip
    const widthEnvelope = Math.sin(Math.PI * Math.pow(u, 0.75)) * (1.0 - 0.25 * Math.pow(u, 2.5));
    const currentWidth = maxWidth * widthEnvelope;

    // Longitudinal curve (bending upward and outward)
    const y = length * (u - 0.1 * Math.pow(u, 2.0));
    const zBase = archAmount * (Math.pow(u, 1.8) - 0.2 * u);

    for (let j = 0; j <= segmentsV; j++) {
      const v = (j / segmentsV) * 2.0 - 1.0; // -1 to +1

      // Lateral edge undulation
      const edgeUndulation = Math.sin(u * 14.0 + v * 3.0) * 0.03 * Math.abs(v);
      const x = v * currentWidth + edgeUndulation;

      // Transverse hollow/cup
      const cup = -cupAmount * (1.0 - v * v) * Math.sin(Math.PI * u);
      // Edge curl
      const edgeCurl = Math.pow(Math.abs(v), 2.2) * curlAmount * u;

      const z = zBase + cup + edgeCurl;

      positions.push(x, y, z);
      // Rough initial normals, will computeVertexNormals later
      normals.push(0, 0, 1);
      uvs.push((v + 1.0) * 0.5, u);
    }
  }

  const rowSize = segmentsV + 1;
  for (let i = 0; i < segmentsU; i++) {
    for (let j = 0; j < segmentsV; j++) {
      const a = i * rowSize + j;
      const b = (i + 1) * rowSize + j;
      const c = (i + 1) * rowSize + (j + 1);
      const d = i * rowSize + (j + 1);

      // Two triangles per quad
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Creates 3D leaf geometry with central midrib and ribbed surface
 */
export function createLeafGeometry(
  length: number = 1.2,
  maxWidth: number = 0.55,
  segmentsU: number = 20,
  segmentsV: number = 12
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segmentsU; i++) {
    const u = i / segmentsU;
    const widthFactor = Math.sin(Math.PI * Math.pow(u, 0.8)) * (1.0 - 0.2 * u);
    const w = maxWidth * widthFactor;

    const y = length * u;
    const arch = 0.2 * Math.sin(Math.PI * u);

    for (let j = 0; j <= segmentsV; j++) {
      const v = (j / segmentsV) * 2.0 - 1.0;
      const x = v * w;
      // V-shaped groove at midrib (v = 0)
      const midribCrease = 0.08 * (1.0 - Math.abs(v)) * Math.sin(Math.PI * u);
      const z = arch - midribCrease;

      positions.push(x, y, z);
      uvs.push((v + 1.0) * 0.5, u);
    }
  }

  const rowSize = segmentsV + 1;
  for (let i = 0; i < segmentsU; i++) {
    for (let j = 0; j < segmentsV; j++) {
      const a = i * rowSize + j;
      const b = (i + 1) * rowSize + j;
      const c = (i + 1) * rowSize + (j + 1);
      const d = i * rowSize + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
      // Double sided
      indices.push(d, b, a);
      indices.push(d, c, b);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates an organic closed bud geometry (cluster of overlapping sepals)
 */
export function createBudGeometry(radius: number = 0.35, height: number = 0.85): THREE.BufferGeometry {
  const geom = new THREE.ConeGeometry(radius, height, 16, 12, true);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const normY = (y + height * 0.5) / height; // 0 at bottom, 1 at tip
    // Swell the middle
    const swell = 1.0 + 0.45 * Math.sin(Math.PI * normY);
    pos.setX(i, pos.getX(i) * swell);
    pos.setZ(i, pos.getZ(i) * swell);
  }
  geom.computeVertexNormals();
  return geom;
}

