// What every page of the website shares: the game's own fonts and paper theme, the store badges, the menu on phones
// and the gentle reveal of sections as they scroll in.
import '@fontsource/cinzel-decorative/latin-900.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-900.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '../landing.css';
import site from '../site.json';

export function setupPage() {
  // Store badges: a link once the store page exists, "Coming soon" until then (the links live in landing/site.json).
  const stores: Record<string, string> = { play: site.playStoreUrl, apple: site.appStoreUrl };
  document.querySelectorAll<HTMLAnchorElement>('a[data-store]').forEach(a => {
    const url = stores[a.dataset.store!];
    if (url) { a.href = url; a.classList.remove('soon'); a.querySelector('.badge-soon')?.remove(); }
    else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
  });

  // The menu folds into a button on phones.
  const nav = document.querySelector('.site-nav'), toggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
  if (nav && toggle) {
    toggle.addEventListener('click', () => { const open = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
    nav.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }));
  }
  // The bar gets its card background once the page scrolls under it.
  const bar = document.querySelector('.site-nav');
  if (bar) { const set = () => bar.classList.toggle('solid', window.scrollY > 40); addEventListener('scroll', set, { passive: true }); set(); }

  // Sections rise in as they arrive.
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(el => io.observe(el));
  } else items.forEach(el => el.classList.add('in'));

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
}
