import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { State } from "react-native-gesture-handler";
import type { StampView } from "@/api/contracts";
import { PassportBook } from "../PassportBook";
import type { PassportData } from "../use-passport";
import { Dimensions } from "react-native";
let mockReduced=false;
jest.mock("react-native-reanimated",()=>({...jest.requireActual("react-native-reanimated/mock"),useSharedValue:(value:unknown)=>jest.requireActual("react").useState(()=>({value}))[0],useReducedMotion:()=>mockReduced}));
const mockPush=jest.fn();
let mockFocus:()=>void;
let mockData:PassportData;
jest.mock("expo-router",()=>({router:{push:(...a:unknown[])=>mockPush(...a)},useFocusEffect:(cb:()=>void)=>{mockFocus=cb;}}));
jest.mock("../use-passport",()=>({usePassport:()=>mockData}));
jest.mock("../../lab3d/Passport3DView",()=>{ const {Pressable}=jest.requireActual("react-native"); return ({Passport3DView:({onTap}:{onTap:()=>void})=><Pressable accessibilityRole="button" accessibilityLabel="Open your passport" onPress={onTap}/> }); });
jest.mock("../first-run",()=>({useFirstRun:()=>({show:false,dismiss:jest.fn()})}));
const stamp = (id: string, page: number, slot: number, name: string): StampView => ({
  id, photoUrl: null, photos: [], caption: "", song: null, page, slot,
  createdAt: "2026-10-08T20:00:00.000Z", visitedAt: "2026-10-03T00:00:00.000Z", verifiedAt: null, verified: false, editedAt: null,
  place: { id: `p-${id}`, slug: id, name, neighborhood: "East Village", neighborhoodId: null },
});
const ready = (over: Partial<PassportData> = {}): PassportData => ({
  status: "ready", handle: "ava", displayName: "Ava Lee", avatarUrl: null, bio: "", memberSince: "2026-10-03T04:00:00.000Z", stamps: [], pins: [],
  counts: { stamps: 0, places: 0, neighborhoods: 0 }, neighborhoods: [], retry: jest.fn(), ...over,
});

const tapPage=async(x:number)=>{await act(()=>fireGestureHandler(getByGestureTestId("flip-tap"),[{state:State.BEGAN,x,y:15},{state:State.ACTIVE,x,y:15},{state:State.END,x,y:15}]));};
describe("PassportBook focused reading",()=>{
 beforeEach(()=>{mockPush.mockClear();mockReduced=false;Dimensions.set({window:{width:390,height:844,scale:3,fontScale:1},screen:{width:390,height:844,scale:3,fontScale:1}});});afterEach(()=>jest.restoreAllMocks());
 it("loading and failed fetch never show a model or trap the user",async()=>{
  mockData=ready({status:"pending"});const v=await render(<PassportBook/>);
  expect(screen.getByRole("progressbar",{name:"Opening your passport"})).toBeTruthy();
  expect(screen.queryByLabelText("Open your passport")).toBeNull();
  mockData=ready({status:"error"});await v.rerender(<PassportBook/>);
  expect(screen.getByText("Try again")).toBeTruthy();expect(screen.queryByLabelText("Open your passport")).toBeNull();
 });
 it("main model opens a full-screen modal; Close has a 44pt target and restores main counts",async()=>{
  mockData=ready({counts:{stamps:7,places:5,neighborhoods:2}});await render(<PassportBook/>);
  expect(screen.getByLabelText("7 stamps, 5 places, 2 neighborhoods")).toBeVisible();
  await fireEvent.press(screen.getByLabelText("Open your passport"));
  expect(screen.queryByLabelText("7 stamps, 5 places, 2 neighborhoods")).toBeNull();
  const close=screen.getByLabelText("Close passport");expect(close).toHaveStyle({minWidth:44,minHeight:44});
  expect(screen.queryByLabelText("Next page")).toBeNull();expect(screen.queryByLabelText("Previous page")).toBeNull();expect(screen.queryByLabelText("Index")).toBeNull();
  await fireEvent.press(close);expect(screen.getByLabelText("7 stamps, 5 places, 2 neighborhoods")).toBeVisible();
 });
 it("an empty passport holds on the bearer spread instead of adding an empty spread",async()=>{
  mockData=ready();await render(<PassportBook/>);await fireEvent.press(screen.getByLabelText("Open your passport"));
  await tapPage(10);await tapPage(300);
  expect(screen.getByLabelText("Passport pages").props.accessibilityValue).toMatchObject({now:1,max:1});
  expect(screen.queryByLabelText("Page 1")).toBeNull();expect(screen.getByLabelText("Close passport")).toBeTruthy();
 });
 it.each([false,true])("four stamps: both boundary faces and final right stamp work with Reduce Motion=%s",async(reduced)=>{
  mockReduced=reduced;
  mockData=ready({stamps:[stamp("s1",1,1,"First"),stamp("s2",1,2,"Second"),stamp("s3",1,3,"Third"),stamp("s4",2,1,"Fourth")],counts:{stamps:4,places:4,neighborhoods:1}});
  await render(<PassportBook/>);await fireEvent.press(screen.getByLabelText("Open your passport"));
  expect(screen.getByLabelText("Nostos. The longing to return home.")).toBeVisible();expect(screen.getByText("NOSTOS PASSPORT")).toBeVisible();
  await tapPage(300);
  expect(screen.getByLabelText("Passport pages").props.accessibilityValue.now).toBe(2);
  expect(screen.getByLabelText("Page 1")).toBeVisible();expect(screen.getByLabelText("Page 2")).toBeVisible();
  const fourth=screen.getByRole("button",{name:"Stamp, Fourth, page 2, slot 1"});expect(fourth).toBeVisible();await fireEvent.press(fourth);
  expect(mockPush).toHaveBeenCalledWith({pathname:"/stamp/[id]",params:{id:"s4"}});
  await act(()=>mockFocus());expect(screen.getByLabelText("Passport pages").props.accessibilityValue.now).toBe(2);
  expect(screen.getByLabelText("Page 2")).toBeVisible();
  await fireEvent.press(screen.getByLabelText("Close passport"));await fireEvent.press(screen.getByLabelText("Open your passport"));
  expect(screen.getByLabelText("Passport pages").props.accessibilityValue.now).toBe(2);
  await tapPage(10);expect(screen.getByLabelText("Passport pages").props.accessibilityValue.now).toBe(1);
 });
});
