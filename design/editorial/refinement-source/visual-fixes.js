
const p=await figma.getNodeByIdAsync('61:19');await figma.setCurrentPageAsync(p);const frames=await Promise.all(['61:303','61:591','61:1103'].map(id=>figma.getNodeByIdAsync(id)));const fs=new Map();for(const f of frames)for(const t of f.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))fs.set(JSON.stringify(s.fontName),s.fontName);await Promise.all([...fs.values()].map(f=>figma.loadFontAsync(f)));const ids=[];
for(const f of frames)for(const n of f.findAll()){
if(['Search baseline','Active nearby filter','Caption baseline'].includes(n.name)){
n.layoutPositioning='ABSOLUTE';n.x=0;n.y=n.name==='Search baseline'?43:n.name==='Active nearby filter'?42:44;ids.push(n.id);
}
if(n.name==='Input · native keyboard'){n.paddingLeft=10;n.strokeTopWeight=0;n.strokeLeftWeight=0;n.strokeRightWeight=0;n.strokeBottomWeight=.65;ids.push(n.id);}
}
return {mutatedNodeIds:ids};
