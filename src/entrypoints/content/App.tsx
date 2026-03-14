import React from 'react';
import { CommandBar } from '../../components/CommandBar/CommandBar';

export interface AppProps {
  onDismiss: () => void;
}

export const App: React.FC<AppProps> = ({ onDismiss }) => {
  return <CommandBar onDismiss={onDismiss} />;
};
