import React from 'react';
import { createRoot } from 'react-dom/client';
import { OnboardingWizard } from '../../components/Onboarding/OnboardingWizard';
import '../../styles/onboarding.css';

const container = document.getElementById('root');
if (!container) throw new Error('onboarding mount point #root missing');
createRoot(container).render(<OnboardingWizard />);
