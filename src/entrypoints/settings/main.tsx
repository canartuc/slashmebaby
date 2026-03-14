import React from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from '../../components/Settings/SettingsPage';
import '../../styles/settings.css';

const root = createRoot(document.getElementById('root')!);
root.render(<SettingsPage />);
