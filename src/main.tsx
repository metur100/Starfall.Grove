import ReactDOM from 'react-dom/client';
// The fonts ship with the game (latin letters only, just the weights the styles use), so text never jumps when a
// font arrives late, and they are there offline too.
import '@fontsource/cinzel-decorative/latin-900.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-900.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import App from './App';
import { startOffline } from './pwa';
import './styles.css';
// The storybook paper theme, laid over the layout above.
import './theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

// The loading screen in index.html covers the first moments; it fades once the fonts are in (or after a short wait).
const boot = document.getElementById('boot');
if (boot) {
  const fonts = Promise.all(['900 20px "Cinzel Decorative"', '700 20px Cinzel', '800 16px Nunito'].map(f => document.fonts?.load(f).catch(() => null)));
  Promise.race([fonts, new Promise(r => setTimeout(r, 1800))]).then(() => requestAnimationFrame(() => {
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 700);
  }));
}
startOffline();
