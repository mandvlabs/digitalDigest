import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabBar from './TabBar.jsx';

describe('TabBar', () => {
  it('renders all five tab labels', () => {
    render(<TabBar active="home" onChange={() => {}} />);
    for (const label of ['Home', 'Bulgaria', 'World', 'Sports', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the active tab with aria-current', () => {
    render(<TabBar active="world" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'World' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('calls onChange with the tab key when clicked', () => {
    const onChange = vi.fn();
    render(<TabBar active="home" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bulgaria' }));
    expect(onChange).toHaveBeenCalledWith('bulgaria');
  });
});
