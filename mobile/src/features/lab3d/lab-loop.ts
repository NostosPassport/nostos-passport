/**
 * The render loop and gesture state of the 3D passport, outside React. It draws only while `props.running`, caps the
 * frame rate by `targetFps`, skips drawing when nothing would change, and frees every GPU resource in `dispose`.
 */
import { type GestureResponderEvent, PanResponder } from "react-native";

import { isModelTap } from "../book/focus-interaction";
import type { GlassChoice, GlassMode } from "./asset-select";
import { createFinger, grab, move, release } from "./finger";
import { type FpsReading, createFpsMeter } from "./fps-meter";
import { shouldRender, targetFps } from "./frame-cap";
import { type Stage, type StageInfo, createStage } from "./passport-stage";
import { canRotate, isOpenSettled, stepOpen } from "./open-motion";
import { bobOffset, dragAngle } from "./rotation";
import { type SimInput, advance, createSim, isActive, isSettled } from "./sim";

export type LoopProps = {
  running: boolean;
  lowPower: boolean;
  reduceMotion: boolean;
  soak: boolean;
  glassMode: GlassMode;
  coverColor?: string;
  coverTitle?: string;
  onReady: (info: StageInfo) => void;
  onTap?: () => void;
  open: boolean;
  onOpenProgress?: (progress: number) => void;
  onOpenSettled?: (open: boolean) => void;
  onGlass: (glass: GlassChoice) => void;
  onStats: (fps: FpsReading, target: number) => void;
  onError: (message: string) => void;
};

const STATS_EVERY_MS = 500;

export class LabLoop {
  private props: LoopProps;
  private stage: Stage | null = null;
  private frame: number | null = null;
  private sim = createSim();
  private finger = createFinger();
  private meter = createFpsMeter();
  private lastRender: number | null = null;
  private lastTick: number | null = null;
  private lastStats = 0;
  private disposed = false;
  private maxTravel = 0;
  private startedAt = 0;
  private generation = 0;
  private openProgress = 0;
  private openTarget: 0 | 1 = 0;
  private renderedOpen = 0;
  private settledReported = true;
  private ignoring = false;

  constructor(props: LoopProps) {
    this.props = props;
  }

  readonly pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      this.ignoring = !canRotate(this.openProgress, this.openTarget);
      if (this.ignoring) return;
      grab(this.finger, e.nativeEvent.pageX, e.nativeEvent.pageY, e.nativeEvent.timestamp);
      this.sim = { ...this.sim, velocity: 0 };
      this.maxTravel = 0;
      this.startedAt = e.nativeEvent.timestamp;
      this.wake();
    },
    onPanResponderMove: (e) => {
      if (this.ignoring) return;
      const dx = move(this.finger, e.nativeEvent.pageX, e.nativeEvent.pageY, e.nativeEvent.timestamp);
      this.maxTravel = Math.max(this.maxTravel, Math.hypot(this.finger.offsetX, this.finger.offsetY));
      this.sim = { ...this.sim, angle: dragAngle(this.sim.angle, dx) };
    },
    onPanResponderRelease: (e) => this.end(e),
    onPanResponderTerminate: (e) => this.end(e, true),
  });

  private end(e: GestureResponderEvent, cancelled = false) {
    if (this.ignoring) {
      this.ignoring = false;
      return;
    }
    const travel = Math.max(this.maxTravel, Math.hypot(e.nativeEvent.pageX-this.finger.startX, e.nativeEvent.pageY-this.finger.startY));
    const tapped = isModelTap(travel, e.nativeEvent.timestamp-this.startedAt, cancelled);
    this.sim = { ...this.sim, velocity: this.props.reduceMotion ? (release(this.finger, e.nativeEvent.timestamp), 0) : release(this.finger, e.nativeEvent.timestamp) };
    if (tapped && this.stage) this.props.onTap?.();
    this.wake();
  }

  update(props: LoopProps) {
    const glassChanged = props.glassMode !== this.props.glassMode;
    this.props = props;
    const target: 0 | 1 = props.open ? 1 : 0;
    if (target !== this.openTarget) {
      this.openTarget = target;
      this.settledReported = false;
    }
    if (glassChanged && this.stage) props.onGlass(this.stage.setGlass(props.glassMode));
    if (props.running) this.wake();
    else this.stop();
  }

  async attach(gl: Parameters<typeof createStage>[0]) {
    const generation = ++this.generation;
    try {
      this.stop();
      this.stage?.dispose();
      this.stage = null;
      const stage = await createStage(gl, this.props.coverColor, this.props.coverTitle);
      if (this.disposed || generation !== this.generation) {
        stage.dispose();
        return;
      }
      this.stage = stage;
      this.props.onGlass(stage.setGlass(this.props.glassMode));
      this.props.onReady({ ...stage.info });
      stage.render({ angle: this.sim.angle, tiltX: 0, tiltY: 0, bob: 0, open: this.openProgress });
      this.wake();
    } catch (e) {
      this.props.onError(e instanceof Error ? e.message : String(e));
    }
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.stage?.dispose();
    this.stage = null;
  }

  private stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private wake() {
    if (this.frame !== null || this.disposed || !this.props.running || !this.stage) return;
    this.lastTick = null;
    this.meter.reset();
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    this.frame = null;
    const p = this.props;
    if (!p.running || !this.stage || this.disposed) return;
    const resized = this.stage.resize();
    const f = this.finger;
    const animating = this.openProgress !== this.renderedOpen || !isOpenSettled(this.openProgress, this.openTarget);
    const idle = this.openProgress === 0 && this.openTarget === 0;
    const input: SimInput = { dragging: f.dragging, offsetX: f.offsetX, offsetY: f.offsetY, motion: !p.reduceMotion && !p.lowPower && idle, soak: p.soak && idle };
    const fps = targetFps({ active: isActive(this.sim, input) || animating, lowPower: p.lowPower });
    if (shouldRender(now, this.lastRender, fps)) {
      const dt = this.lastTick === null ? 0 : (now - this.lastTick) / 1000;
      this.lastTick = now;
      this.openProgress = stepOpen(this.openProgress, this.openTarget, dt, p.reduceMotion);
      const moved = this.openProgress !== this.renderedOpen;
      if (!resized && !moved && isSettled(this.sim, input)) {
        this.lastRender = null;
      } else {
        this.sim = advance(this.sim, dt, input);
        this.stage.render({ angle: this.sim.angle, tiltX: this.sim.tiltX, tiltY: this.sim.tiltY, bob: bobOffset(this.sim.time, input.motion), open: this.openProgress });
        this.renderedOpen = this.openProgress;
        if (moved) p.onOpenProgress?.(this.openProgress);
        this.meter.tick(now);
        this.lastRender = now;
      }
      if (!this.settledReported && isOpenSettled(this.openProgress, this.openTarget)) {
        this.settledReported = true;
        p.onOpenSettled?.(this.openTarget === 1);
      }
    }
    if (now - this.lastStats >= STATS_EVERY_MS) {
      this.lastStats = now;
      p.onStats(this.meter.read(now), fps);
    }
    if (this.openTarget === 1 && this.openProgress === 1 && this.settledReported && !f.dragging) return;
    this.frame = requestAnimationFrame(this.tick);
  };
}