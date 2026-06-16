import { store } from '../lib/store';
import { firebaseApi } from '../lib/firebase';
import { router } from '../lib/router';

export function renderDashboard(container: HTMLElement) {
  const state = store.getState();

  if (!state.user) {
    renderAuth(container);
    return;
  }

  container.innerHTML = `
    <div class="h-full flex flex-col items-center justify-center gap-lg">
      <h1 class="text-3xl text-accent">Welcome to PantherPlay</h1>
      <p class="text-subtext">Signed in as ${state.user.email}</p>

      <div class="flex gap-md mt-lg">
        <button id="btn-free-play" class="btn btn-primary text-xl px-lg py-md">
          🎸 Free Play
        </button>
        <button id="btn-one-minute" class="btn btn-primary text-xl px-lg py-md">
          ⏱️ One-Minute Changes
        </button>
      </div>

      <div class="mt-2xl flex gap-sm">
        <button id="btn-matrix" class="btn">Transition Matrix</button>
        <button id="btn-settings" class="btn">Settings</button>
        <button id="btn-signout" class="btn text-red border border-red">Sign Out</button>
      </div>
    </div>
  `;

  document.getElementById('btn-free-play')?.addEventListener('click', () => router.navigate('free-play'));
  document.getElementById('btn-one-minute')?.addEventListener('click', () => router.navigate('one-minute'));
  document.getElementById('btn-matrix')?.addEventListener('click', () => router.navigate('matrix'));
  document.getElementById('btn-settings')?.addEventListener('click', () => router.navigate('settings'));
  document.getElementById('btn-signout')?.addEventListener('click', () => firebaseApi.signOut());
}

function renderAuth(container: HTMLElement) {
  container.innerHTML = `
    <div class="h-full flex flex-col items-center justify-center gap-md">
      <h1 class="text-3xl text-accent mb-lg">PantherPlay</h1>
      
      <div class="bg-surface-0 p-lg rounded-xl shadow-lg flex flex-col gap-sm" style="width: 320px;">
        <h2 class="text-xl mb-sm">Sign In</h2>
        <input type="email" id="auth-email" placeholder="Email" class="p-sm rounded text-base bg-surface-1 text-text border border-surface-2" />
        <input type="password" id="auth-pass" placeholder="Password" class="p-sm rounded text-base bg-surface-1 text-text border border-surface-2" />
        
        <div class="flex gap-sm mt-md">
          <button id="btn-signin" class="btn btn-primary flex-1">Sign In</button>
          <button id="btn-signup" class="btn flex-1">Sign Up</button>
        </div>
        <p id="auth-error" class="text-red text-sm mt-sm hidden"></p>
      </div>
    </div>
  `;

  const getEmailPass = () => {
    return {
      email: (document.getElementById('auth-email') as HTMLInputElement).value,
      pass: (document.getElementById('auth-pass') as HTMLInputElement).value
    };
  };

  const showError = (msg: string) => {
    const el = document.getElementById('auth-error');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
  };

  document.getElementById('btn-signin')?.addEventListener('click', async () => {
    const { email, pass } = getEmailPass();
    if (!email || !pass) return showError('Enter email and password');
    try {
      await firebaseApi.signIn(email, pass);
    } catch (e: any) {
      showError(e.message);
    }
  });

  document.getElementById('btn-signup')?.addEventListener('click', async () => {
    const { email, pass } = getEmailPass();
    if (!email || !pass) return showError('Enter email and password');
    try {
      await firebaseApi.signUp(email, pass);
    } catch (e: any) {
      showError(e.message);
    }
  });
}
