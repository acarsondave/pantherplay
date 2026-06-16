import { router } from '../lib/router';

export function renderMatrix(container: HTMLElement) {
  const chords = ['A', 'C', 'D', 'E', 'G', 'Am', 'Dm', 'Em'];
  
  // Dummy data for visual proof-of-concept
  const getDummyCPM = (from: string, to: string) => {
    if (from === to) return '-';
    // Random CPM between 20 and 60 for demo
    const cpm = Math.floor(Math.random() * 40) + 20;
    return cpm.toString();
  };

  const getHeatmapColor = (cpmStr: string) => {
    if (cpmStr === '-') return 'bg-surface-1 text-surface-2'; // empty/self
    const cpm = parseInt(cpmStr, 10);
    if (cpm > 50) return 'bg-green text-crust font-bold';
    if (cpm > 40) return 'bg-green text-crust opacity-80';
    if (cpm > 30) return 'bg-yellow text-crust';
    return 'bg-red text-crust';
  };

  const headerRow = '<th></th>' + chords.map(c => `<th class="p-sm text-subtext">${c}</th>`).join('');
  
  const rows = chords.map(from => {
    const cells = chords.map(to => {
      const cpm = getDummyCPM(from, to);
      const colorClass = getHeatmapColor(cpm);
      return `<td class="${colorClass} p-sm text-center border border-surface-0 rounded m-xs" title="${from} to ${to}">${cpm}</td>`;
    }).join('');
    return `<tr><th class="p-sm text-subtext text-right pr-md">${from}</th>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="h-full flex flex-col p-xl">
      <div class="flex justify-between items-center mb-xl border-b border-surface-0 pb-md">
        <h1 class="text-2xl text-accent">Transition Matrix</h1>
        <button id="btn-back" class="btn">← Back</button>
      </div>
      
      <div class="flex-1 flex flex-col items-center justify-center overflow-auto">
        <p class="text-subtext mb-lg">Showing Best Changes Per Minute (CPM). Demo data.</p>
        
        <table class="border-separate" style="border-spacing: 4px;">
          <thead>
            <tr>${headerRow}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => {
    router.navigate('dashboard');
  });
}
