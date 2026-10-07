import * as fs from "node:fs";
import * as path from "node:path";

import * as THREE from "three";

import { parseModel } from "../load-model";

const GLB = path.resolve(__dirname, "../../../../assets/3d/passport-openable.glb");
const bytes = () => {
  const b = fs.readFileSync(GLB);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const stub = () => ({ data: new Uint8Array(16).fill(255), width: 2, height: 2 }); // stand-in for the Skia decoder

async function load() {
  const model = await parseModel(bytes(), stub);
  const clip = model.animations.find((c) => c.name === "open")!;
  const mixer = new THREE.AnimationMixer(model.root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const at = (open: number) => {
    mixer.setTime(clip.duration * open);
    model.root.updateMatrixWorld(true);
  };
  const mesh = (name: string) => model.root.getObjectByName(name) as THREE.Mesh;
  const centre = (name: string) => new THREE.Box3().setFromObject(mesh(name)).getCenter(new THREE.Vector3());
  const normal = (name: string) => {
    const m = mesh(name);
    return new THREE.Vector3().fromBufferAttribute(m.geometry.getAttribute("normal") as THREE.BufferAttribute, 0).transformDirection(m.matrixWorld);
  };
  return { model, clip, at, centre, normal, mesh };
}

describe("the real passport-openable.glb through the React Native loader path", () => {
  it("has the hinge structure, the interior pages and every material", async () => {
    const { model, mesh } = await load();
    for (const n of ["Passport", "Body", "CoverFront", "InsideLining", "BearerPage"]) expect(model.root.getObjectByName(n)).toBeTruthy();
    expect(mesh("InsideLining").isMesh).toBe(true);
    expect(model.info.materials.sort()).toEqual(["BearerPage", "CoverGlass", "InsideLining", "PageBlock", "Trim"]);
    expect(model.info.triangles).toBe(636);
    expect(model.info.clearcoat).toBe(true); // the leather keeps its clearcoat
  });

  it("builds every embedded texture, including the two interior pages", async () => {
    const { model } = await load();
    expect(model.info.texturesLost).toBe(0);
    expect(model.info.texturesLoaded).toBeGreaterThanOrEqual(5);
  });

  it("carries one 2 second clip called open that moves the root and swings the cover", async () => {
    const { clip } = await load();
    expect(clip.duration).toBeCloseTo(2, 2);
    expect(clip.tracks.map((t) => t.name).sort()).toEqual(["CoverFront.quaternion", "Passport.position"]);
  });

  it("is closed at 0: cover untouched, nothing offset", async () => {
    const { at, mesh, model } = await load();
    at(0);
    const q = mesh("CoverFront").quaternion;
    expect(Math.abs(q.w)).toBeCloseTo(1, 4);
    expect(model.root.getObjectByName("Passport")!.position.x).toBeCloseTo(0, 5);
  });

  it("is a flat, centred two page spread at 1: cover turned 180 degrees, root slid 44 mm", async () => {
    const { at, mesh, model, centre } = await load();
    at(1);
    expect(Math.abs(mesh("CoverFront").quaternion.y)).toBeCloseTo(1, 3); // a half turn about the vertical axis
    expect(model.root.getObjectByName("Passport")!.position.x).toBeCloseTo(0.044, 4);
    const lining = centre("InsideLining");
    const bearer = centre("BearerPage");
    expect(lining.x).toBeCloseTo(-bearer.x, 3); // the two pages sit symmetrically about the screen centre
    expect(bearer.x).toBeGreaterThan(0.03);
    expect(Math.abs(lining.y - bearer.y)).toBeLessThan(1e-4);
  });

  it("interior pages face the viewer when open and are hidden inside the book when closed", async () => {
    const { at, normal, centre } = await load();
    const FRONT_SURFACE = 0.0025; // outer face of the front cover, toward the camera (+Z)
    at(0);
    expect(centre("InsideLining").z).toBeLessThan(FRONT_SURFACE);
    expect(centre("BearerPage").z).toBeLessThan(FRONT_SURFACE); // under the cover, so invisible
    at(1);
    expect(normal("InsideLining").z).toBeGreaterThan(0.99);
    expect(normal("BearerPage").z).toBeGreaterThan(0.99);
  });

  it("the cover never gets ahead of the pages it uncovers: it passes through upright on the way", async () => {
    const { at, mesh } = await load();
    at(0.5);
    const yaw = Math.abs(new THREE.Euler().setFromQuaternion(mesh("CoverFront").quaternion, "YXZ").y);
    expect(yaw).toBeGreaterThan(1.2);
    expect(yaw).toBeLessThan(1.95); // about 90 degrees at the midpoint (ease in/out is symmetric)
  });
});
