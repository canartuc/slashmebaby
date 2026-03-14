import React from 'react';

export const LabelBadge: React.FC<{ label: string; dimmed?: boolean }> = ({
  label,
  dimmed,
}) => (
  <span
    className={`smb-label-badge${dimmed ? ' smb-label-badge--dimmed' : ''}`}
  >
    {label}
  </span>
);
