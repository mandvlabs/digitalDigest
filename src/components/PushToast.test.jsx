import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PushToast from './PushToast.jsx';

describe('PushToast', () => {
  it('renders nothing when toast is null', () => {
    const { container } = render(<PushToast toast={null} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows title, body, link and dismiss button', () => {
    render(
      <PushToast
        toast={{ title: 'BBC', body: 'Breaking headline', url: 'https://example.com' }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('BBC')).toBeInTheDocument();
    expect(screen.getByText('Breaking headline')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /read/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('calls onDismiss when close is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <PushToast
        toast={{ title: 'X', body: 'Y', url: null }}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
