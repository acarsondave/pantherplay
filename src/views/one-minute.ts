import { audio } from '../lib/audio-bridge';
import { store } from '../lib/store';
import { router } from '../lib/router';

export function renderOneMinute(container: HTMLElement) {
  let viewState: 'setup' | 'playing' | 'results' = 'setup';
  let chordFrom = 'D';
  let chordTo = 'A';
  let duration = 60;

  let transitions = 0;
  let timeLeft = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let lastChord = '';

  // Onset gating: only count a chord change as a transition
  // if an onset (strum) was detected since the last chord change.
  let onsetSinceLastChange = false;

  const render = () => {
    if (viewState === 'setup') {
      container.innerHTML = `
        <div class="zen-fade h-full w-full flex flex-col items-center justify-center max-w-2xl mx-auto">
          <div class="glass p-xl rounded-xl flex flex-col gap-xl w-full">
            <div class="flex items-center justify-center gap-lg">
              <select id="sel-from" class="bg-surface-0 text-text border border-surface-2 p-md rounded-lg text-2xl font-bold text-center outline-none cursor-pointer appearance-none px-xl">
                ${['A', 'C', 'D', 'E', 'G', 'Am', 'Dm', 'Em'].map(c => `<option value="${c}" ${c===chordFrom?'selected':''}>${c}</option>`).join('')}
              </select>
              <i class="ph ph-arrows-left-right text-subtext text-2xl"></i>
              <select id="sel-to" class="bg-surface-0 text-text border border-surface-2 p-md rounded-lg text-2xl font-bold text-center outline-none cursor-pointer appearance-none px-xl">
                ${['A', 'C', 'D', 'E', 'G', 'Am', 'Dm', 'Em'].map(c => `<option value="${c}" ${c===chordTo?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>

            <button id="btn-start" class="btn btn-primary text-xl px-2xl py-lg w-full flex items-center justify-center gap-sm">
              <i class="ph ph-play text-2xl"></i> Start
            </button>
          </div>
        </div>
      `;

      document.getElementById('sel-from')?.addEventListener('change', (e) => chordFrom = (e.target as HTMLSelectElement).value);
      document.getElementById('sel-to')?.addEventListener('change', (e) => chordTo = (e.target as HTMLSelectElement).value);
      document.getElementById('btn-start')?.addEventListener('click', startSession);

    } else if (viewState === 'playing') {
      container.innerHTML = `
        <div class="h-full w-full flex flex-col items-center justify-center relative">

          <div class="absolute top-10 right-10 flex gap-md opacity-40 hover:opacity-100 transition-fast">
            <button id="btn-abort" class="btn-icon text-subtext hover:text-text" title="Abort">
              <i class="ph ph-x text-2xl"></i>
            </button>
          </div>

          <div class="text-subtext text-2xl mb-xl font-medium tracking-wide uppercase" id="chord-pair-display">
            <span id="chord-from-label">${chordFrom}</span>
            <i class="ph ph-arrows-left-right mx-sm"></i>
            <span id="chord-to-label">${chordTo}</span>
          </div>

          <div class="text-hero text-text font-mono font-bold leading-none" id="transition-count">${transitions}</div>
          <div class="text-subtext text-lg tracking-widest uppercase mb-2xl">transitions</div>

          <div class="flex items-center gap-sm text-3xl text-subtext font-mono mt-xl">
            <i class="ph ph-hourglass"></i>
            <span id="time-left">${timeLeft}</span>
          </div>

          <div class="mt-xl text-subtext text-sm uppercase tracking-wider" id="detected-chord">listening...</div>

        </div>
      `;

      document.getElementById('btn-abort')?.addEventListener('click', abortSession);

    } else if (viewState === 'results') {
      container.innerHTML = `
        <div class="zen-fade h-full flex flex-col items-center justify-center gap-lg max-w-lg mx-auto w-full">
          <div class="flex items-center gap-sm mb-lg text-green">
            <i class="ph ph-check-circle text-4xl"></i>
            <h1 class="text-3xl font-bold tracking-tight">Done</h1>
          </div>

          <div class="glass p-xl rounded-xl text-center w-full">
            <div class="text-hero text-text font-mono font-bold leading-none mb-sm">${transitions}</div>
            <div class="text-subtext text-lg tracking-widest uppercase mb-lg">changes per minute</div>
            <div class="text-xl text-accent font-medium bg-surface-0 py-sm rounded-lg border border-surface-1">
              ${chordFrom} <i class="ph ph-arrows-left-right mx-xs"></i> ${chordTo}
            </div>
          </div>

          <div class="flex gap-md w-full mt-md">
            <button id="btn-retry" class="btn glass flex-1 text-xl py-md hover:bg-surface-1 flex items-center justify-center gap-sm">
              <i class="ph ph-arrow-counter-clockwise"></i> Retry
            </button>
            <button id="btn-done" class="btn btn-primary flex-1 text-xl py-md flex items-center justify-center gap-sm">
              <i class="ph ph-check"></i> Done
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-retry')?.addEventListener('click', () => { viewState = 'setup'; render(); });
      document.getElementById('btn-done')?.addEventListener('click', () => router.navigate('one-minute'));
    }
  };

  let unsubChord: (() => void) | null = null;
  let unsubOnset: (() => void) | null = null;

  const startSession = async () => {
    viewState = 'playing';
    transitions = 0;
    timeLeft = duration;
    lastChord = '';
    onsetSinceLastChange = false;

    document.body.classList.add('is-practicing');
    render();

    try {
      const state = store.getState();
      await audio.startListening(state.micDeviceId || undefined);
    } catch(e) {
      console.error(e);
      document.body.classList.remove('is-practicing');
      viewState = 'setup';
      render();
      return;
    }

    // Listen for onset events (strums)
    if (unsubOnset) unsubOnset();
    unsubOnset = audio.onOnset(() => {
      onsetSinceLastChange = true;
    });

    // Listen for chord events
    if (unsubChord) unsubChord();
    unsubChord = audio.onChord((ev) => {
      // The Rust engine already filters by confidence and stability.
      // We only receive high-confidence, stable detections here.

      // Update the detected chord display (no full re-render)
      const detectedEl = document.getElementById('detected-chord');
      if (detectedEl) {
        detectedEl.textContent = ev.chord;
      }

      // Highlight the active chord in the pair display
      const fromLabel = document.getElementById('chord-from-label');
      const toLabel = document.getElementById('chord-to-label');
      if (fromLabel && toLabel) {
        fromLabel.className = ev.chord === chordFrom ? 'text-accent' : '';
        toLabel.className = ev.chord === chordTo ? 'text-accent' : '';
      }

      // Count transitions only when:
      // 1. The detected chord is one of the two target chords
      // 2. It is different from the last detected target chord
      // 3. We have a previous chord (not the first detection)
      // 4. An onset was detected since the last chord change
      if (
        (ev.chord === chordFrom || ev.chord === chordTo) &&
        ev.chord !== lastChord &&
        lastChord !== '' &&
        onsetSinceLastChange
      ) {
        transitions++;
        const countEl = document.getElementById('transition-count');
        if (countEl) countEl.textContent = transitions.toString();
        onsetSinceLastChange = false;
      }

      if (ev.chord === chordFrom || ev.chord === chordTo) {
        lastChord = ev.chord;
      }
    });

    timerInterval = setInterval(() => {
      timeLeft--;
      const tEl = document.getElementById('time-left');
      if (tEl) tEl.textContent = timeLeft.toString();

      if (timeLeft <= 0) {
        endSession();
      }
    }, 1000);
  };

  const cleanup = () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    if (unsubChord) unsubChord();
    unsubChord = null;
    if (unsubOnset) unsubOnset();
    unsubOnset = null;
    audio.stopListening();
    document.body.classList.remove('is-practicing');
  };

  const endSession = () => {
    cleanup();
    viewState = 'results';
    render();
  };

  const abortSession = () => {
    cleanup();
    viewState = 'setup';
    render();
  };

  render();

  const unsubRoute = router.subscribe((route) => {
    if (route !== 'one-minute') {
      cleanup();
      unsubRoute();
    }
  });
}
