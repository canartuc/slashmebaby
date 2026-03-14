import React from 'react';
import { createRoot } from 'react-dom/client';
import { OnboardingWizard } from '../../components/Onboarding/OnboardingWizard';
import '../../styles/onboarding.css';

const root = createRoot(document.getElementById('root')!);
root.render(<OnboardingWizard />);
