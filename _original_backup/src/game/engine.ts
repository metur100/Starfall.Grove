import { WORLDS } from './worlds';
import type { EngineEvent, Enemy, FloatingText, GameSnapshot, LevelId, Point, Projectile, QuestFlags, WorldDefinition, WorldObject } from './types';

type Hero = {x:number;y:number;hp:number;maxHp:number;mana:number;maxMana:number;vx:number;vy:number;faceX:number;faceY:number;attackCd:number;leafCd:number;shieldCd:number;shieldTime:number;hurtTime:number;walkTime:number};
type Effect = {x:number;y:number;r:number;life:number;maxLife:number;color:string;kind:'ring'|'poof'|'spark'};
export type EngineSave={version:1;hero:{x:number;y:number;hp:number;mana:number};quest:QuestFlags;collected:string[];deadEnemyIds:string[];checkpoint:Point};
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export class GameEngine {
  readonly world:WorldDefinition;
  readonly hero:Hero;
  readonly enemies:Enemy[];
  readonly projectiles:Projectile[]=[];
  readonly effects:Effect[]=[];
  readonly floating:FloatingText[]=[];
  readonly quest:QuestFlags={bridgekeeper:false,crystals:[],elder:false,glowbugs:[],glowbugsDone:false,courier:false,hasBell:false,bellDone:false,bossDefeated:false,beaconRestored:false,forestKeeper:false,runes:[],moths:[],mothsDone:false,hasSatchel:false,satchelDone:false,shrine:false,wardenDefeated:false,rootBellRung:false};
  readonly collected=new Set<string>();
  moveX=0; moveY=0; facing={x:1,y:0}; elapsed=0; defeated=0; message='';
  private eventHandler:(event:EngineEvent)=>void;
  damageFlash=0;
  private checkpoint:Point;
  private lastSnapshotProgress=0;

  constructor(levelId:LevelId,onEvent:(event:EngineEvent)=>void,saved?:EngineSave|null){
    this.world=WORLDS[levelId]; this.eventHandler=onEvent; this.checkpoint={...this.world.spawn};
    this.hero={x:this.world.spawn.x,y:this.world.spawn.y,hp:5,maxHp:5,mana:70,maxMana:100,vx:0,vy:0,faceX:1,faceY:0,attackCd:0,leafCd:0,shieldCd:0,shieldTime:0,hurtTime:0,walkTime:0};
    this.enemies=this.world.enemies.map(seed=>({ ...seed,hp:seed.kind==='mossback'?18:seed.kind==='brambleWarden'?22:seed.kind==='thornling'?4:3,maxHp:seed.kind==='mossback'?18:seed.kind==='brambleWarden'?22:seed.kind==='thornling'?4:3,dead:false,attackCooldown:1+Math.random()*1.5,windup:0,hitFlash:0 }));
    if(saved?.version===1)this.restore(saved);
  }
  setEventHandler(handler:(event:EngineEvent)=>void){this.eventHandler=handler;}
  private restore(saved:EngineSave){
    const valid=(p:Point)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
    if(valid(saved.hero)){this.hero.x=clamp(saved.hero.x,30,this.world.width-30);this.hero.y=clamp(saved.hero.y,30,this.world.height-30);}
    this.hero.hp=clamp(Number(saved.hero.hp)||this.hero.maxHp,1,this.hero.maxHp);this.hero.mana=clamp(Number(saved.hero.mana)||0,0,this.hero.maxMana);
    this.checkpoint=valid(saved.checkpoint)?{...saved.checkpoint}:{...this.world.spawn};
    if(saved.quest){Object.assign(this.quest,saved.quest);}
    for(const id of Array.isArray(saved.collected)?saved.collected:[])this.collected.add(id);
    const dead=new Set(Array.isArray(saved.deadEnemyIds)?saved.deadEnemyIds:[]);
    for(const enemy of this.enemies)if(dead.has(enemy.id)){enemy.dead=true;enemy.hp=0;this.defeated++;}
  }
  exportSave():EngineSave{return {version:1,hero:{x:this.hero.x,y:this.hero.y,hp:this.hero.hp,mana:this.hero.mana},quest:JSON.parse(JSON.stringify(this.quest)) as QuestFlags,collected:[...this.collected],deadEnemyIds:this.enemies.filter(e=>e.dead).map(e=>e.id),checkpoint:{...this.checkpoint}};}

  private notice(text:string){this.message=text;this.eventHandler({type:'notice',text});}
  setMovement(x:number,y:number){const mag=Math.hypot(x,y); if(mag>1){x/=mag;y/=mag;} this.moveX=x;this.moveY=y;if(mag>.08){this.facing={x,y};this.hero.faceX=x;this.hero.faceY=y;}}
  private bossIsUnlocked(){return this.world.id==='meadow'?this.quest.crystals.length>=3:this.quest.runes.length>=3;}
  private isBoss(e:Enemy){return e.boss===true;}
  private canHurt(e:Enemy){return !this.isBoss(e)||this.bossIsUnlocked();}
  private visibleObject(o:WorldObject){
    if(this.collected.has(o.id))return false;
    if(o.kind==='crystal')return !this.quest.crystals.includes(o.id);
    if(o.kind==='glowbug')return !this.quest.glowbugs.includes(o.id);
    if(o.kind==='rune')return !this.quest.runes.includes(o.id);
    if(o.kind==='moth')return !this.quest.moths.includes(o.id);
    if(o.kind==='bell')return !this.quest.hasBell;
    if(o.kind==='satchel')return !this.quest.hasSatchel;
    return true;
  }
  nearestObject(maxRange=100){let best:WorldObject|undefined;let bestD=maxRange;for(const o of this.world.objects){if(!this.visibleObject(o))continue;const d=dist(this.hero,o);if(d<bestD){best=o;bestD=d;}}return best||null;}
  interact(){
    const obj=this.nearestObject(112);
    if(!obj){this.notice('Move closer to a person or object to interact.');return;}
    if(obj.kind==='crystal'){
      this.quest.crystals.push(obj.id);this.collected.add(obj.id);this.hero.mana=Math.min(this.hero.maxMana,this.hero.mana+18);this.spark(obj.x,obj.y,'#ffe98b');this.notice(`Sun-crystal found! ${this.quest.crystals.length}/3. The fox gives an approving yip.`);return;
    }
    if(obj.kind==='glowbug'){
      this.quest.glowbugs.push(obj.id);this.collected.add(obj.id);this.hero.mana=Math.min(this.hero.maxMana,this.hero.mana+5);this.notice(`Glowbug caught gently. ${this.quest.glowbugs.length}/3.`);return;
    }
    if(obj.kind==='rune'){
      this.quest.runes.push(obj.id);this.collected.add(obj.id);this.hero.mana=Math.min(this.hero.maxMana,this.hero.mana+15);this.spark(obj.x,obj.y,'#adf0d4');this.notice(`Root rune awakened. ${this.quest.runes.length}/3.`);return;
    }
    if(obj.kind==='moth'){
      this.quest.moths.push(obj.id);this.collected.add(obj.id);this.notice(`Moon moth follows the lantern. ${this.quest.moths.length}/3.`);return;
    }
    if(obj.kind==='bell'){this.quest.hasBell=true;this.collected.add(obj.id);this.notice('You found the little silver bell. Better return it to Pip.');return;}
    if(obj.kind==='satchel'){this.quest.hasSatchel=true;this.collected.add(obj.id);this.notice('Courier satchel recovered. It smells faintly of apple cake.');return;}
    this.interactNamed(obj);
  }
  private dialogue(speaker:string,lines:string[]){this.eventHandler({type:'dialogue',speaker,lines});}
  private interactNamed(o:WorldObject){
    if(o.id==='bridgekeeper'){
      this.setCheckpoint();this.quest.bridgekeeper=true;
      if(this.quest.crystals.length<3)this.dialogue(o.name,["The beacon's light has gone out. Three sun-crystals can wake it again.",`You have found ${this.quest.crystals.length} of 3. I marked the old paths on your map.`, 'The fox seems to think you should explore every corner. The fox is usually right.']);
      else this.dialogue(o.name,['All three crystals! The path to the Beacon Rise is open.','Mossback guards the beacon. Watch for the ground glowing before a big slam.']);
      return;
    }
    if(o.id==='elder'){
      this.quest.elder=true;
      if(this.quest.glowbugs.length>=3&&!this.quest.glowbugsDone){this.quest.glowbugsDone=true;this.hero.hp=Math.min(this.hero.maxHp,this.hero.hp+2);this.dialogue(o.name,['You found all three glowbugs! They will guide lost travelers home.','Take this healing berry. It is much tastier than it looks.']);}
      else this.dialogue(o.name,['The night paths are hard to see. Could you find three glowbugs in the meadow?','They are tiny floating lights. Walk close and tap Interact to gather them.']);
      return;
    }
    if(o.id==='courier'){
      this.quest.courier=true;
      if(this.quest.hasBell&&!this.quest.bellDone){this.quest.bellDone=true;this.hero.mana=this.hero.maxMana;this.dialogue(o.name,['My bell! I thought I had lost it forever.','Please take this star biscuit. It restores your magic.']);}
      else this.dialogue(o.name,[this.quest.bellDone?'Thanks again for finding my bell!':'I dropped my little silver bell on the far side of the meadow.',this.quest.bellDone?'The Beacon Rise is just beyond the old stone garden.':'It has a tiny star scratched into it. If you find it, bring it back here.']);
      return;
    }
    if(o.id==='meadow-beacon'){
      if(!this.quest.bossDefeated){this.dialogue(o.name,[this.bossIsUnlocked()?'Mossback is here. Defeat the guardian to restore the beacon.':'The beacon is dim. Three sun-crystals are needed before its guardian can be reached.']);return;}
      this.quest.beaconRestored=true;this.dialogue(o.name,['The beacon blazes gold. Across the valley, a second light answers from Whisperroot Woods.','The valley is safer now. Your next adventure begins in the woods.']);
      setTimeout(()=>this.eventHandler({type:'levelComplete',levelId:'meadow',stars:this.earnedStars()}),350);return;
    }
    if(o.id==='forest-keeper'){
      this.setCheckpoint();this.quest.forestKeeper=true;
      if(this.quest.moths.length>=3&&!this.quest.mothsDone){this.quest.mothsDone=true;this.hero.hp=this.hero.maxHp;this.dialogue(o.name,['The moon moths have returned to their lantern tree. The woods glow again.','Here, a warm mushroom pie. You look like you have been adventuring.']);}
      else this.dialogue(o.name,['Welcome to Whisperroot. Three moon moths have gone missing in the dark.',"Find them and bring them back. I'll keep the lantern lit for you."]);
      return;
    }
    if(o.id==='courier-two'){
      if(this.quest.hasSatchel&&!this.quest.satchelDone){this.quest.satchelDone=true;this.hero.mana=this.hero.maxMana;this.dialogue(o.name,['My satchel! The biscuits survived!','You are officially my favorite forest hero. Take a snack for the road.']);}
      else this.dialogue(o.name,[this.quest.satchelDone?'I will keep a closer eye on my things.':'I lost my satchel somewhere near the root-cave. Could you look for it?',this.quest.satchelDone?'The ancient bell is further east.':'It has a red strap and a very loud buckle.']);return;
    }
    if(o.id==='bellkeeper'){
      this.dialogue(o.name,[this.quest.runes.length<3?`The ancient bell is tangled in roots. Find three runes to wake its guardian. You have ${this.quest.runes.length}/3.`:'The runes are awake. The Bramble Warden is guarding the ancient bell.','Keep moving when the floor turns bright. That is the forest warning you.']);return;
    }
    if(o.id==='shield-shrine'){
      this.setCheckpoint();
      if(!this.quest.shrine){this.quest.shrine=true;this.dialogue(o.name,['The grove lends you the Moss Shield. Press the shield button to protect yourself for a moment.','It also gently boops nearby creatures. Very useful, very polite.']);}
      else this.dialogue(o.name,['The shield is ready whenever its glow returns.']);return;
    }
    if(o.id==='root-bell'){
      if(!this.quest.wardenDefeated){this.dialogue(o.name,[this.bossIsUnlocked()?'The Bramble Warden blocks the bell.':'Three root runes are needed to wake the guardian.']);return;}
      this.quest.rootBellRung=true;this.dialogue(o.name,['The ancient bell rings through every root in the forest. The shadows turn to drifting petals.','The path ahead is open. Mira and the fox are only just getting started.']);
      setTimeout(()=>this.eventHandler({type:'levelComplete',levelId:'woods',stars:this.earnedStars()}),350);return;
    }
  }
  attack(){
    if(this.hero.attackCd>0)return;
    this.hero.attackCd=.48;
    const target=this.nearestEnemy(610);
    if(!target){this.spark(this.hero.x+this.hero.faceX*30,this.hero.y+this.hero.faceY*30,'#fff1aa');return;}
    if(!this.canHurt(target)){this.notice('The guardian is protected. Find the three glowing runes first.');return;}
    const dx=target.x-this.hero.x,dy=target.y-this.hero.y,d=Math.max(1,Math.hypot(dx,dy));
    this.projectiles.push({x:this.hero.x+dx/d*20,y:this.hero.y+dy/d*20,vx:dx/d*580,vy:dy/d*580,life:1.1,damage:1,targetId:target.id});
    this.hero.faceX=dx/d;this.hero.faceY=dy/d;
  }
  leafBurst(){
    if(this.hero.leafCd>0){this.notice('Leaf Burst is gathering its sparkle.');return;}
    if(this.hero.mana<25){this.notice('Not enough magic yet. Explore for glowing things.');return;}
    this.hero.mana-=25;this.hero.leafCd=5.2;this.effects.push({x:this.hero.x,y:this.hero.y,r:8,life:.55,maxLife:.55,color:'#b9f29d',kind:'ring'});
    let hits=0;
    for(const enemy of this.enemies){if(enemy.dead||!this.canHurt(enemy))continue;const d=dist(this.hero,enemy);if(d<165){this.damageEnemy(enemy,3);const dx=enemy.x-this.hero.x,dy=enemy.y-this.hero.y,len=Math.max(1,Math.hypot(dx,dy));enemy.x+=dx/len*38;enemy.y+=dy/len*38;hits++;}}
    this.notice(hits?'Leaf Burst! The grove sends a swirl of leaves.':'Leaf Burst! A leafy swirl, just in case.');
  }
  mossShield(){
    if(this.world.id!=='woods'||!this.quest.shrine){this.notice('The Moss Shield awakens at a shrine in Whisperroot Woods.');return;}
    if(this.hero.shieldCd>0){this.notice('Moss Shield is still recharging.');return;}
    if(this.hero.mana<20){this.notice('Not enough magic to raise the shield.');return;}
    this.hero.mana-=20;this.hero.shieldCd=8.5;this.hero.shieldTime=2.8;this.effects.push({x:this.hero.x,y:this.hero.y,r:46,life:.35,maxLife:.35,color:'#b7ef9b',kind:'ring'});for(const enemy of this.enemies){if(!enemy.dead&&dist(this.hero,enemy)<105){enemy.windup=0;enemy.attackCooldown=Math.max(enemy.attackCooldown,1.3);this.damageEnemy(enemy,1);}}this.notice('Moss Shield! You are protected, and nearby creatures get a gentle leafy boop.');
  }
  private nearestEnemy(maxRange:number){let best:Enemy|undefined;let bestD=maxRange;for(const e of this.enemies){if(e.dead)continue;const d=dist(this.hero,e);if(d<bestD){best=e;bestD=d;}}return best||null;}
  private damageEnemy(enemy:Enemy,amount:number){if(!this.canHurt(enemy)){this.notice('The guardian is sealed by the missing runes.');return;}enemy.hp-=amount;enemy.hitFlash=.18;this.floating.push({x:enemy.x,y:enemy.y-38,text:`-${amount}`,life:.7,color:'#fff3c0'});if(enemy.hp<=0){enemy.dead=true;this.defeated++;this.effects.push({x:enemy.x,y:enemy.y,r:12,life:.65,maxLife:.65,color:enemy.boss?'#f3cf67':'#9fe2ba',kind:'poof'});this.hero.mana=Math.min(this.hero.maxMana,this.hero.mana+(enemy.boss?35:6));if(enemy.boss){if(enemy.kind==='mossback'){this.quest.bossDefeated=true;this.notice('Mossback is defeated! The beacon is ready to restore.');}else{this.quest.wardenDefeated=true;this.notice('The Bramble Warden is defeated! Ring the ancient bell.');}}else this.notice(`${enemy.kind==='thornling'?'Thornling':'Gloomling'} dissolved into harmless leaf-light.`);}}
  private spark(x:number,y:number,color:string){this.effects.push({x,y,r:4,life:.35,maxLife:.35,color,kind:'spark'});}
  private hurt(amount:number,x:number,y:number){if(this.hero.hurtTime>0||this.hero.shieldTime>0)return;this.hero.hp-=amount;this.hero.hurtTime=1.05;this.damageFlash=.18;this.floating.push({x:this.hero.x,y:this.hero.y-48,text:'Ouch!',life:.8,color:'#ffd1ae'});this.effects.push({x,y,r:28,life:.32,maxLife:.32,color:'#ef9175',kind:'ring'});if(this.hero.hp<=0){this.hero.hp=this.hero.maxHp;this.hero.mana=Math.max(20,this.hero.mana);this.hero.x=this.checkpoint.x;this.hero.y=this.checkpoint.y;for(const e of this.enemies){if(!e.boss)e.attackCooldown=2;}this.notice('Mira rests at the last lantern. Quest progress is safe.');}}
  update(dtRaw:number){
    const dt=Math.min(.045,Math.max(0,dtRaw));this.elapsed+=dt;this.hero.attackCd=Math.max(0,this.hero.attackCd-dt);this.hero.leafCd=Math.max(0,this.hero.leafCd-dt);this.hero.shieldCd=Math.max(0,this.hero.shieldCd-dt);this.hero.shieldTime=Math.max(0,this.hero.shieldTime-dt);this.hero.hurtTime=Math.max(0,this.hero.hurtTime-dt);this.damageFlash=Math.max(0,this.damageFlash-dt);this.hero.mana=Math.min(this.hero.maxMana,this.hero.mana+2.6*dt);
    const speed=250;const old={x:this.hero.x,y:this.hero.y};this.hero.x=clamp(this.hero.x+this.moveX*speed*dt,30,this.world.width-30);this.hero.y=clamp(this.hero.y+this.moveY*speed*dt,30,this.world.height-30);if(this.moveX||this.moveY)this.hero.walkTime+=dt*9;
    for(const obstacle of this.world.obstacles){const dx=this.hero.x-obstacle.x,dy=this.hero.y-obstacle.y,d=Math.hypot(dx,dy),min=obstacle.r+15;if(d<min&&d>0){this.hero.x=obstacle.x+dx/d*min;this.hero.y=obstacle.y+dy/d*min;}}
    for(const e of this.enemies){if(e.dead)continue;e.attackCooldown=Math.max(0,e.attackCooldown-dt);e.windup=Math.max(0,e.windup-dt);e.hitFlash=Math.max(0,e.hitFlash-dt);const d=dist(this.hero,e);const unlock=this.canHurt(e);if(!unlock)continue;
      const phaseTwo=e.kind==='brambleWarden'&&e.hp<=e.maxHp/2;const attackRange=e.kind==='thornling'?300:e.boss?(phaseTwo?170:132):66;
      if(e.windup>0&&e.windup<=dt){if(d<(e.kind==='thornling'?370:e.boss?(e.kind==='brambleWarden'&&e.hp<=e.maxHp/2?175:150):78))this.hurt(e.boss?1:1,e.x,e.y);e.attackCooldown=e.boss?(e.kind==='brambleWarden'&&e.hp<=e.maxHp/2?1.8:2.3):2.6;}
      if(e.attackCooldown<=0&&e.windup<=0&&d<attackRange+25){e.windup=e.boss?(phaseTwo ? .72 : .95):.68;}
      else if(e.windup<=0&&d<470&&d>attackRange-12){const dx=(this.hero.x-e.x)/Math.max(1,d),dy=(this.hero.y-e.y)/Math.max(1,d);const espeed=e.boss?85:e.kind==='thornling'?52:105;e.x+=dx*espeed*dt;e.y+=dy*espeed*dt;}
    }
    for(let i=this.projectiles.length-1;i>=0;i--){const p=this.projectiles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;const target=this.enemies.find(e=>e.id===p.targetId&&!e.dead);if(target&&dist(p,target)<30){this.damageEnemy(target,p.damage);this.effects.push({x:p.x,y:p.y,r:12,life:.25,maxLife:.25,color:'#fff0a3',kind:'spark'});this.projectiles.splice(i,1);}else if(p.life<=0)this.projectiles.splice(i,1);}
    for(let i=this.effects.length-1;i>=0;i--){const fx=this.effects[i];fx.life-=dt;fx.r+=fx.kind==='ring'?180*dt:32*dt;if(fx.life<=0)this.effects.splice(i,1);}
    for(let i=this.floating.length-1;i>=0;i--){this.floating[i].life-=dt;this.floating[i].y-=22*dt;if(this.floating[i].life<=0)this.floating.splice(i,1);}
    if(old.x!==this.hero.x||old.y!==this.hero.y)this.lastSnapshotProgress++;
  }
  private questRows(){
    if(this.world.id==='meadow'){
      const main=this.quest.beaconRestored?'Beacon restored! Whisperroot Woods awaits.':this.quest.bossDefeated?'Return to the Beacon and restore it.':this.quest.crystals.length<3?`Find sun-crystals (${this.quest.crystals.length}/3)`: 'Defeat Mossback at the Beacon Rise.';
      return {objectives:[this.quest.bridgekeeper?'Main quest':'Talk to the Bridgekeeper',main],sideQuests:[
        {name:'Elder Rowan',status:this.quest.glowbugsDone?'Complete':this.quest.glowbugs.length>=3?'Return to Elder Rowan':`Find glowbugs (${this.quest.glowbugs.length}/3)`,done:this.quest.glowbugsDone},
        {name:'Pip’s silver bell',status:this.quest.bellDone?'Complete':this.quest.hasBell?'Return the bell to Pip':this.quest.courier?'Find the lost bell':'Talk to Pip the Courier',done:this.quest.bellDone},
      ]};
    }
    const main=this.quest.rootBellRung?'The ancient bell rings. The valley is safe.':this.quest.wardenDefeated?'Ring the ancient bell.':this.quest.runes.length<3?`Find root runes (${this.quest.runes.length}/3)`:'Defeat the Bramble Warden.';
    return {objectives:[this.quest.forestKeeper?'Follow the root-song':'Talk to the Mosskeeper',main],sideQuests:[
      {name:'Moon moths',status:this.quest.mothsDone?'Complete':this.quest.moths.length>=3?'Return to the Mosskeeper':`Find moths (${this.quest.moths.length}/3)`,done:this.quest.mothsDone},
      {name:'Courier’s satchel',status:this.quest.satchelDone?'Complete':this.quest.hasSatchel?'Return the satchel to Pip':`Find the satchel${this.quest.courier?'':' (ask Pip)'}`,done:this.quest.satchelDone},
    ]};
  }
  snapshot():GameSnapshot{
    const rows=this.questRows();const near=this.nearestObject(112);const objective=rows.objectives[1];const progress=Math.round((this.defeated/Math.max(1,this.enemies.length))*100);
    return {levelId:this.world.id,hp:this.hero.hp,maxHp:this.hero.maxHp,mana:Math.round(this.hero.mana),maxMana:this.hero.maxMana,shield:this.hero.shieldTime>0,shieldUnlocked:this.world.id==='woods'&&this.quest.shrine,leafReady:this.hero.leafCd<=0,shieldReady:this.hero.shieldCd<=0,nearName:near?.name||null,objectives:[...rows.objectives],sideQuests:rows.sideQuests,defeated:this.defeated,totalEnemies:this.enemies.length,progress,message:this.message||objective};
  }
  getObjective(){return this.questRows();}
  getObjects(){return this.world.objects.filter(o=>this.visibleObject(o));}
  earnedStars(){return Math.min(3,1+Number(this.questRows().sideQuests[0].done)+Number(this.questRows().sideQuests[1].done));}
  setCheckpoint(){this.checkpoint={x:this.hero.x,y:this.hero.y};}
}
