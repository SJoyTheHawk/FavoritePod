import { createRoot } from 'react-dom/client';
import { bindActionIconToColorScheme } from '../core/extension-icon';
import { PopupApp } from './PopupApp';
import '../styles/themes.css';
import '../styles/global.css';

bindActionIconToColorScheme();
createRoot(document.getElementById('root')!).render(<PopupApp />);
