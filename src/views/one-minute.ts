import { audio } from '../lib/audio-bridge';
import { store } from '../lib/store';
import { router } from '../lib/router';

export function renderOneMinute(container: HTMLElement) {
  // Simple state machine for the view
  let viewState: 'setup' | 'playing' | 'results' = 'setup';
  let chordFrom = 'D';
  let chordTo = 'A';
  let duration = 60;
  
  let transitions = 0;
  let timeLeft = 0;
  let timerInterval: any = null;
  
  let lastChord = '';

  const render = () => {
    if (viewState === 'setup') {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center gap-xl p-xl">
          <div class="w-full flex justify-between absolute top-0 left-0 p-md">
            <button id="btn-back" class="btn">← Back</button>
          </div>
          
          <h1 class="text-3xl text-accent">One-Minute Changes</h1>
          
          <div class="flex items-center gap-lg bg-surface-0 p-lg rounded-xl">
            <select id="sel-from" class="bg-surface-1 text-text border border-surface-2 p-sm rounded text-xl">
              ${['A', 'C', 'D', 'E', 'G', 'Am', 'Dm', 'Em'].map(c => `<option value="${c}" ${c===chordFrom?'selected':''}>${c}</option>`).join('')}
            </select>
            <span class="text-subtext text-xl">↔</span>
            <select id="sel-to" class="bg-surface-1 text-text border border-surface-2 p-sm rounded text-xl">
              ${['A', 'C', 'D', 'E', 'G', 'Am', 'Dm', 'Em'].map(c => `<option value="${c}" ${c===chordTo?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          
          <button id="btn-start" class="btn btn-primary text-2xl px-2xl py-md mt-md">Start Practice</button>
        </div>
      `;

      document.getElementById('btn-back')?.addEventListener('click', () => router.navigate('dashboard'));
      document.getElementById('sel-from')?.addEventListener('change', (e) => chordFrom = (e.target as HTMLSelectElement).value);
      document.getElementById('sel-to')?.addEventListener('change', (e) => chordTo = (e.target as HTMLSelectElement).value);
      document.getElementById('btn-start')?.addEventListener('click', startSession);

    } else if (viewState === 'playing') {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center">
          <div class="text-subtext text-xl mb-xl">Change between <span class="text-accent">${chordFrom}</span> and <span class="text-accent">${chordTo}</span></div>
          
          <div class="text-hero text-green mb-sm" id="transition-count">${transitions}</div>
          <div class="text-subtext mb-2xl">Transitions</div>
          
          <div class="text-3xl text-text font-mono" id="time-left">${timeLeft}s</div>
          
          <div class="mt-2xl text-xl" id="current-chord">Ready...</div>
        </div>
      `;
    } else if (viewState === 'results') {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center gap-lg p-xl">
          <h1 class="text-3xl text-accent">Session Complete!</h1>
          <div class="bg-surface-0 p-xl rounded-xl text-center shadow-lg mt-md">
            <div class="text-hero text-green mb-sm">${transitions}</div>
            <div class="text-subtext text-lg">Transitions / Minute</div>
            <div class="text-md text-text mt-md border-t border-surface-1 pt-md">
              ${chordFrom} ↔ ${chordTo}
            </div>
          </div>
          
          <div class="flex gap-md mt-xl">
            <button id="btn-retry" class="btn btn-primary px-lg py-sm">Try Again</button>
            <button id="btn-done" class="btn px-lg py-sm">Done</button>
          </div>
        </div>
      `;

      document.getElementById('btn-retry')?.addEventListener('click', () => { viewState = 'setup'; render(); });
      document.getElementById('btn-done')?.addEventListener('click', () => router.navigate('dashboard'));
    }
  };

  let unsubChord: (() => void) | null = null;

  const startSession = async () => {
    viewState = 'playing';
    transitions = 0;
    timeLeft = duration;
    lastChord = '';
    render();

    try {
      const state = store.getState();
      await audio.startListening(state.micDeviceId || undefined);
    } catch(e) {
      console.error(e);
      alert("Microphone error");
      viewState = 'setup';
      render();
      return;
    }

    if (unsubChord) unsubChord();
    unsubChord = audio.onChord((ev) => {
      const el = document.getElementById('current-chord');
      if (el && ev.confidence > 0.6) {
        el.textContent = `Detected: ${ev.chord}`;
        
        // Very basic transition counting logic
        if ((ev.chord === chordFrom || ev.chord === chordTo) && ev.chord !== lastChord && lastChord !== '') {
           transitions++;
           const countEl = document.getElementById('transition-count');
           if (countEl) countEl.textContent = transitions.toString();
        }
        if (ev.chord === chordFrom || ev.chord === chordTo) {
           lastChord = ev.chord;
        }
      }
    });

    timerInterval = setInterval(() => {
      timeLeft--;
      const tEl = document.getElementById('time-left');
      if (tEl) tEl.textContent = `${timeLeft}s`;
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        if (unsubChord) unsubChord();
        audio.stopListening();
        
        // Save to firebase (todo in Phase 2)
        
        viewState = 'results';
        render();
      }
    }, 1000);
  };

  // Initial render
  render();

  // Cleanup
  const unsubRoute = router.subscribe((route) => {
    if (route !== 'one-minute') {
      if (timerInterval) clearInterval(timerInterval);
      if (unsubChord) unsubChord();
      audio.stopListening();
      unsubRoute();
    }
  });
}
