/**
 * Loads the passport glTF in React Native. The stock GLTFLoader decodes embedded textures through Blob URLs and an
 * <img>, neither of which exists here, so a plugin takes over `loadTexture`: the embedded PNG bytes are decoded to RGBA
 * by the caller (Skia in the app) and become plain DataTextures, which every WebGL path accepts. The decoder is injected,
 * so the same code runs in the Jest test against the real file.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTFParser } from "three/addons/loaders/GLTFLoader.js";

export type DecodedImage = { data: Uint8Array; width: number; height: number };
export type ImageDecoder = (bytes: Uint8Array) => DecodedImage | null;

export type ModelInfo = {
  triangles: number;
  materials: string[];
  /** The material the loader built for the glass cover has a clearcoat layer. */
  clearcoat: boolean;
  texturesLoaded: number;
  texturesLost: number;
};

export type LoadedModel = { root: THREE.Object3D; animations: THREE.AnimationClip[]; info: ModelInfo };

const WRAP: Record<number, THREE.Wrapping> = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };
const MAG: Record<number, THREE.MagnificationTextureFilter> = { 9728: THREE.NearestFilter, 9729: THREE.LinearFilter };

function rnTextures(decode: ImageDecoder, tally: { loaded: number; lost: number }) {
  return (parser: GLTFParser) => ({
    name: "NOSTOS_RN_TEXTURES",
    loadTexture(textureIndex: number) {
      const json = parser.json as { textures: { sampler?: number; source: number }[]; images: { bufferView?: number }[]; samplers?: Record<number, { magFilter?: number; wrapS?: number; wrapT?: number }> };
      const def = json.textures[textureIndex]!;
      const image = json.images[def.source]!;
      if (image.bufferView === undefined) return null; // not embedded: let the stock path try
      return parser
        .getDependency("bufferView", image.bufferView)
        .then((buffer: ArrayBuffer) => {
          const decoded = decode(new Uint8Array(buffer));
          if (!decoded) throw new Error("decode failed");
          const sampler = json.samplers?.[def.sampler ?? -1] ?? {};
          const texture = new THREE.DataTexture(decoded.data, decoded.width, decoded.height, THREE.RGBAFormat, THREE.UnsignedByteType);
          texture.flipY = false; // glTF images start at the top, and so do the decoded rows
          texture.magFilter = MAG[sampler.magFilter ?? 0] ?? THREE.LinearFilter;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.generateMipmaps = true;
          texture.wrapS = WRAP[sampler.wrapS ?? 0] ?? THREE.RepeatWrapping;
          texture.wrapT = WRAP[sampler.wrapT ?? 0] ?? THREE.RepeatWrapping;
          texture.needsUpdate = true;
          tally.loaded += 1;
          return texture;
        })
        .catch(() => {
          tally.lost += 1;
          return null as unknown as THREE.Texture; // the loader skips a missing map, so the material is built without it
        });
    },
  });
}

export function triangleCount(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    n += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  });
  return n;
}

export function parseModel(glb: ArrayBuffer, decode: ImageDecoder): Promise<LoadedModel> {
  const tally = { loaded: 0, lost: 0 };
  const loader = new GLTFLoader();
  loader.register(rnTextures(decode, tally));
  return new Promise((resolve, reject) => {
    loader.parse(
      glb,
      "",
      (gltf) => {
        const materials = new Set<THREE.Material>();
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) [mesh.material].flat().forEach((m) => materials.add(m));
        });
        const list = [...materials];
        const cover = list.find((m) => m.name === "CoverGlass") as THREE.MeshPhysicalMaterial | undefined;
        resolve({
          root: gltf.scene,
          animations: gltf.animations,
          info: {
            triangles: triangleCount(gltf.scene),
            materials: list.map((m) => m.name),
            clearcoat: !!cover?.isMeshPhysicalMaterial && cover.clearcoat > 0,
            texturesLoaded: tally.loaded,
            texturesLost: tally.lost,
          },
        });
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}
