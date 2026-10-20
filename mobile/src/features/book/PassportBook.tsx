import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Modal, Pressable, StyleSheet, Text as NativeText, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection } from "@/api/queries";
import { collectionColorValue } from "@/features/collections/colors";
import { bookMotion, colors, size, space, type as typeScale } from "@/theme";
import { Passport3DView } from "../lab3d/Passport3DView";
import { READER_AT, SPREAD_FILL } from "../lab3d/open-motion";
import { BearerPage } from "./BearerPage";
import { Counts } from "./Cover";
import { FlipBook } from "./FlipBook";
import { FirstRunHint } from "./FirstRunHint";
import { useFirstRun } from "./first-run";
import { InsideCover } from "./InsideCover";
import { PageView } from "./PageView";
import { type PageFace, groupByPage } from "./spreads";
import { slotPlacement } from "./slots";
import { FOCUS_TOP_SPACE, FOCUS_BOTTOM_SPACE, focusBookSize, focusSpreadCount, stampHitRect } from "./focus-interaction";
import { usePassport } from "./use-passport";

/* eslint-disable react-hooks/immutability -- Reanimated shared values are written through .value by design */
type Props = { collectionId?: string };

export function PassportBook({ collectionId }: Props = {}) {
 const master=usePassport();
 const collectionQuery=useCollection(collectionId??"",!!collectionId);
 const collection=collectionQuery.data?.collection??null;
 const customStamps=collection?.stamps??[];
 const customPlaces=new Set(customStamps.map(stamp=>stamp.place.id)).size;
 const customNeighborhoods=new Set(customStamps.map(stamp=>stamp.place.neighborhoodId).filter(Boolean)).size;
 const customStatus=master.status==="error"||collectionQuery.isError?"error":master.status==="pending"||collectionQuery.isPending?"pending":"ready";
 const data=collectionId?{
  ...master,
  status:customStatus as "pending"|"error"|"ready",
  stamps:customStamps,
  counts:{stamps:customStamps.length,places:customPlaces,neighborhoods:customNeighborhoods},
  retry:()=>{master.retry();void collectionQuery.refetch();},
 }:master;
 const coverColor=collection?collectionColorValue(collection.color):undefined;
 const collectionTitle=collection?.name??null;
 const firstRun=useFirstRun();
 const openPages=()=>{firstRun.dismiss();setTransitioning(true);setFocused(true);};
 const open=()=>{
  if(modelClosing)return;
  if(!modelReady.current){openPages();return;}
  firstRun.dismiss();readerRequested.current=false;setOpening(true);
 };
 const {width,height}=useWindowDimensions();
 const insets=useSafeAreaInsets();
 const reduced=useReducedMotion();
 const [focused,setFocused]=useState(false);
 const [spread,setSpread]=useState(0);
 const [transitioning,setTransitioning]=useState(false);
 const [opening,setOpening]=useState(false);
 const [modelClosing,setModelClosing]=useState(false);
 const [modelFrame,setModelFrame]=useState({y:0,height:0,width:0});
 const progress=useSharedValue(0);
 const openProgress=useSharedValue(0);
 const modelReady=useRef(false);
 const readerRequested=useRef(false);
 const closing=useSharedValue(false);
 const finishClose=()=>{setFocused(false);setTransitioning(false);readerRequested.current=false;};
 useEffect(()=>{
  closing.value=false;
  if(!focused){progress.value=0;return;}
  progress.value=withTiming(1,{duration:reduced?0:bookMotion.durations.standard},finished=>{if(finished)scheduleOnRN(setTransitioning,false);});
 },[focused,reduced,progress,closing]);
 const backdropMotion=useAnimatedStyle(()=>({opacity:progress.value}));
 const readerMotion=useAnimatedStyle(()=>({opacity:reduced?progress.value:interpolate(progress.value,[0,0.3,1],[0,0,1]),transform:[{scale:reduced?1:interpolate(progress.value,[0,1],[0.92,1])}]}));
 const [screenActive,setScreenActive]=useState(true);
 const [appActive,setAppActive]=useState(AppState.currentState!=="background"&&AppState.currentState!=="inactive");
 const [modelError,setModelError]=useState(false);
 const [modelKey,setModelKey]=useState(0);
 const returnToFocus=useRef(false);
 useFocusEffect(useCallback(()=>{
  setScreenActive(true);
  if(returnToFocus.current){returnToFocus.current=false;setTransitioning(true);setFocused(true);}
  return ()=>setScreenActive(false);
 },[]));
 useEffect(()=>{const sub=AppState.addEventListener("change",s=>setAppActive(s==="active"));return()=>sub.remove();},[]);
 const total=focusSpreadCount(data.stamps.map(s=>s.page));
 const current=Math.min(spread,total-1);
 const book=focusBookSize(width-insets.left-insets.right,height-insets.top-insets.bottom);
 const fitScale=modelFrame.width>0?Math.min(1.6,Math.max(1,(book.pageWidth*2)/(SPREAD_FILL*modelFrame.width))):1.1;
 const modelMotion=useAnimatedStyle(()=>{
  const sourceCenter=insets.top+size.hitTarget+space.xs+modelFrame.y+modelFrame.height/2;
  const destinationCenter=(height+insets.top-insets.bottom+FOCUS_TOP_SPACE-FOCUS_BOTTOM_SPACE)/2;
  return {transform:[{translateY:reduced?0:openProgress.value*(destinationCenter-sourceCenter)},{scale:reduced?1:interpolate(openProgress.value,[0,1],[1,fitScale])}]};
 });
 const chromeMotion=useAnimatedStyle(()=>({opacity:interpolate(openProgress.value,[0,0.33],[1,0],"clamp")}));
 const requestReader=()=>{if(readerRequested.current)return;readerRequested.current=true;setTransitioning(true);setFocused(true);};
 const onOpenProgress=(p:number)=>{openProgress.value=p;if(opening&&p>=READER_AT)requestReader();};
 const onOpenSettled=(isOpen:boolean)=>{
  if(isOpen&&opening)requestReader();
  else if(!isOpen){readerRequested.current=false;setModelClosing(false);}
 };
 const byPage=useMemo(()=>groupByPage(data.stamps),[data.stamps]);
 const pinnedIds=useMemo(()=>data.pins.map(s=>s.id),[data.pins]);
 const stampTargets=useMemo(()=>[current*2-1,current*2].flatMap((p,index)=>
  (byPage.get(p)??[]).map(s=>stampHitRect(slotPlacement(s.id,s.slot??1,book.pageWidth,book.pageHeight),index*book.pageWidth))),[byPage,current,book.pageWidth,book.pageHeight]);
 const close=()=>{
  if(closing.value)return;
  closing.value=true;setTransitioning(true);
  if(modelReady.current&&opening){setModelClosing(true);setOpening(false);}
  progress.value=withTiming(0,{duration:reduced?0:bookMotion.durations.standard},finished=>{if(finished)scheduleOnRN(finishClose);});
 };
 const openStamp=(id:string)=>{returnToFocus.current=true;setFocused(false);router.push({pathname:"/stamp/[id]",params:{id}});};
 const renderFace=(face:PageFace,side:"left"|"right")=>{
  if(face.kind==="inside-cover")return <InsideCover width={book.pageWidth} height={book.pageHeight}/>;
  if(face.kind==="bearer")return <BearerPage width={book.pageWidth} height={book.pageHeight} bearer={{displayName:data.displayName,handle:data.handle,memberSince:data.memberSince,bio:data.bio}} avatarUrl={data.avatarUrl}/>;
  return <PageView page={face.page} side={side} width={book.pageWidth} height={book.pageHeight} stamps={byPage.get(face.page)??[]} pinnedIds={pinnedIds} onStampPress={s=>openStamp(s.id)}/>;
 };
 if(data.status==="error")return <View style={styles.center}><InlineError message="Couldn't open your passport. Your connection may be down." onRetry={data.retry}/></View>;
 if(data.status==="pending")return <View style={styles.center} accessible accessibilityRole="progressbar" accessibilityLabel="Opening your passport"><Skeleton width={width*.8} height={height*.5}/></View>;
 return <View style={styles.root}>
  <View testID="passport-home" pointerEvents={focused||modelClosing?"none":"auto"} style={[styles.home,{paddingTop:insets.top+size.hitTarget+space.xs}]} accessibilityElementsHidden={focused} importantForAccessibility={focused?"no-hide-descendants":"auto"}>
   <Animated.View testID="passport-model-stage" onLayout={e=>setModelFrame({y:e.nativeEvent.layout.y,height:e.nativeEvent.layout.height,width:e.nativeEvent.layout.width})} style={[styles.model,modelMotion]}>
    {modelError?<View style={styles.center}><InlineError message="Couldn't load the 3D passport." onRetry={()=>{setModelError(false);setModelKey(k=>k+1);}}/><Pressable onPress={openPages} accessibilityRole="button" accessibilityLabel="Open stamp pages" style={styles.close}><Icon name="book" size={size.icon} color="accent"/></Pressable></View>:
    <Passport3DView key={`${modelKey}-${coverColor??"master"}`} running={screenActive&&appActive} lowPower reduceMotion={reduced} soak={false} glassMode="auto" coverColor={coverColor} open={opening} onTap={()=>open()} onOpenProgress={onOpenProgress} onOpenSettled={onOpenSettled} onReady={()=>{modelReady.current=true;setModelError(false);}} onError={()=>{modelReady.current=false;setModelClosing(false);setModelError(true);}} onGlass={()=>undefined} onStats={()=>undefined}/>} 
   </Animated.View>
   <Animated.View style={[styles.counts,chromeMotion]}>{collectionTitle?<NativeText numberOfLines={2} style={styles.collectionTitle}>{collectionTitle}</NativeText>:null}<Counts counts={data.counts}/>{!collectionId&&firstRun.show?<FirstRunHint onDismiss={firstRun.dismiss}/>:null}</Animated.View>
  </View>
  <Modal visible={focused} transparent presentationStyle="overFullScreen" animationType="none" onRequestClose={close}>
   <View style={[styles.focus,{paddingTop:insets.top+FOCUS_TOP_SPACE,paddingBottom:insets.bottom+FOCUS_BOTTOM_SPACE,paddingLeft:insets.left+8,paddingRight:insets.right+8}]} accessibilityViewIsModal>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,styles.backdrop,backdropMotion]}/>
    <Animated.View testID="passport-reader-stage" pointerEvents={transitioning?"none":"auto"} style={readerMotion}>
    <FlipBook key="focused-pages" pageWidth={book.pageWidth} pageHeight={book.pageHeight} total={total} spread={current} onSpreadChange={setSpread} renderFace={renderFace} pageTaps stampTargets={stampTargets}/>
    </Animated.View>
    <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close passport" accessibilityHint="Returns to the main screen without changing your page" onAccessibilityEscape={close} style={[styles.close,{position:"absolute",top:insets.top+4,right:insets.right+8}]}><Icon name="xmark" color="textPrimary" size={size.iconSmall}/></Pressable>
   </View>
  </Modal>
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.background},home:{flex:1,paddingHorizontal:space.md,paddingBottom:space.xs,alignItems:"center"},center:{flex:1,alignItems:"center",justifyContent:"center",padding:space.lg},
 model:{flex:1,width:"100%",minHeight:0},counts:{width:"100%",alignItems:"center",paddingTop:space.md,gap:space.xs},collectionTitle:{...typeScale.title2,maxWidth:"88%",color:colors.textPrimary,textAlign:"center"},focus:{flex:1,alignItems:"center",justifyContent:"center"},backdrop:{backgroundColor:colors.background},close:{minWidth:size.hitTarget,minHeight:size.hitTarget,alignItems:"center",justifyContent:"center"},
});
