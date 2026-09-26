import type { Obstacle, WorldDefinition, WorldObject, EnemySeed, Point } from './types';

const obj = (id:string, kind:WorldObject['kind'], x:number, y:number, name:string, icon?:string):WorldObject => ({id,kind,x,y,name,icon});
const treeLine = (seed:number, count:number, w:number, h:number, avoid:Point[] = []):Obstacle[] => {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out:Obstacle[]=[];
  let attempts=0;
  while(out.length<count && attempts<count*12){
    attempts++; const x=90+rand()*(w-180); const y=100+rand()*(h-200);
    if(avoid.some(p=>Math.hypot(p.x-x,p.y-y)<165)) continue;
    if(out.some(p=>Math.hypot(p.x-x,p.y-y)<105)) continue;
    out.push({x,y,r:18+rand()*13,kind:rand()>.77?'rock':rand()>.65?'bush':'tree'});
  }
  return out;
};
const positions1=[{x:260,y:260},{x:470,y:300},{x:500,y:620},{x:330,y:1510},{x:730,y:360},{x:1410,y:590},{x:2400,y:850},{x:790,y:1160},{x:1570,y:1320},{x:2380,y:1510},{x:2690,y:1740}];
const positions2=[{x:250,y:250},{x:450,y:300},{x:480,y:590},{x:320,y:1500},{x:730,y:370},{x:1390,y:600},{x:2380,y:850},{x:800,y:1160},{x:1570,y:1300},{x:2380,y:1500},{x:2670,y:1740}];

const meadowObjects:WorldObject[]=[
  obj('bridgekeeper','npc',470,300,'Bridgekeeper','!'),obj('elder','npc',500,620,'Elder Rowan','!'),obj('courier','npc',330,1510,'Pip the Courier','!'),
  obj('crystal-a','crystal',730,360,'Sun-crystal'),obj('crystal-b','crystal',1410,590,'Sun-crystal'),obj('crystal-c','crystal',2400,850,'Sun-crystal'),
  obj('glow-a','glowbug',790,1160,'Glowbug'),obj('glow-b','glowbug',1570,1320,'Glowbug'),obj('glow-c','glowbug',2380,1510,'Glowbug'),
  obj('lost-bell','bell',980,1660,'Lost bell'),obj('meadow-beacon','beacon',2690,1740,'Meadow Beacon','✦'),
];
const woodsObjects:WorldObject[]=[
  obj('forest-keeper','npc',450,300,'Mosskeeper','!'),obj('courier-two','npc',320,1500,'Pip the Courier','!'),obj('bellkeeper','npc',480,590,'Old Bellkeeper','!'),
  obj('rune-a','rune',730,370,'Root rune'),obj('rune-b','rune',1390,600,'Root rune'),obj('rune-c','rune',2380,850,'Root rune'),
  obj('moth-a','moth',800,1160,'Moon moth'),obj('moth-b','moth',1570,1300,'Moon moth'),obj('moth-c','moth',2380,1500,'Moon moth'),
  obj('satchel','satchel',980,1660,'Courier satchel'),obj('shield-shrine','shrine',740,920,'Moss Shield Shrine','✧'),obj('root-bell','rootbell',2670,1740,'Ancient Root Bell','♫'),
];
const meadowEnemies:EnemySeed[]=[];
let n=0;
for(const [cx,cy] of [[800,720],[1260,930],[1960,520],[2240,1230],[1430,1550],[560,1030],[2010,1680]]){
  meadowEnemies.push({id:`meadow-gloom-${n++}`,kind:'gloomling',x:cx as number,y:cy as number});
}
for(const [cx,cy] of [[1120,400],[1840,1040],[680,1370]]) meadowEnemies.push({id:`meadow-thorn-${n++}`,kind:'thornling',x:cx as number,y:cy as number});
meadowEnemies.push({id:'boss-mossback',kind:'mossback',x:2570,y:1680,boss:true});
const woodsEnemies:EnemySeed[]=[];
n=0;
for(const [cx,cy] of [[800,730],[1260,930],[1970,520],[2250,1220],[1420,1550],[560,1030],[2010,1680],[1740,360]]) woodsEnemies.push({id:`woods-gloom-${n++}`,kind:'gloomling',x:cx as number,y:cy as number});
for(const [cx,cy] of [[1110,410],[1830,1040],[680,1370],[2290,530]]) woodsEnemies.push({id:`woods-thorn-${n++}`,kind:'thornling',x:cx as number,y:cy as number});
woodsEnemies.push({id:'boss-bramble-warden',kind:'brambleWarden',x:2560,y:1680,boss:true});

export const WORLDS:Record<'meadow'|'woods',WorldDefinition>={
  meadow:{id:'meadow',title:'Sunpetal Meadow',subtitle:'The Broken Beacon',width:3000,height:2100,spawn:{x:260,y:260},palette:{ground:'#7f9b58',alternate:'#89a661',path:'#cbb783',pathEdge:'#9d885e',accent:'#f5cd5c',water:'#4f93a0'},objects:meadowObjects,obstacles:treeLine(17,62,3000,2100,positions1),enemies:meadowEnemies,route:[{x:260,y:260},{x:720,y:370},{x:980,y:680},{x:1460,y:600},{x:1780,y:880},{x:2200,y:930},{x:2650,y:1720}],zoneLabels:[{x:410,y:240,name:'BRIDGEKEEPER’S REST'},{x:1160,y:640,name:'SUNPETAL FIELDS'},{x:1920,y:1180,name:'OLD STONE GARDEN'},{x:2510,y:1580,name:'THE BEACON RISE'}]},
  woods:{id:'woods',title:'Whisperroot Woods',subtitle:'The Bell Beneath the Roots',width:3000,height:2100,spawn:{x:260,y:260},palette:{ground:'#536f54',alternate:'#5e795b',path:'#b5a47a',pathEdge:'#807857',accent:'#b6df91',water:'#456d75'},objects:woodsObjects,obstacles:treeLine(72,76,3000,2100,positions2),enemies:woodsEnemies,route:[{x:260,y:260},{x:740,y:370},{x:980,y:700},{x:1420,y:600},{x:1760,y:940},{x:2190,y:930},{x:2630,y:1720}],zoneLabels:[{x:410,y:230,name:'MOSSKEEPER’S CAMP'},{x:1160,y:650,name:'WHISPERROOT TRAIL'},{x:1920,y:1180,name:'ROOT-CAVE APPROACH'},{x:2500,y:1570,name:'THE OLD BELL'}]},
};
