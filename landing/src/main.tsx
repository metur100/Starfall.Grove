import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import TitleBackdrop from '../../src/TitleBackdrop';
import { HEROES } from '../../src/game/spells';
import type { HeroId } from '../../src/game/types';
import { createLineup } from './lineup';
import Select from './Select';
import { playAs } from './heroes';
import { setupPage } from './site-page';

// The landing page. Everything you read is plain HTML in landing/index.html; this adds what moves: the paper diorama
// behind the hero section, the cast standing on its front hill, the hero select, and the intro films. Each moving
// piece is only drawn while it is on screen, so a phone scrolling the page only ever animates one of them.

setupPage();

/** Calls `on(true)` when the element comes on screen and `on(false)` when it leaves. */
function watch(el: Element, on: (shown: boolean) => void, margin = '120px') {
  const io = new IntersectionObserver(([e]) => on(e.isIntersecting), { rootMargin: margin });
  io.observe(el);
}

// The hero section: the night diorama and the whole cast on the front hill.
const hero = document.getElementById('top')!;
const backdropRoot = ReactDOM.createRoot(document.getElementById('hero-backdrop')!);
function HeroBackdrop() {
  const [shown, setShown] = useState(true);
  useEffect(() => watch(hero, setShown, '0px'), []);
  return shown ? <TitleBackdrop level="meadow" /> : null;
}
backdropRoot.render(<HeroBackdrop />);

const pick = (id: HeroId) => {
  window.dispatchEvent(new CustomEvent('sg:hero', { detail: id }));
  document.getElementById('heroes')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
};
const castCanvas = document.getElementById('cast') as HTMLCanvasElement | null;
const tags = document.getElementById('cast-tags');
if (castCanvas && tags) {
  try {
    const lineup = createLineup(castCanvas, pick);
    // Paper name tags under each hero; they are also the keyboard way to pick one.
    const place = () => {
      for (const p of lineup.place()) {
        const tag = tags.querySelector<HTMLElement>(`[data-hero="${p.id}"]`);
        if (tag) { tag.style.left = `${p.x * 100}%`; tag.style.top = `${p.y}px`; }
      }
    };
    new ResizeObserver(place).observe(castCanvas); place();
    tags.addEventListener('click', e => { const id = (e.target as HTMLElement).closest<HTMLElement>('[data-hero]')?.dataset.hero as HeroId | undefined; if (id) pick(id); });
    watch(hero, on => lineup.run(on), '0px');
    requestAnimationFrame(() => document.body.classList.add('cast-in'));
  } catch { castCanvas.remove(); }
}

// The intro films, in a paper frame over the page. They stream from the game's own copies and only load when opened.
const film = document.getElementById('film') as HTMLDialogElement | null;
const video = film?.querySelector('video');
const openFilm = (id: HeroId) => {
  if (!film || !video) return;
  film.querySelector('[data-film-title]')!.textContent = `${HEROES[id].name}, ${HEROES[id].title}`;
  const play = film.querySelector<HTMLAnchorElement>('[data-film-play]');
  if (play) { play.textContent = `Play as ${HEROES[id].name} →`; play.onclick = () => playAs(id); }
  video.src = `../intro/${id}.mp4`;
  film.showModal();
  video.play().catch(() => { /* the controls are there to start it */ });
};
if (film && video) {
  const close = () => { video.pause(); video.removeAttribute('src'); video.load(); };
  film.addEventListener('close', close);
  film.addEventListener('click', e => { if (e.target === film) film.close(); });
  film.querySelector('[data-film-close]')?.addEventListener('click', () => film.close());
}
document.querySelectorAll<HTMLElement>('[data-film]').forEach(b => b.addEventListener('click', () => openFilm(b.dataset.film as HeroId)));

// The hero select, drawn only while it is on screen.
const selectEl = document.getElementById('select-root');
if (selectEl) {
  const root = ReactDOM.createRoot(selectEl);
  function SelectSection() {
    const [shown, setShown] = useState(false);
    useEffect(() => watch(selectEl!, setShown), []);
    return <Select visible={shown} onFilm={openFilm} />;
  }
  root.render(<SelectSection />);
}
