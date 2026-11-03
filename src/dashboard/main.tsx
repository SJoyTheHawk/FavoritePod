import { createRoot } from 'react-dom/client';
import { bindActionIconToColorScheme } from '../core/extension-icon';
import { DashboardApp } from './DashboardApp';
import '../styles/themes.css';
import '../styles/global.css';

bindActionIconToColorScheme();
createRoot(document.getElementById('root')!).render(<DashboardApp />);
