import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PushToast from './PushToast.jsx';

describe('PushToast', () => {
  it('renders nothing when toast is null', () => {
    const { container } = render(
      <PushToast toast={null} onDismiss={() => {}} onArticleOpen={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows title, body, and an in-app Read button when articleId is present', () => {
    const onArticleOpen = vi.fn();
    render(
      <PushToast
        toast={{
          title: 'BBC',
          body: 'Breaking headline',
          articleId: 'abc123',
          url: 'https://example.com',
        }}
        onDismiss={() => {}}
        onArticleOpen={onArticleOpen}
      />,
    );
    expect(screen.getByText('BBC')).toBeInTheDocument();
    expect(screen.getByText('Breaking headline')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /read/i });
    fireEvent.click(button);
    expect(onArticleOpen).toHaveBeenCalledWith('abc123');
  });

  it('falls back to external link when no articleId', () => {
    render(
      <PushToast
        toast={{
          title: 'BBC',
          body: 'Breaking headline',
          articleId: null,
          url: 'https://example.com',
        }}
        onDismiss={() => {}}
        onArticleOpen={() => {}}
      />,
    );
    const link = screen.getByRole('link', { name: /read/i });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('calls onDismiss when close is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <PushToast
        toast={{ title: 'X', body: 'Y', articleId: null, url: null }}
        onDismiss={onDismiss}
        onArticleOpen={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
