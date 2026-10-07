import { createViewportSizer } from "../viewport";
describe("3D viewport resizing",()=>{
 it("updates framebuffer size and camera aspect on a real size change, and rejects empty layouts",()=>{
  const renderer={setSize:jest.fn()};const camera={aspect:1,updateProjectionMatrix:jest.fn()};const resize=createViewportSizer(renderer,camera);
  expect(resize(358,440)).toBe(true);expect(renderer.setSize).toHaveBeenCalledWith(358,440,false);expect(camera.aspect).toBeCloseTo(358/440);
  expect(resize(358,440)).toBe(false);expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(1);
  expect(resize(0,440)).toBe(false);expect(resize(440,358)).toBe(true);expect(camera.aspect).toBeCloseTo(440/358);expect(camera.updateProjectionMatrix).toHaveBeenCalledTimes(2);
 });
});
