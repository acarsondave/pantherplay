import './styles/global.css';
import { router, Route } from './lib/router';
import { renderFreePlay } from './views/free-play';
import { renderOneMinute } from './views/one-minute';
import { renderMatrix } from './views/matrix';
import { firebaseApi } from './lib/firebase';
import { store } from './lib/store';

// Build the persistent app shell
document.body.innerHTML = `
  <header class="zen-fade w-full flex justify-between items-center px-lg py-md absolute top-0 left-0 right-0 z-10">
    <div class="flex items-center gap-md">
      <div class="flex items-center gap-xs cursor-pointer" id="nav-logo">
        <i class="ph ph-guitar text-xl text-accent"></i>
        <span class="font-bold text-lg tracking-tight">PantherPlay</span>
      </div>
      <div class="flex items-center gap-xs text-sm">
        <span class="text-surface-2">|</span>
        <select id="mode-select" class="bg-transparent text-subtext border-none outline-none cursor-pointer text-sm font-medium appearance-none pr-md">
          <option value="one-minute">one minute</option>
          <option value="free-play">free play</option>
        </select>
      </div>
    </div>
    <div class="flex items-center gap-sm">
      <button class="btn-icon" id="nav-calibrate" title="Calibrate Tuning">
        <i class="ph ph-waveform text-lg"></i>
      </button>
      <button class="btn-icon" id="nav-matrix" title="Transition Matrix">
        <i class="ph ph-grid-four text-lg"></i>
      </button>
      <button class="btn-icon" id="nav-settings" title="Settings">
        <i class="ph ph-sliders-horizontal text-lg"></i>
      </button>
      <button class="btn-icon" id="nav-account" title="Account">
        <i class="ph ph-user text-lg"></i>
      </button>
    </div>
  </header>
  <main id="app-content" class="w-full h-full flex flex-col justify-center items-center relative"></main>

  <!-- Account Modal -->
  <div id="account-modal" class="modal-overlay hidden">
    <div class="modal-content glass rounded-xl p-xl flex flex-col gap-lg max-w-sm w-full mx-lg">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-bold text-text">Account</h2>
        <button id="modal-close" class="btn-icon"><i class="ph ph-x text-xl"></i></button>
      </div>
      <div id="account-body"></div>
    </div>
  </div>

  <!-- Calibration Modal -->
  <div id="calibration-modal" class="modal-overlay hidden">
    <div class="modal-content glass rounded-xl p-xl flex flex-col items-center text-center gap-md max-w-sm w-full mx-lg">
      <div class="w-16 h-16 rounded-full bg-surface-1 flex items-center justify-center mb-sm">
        <i class="ph ph-waveform text-3xl text-accent animate-pulse" id="calibration-icon"></i>
      </div>
      <h2 class="text-xl font-bold text-text">Calibrate Tuning</h2>
      <p class="text-subtext text-sm mb-lg">Pluck any single open string and let it ring clearly.</p>
      
      <div id="calibration-status" class="text-accent font-mono text-lg font-medium h-8">
        Listening...
      </div>
      
      <div class="flex gap-md w-full mt-md">
        <button id="modal-calibration-cancel" class="btn glass flex-1 py-md text-subtext hover:text-text">Cancel</button>
        <button id="modal-calibration-done" class="btn btn-primary flex-1 py-md hidden">Done</button>
      </div>
    </div>
  </div>
`;

const appContent = document.querySelector<HTMLDivElement>('#app-content')!;
const modeSelect = document.getElementById('mode-select') as HTMLSelectElement;
const accountModal = document.getElementById('account-modal')!;
const calibrationModal = document.getElementById('calibration-modal')!;

// Mode selector: navigates between practice modes
modeSelect.addEventListener('change', () => {
  router.navigate(modeSelect.value as Route);
});

// Navigation buttons
document.getElementById('nav-logo')?.addEventListener('click', () => router.navigate('one-minute'));
document.getElementById('nav-matrix')?.addEventListener('click', () => router.navigate('matrix'));
document.getElementById('nav-settings')?.addEventListener('click', () => router.navigate('settings'));
document.getElementById('nav-account')?.addEventListener('click', () => openAccountModal());
document.getElementById('modal-close')?.addEventListener('click', () => closeAccountModal());

document.getElementById('nav-calibrate')?.addEventListener('click', () => openCalibrationModal());
document.getElementById('modal-calibration-cancel')?.addEventListener('click', () => closeCalibrationModal());
document.getElementById('modal-calibration-done')?.addEventListener('click', () => closeCalibrationModal());

