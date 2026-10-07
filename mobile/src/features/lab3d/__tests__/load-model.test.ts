import * as fs from "node:fs";
import * as path from "node:path";

import * as THREE from "three";

import { parseModel } from "../load-model";

const GLB = path.resolve(__dirname, "../../../../assets/3d/passport.glb");
const bytes = () => {
  const b = fs.readFileSync(GLB);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
// A stand-in for Skia: a 2x2 opaque image, so the real texture path runs without a device.
const stub = () => ({ data: new Uint8Array(16).fill(255), width: 2, height: 2 });

describe("the real passport.glb through the React Native loader path", () => {
  it("loads 632 triangles and three named materials", async () => {
    const { info } = await parseModel(bytes(), stub);
    expect(info.triangles).toBe(632);
    expect(info.materials.sort()).toEqual(["CoverGlass", "PageBlock", "Trim"]);
  });

  it("keeps the clearcoat: CoverGlass becomes a MeshPhysicalMaterial with clearcoat", async () => {
    const { info, root } = await parseModel(bytes(), stub);
    expect(info.clearcoat).toBe(true);
    let found = false;
    root.traverse((o) => {
      const m = (o as { material?: { name: string; isMeshPhysicalMaterial?: boolean; clearcoat?: number } }).material;
      if (m?.name === "CoverGlass") found = !!m.isMeshPhysicalMaterial && (m.clearcoat ?? 0) > 0;
    });
    expect(found).toBe(true);
  });

  it("builds every embedded texture through the plugin (normal, roughness/occlusion/metal, page edge)", async () => {
    const { info, root } = await parseModel(bytes(), stub);
    expect(info.texturesLost).toBe(0);
    expect(info.texturesLoaded).toBeGreaterThanOrEqual(3);
    const maps = new Set<string>();
    root.traverse((o) => {
      const m = (o as { material?: Record<string, unknown> }).material;
      if (m) for (const k of ["normalMap", "metalnessMap", "roughnessMap", "aoMap", "map"]) if (m[k]) maps.add(k);
    });
    expect(maps.has("normalMap")).toBe(true);
    expect(maps.has("map")).toBe(true);
    expect(maps.has("roughnessMap")).toBe(true);
  });

  it("reports lost textures instead of failing when decoding fails", async () => {
    const { info } = await parseModel(bytes(), () => null);
    expect(info.texturesLoaded).toBe(0);
    expect(info.texturesLost).toBeGreaterThan(0);
    expect(info.triangles).toBe(632);
  });

  it("has the documented size, 0.088 x 0.125 x 0.005 m, centered", async () => {
    const { root } = await parseModel(bytes(), stub);
    const box = new THREE.Box3().setFromObject(root);
    const s = box.getSize(new THREE.Vector3());
    expect([s.x, s.y, s.z].map((v) => Math.round(v * 1000) / 1000)).toEqual([0.088, 0.125, 0.005]);
    const c = box.getCenter(new THREE.Vector3());
    expect(Math.max(Math.abs(c.x), Math.abs(c.y), Math.abs(c.z))).toBeLessThan(0.002);
  });
});
