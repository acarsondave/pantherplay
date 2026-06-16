import './styles/global.css';
import { router, Route } from './lib/router';
import { renderDashboard } from './views/dashboard';
import { renderFreePlay } from './views/free-play';
import { renderOneMinute } from './views/one-minute';
import { renderMatrix } from './views/matrix';

const app = document.querySelector<HTMLDivElement>('#app')!;

function render(route: Route) {
  // Clear container
  app.innerHTML = '';
  
  switch (route) {
    case 'dashboard':
      renderDashboard(app);
      break;
    case 'free-play':
      renderFreePlay(app);
      break;
    case 'one-minute':
      renderOneMinute(app);
      break;
    case 'matrix':
      renderMatrix(app);
      break;
    case 'settings':
      import('./views/settings').then(m => m.renderSettings(app));
      break;
  }
}

router.subscribe(render);
