/** Keeps the existing GL scene in the actual native buffer's aspect ratio after layout changes. */
export function createViewportSizer(renderer:{setSize:(width:number,height:number,updateStyle:boolean)=>void},camera:{aspect:number;updateProjectionMatrix:()=>void}) {
 let previousWidth=0,previousHeight=0;
 return (width:number,height:number):boolean=>{
  if(width<=0||height<=0||!Number.isFinite(width)||!Number.isFinite(height)||width===previousWidth&&height===previousHeight)return false;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  previousWidth=width;previousHeight=height;return true;
 };
}
