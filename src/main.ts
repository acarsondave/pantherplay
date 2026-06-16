import './styles/global.css';
import { router, Route } from './lib/router';
import { renderDashboard } from './views/dashboard';
import { renderFreePlay } from './views/free-play';
import { renderOneMinute } from './views/one-minute';
import { renderMatrix } from './views/matrix';

// Build the persistent app shell
document.body.innerHTML = `
  <header class="zen-fade w-full flex justify-between items-center p-lg absolute top-0 left-0 right-0 z-10">
    <div class="flex items-center gap-sm cursor-pointer" id="nav-logo">
      <i class="ph ph-guitar text-2xl text-accent"></i>
      <span class="font-bold text-xl tracking-tight">PantherPlay</span>
    </div>
    <div class="flex items-center gap-md">
      <button class="btn glass rounded-full w-10 h-10 flex items-center justify-center p-0 hover:bg-surface-1 transition-fast" id="nav-settings" title="Settings">
        <i class="ph ph-sliders-horizontal text-xl"></i>
      </button>
      <button class="btn glass rounded-full w-10 h-10 flex items-center justify-center p-0 hover:bg-surface-1 transition-fast" id="nav-account" title="Account">
        <i class="ph ph-user text-xl"></i>
      </button>
    </div>
  </header>
  <main id="app-content" class="w-full h-full flex flex-col justify-center items-center pt-3xl relative"></main>
`;

const appContent = document.querySelector<HTMLDivElement>('#app-content')!;

document.getElementById('nav-logo')?.addEventListener('click', () => router.navigate('dashboard'));
document.getElementById('nav-settings')?.addEventListener('click', () => router.navigate('settings'));
// document.getElementById('nav-account')?.addEventListener('click', () => openAccountModal()); // To be implemented

function render(route: Route) {
  appContent.innerHTML = '';
  // Ensure we are not stuck in practice mode when navigating away
  document.body.classList.remove('is-practicing');
  
  switch (route) {
    case 'dashboard':
      renderDashboard(appContent);
      break;
    case 'free-play':
      renderFreePlay(appContent);
      break;
    case 'one-minute':
      renderOneMinute(appContent);
      break;
    case 'matrix':
      renderMatrix(appContent);
      break;
    case 'settings':
      import('./views/settings').then(m => m.renderSettings(appContent));
      break;
  }
}

router.subscribe(render);
