import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from './game/GameCanvas';
import { GameEngine } from './game/engine';
import { WORLDS } from './game/worlds';
import { clearSession } from './game/storage';
import type { EngineEvent, GameSnapshot, LevelId } from './game/types';

type Mode='title'|'play'|'victory'|'ending';
type Save={version:1;meadowDone:boolean;woodsDone:boolean;meadowStars:number;woodsStars:number};
type Dialogue={speaker:string;lines:string[];index:number};
const SAVE_KEY='starfall-grove-save-v1';
const blankSave:Save={version:1,meadowDone:false,woodsDone:false,meadowStars:0,woodsStars:0};
function getSave():Save{try{const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'null') as Partial<Save>|null;if(!d||d.version!==1)return blankSave;return {...blankSave,...d};}catch{return blankSave;}}
function saveNow(data:Save){try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));}catch{/* local play remains available */}}

function App(){
  const [mode,setMode]=useState<Mode>('title');
  const [levelId,setLevelId]=useState<LevelId>('meadow');
  const [save,setSave]=useState<Save>(()=>getSave());
  const [snapshot,setSnapshot]=useState<GameSnapshot|null>(null);
  const [dialogue,setDialogue]=useState<Dialogue|null>(null);
  const [paused,setPaused]=useState(false);
  const [toast,setToast]=useState('');
  const [showJournal,setShowJournal]=useState(false);
  const [stick,setStick]=useState({x:0,y:0});
  const engineRef=useRef<GameEngine|null>(null);
  const toastTimer=useRef<number|undefined>(undefined);
  const currentWorld=WORLDS[levelId];
  const worldPct=snapshot?.progress||0;

  const notify=useCallback((text:string)=>{setToast(text);if(toastTimer.current)window.clearTimeout(toastTimer.current);toastTimer.current=window.setTimeout(()=>setToast(''),2300);},[]);
  const onReady=useCallback((engine:GameEngine|null)=>{engineRef.current=engine;},[]);
  const onSnapshot=useCallback((state:GameSnapshot)=>setSnapshot(state),[]);
  const onEvent=useCallback((event:EngineEvent)=>{
    if(event.type==='dialogue'){engineRef.current?.setMovement(0,0);setStick({x:0,y:0});setDialogue({speaker:event.speaker,lines:event.lines,index:0});return;}
    if(event.type==='notice'){notify(event.text);return;}
    if(event.type==='levelComplete'){
      clearSession(event.levelId);
      setSave(prev=>{const next={...prev};if(event.levelId==='meadow'){next.meadowDone=true;next.meadowStars=Math.max(next.meadowStars,event.stars);}else{next.woodsDone=true;next.woodsStars=Math.max(next.woodsStars,event.stars);}saveNow(next);return next;});
      setDialogue(null);setPaused(false);setMode('victory');
    }
  },[notify]);

  const startGame=(id:LevelId,fresh=false)=>{if(fresh)clearSession(id);setLevelId(id);setSnapshot(null);setDialogue(null);setPaused(false);setShowJournal(false);setStick({x:0,y:0});setMode('play');};
  const nextLevel=()=>{if(levelId==='meadow'){startGame('woods');}else{setMode('ending');}};
  const togglePause=()=>{engineRef.current?.setMovement(0,0);setStick({x:0,y:0});setPaused(v=>!v);};

  useEffect(()=>{
    if(mode!=='play')return;
    const keys=new Set<string>();
    const sync=()=>{const x=(keys.has('ArrowRight')||keys.has('d')||keys.has('D')?1:0)-(keys.has('ArrowLeft')||keys.has('a')||keys.has('A')?1:0);const y=(keys.has('ArrowDown')||keys.has('s')||keys.has('S')?1:0)-(keys.has('ArrowUp')||keys.has('w')||keys.has('W')?1:0);engineRef.current?.setMovement(x,y);};
    const down=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA'].includes(e.target.tagName))return;const k=e.key;if(dialogue){if(k==='Enter'||k===' '){setDialogue(d=>d?(d.index<d.lines.length-1?{...d,index:d.index+1}:null):null);e.preventDefault();}if(k==='Escape')setDialogue(null);return;}if(paused){if(k==='Escape'){engineRef.current?.setMovement(0,0);setPaused(false);}return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(k)){keys.add(k);sync();e.preventDefault();}if(e.repeat)return;if(k===' '||k==='j'||k==='J')engineRef.current?.attack();if(k==='q'||k==='Q')engineRef.current?.leafBurst();if(k==='f'||k==='F')engineRef.current?.mossShield();if(k==='e'||k==='E'||k==='Enter')engineRef.current?.interact();if(k==='Escape'){engineRef.current?.setMovement(0,0);setStick({x:0,y:0});setPaused(true);}};
    const up=(e:KeyboardEvent)=>{keys.delete(e.key);sync();};
    const blur=()=>{keys.clear();engineRef.current?.setMovement(0,0);};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);engineRef.current?.setMovement(0,0);};
  },[mode,paused,dialogue]);

  const currentQuest=snapshot?.objectives[1]||'Speak with the villagers to begin.';
  const shieldAvailable=snapshot?.shieldUnlocked||false;
  const isGamePaused=paused||!!dialogue||mode!=='play';
  const closeDialogue=()=>{if(!dialogue)return;if(dialogue.index<dialogue.lines.length-1)setDialogue({...dialogue,index:dialogue.index+1});else setDialogue(null);};

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>mode==='play'?setPaused(true):setMode('title')} aria-label="Starfall Grove home"><span className="brand-gem">✦</span><span><strong>STARFALL GROVE</strong><small>THE LOST BEACON</small></span></button>
      <div className="topbar-meta"><span className="save-indicator"><i/> AUTOSAVED</span>{mode==='play'&&<button className="pause-top" onClick={togglePause} aria-label={paused?'Resume':'Pause'}>{paused?'▶':'Ⅱ'}</button>}</div>
    </header>

    {mode==='title'&&<main className="title-page">
      <section className="title-copy">
        <div className="eyebrow"><span/> A STORYBOOK ACTION RPG</div>
        <h1>Find the light.<br/><em>Help it grow.</em></h1>
        <p className="title-intro">A fallen star has dimmed the forest beacon. Explore a hand-painted valley, help its people, learn gentle magic, and face the creatures hiding in the shadows.</p>
        <div className="title-buttons"><button className="primary-button" onClick={()=>startGame(save.meadowDone?'woods':'meadow')}><span>{save.meadowDone?'Continue adventure':'Begin adventure'}</span><b>→</b></button><button className="quiet-button" onClick={()=>startGame('meadow',true)}>Start from the beginning</button></div>
        <div className="title-facts"><span>◉ SINGLE PLAYER</span><span>✦ TWO ADVENTURE LEVELS</span><span>⌁ NO TIMER</span></div>
        {save.meadowDone&&<div className="unlocked-banner"><span>✦</span> WHISPERROOT WOODS UNLOCKED <button onClick={()=>startGame('woods')}>Play Level 2 →</button></div>}
      </section>
      <section className="cover-art" aria-label="Mira and her fox companion in a magical forest">
        <div className="cover-moon"/><div className="cover-stars"><i>✦</i><i>·</i><i>✧</i><i>·</i><i>✦</i></div>
        <div className="cover-hill hill-back"/><div className="cover-hill hill-front"/>
        <div className="cover-beacon"><span>✦</span></div>
        <div className="cover-hero">🧙🏻‍♀️</div><div className="cover-fox">🦊</div>
        <div className="cover-caption"><small>AN ADVENTURE IN TWO CHAPTERS</small><strong>Starfall Grove</strong><span>Move, explore, make a little magic.</span></div>
        <div className="cover-seal">A GENTLE<br/>QUEST ✦</div>
      </section>
      <section className="feature-strip"><div><b>01</b><span>EXPLORE<br/><small>Wide, winding places</small></span></div><div><b>02</b><span>HELP<br/><small>Small quests, kind people</small></span></div><div><b>03</b><span>CAST<br/><small>Magic with a little sparkle</small></span></div><div><b>04</b><span>GROW<br/><small>Two chapters to discover</small></span></div></section>
    </main>}

    {mode==='play'&&<main className="play-page">
      <div className="play-heading"><div><div className="eyebrow"><span/> CHAPTER {levelId==='meadow'?'01':'02'}</div><h1>{currentWorld.title}<small> — {currentWorld.subtitle}</small></h1></div><div className="play-heading-right"><span className="zone-pill">{levelId==='meadow'?'SUNPETAL VALLEY':'WHISPERROOT WILDS'}</span><button className="journal-toggle" onClick={()=>setShowJournal(v=>!v)}>{showJournal?'Hide journal':'Quest journal'} <span>▤</span></button></div></div>
      <div className="game-layout">
        <section className="game-stage">
          <GameCanvas levelId={levelId} paused={isGamePaused} onReady={onReady} onSnapshot={onSnapshot} onEvent={onEvent}/>
          <div className="world-vignette"/>
          <div className="stage-top-hud">
            <div className="vitals-card"><div className="vital-row health-row"><span>♥</span><div className="pips">{Array.from({length:snapshot?.maxHp||5},(_,i)=><i key={i} className={i<(snapshot?.hp||5)?'filled':''}/>)}</div><small>{snapshot?.hp??5}/{snapshot?.maxHp??5}</small></div><div className="vital-row mana-row"><span>✦</span><div className="mana-track"><i style={{width:`${snapshot?.mana??70}%`}}/></div><small>{snapshot?.mana??70}</small></div></div>
            <div className="objective-chip"><small>CURRENT QUEST</small><strong>{currentQuest}</strong><div className="mini-progress"><i style={{width:`${worldPct}%`}}/></div></div>
          </div>
          {snapshot?.nearName&&<div className="near-prompt"><span>✧</span> {snapshot.nearName} <kbd>E</kbd></div>}
          <div className="control-left"><div className="virtual-stick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect();const x=(e.clientX-r.left-r.width/2)/(r.width*.34);const y=(e.clientY-r.top-r.height/2)/(r.height*.34);const mag=Math.hypot(x,y);const nx=mag>1?x/mag:x,ny=mag>1?y/mag:y;setStick({x:nx,y:ny});engineRef.current?.setMovement(nx,ny);}} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const r=e.currentTarget.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/(r.width*.34),y=(e.clientY-r.top-r.height/2)/(r.height*.34);const mag=Math.hypot(x,y);if(mag>1){x/=mag;y/=mag;}setStick({x,y});engineRef.current?.setMovement(x,y);}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);setStick({x:0,y:0});engineRef.current?.setMovement(0,0);}} onPointerCancel={()=>{setStick({x:0,y:0});engineRef.current?.setMovement(0,0);}} aria-label="Move Mira with the virtual joystick"><div className="stick-ring"><i className="stick-thumb" style={{transform:`translate(${stick.x*25}px,${stick.y*25}px)`}}/><span className="stick-label">MOVE</span></div></div><div className="keyboard-hint">WASD / ARROWS</div></div>
          <div className="control-right">
            <button className="action-button attack-button" onClick={()=>engineRef.current?.attack()} aria-label="Spark attack"><i>✦</i><small>ATTACK</small><kbd>J</kbd></button>
            <button className="action-button leaf-button" onClick={()=>engineRef.current?.leafBurst()} aria-label="Cast Leaf Burst"><i>❋</i><small>LEAF BURST</small><kbd>Q</kbd><b>{snapshot?.leafReady?'READY':'…'}</b></button>
            <button className={`action-button shield-button ${shieldAvailable?'':'locked'}`} onClick={()=>engineRef.current?.mossShield()} aria-label="Cast Moss Shield" disabled={!shieldAvailable}><i>◉</i><small>MOSS SHIELD</small><kbd>F</kbd><b>{shieldAvailable?(snapshot?.shieldReady?'READY':'…'):'LOCKED'}</b></button>
            {snapshot?.nearName&&<button className="interact-button" onClick={()=>engineRef.current?.interact()}><span>✧</span> INTERACT <kbd>E</kbd></button>}
          </div>
          {toast&&<div className="game-toast" role="status">{toast}</div>}
          {showJournal&&<div className="mobile-journal"><QuestJournal snapshot={snapshot}/><button onClick={()=>setShowJournal(false)}>Close journal</button></div>}
          {dialogue&&<div className="dialogue-backdrop"><div className="dialogue-box" role="dialog" aria-modal="true"><div className="dialogue-avatar">{dialogue.speaker.includes('Pip')?'🦊':dialogue.speaker.includes('Elder')?'🧙🏼':'✦'}</div><div className="dialogue-copy"><small>NOW SPEAKING</small><strong>{dialogue.speaker}</strong><p>{dialogue.lines[dialogue.index]}</p><button className="primary-button dialog-next" onClick={closeDialogue}><span>{dialogue.index<dialogue.lines.length-1?'Continue':'Got it'}</span><b>→</b></button></div></div></div>}
          {paused&&<div className="pause-backdrop"><div className="pause-card"><span className="eyebrow"><span/> PAUSE</span><h2>Take a breath.</h2><p>Your adventure is safe. The forest can wait.</p><button className="primary-button" onClick={()=>setPaused(false)}><span>Back to adventure</span><b>→</b></button><button className="quiet-button" onClick={()=>{setPaused(false);setMode('title');}}>Return to title</button></div></div>}
        </section>
        <aside className="quest-sidebar"><QuestJournal snapshot={snapshot}/><div className="sidebar-tip"><span>FOX’S FIELD NOTE</span><p>“Watch the ground. If it glows, move away before the creature jumps!”</p></div><div className="exploration-meter"><div><span>CREATURES CLEARED</span><b>{snapshot?.defeated||0}<small> / {snapshot?.totalEnemies||0}</small></b></div><div className="meter-track"><i style={{width:`${worldPct}%`}}/></div><small>Defeating creatures is optional unless guarding the beacon.</small></div></aside>
      </div>
    </main>}

    {mode==='victory'&&<main className="ending-page"><div className="ending-art"><span>✦</span><i/><b>🦊</b></div><div className="eyebrow"><span/> CHAPTER COMPLETE</div><h1>{levelId==='meadow'?'The beacon shines again.':'The bell rings through the valley.'}</h1><p>{levelId==='meadow'?'Mossback returns to its quiet grove, and a second light glimmers beyond the hills. Your next path leads into Whisperroot Woods.':'The forest shadows drift away like petals. Mira and her fox have become the valley’s newest legends.'}</p><div className="star-row">{[1,2,3].map(n=><span key={n} className={n<=(levelId==='meadow'?save.meadowStars:save.woodsStars)?'on':''}>✦</span>)}</div><div className="ending-actions"><button className="primary-button" onClick={nextLevel}><span>{levelId==='meadow'?'Begin Chapter 2':'Finish adventure'}</span><b>→</b></button><button className="quiet-button" onClick={()=>setMode('title')}>Back to title</button></div></main>}
    {mode==='ending'&&<main className="ending-page final-ending"><div className="final-art">🌠</div><div className="eyebrow"><span/> THE VALLEY REMEMBERS</div><h1>One more light<br/><em>is waiting.</em></h1><p>You restored two beacons, helped the people of the valley, and made a brave new friend. The wider world is still out there whenever you are ready.</p><div className="final-buttons"><button className="primary-button" onClick={()=>startGame('meadow')}><span>Play the adventure again</span><b>↻</b></button><button className="quiet-button" onClick={()=>setMode('title')}>Return to title</button></div></main>}
    <footer className="footer"><span>STARFALL GROVE <i>•</i> A STORY TO EXPLORE</span><span>NO TIMER <i>•</i> ADVENTURE AT YOUR PACE</span></footer>
  </div>;
}

function QuestJournal({snapshot}:{snapshot:GameSnapshot|null}){
  if(!snapshot)return <div className="journal-card"><div className="journal-heading">JOURNAL <span>✦</span></div><p className="loading-line">The fox is sniffing out the trail…</p></div>;
  return <div className="journal-card"><div className="journal-heading">JOURNAL <span>✦</span></div><div className="main-quest"><small>MAIN QUEST</small><p>{snapshot.objectives[0]}</p><strong>{snapshot.objectives[1]}</strong></div><div className="side-quest-list"><small>SMALL QUESTS</small>{snapshot.sideQuests.map((q,i)=><div className={`side-quest ${q.done?'complete':''}`} key={i}><span>{q.done?'✓':'○'}</span><div><b>{q.name}</b><small>{q.status}</small></div></div>)}</div><div className="journal-foot"><span>✦</span> You can explore before moving on.</div></div>;
}
export default App;
