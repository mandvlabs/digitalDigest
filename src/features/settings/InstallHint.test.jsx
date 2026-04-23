import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../utils/standalone.js', () => ({
  isStandalone: vi.fn(),
  isIos: vi.fn(),
}));

import { isStandalone, isIos } from '../../utils/standalone.js';
import InstallHint from './InstallHint.jsx';

describe('InstallHint', () => {
  it('renders nothing when app is already standalone', () => {
    isStandalone.mockReturnValue(true);
    isIos.mockReturnValue(true);
    const { container } = render(<InstallHint />);
    expect(container.firstChild).toBeNull();
  });

  it('renders iOS-specific copy on iOS Safari tab', () => {
    isStandalone.mockReturnValue(false);
    isIos.mockReturnValue(true);
    render(<InstallHint />);
    expect(screen.getByText(/home screen/i)).toBeInTheDocument();
    expect(screen.getByText(/share/i)).toBeInTheDocument();
  });

  it('renders generic hint on non-iOS browsers', () => {
    isStandalone.mockReturnValue(false);
    isIos.mockReturnValue(false);
    render(<InstallHint />);
    expect(screen.getByText(/install/i)).toBeInTheDocument();
  });
});
