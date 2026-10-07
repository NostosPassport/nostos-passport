import { LabLoop, type LoopProps } from "../lab-loop";
import { createStage } from "../passport-stage";

jest.mock("../passport-stage", () => ({ createStage: jest.fn() }));

type Frame = (t: number) => void;
let queue: Frame[] = [];
let now = 0;
const runMs = (ms: number, step = 1000 / 60) => {
  const end = now + ms;
  while (now < end && queue.length) {
    now += step;
    const batch = queue;
    queue = [];
    batch.forEach((cb) => cb(now));
  }
};

const fakeStage = () => ({
  info: { loadMs: 0, triangles: 0, assets: "", env: "studio-env.jpg", glass: "clearcoat", clearcoatInModel: true, pmremOk: true, texturesLoaded: 5, texturesLost: 0, hasOpenClip: true },
  render: jest.fn(),
  resize: () => false,
  setGlass: () => "clearcoat" as const,
  drawnTriangles: () => 0,
  dispose: jest.fn(),
});

function makeProps(over: Partial<LoopProps> = {}): LoopProps {
  return {
    running: true, lowPower: false, reduceMotion: false, soak: false, glassMode: "auto", open: false,
    onReady: jest.fn(), onTap: jest.fn(), onOpenProgress: jest.fn(), onOpenSettled: jest.fn(), onGlass: jest.fn(), onStats: jest.fn(), onError: jest.fn(),
    ...over,
  };
}

async function started(over: Partial<LoopProps> = {}) {
  const stage = fakeStage();
  (createStage as jest.Mock).mockResolvedValue(stage);
  const props = makeProps(over);
  const loop = new LabLoop(props);
  await loop.attach({} as never);
  return { loop, stage, props };
}

const opens = (stage: ReturnType<typeof fakeStage>) => stage.render.mock.calls.map((c) => (c[0] as { open: number }).open);

beforeEach(() => {
  queue = [];
  now = 0;
  (global as unknown as { requestAnimationFrame: (cb: Frame) => number }).requestAnimationFrame = (cb) => {
    queue.push(cb);
    return queue.length;
  };
  (global as unknown as { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame = () => {
    queue = [];
  };
});

describe("LabLoop opening and closing", () => {
  it("opens over about two seconds, reports progress each frame and settles exactly once", async () => {
    const { loop, stage, props } = await started();
    loop.update({ ...props, open: true });
    runMs(3000);
    const series = opens(stage);
    expect(series[series.length - 1]).toBe(1);
    for (let i = 1; i < series.length; i++) expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]!); // never goes backwards
    expect(props.onOpenSettled).toHaveBeenCalledTimes(1);
    expect(props.onOpenSettled).toHaveBeenCalledWith(true);
    const progressCalls = (props.onOpenProgress as jest.Mock).mock.calls.map((c) => c[0] as number);
    expect(progressCalls[progressCalls.length - 1]).toBe(1);
    expect(progressCalls.length).toBeGreaterThan(30); // a real animation, not a jump
  });

  it("takes about OPEN_SECONDS to get there", async () => {
    const { loop, props } = await started();
    loop.update({ ...props, open: true });
    const start = now;
    let reachedAt = 0;
    (props.onOpenProgress as jest.Mock).mockImplementation((p: number) => {
      if (p >= 1 && !reachedAt) reachedAt = now - start;
    });
    runMs(3000);
    expect(reachedAt / 1000).toBeGreaterThan(1.7);
    expect(reachedAt / 1000).toBeLessThan(2.4);
  });

  it("stops scheduling frames once fully open (the reader is on top; no battery burn)", async () => {
    const { loop, props } = await started();
    loop.update({ ...props, open: true });
    runMs(3000);
    expect(queue.length).toBe(0);
  });

  it("closing plays the same range backwards and settles closed", async () => {
    const { loop, stage, props } = await started();
    loop.update({ ...props, open: true });
    runMs(3000);
    stage.render.mockClear();
    loop.update({ ...props, open: false });
    runMs(3000);
    const series = opens(stage);
    expect(series[0]).toBeLessThan(1);
    expect(series[series.length - 1]).toBe(0);
    for (let i = 1; i < series.length; i++) expect(series[i]).toBeLessThanOrEqual(series[i - 1]!);
    expect(props.onOpenSettled).toHaveBeenLastCalledWith(false);
  });

  it("Reduce Motion jumps straight to the ends with no in-between frames", async () => {
    const { loop, stage, props } = await started({ reduceMotion: true });
    loop.update({ ...props, reduceMotion: true, open: true });
    runMs(500);
    const series = opens(stage);
    expect(series.every((v) => v === 0 || v === 1)).toBe(true);
    expect(series[series.length - 1]).toBe(1);
    expect(props.onOpenSettled).toHaveBeenCalledWith(true);
  });

  it("a re-render with the same props mid-swing neither restarts nor stalls it (the reader mounting at READER_AT re-renders the view)", async () => {
    const { loop, stage, props } = await started();
    loop.update({ ...props, open: true });
    runMs(1600); // past READER_AT
    loop.update({ ...props, open: true, running: true });
    runMs(1500);
    expect(opens(stage)[opens(stage).length - 1]).toBe(1);
  });

  it("holds the idle spin still while open or opening, so the spread cannot rotate", async () => {
    const { loop, stage, props } = await started();
    loop.update({ ...props, open: true });
    runMs(3000);
    const angles = stage.render.mock.calls.map((c) => (c[0] as { angle: number }).angle);
    expect(new Set(angles.slice(-20)).size).toBe(1);
  });

  it("never reports progress for a passport that was never asked to open", async () => {
    const { props } = await started();
    runMs(1000);
    expect(props.onOpenProgress).not.toHaveBeenCalled();
    expect(props.onOpenSettled).not.toHaveBeenCalled();
  });
});
