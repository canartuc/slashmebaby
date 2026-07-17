import React, { useCallback } from 'react';
import { CommandBar } from '../../components/CommandBar/CommandBar';
import { getActiveTabUrl } from '../../lib/active-tab';
import { usePopupKeySource } from './usePopupKeySource';

/**
 * The toolbar-action popup: the palette's surface on restricted pages
 * (new tab, chrome://, Web Store) where the in-page overlay cannot exist.
 * Renders the same CommandBar as the overlay — popup framing, native
 * keyboard source, window.close() dismiss, and the active tab's URL for
 * copy-clean-link (the popup's own location is the extension page).
 */
export const Popup: React.FC = () => {
  const dismiss = useCallback(() => window.close(), []);
  usePopupKeySource(dismiss);
  return (
    <CommandBar variant="popup" onDismiss={dismiss} resolveCopyUrl={getActiveTabUrl} />
  );
};
