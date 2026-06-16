import { audio } from '../lib/audio-bridge';
import { store } from '../lib/store';
import { router } from '../lib/router';

export function renderFreePlay(container: HTMLElement) {
  container.innerHTML = `
    <div class="h-full flex flex-col">
      <div class="p-md flex justify-between items-center bg-crust">
        <button id="btn-back" class="btn">← Back</button>
        <div class="text-subtext">Free Play Mode</div>
        <div id="mic-status" class="text-sm text-green">Listening...</div>
      </div>
      
      <div class="flex-1 flex flex-col items-center justify-center">
        <div id="chord-display" class="text-display text-text" style="transition: color var(--transition-fast)">
          --
        </div>
        <div id="confidence-bar" class="w-64 h-2 bg-surface-0 mt-lg rounded overflow-hidden">
          <div id="confidence-fill" class="h-full bg-accent" style="width: 0%; transition: width var(--transition-fast), background-color var(--transition-fast)"></div>
        </div>
        <div class="text-subtext mt-sm text-sm">Play a chord (A, D, E, Am, Em, G, C, Dm)</div>
      </div>
    </div>
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => {
    router.navigate('dashboard');
  });

  // Start listening
  const state = store.getState();
  audio.startListening(state.micDeviceId || undefined).catch(e => {
    const el = document.getElementById('mic-status');
    if (el) {
      el.textContent = 'Mic Error';
      el.classList.replace('text-green', 'text-red');
    }
    console.error(e);
  });

  // Set up events
  const unsubChord = audio.onChord((ev) => {
    const display = document.getElementById('chord-display');
    const fill = document.getElementById('confidence-fill');
    
    if (display && fill) {
      // Only update if confidence is high enough to reduce flicker on bad matches
      if (ev.confidence > 0.4 || display.textContent === '--') {
        display.textContent = ev.chord;
      }
      fill.style.width = `${Math.min(ev.confidence * 100, 100)}%`;
      if (ev.confidence > 0.8) {
        fill.style.backgroundColor = 'var(--color-green)';
        display.style.color = 'var(--color-green)';
      } else if (ev.confidence > 0.5) {
        fill.style.backgroundColor = 'var(--color-yellow)';
        display.style.color = 'var(--color-text)';
      } else {
        fill.style.backgroundColor = 'var(--color-red)';
        display.style.color = 'var(--color-subtext-0)';
      }
    }
  });

  // Clean up when leaving route
  const unsubRoute = router.subscribe((route) => {
    if (route !== 'free-play') {
      unsubChord();
      unsubRoute();
      audio.stopListening();
    }
  });
}
