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
  let timerInterval: any = null;
  let lastChord = '';

  const render = () => {
    if (viewState === 'setup') {
      container.innerHTML = `
        <div class="zen-fade h-full w-full flex flex-col items-center justify-center max-w-2xl mx-auto">
          <div class="flex items-center gap-sm mb-lg text-accent">
            <i class="ph ph-timer text-3xl"></i>
            <h1 class="text-3xl font-bold tracking-tight">One-Minute Changes</h1>
          </div>
          
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
              <i class="ph ph-play text-2xl"></i> Start Test
            </button>
          </div>
        </div>
      `;

      document.getElementById('sel-from')?.addEventListener('change', (e) => chordFrom = (e.target as HTMLSelectElement).value);
      document.getElementById('sel-to')?.addEventListener('change', (e) => chordTo = (e.target as HTMLSelectElement).value);
      document.getElementById('btn-start')?.addEventListener('click', startSession);

    } else if (viewState === 'playing') {
      // In playing state, we want ZERO UI bloat. Only the test matters.
      container.innerHTML = `
        <div class="h-full w-full flex flex-col items-center justify-center relative">
          
          <div class="absolute top-10 right-10 flex gap-md opacity-50 hover:opacity-100 transition-fast">
            <button id="btn-abort" class="btn glass p-md rounded-full flex items-center justify-center text-subtext hover:text-text hover:bg-surface-2" title="Abort Test">
              <i class="ph ph-x text-2xl"></i>
            </button>
          </div>

          <div class="text-subtext text-2xl mb-xl font-medium tracking-wide uppercase">
            <span class="${lastChord === chordFrom ? 'text-accent' : ''}">${chordFrom}</span> 
            <i class="ph ph-arrows-left-right mx-sm"></i> 
            <span class="${lastChord === chordTo ? 'text-accent' : ''}">${chordTo}</span>
          </div>
          
          <div class="text-hero text-text font-mono font-bold leading-none" id="transition-count">${transitions}</div>
          <div class="text-subtext text-lg tracking-widest uppercase mb-2xl">Transitions</div>
          
          <div class="flex items-center gap-sm text-3xl text-subtext font-mono mt-xl">
            <i class="ph ph-hourglass"></i>
            <span id="time-left">${timeLeft}</span>
          </div>
          
        </div>
      `;
      
      document.getElementById('btn-abort')?.addEventListener('click', abortSession);

    } else if (viewState === 'results') {
      container.innerHTML = `
        <div class="zen-fade h-full flex flex-col items-center justify-center gap-lg max-w-lg mx-auto w-full">
          <div class="flex items-center gap-sm mb-lg text-green">
            <i class="ph ph-check-circle text-4xl"></i>
            <h1 class="text-3xl font-bold tracking-tight">Test Complete</h1>
          </div>
          
          <div class="glass p-xl rounded-xl text-center w-full">
            <div class="text-hero text-text font-mono font-bold leading-none mb-sm">${transitions}</div>
            <div class="text-subtext text-lg tracking-widest uppercase mb-lg">CPM (Changes per Minute)</div>
            <div class="text-xl text-accent font-medium bg-surface-0 py-sm rounded-lg border border-surface-1">
              ${chordFrom} <i class="ph ph-arrows-left-right mx-xs"></i> ${chordTo}
            </div>
          </div>
          
          <div class="flex gap-md w-full mt-md">
            <button id="btn-retry" class="btn glass flex-1 text-xl py-md hover:bg-surface-1 flex items-center justify-center gap-sm">
              <i class="ph ph-arrow-counter-clockwise"></i> Retry
            </button>
            <button id="btn-done" class="btn btn-primary flex-1 text-xl py-md flex items-center justify-center gap-sm">
              <i class="ph ph-check"></i> Continue
            </button>
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
    
    // ENGAGE ZEN MODE
    document.body.classList.add('is-practicing');
    render();

    try {
      const state = store.getState();
      await audio.startListening(state.micDeviceId || undefined);
    } catch(e) {
      console.error(e);
      document.body.classList.remove('is-practicing');
      alert("Microphone error");
      viewState = 'setup';
      render();
      return;
    }

    if (unsubChord) unsubChord();
    unsubChord = audio.onChord((ev) => {
      if (ev.confidence > 0.6) {
        if ((ev.chord === chordFrom || ev.chord === chordTo) && ev.chord !== lastChord && lastChord !== '') {
           transitions++;
           const countEl = document.getElementById('transition-count');
           if (countEl) countEl.textContent = transitions.toString();
        }
        if (ev.chord === chordFrom || ev.chord === chordTo) {
           lastChord = ev.chord;
           render(); // Re-render playing state to show active chord color
        }
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

  const endSession = () => {
    clearInterval(timerInterval);
    if (unsubChord) unsubChord();
    audio.stopListening();
    
    // DISENGAGE ZEN MODE
    document.body.classList.remove('is-practicing');
    viewState = 'results';
    render();
  };

  const abortSession = () => {
    clearInterval(timerInterval);
    if (unsubChord) unsubChord();
    audio.stopListening();
    document.body.classList.remove('is-practicing');
    viewState = 'setup';
    render();
  };

  // Initial render
  render();

  // Cleanup
  const unsubRoute = router.subscribe((route) => {
    if (route !== 'one-minute') {
      if (timerInterval) clearInterval(timerInterval);
      if (unsubChord) unsubChord();
      audio.stopListening();
      document.body.classList.remove('is-practicing');
      unsubRoute();
    }
  });
}
