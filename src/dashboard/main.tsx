import { createRoot } from 'react-dom/client';
import { DashboardApp } from './DashboardApp';
import '../styles/themes.css';
import '../styles/global.css';

declare global {
  interface Window {
    favoritePodMemoryReport: () => Promise<unknown>;
  }
}

// Load the read-only diagnostic only when explicitly requested in DevTools.
window.favoritePodMemoryReport = async () =>
  (await import('./memory-diagnostics')).getMemoryReport();

createRoot(document.getElementById('root')!).render(<DashboardApp />);
