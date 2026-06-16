export type Route = 'dashboard' | 'free-play' | 'one-minute' | 'matrix' | 'settings';

type RouteListener = (route: Route) => void;

class Router {
  private currentRoute: Route = 'dashboard';
  private listeners: RouteListener[] = [];

  constructor() {
    window.addEventListener('hashchange', () => this.handleHashChange());
    // Trigger initial route
    setTimeout(() => this.handleHashChange(), 0);
  }

  private handleHashChange() {
    const hash = window.location.hash.slice(1) as Route;
    if (hash && this.isValidRoute(hash)) {
      this.currentRoute = hash;
    } else {
      this.currentRoute = 'dashboard';
      window.location.hash = 'dashboard';
    }
    this.notify();
  }

  private isValidRoute(route: string): route is Route {
    return ['dashboard', 'free-play', 'one-minute', 'matrix', 'settings'].includes(route);
  }

  public navigate(route: Route) {
    window.location.hash = route;
  }

  public getCurrentRoute(): Route {
    return this.currentRoute;
  }

  public subscribe(listener: RouteListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentRoute));
  }
}

export const router = new Router();
