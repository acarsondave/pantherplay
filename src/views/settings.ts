import { store } from '../lib/store';
import { audio } from '../lib/audio-bridge';
import { router } from '../lib/router';

export async function renderSettings(container: HTMLElement) {
  const devices = await audio.getAudioDevices();
  const state = store.getState();

  const options = devices.map(d => 
    `<option value="${d.id}" ${state.micDeviceId === d.id ? 'selected' : ''}>${d.name}</option>`
  ).join('');

  container.innerHTML = `
    <div class="h-full flex flex-col max-w-2xl mx-auto w-full p-xl">
      <div class="flex justify-between items-center mb-xl border-b border-surface-0 pb-md">
        <h1 class="text-2xl text-accent">Settings</h1>
        <button id="btn-back" class="btn">← Back</button>
      </div>
      
      <div class="bg-surface-0 rounded-xl p-lg flex flex-col gap-md">
        <div>
          <label class="block text-subtext mb-sm text-sm">Microphone Input</label>
          <select id="mic-select" class="w-full bg-surface-1 text-text border border-surface-2 p-sm rounded outline-none focus:border-accent">
            <option value="">Default System Device</option>
            ${options}
          </select>
        </div>
        
        <div class="pt-md border-t border-surface-1">
          <label class="block text-subtext mb-sm text-sm">Account</label>
          ${state.user 
            ? `<p class="text-text">Signed in as ${state.user.email}</p>` 
            : `<p class="text-subtext">Not signed in</p>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-back')?.addEventListener('click', () => {
    router.navigate('dashboard');
  });

  document.getElementById('mic-select')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    store.update({ micDeviceId: val || null });
  });
}
