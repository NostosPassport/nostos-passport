import { UNIMPLEMENTED, createCompatLog, describeContext, guardUnimplemented, withoutWebGL1Global } from "../gl-compat";

type G = { WebGLRenderingContext?: unknown };
const g = globalThis as unknown as G;

describe("three's WebGL1 check", () => {
  afterEach(() => {
    delete g.WebGLRenderingContext;
  });

  it("hides the global WebGLRenderingContext while the callback runs, then restores it", () => {
    function Ctx() {}
    g.WebGLRenderingContext = Ctx;
    let seen: unknown = "unset";
    const out = withoutWebGL1Global(() => {
      seen = g.WebGLRenderingContext;
      return 7;
    });
    expect(out).toBe(7);
    expect(seen).toBeUndefined();
    expect(g.WebGLRenderingContext).toBe(Ctx);
  });

  it("restores the global even when the callback throws", () => {
    function Ctx() {}
    g.WebGLRenderingContext = Ctx;
    expect(() => withoutWebGL1Global(() => { throw new Error("boom"); })).toThrow("boom");
    expect(g.WebGLRenderingContext).toBe(Ctx);
  });

  it("leaves an absent global absent", () => {
    withoutWebGL1Global(() => 1);
    expect("WebGLRenderingContext" in g).toBe(false);
  });

  it("makes expo-gl's real shape pass: a WebGL2 instance that extends the WebGL1 class is rejected only while the global is visible", () => {
    function GL1() {}
    function GL2() {}
    GL2.prototype = Object.create(GL1.prototype);
    g.WebGLRenderingContext = GL1;
    const gl = new (GL2 as unknown as new () => object)();
    const threeCheck = () => typeof g.WebGLRenderingContext !== "undefined" && gl instanceof (g.WebGLRenderingContext as never);
    expect(threeCheck()).toBe(true);
    expect(withoutWebGL1Global(threeCheck)).toBe(false);
  });
});

describe("unimplemented method guards", () => {
  it("lists the expo-gl 57.0.2 unimplemented methods", () => {
    for (const n of ["getTexParameter", "getFramebufferAttachmentParameter", "renderbufferStorageMultisample", "compressedTexImage2D", "getUniform"]) expect(UNIMPLEMENTED).toContain(n);
  });

  it("logs each unimplemented call with a count and still calls through", () => {
    const calls: unknown[][] = [];
    const gl = { getTexParameter: (...a: unknown[]) => (calls.push(a), 5), viewport: () => 0 } as Record<string, unknown>;
    const log = createCompatLog();
    guardUnimplemented(gl, log);
    expect((gl.getTexParameter as (...a: unknown[]) => unknown)(1, 2)).toBe(5);
    (gl.getTexParameter as (...a: unknown[]) => unknown)(1, 2);
    expect(calls).toHaveLength(2);
    expect(log.entries()).toEqual([{ name: "getTexParameter", count: 2 }]);
    expect(log.summary()).toBe("unimplemented calls: getTexParameter x2");
  });

  it("does not wrap methods the context does not have, and a throwing method is logged, not fatal", () => {
    const gl = { getUniform: () => { throw new Error("native"); } } as Record<string, unknown>;
    const log = createCompatLog();
    guardUnimplemented(gl, log);
    expect("getTexParameter" in gl).toBe(false);
    expect((gl.getUniform as () => unknown)()).toBeNull();
    expect(log.entries()[0]).toEqual({ name: "getUniform", count: 1 });
  });

  it("an empty log says so", () => {
    expect(createCompatLog().summary()).toBe("unimplemented calls: none yet");
  });
});

describe("describeContext", () => {
  it("reports the constructor name, WebGL2 flag, version string and the WebGL2 methods three needs", () => {
    function WebGL2RenderingContext() {}
    const gl = Object.assign(new (WebGL2RenderingContext as unknown as new () => object)(), {
      supportsWebGL2: true,
      VERSION: 1,
      getParameter: () => "OpenGL ES 3.0 Apple",
      texStorage2D() {},
      createVertexArray() {},
    });
    const d = describeContext(gl as never);
    expect(d.constructorName).toBe("WebGL2RenderingContext");
    expect(d.supportsWebGL2).toBe(true);
    expect(d.version).toBe("OpenGL ES 3.0 Apple");
    expect(d.missing).toContain("blitFramebuffer");
    expect(d.missing).not.toContain("texStorage2D");
    expect(d.text).toContain("WebGL2 yes");
  });

  it("survives a context that throws on getParameter", () => {
    const d = describeContext({ getParameter: () => { throw new Error("x"); } } as never);
    expect(d.version).toBe("unknown");
    expect(d.supportsWebGL2).toBe(false);
  });
});
