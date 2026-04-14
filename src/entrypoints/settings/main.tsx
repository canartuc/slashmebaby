import React from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from '../../components/Settings/SettingsPage';
import '../../styles/settings.css';

const container = document.getElementById('root');
if (!container) throw new Error('settings mount point #root missing');
createRoot(container).render(<SettingsPage />);