// Close modals on overlay click
accountModal.addEventListener('click', (e) => {
  if (e.target === accountModal) closeAccountModal();
});
calibrationModal.addEventListener('click', (e) => {
  if (e.target === calibrationModal) closeCalibrationModal();
});

import { audio } from './lib/audio-bridge';
let unsubCalibrate: (() => void) | null = null;

function openCalibrationModal() {
  calibrationModal.classList.remove('hidden');
  const statusEl = document.getElementById('calibration-status')!;
  const doneBtn = document.getElementById('modal-calibration-done')!;
  const cancelBtn = document.getElementById('modal-calibration-cancel')!;
  const icon = document.getElementById('calibration-icon')!;
  
  statusEl.textContent = 'Listening...';
  statusEl.className = 'text-accent font-mono text-lg font-medium h-8';
  doneBtn.classList.add('hidden');
  cancelBtn.classList.remove('hidden');
  icon.classList.add('animate-pulse');
  
  // Ensure engine is running (if we're in one-minute mode, it might not be listening yet, but let's just send the command)
  audio.calibratePitch();
  
  if (unsubCalibrate) unsubCalibrate();
  unsubCalibrate = audio.onCalibrationComplete((ev) => {
    icon.classList.remove('animate-pulse');
    cancelBtn.classList.add('hidden');
    doneBtn.classList.remove('hidden');
    
    if (ev.frequency > 0) {
      statusEl.textContent = `Tuned to A = ${ev.frequency.toFixed(1)} Hz`;
      statusEl.className = 'text-green font-mono text-lg font-medium h-8';
    } else {
      statusEl.textContent = 'Failed to detect pitch.';
      statusEl.className = 'text-red font-mono text-lg font-medium h-8';
    }
  });
}

function closeCalibrationModal() {
  calibrationModal.classList.add('hidden');
  if (unsubCalibrate) {
    unsubCalibrate();
    unsubCalibrate = null;
  }
}

function openAccountModal() {
  const state = store.getState();
  const body = document.getElementById('account-body')!;

  if (state.user) {
    body.innerHTML = `
      <p class="text-subtext text-sm">Signed in as</p>
      <p class="text-text font-medium mb-lg">${state.user.email}</p>
      <button id="btn-signout" class="btn btn-primary w-full py-md">Sign Out</button>
    `;
    document.getElementById('btn-signout')?.addEventListener('click', async () => {
      await firebaseApi.signOut();
      closeAccountModal();
    });
  } else {
    body.innerHTML = `
      <p class="text-subtext text-sm mb-md">Sign in to sync your data across devices.</p>
      <form id="auth-form" class="flex flex-col gap-md">
        <input type="email" id="auth-email" placeholder="Email" required
          class="bg-surface-0 text-text border border-surface-2 p-md rounded-lg outline-none focus:border-accent" />
        <input type="password" id="auth-pass" placeholder="Password" required
          class="bg-surface-0 text-text border border-surface-2 p-md rounded-lg outline-none focus:border-accent" />
        <div id="auth-error" class="text-red text-sm hidden"></div>
        <button type="submit" class="btn btn-primary w-full py-md">Sign In</button>
        <button type="button" id="btn-signup" class="btn glass w-full py-md text-subtext hover:text-text">Create Account</button>
      </form>
    `;

    const form = document.getElementById('auth-form') as HTMLFormElement;
    const errorEl = document.getElementById('auth-error')!;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('auth-email') as HTMLInputElement).value;
      const pass = (document.getElementById('auth-pass') as HTMLInputElement).value;
      try {
        await firebaseApi.signIn(email, pass);
        closeAccountModal();
      } catch (err: any) {
        errorEl.textContent = err.message || 'Sign in failed';
        errorEl.classList.remove('hidden');
      }
    });

    document.getElementById('btn-signup')?.addEventListener('click', async () => {
      const email = (document.getElementById('auth-email') as HTMLInputElement).value;
      const pass = (document.getElementById('auth-pass') as HTMLInputElement).value;
      if (!email || !pass) return;
      try {
        await firebaseApi.signUp(email, pass);
        closeAccountModal();
      } catch (err: any) {
        errorEl.textContent = err.message || 'Sign up failed';
        errorEl.classList.remove('hidden');
      }
    });
  }

  accountModal.classList.remove('hidden');
}

function closeAccountModal() {
  accountModal.classList.add('hidden');
}

function render(route: Route) {
  appContent.innerHTML = '';
  document.body.classList.remove('is-practicing');

  // Sync mode selector with current route
  if (route === 'one-minute' || route === 'free-play') {
    modeSelect.value = route;
  }

  switch (route) {
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
