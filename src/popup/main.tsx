import { createRoot } from 'react-dom/client';
import { PopupApp } from './PopupApp';
import '../styles/themes.css';
import '../styles/global.css';

createRoot(document.getElementById('root')!).render(<PopupApp />);
