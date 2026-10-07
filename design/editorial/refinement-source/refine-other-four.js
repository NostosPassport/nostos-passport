
const p=await figma.getNodeByIdAsync('61:19');await figma.setCurrentPageAsync(p);
const frames=await Promise.all(['61:303','61:591','61:848','61:1103'].map(id=>figma.getNodeByIdAsync(id)));
const fs=new Map();for(const f of frames)for(const t of f.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))fs.set(JSON.stringify(s.fontName),s.fontName);
await Promise.all([...fs.values(),{family:'Instrument Serif',style:'Regular'},{family:'Instrument Serif',style:'Italic'}].map(x=>figma.loadFontAsync(x)));
const ids=new Set(),created=[];const mark=n=>(ids.add(n.id),n);
const K={r:23/255,g:23/255,b:20/255},B={r:18/255,g:59/255,b:1};const paint=(c,o=1)=>({type:'SOLID',color:c,opacity:o});
const find=(f,s)=>f.findAllWithCriteria({types:['TEXT']}).find(n=>n.characters===s);
function display(f,s,size,y,lh=92){const n=mark(find(f,s));n.fontName={family:'Instrument Serif',style:'Regular'};n.fontSize=size;n.letterSpacing={unit:'PIXELS',value:-.8};n.lineHeight={unit:'PERCENT',value:lh};if(y!==undefined)n.y=y;return n;}
function line(parent,name,x,y,w,c=K,opacity=.45){const n=figma.createRectangle();parent.appendChild(n);n.name=name;n.resize(w,.65);n.x=x;n.y=y;n.fills=[paint(c,opacity)];created.push(n.id);return n;}
for(const f of frames){
mark(f).fills=[{type:'GRADIENT_LINEAR',gradientTransform:[[0,1,0],[-1,0,1]],gradientStops:[{position:0,color:{r:.970,g:.958,b:.933,a:1}},{position:1,color:{r:.953,g:.938,b:.900,a:1}}]}];
for(const n of f.findAll()){
if(n.name==='Subtle editable paper grain'){for(const dot of n.findAll()){if('fills' in dot&&Array.isArray(dot.fills)&&dot.fills.length){mark(dot).fills=dot.fills.map(q=>({...q,opacity:Math.min(.2,(q.opacity??1)*1.8)}));}}}
if(n.name==='Newspaper rule'){mark(n).opacity=.58;}
if(n.type==='TEXT'&&n.fontName.family==='Bodoni Moda'){mark(n).fontName={family:'Instrument Serif',style:'Regular'};n.letterSpacing={unit:'PIXELS',value:-.4};}
if(n.type==='RECTANGLE'&&Array.isArray(n.fills)&&n.fills.some(q=>q.type==='IMAGE'))mark(n).cornerRadius=1;
}
for(const n of f.findAllWithCriteria({types:['INSTANCE']})){
if(n.name.includes('button')){mark(n).cornerRadius=1;
const outline=n.name.includes('outline');if(outline){n.fills=[];n.strokes=[paint(K,.55)];n.strokeWeight=.65;for(const t of n.findAllWithCriteria({types:['TEXT']})){mark(t).fills=[paint(K)];}}
}
}
const nav=f.findOne(n=>n.name==='Passport / Stamp / Map');if(nav){
const stamp=nav.findOne(n=>n.name.startsWith('Stamp /'));const slot=mark(stamp.children[0]);slot.fills=[];slot.strokes=[paint(B,.8)];slot.strokeWeight=.8;slot.cornerRadius=22;
for(const n of slot.findAll())if('strokes' in n&&Array.isArray(n.strokes)&&n.strokes.length)mark(n).strokes=n.strokes.map(q=>({...q,color:B}));
for(const t of nav.findAllWithCriteria({types:['TEXT']}))mark(t).fontSize=12;
}
}
const [map,stamp,memory,sign]=frames;
const ml=mark(find(map,'NOSTOS'));ml.fontSize=46;ml.y=46;
display(map,'Go somewhere.',53,117,98);
const search=mark(map.findOne(n=>n.name.startsWith('Find a place')));search.cornerRadius=0;search.strokes=[];search.paddingLeft=0;line(search,'Search baseline',0,43,345,K,.38);
const filters=mark(map.findOne(n=>n.name.startsWith('Map filters')));filters.resize(345,44);filters.y=229;
for(const pill of filters.children){mark(pill);pill.resize(164,44);pill.cornerRadius=0;pill.fills=[];pill.strokes=[];for(const t of pill.findAllWithCriteria({types:['TEXT']}))mark(t).fills=[paint(K)];if(pill.name.startsWith('NEARBY'))line(pill,'Active nearby filter',0,42,164,B,.9);}
const ms=mark(map.findOne(n=>n.name==='Selected place sheet'));ms.cornerRadius=1;ms.strokes=[];line(map,'Place sheet top rule',24,594,345,K,.5);line(map,'Place sheet bottom rule',24,731,345,K,.5);
display(map,'Via Carota',38,628,104);mark(find(map,"You're close enough to stamp.")).fontSize=12;
const district=mark(find(map,'WEST VILLAGE'));district.x=54;district.y=482;district.resize(120,district.height);
display(stamp,'Make it\na memory.',70,98,88);mark(find(stamp,"VIA CAROTA · YOU'RE HERE")).y=231;
const cap=stamp.findOne(n=>n.name.startsWith('Caption ·'));const input=mark(cap.findOne(n=>n.name==='Caption input'));input.strokes=[];input.cornerRadius=0;input.paddingLeft=0;line(input,'Caption baseline',0,44,345,K,.45);
const photo=mark(stamp.findOne(n=>n.name.startsWith('Draft photo')));photo.cornerRadius=1;
display(memory,'Via Carota',65,126,96);
display(memory,'An afternoon\nworth keeping.',44,539,92);
display(memory,'New York, I Love You',21,641,112);
const record=memory.findOne(n=>n.name.startsWith('Record artwork'));mark(record).resize(42,42);record.x=29;record.y=645;
const markArt=mark(memory.findOne(n=>n.name==='Original Greek amphora travel stamp'));markArt.rotation=-4;markArt.x=278;markArt.y=241;markArt.strokeWeight=.65;
const sl=mark(find(sign,'NOSTOS'));sl.fontSize=72;sl.y=41;
const collage=mark(sign.findOne(n=>n.name.startsWith('Original Greek engraved')));collage.y=113;collage.resize(393,299);collage.cornerRadius=0;
collage.fills=collage.fills.map(q=>q.type==='IMAGE'?{...q,scaleMode:'CROP',imageTransform:[[.72,0,0],[0,.86,.01]]}:q);
display(sign,'Find your\nway back.',67,426,88);
const form=mark(sign.findOne(n=>n.name==='Sign in form'));form.y=563;form.itemSpacing=16;
for(const well of form.findAll().filter(n=>n.name==='Input · native keyboard')){
mark(well).cornerRadius=0;well.strokes=[];well.paddingLeft=0;well.strokes=[paint(K,.5)];well.strokeWeight=.65;
}
const signup=mark(find(sign,'New here? Create a passport'));signup.y=793;
const metrics=frames.map(f=>({id:f.id,name:f.name,counts:f.findAll().reduce((a,n)=>(a[n.type]=(a[n.type]??0)+1,a),{}),imageNodes:f.findAll().filter(n=>'fills' in n&&Array.isArray(n.fills)&&n.fills.some(q=>q.type==='IMAGE')).map(n=>({id:n.id,name:n.name,width:n.width,height:n.height})),headings:f.findAllWithCriteria({types:['TEXT']}).filter(n=>n.fontName.family==='Instrument Serif').map(n=>({text:n.characters,font:n.fontName,size:n.fontSize,x:n.x,y:n.y,width:n.width,height:n.height}))}));
return {mutatedNodeIds:[...ids],createdNodeIds:created,frames:metrics};
