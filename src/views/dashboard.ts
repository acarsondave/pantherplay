
import { router } from '../lib/router';

export function renderDashboard(container: HTMLElement) {

  container.innerHTML = `
    <div class="zen-fade dashboard-layout h-full flex flex-col items-center justify-center gap-2xl w-full max-w-4xl mx-auto px-lg">
      
      <div class="text-center mb-xl">
        <h1 class="text-display text-text font-bold mb-xs tracking-tight">Focus. Play.</h1>
        <p class="text-subtext text-xl">The fastest way to internalize your transitions.</p>
      </div>

      <div class="flex gap-lg w-full max-w-2xl">
        <button id="btn-free-play" class="flex-1 glass p-xl rounded-xl flex flex-col items-center justify-center gap-md hover:bg-surface-1 transition-fast text-left group">
          <i class="ph ph-waveform text-4xl text-blue group-hover:scale-110 transition-fast"></i>
          <div>
            <h3 class="text-2xl font-bold text-text mb-xs">Free Play</h3>
            <p class="text-subtext text-sm text-center">Practice freely with instant feedback.</p>
          </div>
        </button>
        
        <button id="btn-one-minute" class="flex-1 glass p-xl rounded-xl flex flex-col items-center justify-center gap-md hover:bg-surface-1 transition-fast text-left group">
          <i class="ph ph-timer text-4xl text-accent group-hover:scale-110 transition-fast"></i>
          <div>
            <h3 class="text-2xl font-bold text-text mb-xs">One Minute</h3>
            <p class="text-subtext text-sm text-center">Test your transition speed under pressure.</p>
          </div>
        </button>
      </div>

      <div class="mt-2xl flex gap-md">
        <button id="btn-matrix" class="btn glass flex items-center gap-sm px-lg py-md rounded-full text-lg hover:bg-surface-1">
          <i class="ph ph-grid-four text-xl"></i> Transition Matrix
        </button>
      </div>
      
    </div>
  `;

  document.getElementById('btn-free-play')?.addEventListener('click', () => router.navigate('free-play'));
  document.getElementById('btn-one-minute')?.addEventListener('click', () => router.navigate('one-minute'));
  document.getElementById('btn-matrix')?.addEventListener('click', () => router.navigate('matrix'));
}
