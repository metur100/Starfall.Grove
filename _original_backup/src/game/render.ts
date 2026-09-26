import type { GameEngine } from './engine';
import type { Enemy, Point, WorldObject } from './types';

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function diamond(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string){ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.7,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.7,y);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.68)';ctx.lineWidth=2;ctx.stroke();}
function drawGround(ctx:CanvasRenderingContext2D,w:number,h:number,cam:Point,engine:GameEngine){
  const p=engine.world.palette;ctx.fillStyle=p.ground;ctx.fillRect(cam.x,cam.y,w,h);
  const sx=Math.floor(cam.x/88)*88, sy=Math.floor(cam.y/88)*88;
  for(let y=sy;y<cam.y+h+88;y+=88)for(let x=sx;x<cam.x+w+88;x+=88){const v=Math.abs(Math.sin(x*12.9898+y*78.233));ctx.fillStyle=v>.48?p.alternate:p.ground;ctx.globalAlpha=.19;ctx.beginPath();ctx.ellipse(x+16+v*46,y+20+(1-v)*43,17+v*9,8+v*5,v,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='rgba(244,241,200,.17)';ctx.beginPath();ctx.arc(x+9+v*61,y+63-v*29,1.4,0,Math.PI*2);ctx.fill();}
  // Winding footpath connecting the story locations.
  ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();engine.world.route.forEach((pt,i)=>{const x=pt.x,y=pt.y;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.strokeStyle=p.pathEdge;ctx.lineWidth=92;ctx.stroke();ctx.strokeStyle=p.path;ctx.lineWidth=72;ctx.stroke();
  for(const zone of engine.world.zoneLabels){ctx.save();ctx.translate(zone.x,zone.y);ctx.fillStyle='rgba(33,54,38,.2)';ctx.font='700 18px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(zone.name,0,0);ctx.restore();}
  // Small ponds are decorative landmarks, never hazards.
  const ponds=engine.world.id==='meadow'?[{x:1780,y:450,r:175},{x:720,y:1500,r:125},{x:2200,y:1420,r:135}]:[{x:1760,y:460,r:175},{x:720,y:1500,r:115},{x:2190,y:1400,r:145}];
  for(const pond of ponds){ctx.fillStyle='rgba(36,60,42,.18)';ctx.beginPath();ctx.ellipse(pond.x+5,pond.y+13,pond.r*1.1,pond.r*.64,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.water;ctx.globalAlpha=.9;ctx.beginPath();ctx.ellipse(pond.x,pond.y,pond.r,pond.r*.58,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='rgba(224,240,188,.32)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(pond.x-15,pond.y-12,pond.r*.62,pond.r*.26,-.12,0,Math.PI*2);ctx.stroke();}
}
function drawTree(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,kind:string,time:number){
  ctx.fillStyle='rgba(21,38,27,.23)';ctx.beginPath();ctx.ellipse(x+6,y+r*.55,r*1.12,r*.48,0,0,Math.PI*2);ctx.fill();
  if(kind==='rock'){ctx.fillStyle='#858879';ctx.beginPath();ctx.moveTo(x-r,y+r*.25);ctx.lineTo(x-r*.65,y-r*.55);ctx.lineTo(x+r*.1,y-r);ctx.lineTo(x+r*.85,y-r*.35);ctx.lineTo(x+r,y+r*.35);ctx.lineTo(x+r*.3,y+r*.75);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.ellipse(x-r*.15,y-r*.35,r*.45,r*.16,-.4,0,Math.PI*2);ctx.fill();return;}
  if(kind==='bush'){ctx.fillStyle='#668652';for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(x+(i-1.5)*r*.35,y+Math.sin(i)*r*.1,r*.47,0,Math.PI*2);ctx.fill();}return;}
  const dark=ctx.createRadialGradient(x-r*.25,y-r*.4,2,x,y,r*1.3);dark.addColorStop(0,'#93ad65');dark.addColorStop(1,'#385b42');ctx.fillStyle=dark;ctx.beginPath();ctx.arc(x,y-r*.08,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.13)';ctx.beginPath();ctx.ellipse(x-r*.3,y-r*.42,r*.36,r*.16,-.4+Math.sin(time+y)*.02,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6f5337';ctx.fillRect(x-r*.18,y+r*.48,r*.36,r*.52);
}
function drawObject(ctx:CanvasRenderingContext2D,o:WorldObject,time:number,near:boolean){
  const bob=Math.sin(time*2.2+o.x*.03)*3;const x=o.x,y=o.y+bob;
  ctx.fillStyle='rgba(26,42,29,.18)';ctx.beginPath();ctx.ellipse(x,y+18,25,11,0,0,Math.PI*2);ctx.fill();
  if(o.kind==='crystal'||o.kind==='rune'){
    ctx.globalAlpha=.22;ctx.fillStyle=o.kind==='crystal'?'#ffe286':'#b5f5d8';ctx.beginPath();ctx.arc(x,y,34,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    diamond(ctx,x,y,23,o.kind==='crystal'?'#f5d266':'#8ee0be');ctx.fillStyle='rgba(255,255,255,.58)';ctx.beginPath();ctx.moveTo(x,y-17);ctx.lineTo(x+5,y-2);ctx.lineTo(x,y+1);ctx.closePath();ctx.fill();
  }else if(o.kind==='glowbug'||o.kind==='moth'){
    ctx.globalAlpha=.2;ctx.fillStyle='#fff49b';ctx.beginPath();ctx.arc(x,y,27,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#fff2a1';ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-2,y-2,2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(255,246,171,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x-8,y,8,4,-.6,0,Math.PI*2);ctx.ellipse(x+8,y,8,4,.6,0,Math.PI*2);ctx.stroke();
  }else if(o.kind==='bell'||o.kind==='satchel'){
    ctx.fillStyle=o.kind==='bell'?'#e7cb75':'#b96b4f';ctx.beginPath();ctx.roundRect(x-15,y-14,30,27,7);ctx.fill();ctx.fillStyle='#f7e8ae';ctx.beginPath();ctx.arc(x,y-13,6,Math.PI,0);ctx.fill();ctx.fillStyle='#6d5637';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText(o.kind==='bell'?'♫':'✦',x,y+5);
  }else if(o.kind==='beacon'||o.kind==='rootbell'){
    const c=o.kind==='beacon'?'#ffe58a':'#c1e7b9';ctx.globalAlpha=.12;ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,56+Math.sin(time*2)*5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#756548';ctx.beginPath();ctx.roundRect(x-26,y-8,52,42,7);ctx.fill();ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y-15,19,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff5bb';ctx.font='18px sans-serif';ctx.textAlign='center';ctx.fillText(o.kind==='beacon'?'✦':'♫',x,y-9);
  }else if(o.kind==='shrine'){
    ctx.fillStyle='#5d6c4e';ctx.beginPath();ctx.roundRect(x-27,y-16,54,42,10);ctx.fill();ctx.strokeStyle='#c6e8ac';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y-18,15,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d7efb6';ctx.font='17px sans-serif';ctx.textAlign='center';ctx.fillText('✧',x,y-12);
  }else if(o.kind==='npc'){
    const colors:Record<string,string>={bridgekeeper:'#d99857',elder:'#818ca8',courier:'#c16d59','forest-keeper':'#728f5a','courier-two':'#c16d59',bellkeeper:'#9c7860'};const color=colors[o.id]||'#d6a35b';
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y+3,17,21,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#efc5a0';ctx.beginPath();ctx.arc(x,y-17,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4b3b32';ctx.beginPath();ctx.arc(x-4,y-18,1.5,0,Math.PI*2);ctx.arc(x+4,y-18,1.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#465a42';ctx.beginPath();ctx.arc(x,y-28,16,Math.PI,Math.PI*2);ctx.fill();
  }
  if(o.kind==='npc'||o.kind==='beacon'||o.kind==='rootbell'){
    ctx.fillStyle=o.kind==='npc'?'#f3d66f':'#fff3a5';ctx.beginPath();ctx.arc(x,y-52,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3b503a';ctx.font='bold 13px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(o.kind==='npc'?'!':'✦',x,y-47);
  }
  if(near){ctx.fillStyle='rgba(27,43,31,.74)';ctx.beginPath();ctx.roundRect(x-62,y+37,124,22,7);ctx.fill();ctx.fillStyle='#f7f2dd';ctx.font='11px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(o.name,x,y+52);}
}
function drawEnemy(ctx:CanvasRenderingContext2D,e:Enemy,time:number){
  if(e.dead)return;const boss=!!e.boss;const r=boss?38:e.kind==='thornling'?22:19;const wob=Math.sin(time*4+e.x*.02)*2;
  ctx.fillStyle='rgba(20,30,25,.24)';ctx.beginPath();ctx.ellipse(e.x,e.y+r*.72,r*1.2,r*.48,0,0,Math.PI*2);ctx.fill();
  if(e.windup>0){const phaseTwo=e.kind==='brambleWarden'&&e.hp<=e.maxHp/2;const warningRadius=boss?(phaseTwo?170:145):e.kind==='thornling'?90:74;ctx.fillStyle='rgba(228,102,79,.16)';ctx.beginPath();ctx.arc(e.x,e.y,warningRadius,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(246,165,115,.83)';ctx.lineWidth=3;ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(e.x,e.y,warningRadius,0,Math.PI*2);ctx.stroke();if(phaseTwo){ctx.beginPath();ctx.arc(e.x,e.y,warningRadius*.62,0,Math.PI*2);ctx.stroke();}ctx.setLineDash([]);}
  if(e.kind==='mossback'||e.kind==='brambleWarden'){
    ctx.fillStyle=e.hitFlash>0?'#fff1c0':e.kind==='mossback'?'#657c4e':'#526b55';ctx.beginPath();ctx.ellipse(e.x,e.y,r*1.15,r*.93,wob*.015,0,Math.PI*2);ctx.fill();ctx.fillStyle=e.kind==='mossback'?'#a6ba73':'#91b28a';for(let i=0;i<5;i++){const a=i*1.26;ctx.beginPath();ctx.arc(e.x+Math.cos(a)*r*.7,e.y+Math.sin(a)*r*.7,8,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#322c2b';ctx.beginPath();ctx.arc(e.x-10,e.y-4,3,0,Math.PI*2);ctx.arc(e.x+10,e.y-4,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e5a46d';ctx.beginPath();ctx.moveTo(e.x-6,e.y+11);ctx.lineTo(e.x,e.y+17);ctx.lineTo(e.x+6,e.y+11);ctx.fill();
  }else{
    ctx.fillStyle=e.hitFlash>0?'#fff0c2':e.kind==='thornling'?'#74824c':'#514b78';ctx.beginPath();ctx.ellipse(e.x,e.y+wob,r,r*.84,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.14)';ctx.beginPath();ctx.ellipse(e.x-r*.28,e.y-r*.22,r*.3,r*.18,-.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f6e9c6';ctx.beginPath();ctx.arc(e.x-6,e.y-2,2.7,0,Math.PI*2);ctx.arc(e.x+6,e.y-2,2.7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#443743';ctx.beginPath();ctx.arc(e.x-6,e.y-2,1,0,Math.PI*2);ctx.arc(e.x+6,e.y-2,1,0,Math.PI*2);ctx.fill();if(e.kind==='thornling'){ctx.fillStyle='#8eac61';for(let j=-1;j<=1;j++){ctx.beginPath();ctx.moveTo(e.x+j*11,e.y-r+3);ctx.lineTo(e.x+j*11+5,e.y-r-9);ctx.lineTo(e.x+j*11+9,e.y-r+4);ctx.fill();}}
  }
  const barW=boss?82:38;ctx.fillStyle='rgba(25,35,27,.7)';ctx.fillRect(e.x-barW/2,e.y-r-17,barW,5);ctx.fillStyle=boss?'#e28c70':'#c8d77b';ctx.fillRect(e.x-barW/2,e.y-r-17,barW*Math.max(0,e.hp/e.maxHp),5);
  if(boss){ctx.fillStyle='#fff0ce';ctx.font='bold 12px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(e.kind==='mossback'?'MOSSBACK':'BRAMBLE WARDEN',e.x,e.y-r-24);}
}
function drawHero(ctx:CanvasRenderingContext2D,e:GameEngine,time:number){
  const h=e.hero;if(h.hurtTime>0&&Math.floor(time*14)%2===0)return;const bob=Math.sin(h.walkTime)*2;
  ctx.fillStyle='rgba(28,40,28,.27)';ctx.beginPath();ctx.ellipse(h.x,h.y+17,22,10,0,0,Math.PI*2);ctx.fill();
  if(h.shieldTime>0){ctx.strokeStyle='rgba(193,239,166,.8)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(h.x,h.y,34+Math.sin(time*14)*3,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#d7745b';ctx.beginPath();ctx.moveTo(h.x-17,h.y-2+bob);ctx.lineTo(h.x+17,h.y-2+bob);ctx.lineTo(h.x+21,h.y+20+bob);ctx.quadraticCurveTo(h.x,h.y+29+bob,h.x-21,h.y+20+bob);ctx.closePath();ctx.fill();
  ctx.fillStyle='#e9c09a';ctx.beginPath();ctx.arc(h.x,h.y-17+bob,13,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#435a41';ctx.beginPath();ctx.moveTo(h.x-16,h.y-20+bob);ctx.quadraticCurveTo(h.x-10,h.y-40+bob,h.x+13,h.y-30+bob);ctx.lineTo(h.x+17,h.y-15+bob);ctx.lineTo(h.x+4,h.y-22+bob);ctx.lineTo(h.x-12,h.y-14+bob);ctx.closePath();ctx.fill();
  ctx.fillStyle='#342d2a';ctx.beginPath();ctx.arc(h.x+5,h.y-17+bob,1.7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#806047';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(h.x+14,h.y-4+bob);ctx.lineTo(h.x+24,h.y-20+bob);ctx.stroke();ctx.fillStyle='#fff2a3';ctx.beginPath();ctx.arc(h.x+25,h.y-22+bob,4,0,Math.PI*2);ctx.fill();
  // Fox companion follows a gentle offset.
  const fx=h.x-32+Math.sin(time*1.7)*5,fy=h.y+19+Math.cos(time*1.7)*3;ctx.fillStyle='#cf8754';ctx.beginPath();ctx.ellipse(fx,fy,11,8,-.15,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(fx-7,fy-4);ctx.lineTo(fx-13,fy-15);ctx.lineTo(fx-2,fy-9);ctx.fill();ctx.beginPath();ctx.moveTo(fx+3,fy-5);ctx.lineTo(fx+8,fy-16);ctx.lineTo(fx+10,fy-4);ctx.fill();ctx.fillStyle='#fff0d2';ctx.beginPath();ctx.arc(fx+8,fy+1,3.5,0,Math.PI*2);ctx.fill();
}

export function renderWorld(ctx:CanvasRenderingContext2D,w:number,h:number,e:GameEngine,time:number){
  const camX=clamp(e.hero.x-w/2,0,Math.max(0,e.world.width-w));const camY=clamp(e.hero.y-h/2,0,Math.max(0,e.world.height-h));
  ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(-camX,-camY);drawGround(ctx,w,h,{x:camX,y:camY},e);
  // Scattered flowers and mushrooms add texture without covering walkable routes.
  for(let i=0;i<110;i++){const x=(i*173+57)%e.world.width,y=(i*293+111)%e.world.height;if(Math.abs(x-e.hero.x)<w*.55&&Math.abs(y-e.hero.y)<h*.55){ctx.fillStyle=i%4===0?'rgba(247,215,116,.72)':i%4===1?'rgba(224,235,175,.68)':'rgba(225,226,187,.48)';ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill();}}
  const visible=e.getObjects();const draws:Array<{y:number;run:()=>void}>=[];
  for(const o of visible){const near=e.nearestObject(112)?.id===o.id;draws.push({y:o.y,run:()=>drawObject(ctx,o,time,near)});}
  for(const obs of e.world.obstacles){if(obs.x<camX-80||obs.x>camX+w+80||obs.y<camY-100||obs.y>camY+h+100)continue;draws.push({y:obs.y+obs.r,run:()=>drawTree(ctx,obs.x,obs.y,obs.r,obs.kind,time)});}
  for(const enemy of e.enemies)if(!enemy.dead&&enemy.x>camX-100&&enemy.x<camX+w+100&&enemy.y>camY-100&&enemy.y<camY+h+100)draws.push({y:enemy.y+40,run:()=>drawEnemy(ctx,enemy,time)});
  draws.push({y:e.hero.y+22,run:()=>drawHero(ctx,e,time)});draws.sort((a,b)=>a.y-b.y);for(const item of draws)item.run();
  for(const p of e.projectiles){ctx.fillStyle='#fff0a4';ctx.shadowColor='#ffe784';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  for(const fx of e.effects){const alpha=Math.max(0,fx.life/fx.maxLife);ctx.globalAlpha=alpha;if(fx.kind==='ring'){ctx.strokeStyle=fx.color;ctx.lineWidth=6*alpha+1;ctx.beginPath();ctx.arc(fx.x,fx.y,fx.r,0,Math.PI*2);ctx.stroke();}else if(fx.kind==='poof'){ctx.fillStyle=fx.color;for(let j=0;j<8;j++){const a=j*Math.PI/4;ctx.beginPath();ctx.arc(fx.x+Math.cos(a)*fx.r,fx.y+Math.sin(a)*fx.r,5*alpha+1,0,Math.PI*2);ctx.fill();}}else{ctx.fillStyle=fx.color;ctx.beginPath();ctx.arc(fx.x,fx.y,fx.r*alpha+2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
  for(const f of e.floating){ctx.globalAlpha=Math.min(1,f.life*1.7);ctx.fillStyle=f.color;ctx.font='bold 15px ui-monospace,monospace';ctx.textAlign='center';ctx.strokeStyle='rgba(32,43,32,.7)';ctx.lineWidth=3;ctx.strokeText(f.text,f.x,f.y);ctx.fillText(f.text,f.x,f.y);ctx.globalAlpha=1;}
  ctx.restore();
  // Edges soften the world view like a storybook illustration.
  const vg=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.76);vg.addColorStop(0,'rgba(22,37,27,0)');vg.addColorStop(1,'rgba(22,37,27,.24)');ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
  if(e.damageFlash>0){ctx.fillStyle=`rgba(255,100,70,${e.damageFlash*.45})`;ctx.fillRect(0,0,w,h);}
}
