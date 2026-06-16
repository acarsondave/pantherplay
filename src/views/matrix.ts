import { router } from '../lib/router';

export function renderMatrix(container: HTMLElement) {
  const chords = ['A', 'C', 'D', 'E', 'G', 'Am', 'Dm', 'Em'];
  
  // Dummy data for visual proof-of-concept
  const getDummyCPM = (from: string, to: string) => {
    if (from === to) return '-';
    const cpm = Math.floor(Math.random() * 40) + 20;
    return cpm.toString();
  };

  const getHeatmapColor = (cpmStr: string) => {
    if (cpmStr === '-') return 'bg-surface-0 text-surface-2'; // empty/self
    const cpm = parseInt(cpmStr, 10);
    // Use opacity based on heat for a more modern look
    if (cpm > 50) return 'bg-green text-crust font-bold';
    if (cpm > 40) return 'bg-green text-crust opacity-80';
    if (cpm > 30) return 'bg-yellow text-crust';
    return 'bg-surface-1 text-text';
  };

  const headerRow = '<th></th>' + chords.map(c => `<th class="p-md text-subtext font-semibold">${c}</th>`).join('');
  
  const rows = chords.map(from => {
    const cells = chords.map(to => {
      const cpm = getDummyCPM(from, to);
      const colorClass = getHeatmapColor(cpm);
      return `<td class="${colorClass} p-sm text-center border border-surface-0 rounded-md font-mono m-xs transition-fast hover:scale-105 cursor-pointer" title="${from} ↔ ${to}">${cpm}</td>`;
    }).join('');
    return `<tr><th class="p-md text-subtext font-semibold text-right pr-lg">${from}</th>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="zen-fade h-full flex flex-col max-w-4xl mx-auto p-xl animate-in fade-in">
      
      <div class="flex items-center gap-sm mb-2xl text-accent">
        <i class="ph ph-grid-four text-3xl"></i>
        <h1 class="text-3xl font-bold tracking-tight">Transition Matrix</h1>
      </div>
      
      <div class="flex-1 flex flex-col items-center justify-center overflow-auto w-full">
        <div class="glass p-xl rounded-xl shadow-lg w-full">
          <div class="flex justify-between items-center mb-lg">
            <p class="text-subtext text-sm uppercase tracking-wider font-semibold">Best CPM (Changes per Minute)</p>
          </div>
          
          <div class="overflow-x-auto w-full flex justify-center">
            <table class="border-separate w-full max-w-2xl" style="border-spacing: 6px;">
              <thead>
                <tr>${headerRow}</tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}
