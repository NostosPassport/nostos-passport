/**
 * The three.js side of the 3D passport lab: renderer on an expo-gl context, the real model, a studio environment, the
 * glass (clearcoat, or a fake cube reflection), the fake shadow, and a complete dispose. No React in here. This file
 * needs a phone to run (expo-gl), so its logic is kept thin and the decisions live in the tested modules next to it.
 */
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import type { ExpoWebGLRenderingContext } from "expo-gl";
import * as THREE from "three";

import { createViewportSizer } from "./viewport";
import { colors, scene3d } from "@/theme";
import { type EnvChoice, type GlassChoice, type GlassMode, chooseEnvironment, chooseGlass, describeAssets } from "./asset-select";
import { withoutWebGL1Global, guardUnimplemented, createCompatLog } from "./gl-compat";
import { decodeImage, flipRows } from "./decode-image";
import { parseModel } from "./load-model";
import { cameraDistance, facingAngle, motionShare, shadowSpread } from "./open-motion";
import { shadowWidthRatio } from "./rotation";
import { buildCubeFace, buildEquirect } from "./studio-env";

// Metro asset ids (.glb is an asset type, see metro.config.js).
import MODEL from "../../../assets/3d/passport-openable.glb";
import ENV_IMAGE from "../../../assets/3d/studio-env.jpg";

/** `open` is how far the passport is open: 0 closed, 1 the flat two-page spread (scrubs the model's `open` clip). */
export type Pose = { angle: number; tiltX: number; tiltY: number; bob: number; open: number };

export type StageInfo = {
  loadMs: number;
  triangles: number;
  assets: string;
  env: EnvChoice;
  glass: GlassChoice;
  clearcoatInModel: boolean;
  pmremOk: boolean;
  texturesLoaded: number;
  texturesLost: number;
  /** The model carries the `open` clip; if false the passport can only be shown closed. */
  hasOpenClip: boolean;
};

export type Stage = {
  info: StageInfo;
  render: (pose: Pose) => void;
  resize: () => boolean;
  setGlass: (mode: GlassMode) => GlassChoice;
  drawnTriangles: () => number;
  dispose: () => void;
};

const CAMERA = { fov: 30, distance: 0.42, lift: 0.03 };
const PAPER_LIFT = 0.3;
const SHADOW = { y: -0.098, wide: 0.13, deep: 0.05 };
const ENV_SIZE = { cols: 512, rows: 256 };
const CUBE_SIZE = 64;

const bytesOf = async (moduleId: number) => {
  const [asset] = await Asset.loadAsync(moduleId);
  return new File(asset!.localUri ?? asset!.uri).arrayBuffer();
};

async function loadEnvironment(): Promise<{ texture: THREE.DataTexture; choice: EnvChoice }> {
  let imageFailed = false;
  let image: { data: Uint8Array; width: number; height: number } | null = null;
  try {
    const decoded = decodeImage(new Uint8Array(await bytesOf(ENV_IMAGE)));
    image = decoded ? flipRows(decoded) : null;
    imageFailed = !image;
  } catch {
    imageFailed = true;
  }
  const choice = chooseEnvironment({ imageBundled: true, imageFailed });
  const source = image && choice === "studio-env.jpg" ? image : { data: buildEquirect(ENV_SIZE.cols, ENV_SIZE.rows), width: ENV_SIZE.cols, height: ENV_SIZE.rows };
  const texture = new THREE.DataTexture(source.data, source.width, source.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, choice };
}

