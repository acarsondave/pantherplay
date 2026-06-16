import { audio } from '../lib/audio-bridge';
import { store } from '../lib/store';
import { router } from '../lib/router';

export function renderFreePlay(container: HTMLElement) {
  document.body.classList.add('is-practicing');

  container.innerHTML = `
    <div class="h-full w-full flex flex-col items-center justify-center relative">
      <div class="absolute top-10 right-10 flex gap-md opacity-40 hover:opacity-100 transition-fast">
        <button id="btn-exit" class="btn-icon text-subtext hover:text-text" title="Exit">
          <i class="ph ph-x text-2xl"></i>
        </button>
      </div>

      <div class="flex-1 flex flex-col items-center justify-center w-full max-w-md">
        <div id="chord-display" class="text-[12rem] font-bold mb-md leading-none tracking-tighter" style="transition: color 250ms ease, transform 250ms cubic-bezier(0.175, 0.885, 0.32, 1.275); color: var(--color-surface-2)">
          --
        </div>

        <div class="flex items-center gap-sm text-subtext text-sm tracking-wide uppercase mt-xl">
          <i id="mic-icon" class="ph ph-microphone text-lg text-green"></i>
          <span id="mic-status">listening...</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-exit')?.addEventListener('click', () => {
    router.navigate('one-minute');
  });

  const state = store.getState();
  audio.startListening(state.micDeviceId || undefined).catch(e => {
    const el = document.getElementById('mic-status');
    const icon = document.getElementById('mic-icon');
    if (el && icon) {
      el.textContent = 'mic error';
      icon.classList.replace('text-green', 'text-red');
      icon.classList.replace('ph-microphone', 'ph-microphone-slash');
    }
    console.error(e);
  });

  // Only update chord display after the Rust engine sends a confident detection
  const unsubChord = audio.onChord((ev) => {
    const display = document.getElementById('chord-display');

    if (display) {
      display.textContent = ev.chord;
      display.style.transform = 'scale(1.1) translateY(-10px)';
      display.style.color = 'var(--color-accent)';
      
      setTimeout(() => { 
        if(display) {
          display.style.transform = 'scale(1) translateY(0)'; 
          display.style.color = 'var(--color-text)';
        }
      }, 300);
    }
  });

  const unsubRoute = router.subscribe((route) => {
    if (route !== 'free-play') {
      unsubChord();
      audio.stopListening();
      document.body.classList.remove('is-practicing');
      unsubRoute();
    }
  });
}
