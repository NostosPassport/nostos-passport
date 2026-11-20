import { useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Modal, Platform, StyleSheet, Text as NativeText, useWindowDimensions, View, type ViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection } from "@/api/queries";
import { collectionColorValue } from "@/features/collections/colors";
import { bookMotion, colors, maxFontSizeMultiplier, scene3d, size, space, type as typeScale } from "@/theme";
import { Button } from "@/components/ui/button";
import { ScreenState } from "@/components/ui/screen-state";
import { Text } from "@/components/ui/text";
import { Passport3DView } from "../lab3d/Passport3DView";
import { READER_AT, SPREAD_FILL } from "../lab3d/open-motion";
import { BearerPage } from "./BearerPage";
import { BookFrame, FRAME_EXTRA } from "./BookFrame";
import { BOOK_ASPECT } from "./dimensions";
import { Counts, Cover } from "./Cover";
import { FlipBook } from "./FlipBook";
import { FirstRunHint } from "./FirstRunHint";
import { useFirstRun } from "./first-run";
import { InsideCover } from "./InsideCover";
import { PageView } from "./PageView";
import { SinglePageFlipBook } from "./SinglePageFlipBook";
import { type PageFace, groupByPage } from "./spreads";
import { stampPlacement } from "./slots";
import { FOCUS_TOP_SPACE, FOCUS_BOTTOM_SPACE, focusBookSize, focusPageCount, focusPageSize, focusSpreadCount, stampHitRect } from "./focus-interaction";
import { usePassport } from "./use-passport";
import { nav } from "@/lib/nav";
import { Tappable } from "@/components/ui/tappable";

/* eslint-disable react-hooks/immutability -- Reanimated shared values are written through .value by design */
/** `top` and `bottom` sit above and below the 3D passport on the home screen; they fade out while the book opens. */
type Slots = { top?: ReactNode; bottom?: ReactNode };
type Props = { collectionId?: string } & Slots;
type PassportData = ReturnType<typeof usePassport>;
type BookViewProps = {
  data: PassportData;
  collectionId?: string;
  coverColor?: string;
  collectionTitle?: string | null;
} & Slots;

const TABLET_MIN_DIMENSION = 700;

export function PassportBook({ collectionId, top, bottom }: Props = {}) {
  return collectionId ? <CollectionPassportBook collectionId={collectionId} /> : <MasterPassportBook top={top} bottom={bottom} />;
}

function MasterPassportBook(slots: Slots) {
  const data = usePassport();
  return <PassportBookView data={data} {...slots} />;
}

function CollectionPassportBook({ collectionId }: { collectionId: string }) {
  const master = usePassport();
  const collectionQuery = useCollection(collectionId);
  const collection = collectionQuery.data?.collection ?? null;
  const customStamps = collection?.stamps ?? [];
  const customPlaces = new Set(customStamps.map((stamp) => stamp.place.id)).size;
  const customStatus = master.status === "error" || collectionQuery.isError
    ? "error"
    : master.status === "pending" || collectionQuery.isPending
      ? "pending"
      : "ready";
  const data: PassportData = {
    ...master,
    status: customStatus,
    stamps: customStamps,
    counts: { stamps: customStamps.length, places: customPlaces },
    retry: () => {
      master.retry();
      void collectionQuery.refetch();
    },
  };
  return (
    <PassportBookView
      data={data}
      collectionId={collectionId}
      coverColor={collection ? collectionColorValue(collection.color) : undefined}
      collectionTitle={collection?.name ?? null}
    />
  );
}

