import { createRoot } from 'react-dom/client';
import { DashboardApp } from './DashboardApp';
import '../styles/themes.css';
import '../styles/global.css';

createRoot(document.getElementById('root')!).render(<DashboardApp />);
