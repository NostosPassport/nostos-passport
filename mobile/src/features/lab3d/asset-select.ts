/** Which environment image and which glass the 3D lab uses, decided from facts about the bundle and the device. */

export type EnvChoice = "studio-env.jpg" | "procedural";
export type GlassChoice = "clearcoat" | "fake-reflection";

export const chooseEnvironment = ({ imageBundled, imageFailed }: { imageBundled: boolean; imageFailed: boolean }): EnvChoice =>
  imageBundled && !imageFailed ? "studio-env.jpg" : "procedural";

/** The owner's override on the phone: let the app decide, always fake the glass, or always use clearcoat. */
export type GlassMode = "auto" | "fake" | "clearcoat";

/** Clearcoat needs the model to carry it and the environment prefilter (PMREM) to work; otherwise fake the glass with a cube reflection. */
export const chooseGlass = ({ clearcoatInModel, pmremOk, mode }: { clearcoatInModel: boolean; pmremOk: boolean; mode: GlassMode }): GlassChoice => {
  if (mode === "fake") return "fake-reflection";
  if (mode === "clearcoat") return clearcoatInModel ? "clearcoat" : "fake-reflection";
  return clearcoatInModel && pmremOk ? "clearcoat" : "fake-reflection";
};

export const MODEL_PATH = "assets/3d/passport.glb";

export const describeAssets = (env: EnvChoice) => `${MODEL_PATH} + ${env === "procedural" ? "procedural studio" : `assets/3d/${env}`}`;