function PassportBookView({ data, collectionId, coverColor, collectionTitle = null, top, bottom }: BookViewProps) {
  const firstRun = useFirstRun();
  const dismissFirstRun = () => { if (!collectionId) firstRun.dismiss(); };
  const openPages = () => { dismissFirstRun(); setTransitioning(true); setFocused(true); };
  const open = () => {
    if (modelClosing) return;
    if (!modelReady.current) { openPages(); return; }
    dismissFirstRun();
    readerRequested.current = false;
    setOpening(true);
  };
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const compactReader = Platform.OS !== "web" && Math.min(width, height) < TABLET_MIN_DIMENSION;
  const [focused, setFocused] = useState(false);
  const [readerIndex, setReaderIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [opening, setOpening] = useState(false);
  const [modelClosing, setModelClosing] = useState(false);
  const [modelFrame, setModelFrame] = useState({ y: 0, height: 0, width: 0 });
  const modelStage = useRef<ViewInstance>(null);
  const [modelShown, setModelShown] = useState(false);
  const placeholder = useSharedValue(1);
  const progress = useSharedValue(0);
  const openProgress = useSharedValue(0);
  const modelReady = useRef(false);
  const modelClosingRef = useRef(false);
  const readerRequested = useRef(false);
  const closing = useSharedValue(false);
  // Bring the home chrome back even when the model never drives openProgress home (e.g. the reader came back from a
  // stamp, or opened without the 3D model); while the model is closing, its own frames overwrite this.
  const finishClose = () => { setFocused(false); setTransitioning(false); readerRequested.current = false; if (!modelClosingRef.current) openProgress.value = withTiming(0, { duration: reduced ? 0 : bookMotion.durations.standard }); };
  useEffect(() => {
    closing.value = false;
    if (!focused) { progress.value = 0; return; }
    progress.value = withTiming(1, { duration: reduced ? 0 : bookMotion.durations.standard }, (finished) => { if (finished) scheduleOnRN(setTransitioning, false); });
  }, [focused, reduced, progress, closing]);
  const backdropMotion = useAnimatedStyle(() => ({ opacity: progress.value }));
  const readerMotion = useAnimatedStyle(() => ({ opacity: reduced ? progress.value : interpolate(progress.value, [0, 0.3, 1], [0, 0, 1]), transform: [{ scale: reduced ? 1 : interpolate(progress.value, [0, 1], [0.92, 1]) }] }));
  const [screenActive, setScreenActive] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [modelError, setModelError] = useState(false);
  const [modelKey, setModelKey] = useState(0);
  const returnToFocus = useRef(false);
  useFocusEffect(useCallback(() => {
    setScreenActive(true);
    if (returnToFocus.current) { returnToFocus.current = false; setTransitioning(true); setFocused(true); }
    return () => setScreenActive(false);
  }, []));
  useEffect(() => { const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active")); return () => sub.remove(); }, []);
  const stampPages = data.stamps.map((s) => s.page);
  // An empty master passport still has a first stamp page to turn to, with a way to stamp (P-034).
  const emptyMaster = !collectionId && data.stamps.length === 0;
  const total = compactReader ? Math.max(emptyMaster ? 2 : 1, focusPageCount(stampPages)) : Math.max(emptyMaster ? 2 : 1, focusSpreadCount(stampPages));
  const current = Math.min(readerIndex, total - 1);
  const availableWidth = width - insets.left - insets.right;
  const availableHeight = height - insets.top - insets.bottom;
  const book = compactReader ? focusPageSize(availableWidth - FRAME_EXTRA.width, availableHeight - FRAME_EXTRA.height) : focusBookSize(availableWidth, availableHeight);
  const readerWidth = compactReader ? book.pageWidth : book.pageWidth * 2;
  const fitScale = modelFrame.width > 0 ? Math.min(1.6, Math.max(1, readerWidth / (SPREAD_FILL * modelFrame.width))) : 1.1;
  const modelMotion = useAnimatedStyle(() => {
    const sourceCenter = modelFrame.y + modelFrame.height / 2;
    const destinationCenter = (height + insets.top - insets.bottom + FOCUS_TOP_SPACE - FOCUS_BOTTOM_SPACE) / 2;
    return { transform: [{ translateY: reduced ? 0 : openProgress.value * (destinationCenter - sourceCenter) }, { scale: reduced ? 1 : interpolate(openProgress.value, [0, 1], [1, fitScale]) }] };
  });
  const chromeMotion = useAnimatedStyle(() => ({ opacity: interpolate(openProgress.value, [0, 0.33], [1, 0], "clamp") }));
  const placeholderMotion = useAnimatedStyle(() => ({ opacity: placeholder.value }));
  useEffect(() => {
    if (!modelShown) { placeholder.value = 1; return; }
    // Hold the flat cover a beat after onReady so the GL surface has drawn before it shows through.
    placeholder.value = withTiming(0, { duration: reduced ? 0 : bookMotion.durations.standard });
  }, [modelShown, reduced, placeholder]);
  const measureModel = () => modelStage.current?.measureInWindow((_x, y, w, h) => setModelFrame({ y, height: h, width: w }));
  // Before the stage is measured, size the flat cover off the window so the fallback is always there to tap.
  const coverWidth = modelFrame.width > 0 ? Math.floor(Math.min(modelFrame.width * 0.56, (modelFrame.height * 0.78) / BOOK_ASPECT)) : Math.floor(width * 0.42);
  const requestReader = () => { if (readerRequested.current) return; readerRequested.current = true; setTransitioning(true); setFocused(true); };
  const onOpenProgress = (p: number) => { openProgress.value = p; if (opening && p >= READER_AT) requestReader(); };
  const onOpenSettled = (isOpen: boolean) => {
    if (isOpen && opening) requestReader();
    else if (!isOpen) { readerRequested.current = false; modelClosingRef.current = false; setModelClosing(false); openProgress.value = 0; }
  };
  const byPage = useMemo(() => groupByPage(data.stamps), [data.stamps]);
  const stampTargets = useMemo(() => {
    if (compactReader) {
      if (current === 0) return [];
      return (byPage.get(current) ?? []).map((s) => stampHitRect(stampPlacement(s, book.pageWidth, book.pageHeight), 0));
    }
    return [current * 2 - 1, current * 2].flatMap((p, index) =>
      (byPage.get(p) ?? []).map((s) => stampHitRect(stampPlacement(s, book.pageWidth, book.pageHeight), index * book.pageWidth)));
  }, [compactReader, byPage, current, book.pageWidth, book.pageHeight]);
  const close = () => {
    if (closing.value) return;
    closing.value = true;
    setTransitioning(true);
    if (modelReady.current && opening) { modelClosingRef.current = true; setModelClosing(true); setOpening(false); }
    progress.value = withTiming(0, { duration: reduced ? 0 : bookMotion.durations.standard }, (finished) => { if (finished) scheduleOnRN(finishClose); });
  };
  const openStamp = (id: string) => { returnToFocus.current = true; setFocused(false); nav.push({ pathname: "/stamp/[id]", params: { id } }); };
  const bearerPage = <BearerPage width={book.pageWidth} height={book.pageHeight} bearer={{ displayName: data.displayName, handle: data.handle, memberSince: data.memberSince, bio: data.bio }} avatarUrl={data.avatarUrl} />;
  const stampFirst = () => { close(); nav.push("/stamp/new"); };
  const firstPagePrompt = (page: number) => emptyMaster && page === 1 ? (
    <View style={[StyleSheet.absoluteFill, styles.emptyPage]} pointerEvents="box-none">
      <Text variant="serifLabel" color="brass" align="center">Your first stamp lands here.</Text>
      <Button title="Stamp a place" variant="secondary" compact block={false} onPress={stampFirst} />
    </View>
  ) : null;
  const renderFace = (face: PageFace, side: "left" | "right") => {
    if (face.kind === "inside-cover") return <InsideCover width={book.pageWidth} height={book.pageHeight} />;
    if (face.kind === "bearer") return bearerPage;
    return <View><PageView page={face.page} side={side} width={book.pageWidth} height={book.pageHeight} stamps={byPage.get(face.page) ?? []} onStampPress={(s) => openStamp(s.id)} />{firstPagePrompt(face.page)}</View>;
  };
  const renderSinglePage = (index: number) => {
    if (index === 0) return bearerPage;
    return <View><PageView page={index} side={index % 2 === 1 ? "left" : "right"} width={book.pageWidth} height={book.pageHeight} stamps={byPage.get(index) ?? []} onStampPress={(s) => openStamp(s.id)} />{firstPagePrompt(index)}</View>;
  };
  if (data.status === "error") return <View style={styles.center}><ScreenState kind="error" message="Couldn't open your passport. Your connection may be down." onRetry={data.retry} /></View>;
  if (data.status === "pending") return <View style={styles.center} accessible accessibilityRole="progressbar" accessibilityLabel="Opening your passport"><Skeleton width={Math.min(width * .5, (height * .45) / BOOK_ASPECT)} height={Math.min(width * .5, (height * .45) / BOOK_ASPECT) * BOOK_ASPECT} /></View>;
  const slotted = top !== undefined || bottom !== undefined;
  return <View style={styles.root}>
    <View testID="passport-home" pointerEvents={focused || modelClosing ? "none" : "auto"} style={[styles.home, { paddingTop: insets.top + (slotted ? space.xs : size.hitTarget + space.xs) }]} accessibilityElementsHidden={focused} importantForAccessibility={focused ? "no-hide-descendants" : "auto"}>
      {top !== undefined ? <Animated.View style={[styles.slot, chromeMotion]}>{top}</Animated.View> : null}
      <Animated.View ref={modelStage} testID="passport-model-stage" onLayout={measureModel} style={[styles.model, modelMotion]}>
        {modelError ? null :
          <Passport3DView key={`${modelKey}-${coverColor ?? "master"}-${collectionTitle ?? "nostos"}`} running={screenActive && appActive} lowPower reduceMotion={reduced} soak={false} glassMode="auto" coverColor={coverColor} coverTitle={collectionTitle ?? undefined} open={opening} onTap={() => open()} onOpenProgress={onOpenProgress} onOpenSettled={onOpenSettled} onReady={() => { modelReady.current = true; setModelError(false); setTimeout(() => setModelShown(true), 120); }} onError={() => { modelReady.current = false; modelClosingRef.current = false; setModelShown(false); setModelClosing(false); setModelError(true); }} onGlass={() => undefined} onStats={() => undefined} />}
        {coverWidth > 0 ? (
          <Animated.View testID="passport-placeholder" pointerEvents={modelShown && !modelError ? "none" : "auto"} style={[StyleSheet.absoluteFill, styles.placeholder, placeholderMotion]}>
            <Cover width={coverWidth} height={Math.floor(coverWidth * BOOK_ASPECT)} counts={data.counts} showCounts={false} tint={coverColor ?? scene3d.passportCover} onOpen={modelError ? openPages : open} />
          </Animated.View>
        ) : null}
        {modelError ? <Tappable onPress={() => { setModelError(false); setModelKey((k) => k + 1); }} accessibilityRole="button" accessibilityLabel="Retry the 3D passport" style={[styles.close, styles.retry3d]}><Icon name="arrow.clockwise" size={size.iconSmall} color="textTertiary" /></Tappable> : null}
      </Animated.View>
      {/* On home the shelf replaces the counts; an empty counts block would only push the passport up by its padding. */}
      {collectionTitle || bottom === undefined ? <Animated.View style={[styles.counts, chromeMotion]}>{collectionTitle ? <NativeText numberOfLines={2} maxFontSizeMultiplier={maxFontSizeMultiplier} style={styles.collectionTitle}>{collectionTitle}</NativeText> : null}{bottom === undefined ? <Counts counts={data.counts} /> : null}{!collectionId && bottom === undefined && firstRun.show && data.counts.stamps === 0 ? <FirstRunHint onDismiss={firstRun.dismiss} /> : null}</Animated.View> : null}
      {bottom !== undefined ? <Animated.View style={[styles.slot, chromeMotion]}>{bottom}</Animated.View> : null}
    </View>
    <Modal visible={focused} transparent presentationStyle="overFullScreen" animationType="none" onRequestClose={close}>
      <View style={[styles.focus, { paddingTop: insets.top + FOCUS_TOP_SPACE, paddingBottom: insets.bottom + FOCUS_BOTTOM_SPACE, paddingLeft: insets.left + 8, paddingRight: insets.right + 8 }]} accessibilityViewIsModal>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, backdropMotion]} />
        <Animated.View testID="passport-reader-stage" pointerEvents={transitioning ? "none" : "auto"} style={readerMotion}>
          {compactReader ?
            <BookFrame pageWidth={book.pageWidth} pageHeight={book.pageHeight} page={current} total={total} coverColor={coverColor ?? scene3d.passportCover}>
              <SinglePageFlipBook key="focused-single-pages" pageWidth={book.pageWidth} pageHeight={book.pageHeight} total={total} page={current} onPageChange={setReaderIndex} renderPage={renderSinglePage} pageTaps stampTargets={stampTargets} />
            </BookFrame> :
            <FlipBook key="focused-spreads" pageWidth={book.pageWidth} pageHeight={book.pageHeight} total={total} spread={current} onSpreadChange={setReaderIndex} renderFace={renderFace} pageTaps stampTargets={stampTargets} />}
        </Animated.View>
        <Tappable onPress={close} accessibilityRole="button" accessibilityLabel="Close passport" accessibilityHint="Returns to the main screen without changing your page" onAccessibilityEscape={close} style={[styles.close, { position: "absolute", top: insets.top + 4, right: insets.right + 8 }]}><Icon name="xmark" color="textPrimary" size={size.iconSmall} /></Tappable>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  home: { flex: 1, paddingHorizontal: space.md, paddingBottom: space.xs, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg },
  model: { flex: 1, width: "100%", minHeight: 0 },
  counts: { width: "100%", alignItems: "center", paddingTop: space.md, gap: space.xs },
  slot: { width: "100%" },
  emptyPage: { alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.lg },
  retry3d: { position: "absolute", right: 0, bottom: 0 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  collectionTitle: { ...typeScale.title2, maxWidth: "88%", color: colors.textPrimary, textAlign: "center" },
  focus: { flex: 1, alignItems: "center", justifyContent: "center" },
  backdrop: { backgroundColor: colors.background },
  close: { minWidth: size.hitTarget, minHeight: size.hitTarget, alignItems: "center", justifyContent: "center" },
});
