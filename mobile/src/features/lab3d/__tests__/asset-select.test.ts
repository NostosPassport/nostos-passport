import { chooseEnvironment, chooseGlass, describeAssets } from "../asset-select";

describe("asset selection", () => {
  it("uses the studio panorama when it is bundled and decoded", () => {
    expect(chooseEnvironment({ imageBundled: true, imageFailed: false })).toBe("studio-env.jpg");
  });

  it("falls back to the procedural studio when the image is missing or fails to decode", () => {
    expect(chooseEnvironment({ imageBundled: false, imageFailed: false })).toBe("procedural");
    expect(chooseEnvironment({ imageBundled: true, imageFailed: true })).toBe("procedural");
  });

  it("auto: clearcoat when the material has it and the prefilter works", () => {
    expect(chooseGlass({ clearcoatInModel: true, pmremOk: true, mode: "auto" })).toBe("clearcoat");
  });

  it("auto: the fake reflection when clearcoat is lost or PMREM fails", () => {
    expect(chooseGlass({ clearcoatInModel: false, pmremOk: true, mode: "auto" })).toBe("fake-reflection");
    expect(chooseGlass({ clearcoatInModel: true, pmremOk: false, mode: "auto" })).toBe("fake-reflection");
  });

  it("the owner can force either glass, but clearcoat cannot be forced onto a model without it", () => {
    expect(chooseGlass({ clearcoatInModel: true, pmremOk: true, mode: "fake" })).toBe("fake-reflection");
    expect(chooseGlass({ clearcoatInModel: true, pmremOk: false, mode: "clearcoat" })).toBe("clearcoat");
    expect(chooseGlass({ clearcoatInModel: false, pmremOk: true, mode: "clearcoat" })).toBe("fake-reflection");
  });

  it("describes the assets in use for the readout", () => {
    expect(describeAssets("studio-env.jpg")).toBe("assets/3d/passport.glb + assets/3d/studio-env.jpg");
    expect(describeAssets("procedural")).toBe("assets/3d/passport.glb + procedural studio");
  });
});
