export interface AppState {
  user: { uid: string; email: string } | null;
  theme: 'mocha' | 'light' | 'dark' | 'oled';
  fontFamily: 'geist' | 'satoshi' | 'inter';
  micDeviceId: string | null;
}

const defaultState: AppState = {
  user: null,
  theme: 'mocha',
  fontFamily: 'geist',
  micDeviceId: null,
};

function loadState(): AppState {
  try {
    const stored = localStorage.getItem('pantherplay_state');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultState, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load state from local storage', e);
  }
  return defaultState;
}

type StateListener = (state: AppState) => void;

class Store {
  private state: AppState = loadState();
  private listeners: StateListener[] = [];

  public getState(): AppState {
    return this.state;
  }

  public update(partialState: Partial<AppState>) {
    this.state = { ...this.state, ...partialState };
    this.saveState();
    this.notify();
  }

  private saveState() {
    try {
      // Don't persist user session in this generic state blob, Firebase handles auth state.
      const { user, ...persistable } = this.state;
      localStorage.setItem('pantherplay_state', JSON.stringify(persistable));
    } catch (e) {
      console.warn('Failed to save state', e);
    }
  }

  public subscribe(listener: StateListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }
}

export const store = new Store();