/** Six procedural faces as a cube texture, for the fake glass (a plain cube map needs no prefilter, so no float render targets). */
function buildCube(): THREE.CubeTexture {
  const faces = Array.from({ length: 6 }, (_, f) => {
    const t = new THREE.DataTexture(buildCubeFace(f, CUBE_SIZE), CUBE_SIZE, CUBE_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const cube = new THREE.CubeTexture(faces as unknown as HTMLImageElement[]);
  cube.colorSpace = THREE.SRGBColorSpace;
  cube.generateMipmaps = false;
  cube.minFilter = THREE.LinearFilter;
  cube.needsUpdate = true;
  return cube;
}

/** A soft round falloff in the shadow color; the opacity at its center is the material's. */
function buildShadowTexture(): THREE.DataTexture {
  const n = 64;
  const px = new Uint8Array(n * n * 4);
  const hex = scene3d.shadow;
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot((x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5) * 2;
      const a = Math.max(0, 1 - d);
      const k = (y * n + x) * 4;
      px[k] = rgb[0]!;
      px[k + 1] = rgb[1]!;
      px[k + 2] = rgb[2]!;
      px[k + 3] = Math.round(255 * a * a);
    }
  const t = new THREE.DataTexture(px, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const disposeMaterial = (m: THREE.Material) => {
  for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
  m.dispose();
};

export async function createStage(gl: ExpoWebGLRenderingContext): Promise<Stage> {
  const started = Date.now();
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  // three expects a canvas; expo-gl has none, so hand it a stand-in that returns the existing context.
  const glx = gl as unknown as { getContextAttributes?: () => unknown };
  glx.getContextAttributes ??= () => ({ alpha: false, depth: true, stencil: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "default", failIfMajorPerformanceCaveat: false });
  const canvas = { width, height, clientWidth: width, clientHeight: height, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => gl } as unknown as HTMLCanvasElement;
  guardUnimplemented(gl as unknown as Record<string, unknown>, createCompatLog());
  const renderer = withoutWebGL1Global(() => new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true, alpha: false }));
  renderer.setPixelRatio(1); // the native buffer is already sized for the capped pixel ratio (see Passport3DView)
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.background);
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, width / height, 0.05, 5);
  camera.position.set(0, CAMERA.lift, CAMERA.distance);
  camera.lookAt(0, -0.01, 0);
  const sizeViewport=createViewportSizer(renderer,camera);
  const resize=()=>sizeViewport(gl.drawingBufferWidth,gl.drawingBufferHeight);
  resize();
  const key = new THREE.DirectionalLight(new THREE.Color(scene3d.softbox), 0.5);
  key.position.set(0.1, 0.3, 0.3);
  scene.add(key);

  // Environment: the studio panorama, prefiltered for physically based materials. If this fails, the fake glass takes over.
  const env = await loadEnvironment();
  let pmremOk = false;
  let envTarget: THREE.WebGLRenderTarget | null = null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    const hasTargets = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    if (hasTargets) {
      envTarget = pmrem.fromEquirectangular(env.texture);
      scene.environment = envTarget.texture;
      pmremOk = gl.getError() === gl.NO_ERROR;
    }
  } catch {
    pmremOk = false;
  }

  const model = await parseModel(await bytesOf(MODEL), decodeImage);
  // The cover swing is a clip made in Blender. We never play it in real time: the loop scrubs it to `pose.open`, which
  // makes closing the same clip backwards, and lets Reduce Motion jump straight to either end.
  const openClip = model.animations.find((c) => c.name === "open");
  const mixer = openClip ? new THREE.AnimationMixer(model.root) : null;
  if (mixer && openClip) {
    const action = mixer.clipAction(openClip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
  }
  let lastOpen = -1;
  // The studio lighting is moody and the opened pages are meant to match the cream 2D reader they cross-fade into. PAPER_LIFT
  // adds a little self-light to the two interior pages only: 0 = lit by the studio alone. It cannot be judged without a phone, so
  // it is one number to nudge on a device (raise it if the 3D pages look greyer than the 2D pages, lower it if they look washed out).
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const m = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!mesh.isMesh || !m || (m.name !== "InsideLining" && m.name !== "BearerPage")) return;
    m.emissive.setScalar(1);
    m.emissiveMap = m.map;
    m.emissiveIntensity = PAPER_LIFT;
    m.needsUpdate = true;
  });
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  spin.add(model.root);
  tilt.add(spin);
  scene.add(tilt);

  // Glass: clearcoat is what the file carries; the fake is a Phong material reflecting a procedural cube.
  const covers: THREE.Mesh[] = [];
  model.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material).name === "CoverGlass") covers.push(m);
  });
  const clearMaterial = covers[0]?.material as THREE.MeshPhysicalMaterial | undefined;
  let cube: THREE.CubeTexture | null = null;
  let fakeMaterial: THREE.MeshPhongMaterial | null = null;
  const makeFake = () => {
    cube ??= buildCube();
    fakeMaterial ??= new THREE.MeshPhongMaterial({
      color: clearMaterial?.color ?? new THREE.Color(scene3d.studio),
      normalMap: clearMaterial?.normalMap ?? null,
      envMap: cube,
      reflectivity: 0.6,
      combine: THREE.MixOperation,
      shininess: 120,
      specular: new THREE.Color(scene3d.strip),
    });
    return fakeMaterial;
  };
  const applyGlass = (choice: GlassChoice) => {
    for (const c of covers) c.material = choice === "clearcoat" && clearMaterial ? clearMaterial : makeFake();
  };
  const setGlass = (mode: GlassMode) => {
    const choice = chooseGlass({ clearcoatInModel: model.info.clearcoat, pmremOk, mode });
    applyGlass(choice);
    info.glass = choice;
    return choice;
  };

  const shadowTexture = buildShadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: scene3d.shadowOpacity, depthWrite: false, toneMapped: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = SHADOW.y;
  shadow.renderOrder = -1;
  scene.add(shadow);

  const info: StageInfo = {
    loadMs: 0,
    triangles: model.info.triangles,
    assets: describeAssets(env.choice),
    env: env.choice,
    glass: "clearcoat",
    clearcoatInModel: model.info.clearcoat,
    pmremOk,
    texturesLoaded: model.info.texturesLoaded,
    texturesLost: model.info.texturesLost,
    hasOpenClip: !!openClip,
  };
  setGlass("auto");
  info.loadMs = Date.now() - started;

  return {
    info,
    resize,
    render(p) {
      if (mixer && openClip && p.open !== lastOpen) {
        mixer.setTime(openClip.duration * p.open);
        lastOpen = p.open;
      }
      // Opening squares the book up to the viewer, stills the tilt and bob, and pulls the camera back to fit the spread.
      const facing = facingAngle(p.angle, p.open);
      const calm = motionShare(p.open);
      spin.rotation.y = facing;
      tilt.rotation.set(p.tiltX * calm, 0, p.tiltY * calm);
      tilt.position.y = p.bob * calm;
      camera.position.set(0, CAMERA.lift, cameraDistance(p.open, camera.aspect, CAMERA.fov, CAMERA.distance));
      camera.lookAt(0, -0.01, 0);
      shadow.scale.set(SHADOW.wide * shadowWidthRatio(facing) * shadowSpread(p.open), SHADOW.deep, 1);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    },
    setGlass,
    drawnTriangles: () => renderer.info.render.triangles,
    dispose() {
      mixer?.stopAllAction();
      mixer?.uncacheRoot(model.root);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        [m.material].flat().forEach(disposeMaterial);
      });
      if (fakeMaterial) disposeMaterial(fakeMaterial);
      cube?.dispose();
      (cube?.images as THREE.DataTexture[] | undefined)?.forEach((t) => t.dispose?.());
      shadowTexture.dispose();
      envTarget?.dispose();
      env.texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      scene.clear();
    },
  };
}
