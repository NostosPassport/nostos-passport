/**
 * expo-gl compatibility for three 0.186. Two facts from the expo-gl 57.0.2 source (see mobile/DECISIONS.md):
 * its WebGL2 context also passes `instanceof WebGLRenderingContext`, which three treats as "WebGL 1"; and a list of methods exists
 * but is unimplemented. This file hides the first and logs the second.
 */
import type { ExpoWebGLRenderingContext } from "expo-gl";

/** Methods expo-gl 57.0.2 declares but does not implement (they warn and return nothing). */
export const UNIMPLEMENTED = [
  "compressedTexImage2D", "compressedTexSubImage2D", "getTexParameter", "compressedTexImage3D", "compressedTexSubImage3D",
  "getBufferSubData", "getFramebufferAttachmentParameter", "getRenderbufferParameter", "renderbufferStorageMultisample",
  "getUniform", "getVertexAttrib", "getVertexAttribOffset", "fenceSync", "isSync", "deleteSync", "clientWaitSync", "waitSync",
  "getSyncParameter", "getActiveUniformBlockParameter",
] as const;

/** WebGL2 methods three 0.186 uses and expo-gl implements; reported as missing if a future version drops one. */
const WEBGL2_NEEDED = ["texStorage2D", "texImage3D", "drawBuffers", "blitFramebuffer", "getInternalformatParameter", "bindBufferBase", "uniformBlockBinding", "createVertexArray"];

const globals = globalThis as unknown as { WebGLRenderingContext?: unknown };

/** Runs `fn` with the global `WebGLRenderingContext` hidden, so three's `instanceof` check cannot misread a WebGL2 context as WebGL1. */
export function withoutWebGL1Global<T>(fn: () => T): T {
  const had = "WebGLRenderingContext" in globals;
  const saved = globals.WebGLRenderingContext;
  globals.WebGLRenderingContext = undefined;
  try {
    return fn();
  } finally {
    if (had) globals.WebGLRenderingContext = saved;
    else delete globals.WebGLRenderingContext;
  }
}

/**
 * Three configures several WebGL unpack flags while uploading textures. Expo GL only supports the flip-Y variant and logs for
 * the others. Expo Three uses this same compatibility shim in its examples, so ignore the unsupported calls instead of
 * forwarding them to native and filling the console with EXGL warnings.
 */
export function guardPixelStorei(gl: ExpoWebGLRenderingContext) {
  const original = gl.pixelStorei.bind(gl);
  gl.pixelStorei = ((parameter: number, value: number | boolean) => {
    if (parameter === gl.UNPACK_FLIP_Y_WEBGL) original(parameter, value);
  }) as typeof gl.pixelStorei;
}

export type CompatLog = { note: (name: string) => void; entries: () => { name: string; count: number }[]; summary: () => string };

export function createCompatLog(): CompatLog {
  const counts = new Map<string, number>();
  const entries = () => [...counts].map(([name, count]) => ({ name, count }));
  return {
    note: (name) => counts.set(name, (counts.get(name) ?? 0) + 1),
    entries,
    summary: () => (counts.size ? `unimplemented calls: ${entries().map((e) => `${e.name} x${e.count}`).join(", ")}` : "unimplemented calls: none yet"),
  };
}

/** Wraps each unimplemented method the context has: count the call, call through, and never let a native failure escape (returns null). */
export function guardUnimplemented(gl: Record<string, unknown>, log: CompatLog) {
  for (const name of UNIMPLEMENTED) {
    const original = gl[name];
    if (typeof original !== "function") continue;
    gl[name] = (...args: unknown[]) => {
      log.note(name);
      try {
        return (original as (...a: unknown[]) => unknown).apply(gl, args);
      } catch {
        return null;
      }
    };
  }
}

export type ContextDescription = { constructorName: string; supportsWebGL2: boolean; version: string; missing: string[]; text: string };

/** What the context actually is, for the on-screen panel. Never throws. */
export function describeContext(gl: ExpoWebGLRenderingContext): ContextDescription {
  const g = gl as unknown as Record<string, unknown> & { getParameter?: (p: unknown) => unknown };
  let version = "unknown";
  try {
    version = String(g.getParameter?.(g.VERSION) ?? "unknown");
  } catch {
    version = "unknown";
  }
  const constructorName = (Object.getPrototypeOf(gl) as { constructor?: { name?: string } } | null)?.constructor?.name || "unknown";
  const supportsWebGL2 = g.supportsWebGL2 === true;
  const missing = WEBGL2_NEEDED.filter((m) => typeof g[m] !== "function");
  const text = `${constructorName}, WebGL2 ${supportsWebGL2 ? "yes" : "NO"}, ${version}${missing.length ? `, missing ${missing.join(" ")}` : ""}`;
  return { constructorName, supportsWebGL2, version, missing, text };
}
