// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupHeader } from '../../components/CommandBar/GroupHeader';

describe('GroupHeader', () => {
  it('renders "Open Tabs" for tabs category', () => {
    render(<GroupHeader category="tabs" />);
    expect(screen.getByText('Open Tabs')).toBeTruthy();
  });

  it('renders "Bookmarks" for bookmarks category', () => {
    render(<GroupHeader category="bookmarks" />);
    expect(screen.getByText('Bookmarks')).toBeTruthy();
  });

  it('renders "History" for history category', () => {
    render(<GroupHeader category="history" />);
    expect(screen.getByText('History')).toBeTruthy();
  });

  it('renders "Actions" for actions category', () => {
    render(<GroupHeader category="actions" />);
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('has the correct CSS class', () => {
    const { container } = render(<GroupHeader category="tabs" />);
    const header = container.querySelector('.smb-group-header');
    expect(header).toBeTruthy();
  });

  it('has role="presentation" for accessibility', () => {
    render(<GroupHeader category="tabs" />);
    const header = screen.getByText('Open Tabs');
    expect(header.getAttribute('role')).toBe('presentation');
  });
});
