import { store } from '../lib/store';
import { audio } from '../lib/audio-bridge';

export async function renderSettings(container: HTMLElement) {
  const devices = await audio.getAudioDevices();
  const state = store.getState();

  const micOptions = devices.map(d => 
    `<option value="${d.id}" ${state.micDeviceId === d.id ? 'selected' : ''}>${d.name}</option>`
  ).join('');

  container.innerHTML = `
    <div class="zen-fade h-full flex flex-col max-w-3xl mx-auto w-full px-lg animate-in fade-in">
      
      <div class="flex items-center gap-sm mb-2xl text-subtext">
        <i class="ph ph-sliders-horizontal text-2xl"></i>
        <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
      </div>
      
      <div class="flex flex-col gap-xl">
        <!-- Appearance -->
        <section>
          <div class="flex items-center gap-xs mb-md text-text">
            <i class="ph ph-palette text-xl text-accent"></i>
            <h2 class="text-xl font-bold">Appearance</h2>
          </div>
          <div class="grid grid-cols-2 gap-lg pl-lg">
            
            <div>
              <label class="block text-subtext mb-xs text-sm font-semibold uppercase tracking-wider">Theme</label>
              <div class="flex gap-sm">
                <button class="btn glass flex-1 py-sm ${state.theme === 'mocha' ? 'border-accent text-accent' : ''}" data-theme="mocha">Mocha</button>
                <button class="btn glass flex-1 py-sm ${state.theme === 'dark' ? 'border-accent text-accent' : ''}" data-theme="dark">Dark</button>
                <button class="btn glass flex-1 py-sm ${state.theme === 'oled' ? 'border-accent text-accent' : ''}" data-theme="oled">OLED</button>
              </div>
            </div>

            <div>
              <label class="block text-subtext mb-xs text-sm font-semibold uppercase tracking-wider">Font Family</label>
              <div class="flex gap-sm">
                <button class="btn glass flex-1 py-sm ${state.fontFamily === 'geist' ? 'border-accent text-accent' : ''}" data-font="geist">Geist</button>
                <button class="btn glass flex-1 py-sm ${state.fontFamily === 'satoshi' ? 'border-accent text-accent' : ''}" data-font="satoshi">Satoshi</button>
              </div>
            </div>

          </div>
        </section>

        <!-- Audio -->
        <section>
          <div class="flex items-center gap-xs mb-md text-text">
            <i class="ph ph-microphone text-xl text-green"></i>
            <h2 class="text-xl font-bold">Audio</h2>
          </div>
          <div class="pl-lg">
            <label class="block text-subtext mb-xs text-sm font-semibold uppercase tracking-wider">Input Device</label>
            <select id="mic-select" class="w-full max-w-md bg-surface-0 text-text border border-surface-2 p-md rounded-lg outline-none focus:border-accent transition-fast cursor-pointer appearance-none">
              <option value="">Default System Device</option>
              ${micOptions}
            </select>
          </div>
        </section>

      </div>
    </div>
  `;

  // Listeners
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const theme = (e.currentTarget as HTMLElement).dataset.theme as any;
      store.update({ theme });
      renderSettings(container); // Re-render to update selected states
    });
  });

  document.querySelectorAll('[data-font]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const fontFamily = (e.currentTarget as HTMLElement).dataset.font as any;
      store.update({ fontFamily });
      renderSettings(container);
    });
  });

  document.getElementById('mic-select')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    store.update({ micDeviceId: val || null });
  });
}
