import React from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import '../../styles/popup.css';

const container = document.getElementById('root');
if (!container) throw new Error('popup mount point #root missing');
createRoot(container).render(<Popup />);
