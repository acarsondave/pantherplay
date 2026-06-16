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
        <div id="chord-display" class="text-hero text-text font-bold mb-md leading-none" style="transition: color 150ms ease, transform 150ms ease">
          --
        </div>

        <div class="w-full h-2 bg-surface-1 rounded-full overflow-hidden mb-lg">
          <div id="confidence-fill" class="h-full bg-accent rounded-full" style="width: 0%; transition: width 150ms ease, background-color 150ms ease"></div>
        </div>

        <div class="flex items-center gap-sm text-subtext text-sm tracking-wide uppercase">
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
  // (engine already gates on onset + confidence + stability)
  const unsubChord = audio.onChord((ev) => {
    const display = document.getElementById('chord-display');
    const fill = document.getElementById('confidence-fill');

    if (display && fill) {
      display.textContent = ev.chord;
      display.style.transform = 'scale(1.05)';
      setTimeout(() => { if(display) display.style.transform = 'scale(1)'; }, 150);

      fill.style.width = `${Math.min(ev.confidence * 100, 100)}%`;

      if (ev.confidence > 0.9) {
        fill.style.backgroundColor = 'var(--color-green)';
        display.style.color = 'var(--color-green)';
      } else if (ev.confidence > 0.8) {
        fill.style.backgroundColor = 'var(--color-yellow)';
        display.style.color = 'var(--color-text)';
      } else {
        fill.style.backgroundColor = 'var(--color-red)';
        display.style.color = 'var(--color-subtext-0)';
      }
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
