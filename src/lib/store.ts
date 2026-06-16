export interface AppState {
  user: { uid: string; email: string } | null;
  theme: 'mocha';
  micDeviceId: string | null;
}

const initialState: AppState = {
  user: null,
  theme: 'mocha',
  micDeviceId: null,
};

type StateListener = (state: AppState) => void;

class Store {
  private state: AppState = initialState;
  private listeners: StateListener[] = [];

  public getState(): AppState {
    return this.state;
  }

  public update(partialState: Partial<AppState>) {
    this.state = { ...this.state, ...partialState };
    this.notify();
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
