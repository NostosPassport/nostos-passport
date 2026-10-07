import { createFpsMeter } from "../fps-meter";

describe("fps meter", () => {
  it("is empty before two frames", () => {
    const m = createFpsMeter();
    expect(m.read(0)).toEqual({ avg: 0, min: 0 });
    m.tick(0);
    expect(m.read(0)).toEqual({ avg: 0, min: 0 });
  });

  it("reads average and minimum fps over the last second", () => {
    const m = createFpsMeter();
    for (let t = 0; t <= 1000; t += 20) m.tick(t); // 50 fps
    const r = m.read(1000);
    expect(r.avg).toBeCloseTo(50, 0);
    expect(r.min).toBeCloseTo(50, 0);
  });

  it("minimum catches one slow frame", () => {
    const m = createFpsMeter();
    let t = 0;
    for (let i = 0; i < 20; i++) m.tick((t += 16.7));
    m.tick((t += 100));
    for (let i = 0; i < 10; i++) m.tick((t += 16.7));
    const r = m.read(t);
    expect(r.min).toBeCloseTo(10, 0);
    expect(r.avg).toBeGreaterThan(r.min);
  });

  it("forgets frames older than a second", () => {
    const m = createFpsMeter();
    for (let t = 0; t <= 500; t += 10) m.tick(t);
    for (let t = 2000; t <= 2500; t += 50) m.tick(t);
    expect(m.read(2500).avg).toBeCloseTo(20, 0);
  });

  it("reset clears everything", () => {
    const m = createFpsMeter();
    m.tick(0);
    m.tick(16);
    m.reset();
    expect(m.read(16)).toEqual({ avg: 0, min: 0 });
  });
});
