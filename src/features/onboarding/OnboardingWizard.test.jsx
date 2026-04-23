import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../hooks/usePrefs.js', () => ({
  usePrefs: vi.fn(),
}));

vi.mock('../../hooks/useAuth.js', () => ({
  useAuth: vi.fn(() => ({ user: { uid: 'test-uid' }, loading: false })),
}));

vi.mock('../../services/messaging.js', () => ({
  subscribeToken: vi.fn().mockResolvedValue(null),
  onForegroundMessage: vi.fn().mockResolvedValue(() => {}),
}));

const updateMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderWizard(onFinish = vi.fn()) {
  const { usePrefs } = await import('../../hooks/usePrefs.js');
  usePrefs.mockReturnValue({ prefs: {}, loading: false, update: updateMock });
  const OnboardingWizard = (await import('./OnboardingWizard.jsx')).default;
  render(<OnboardingWizard onFinish={onFinish} />);
}

describe('OnboardingWizard', () => {
  it('starts on the Welcome step', async () => {
    await renderWizard();
    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });

  it('advances through all five steps in order', async () => {
    await renderWizard();
    // Welcome → Bulgaria
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/which bulgarian outlets/i)).toBeInTheDocument();
    // Bulgaria — pick one outlet then Next
    fireEvent.click(screen.getByLabelText('Dnevnik'));
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    // World — pick ≥1 topic and ≥1 region
    expect(screen.getByText(/topics/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Politics'));
    fireEvent.click(screen.getByLabelText('United States'));
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }));
    // Sports — skippable (use heading selector to avoid matching paragraph text)
    expect(screen.getByRole('heading', { level: 1, name: /^sports$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));
    // Notifications — skippable
    expect(screen.getByRole('heading', { level: 1, name: /^notifications$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));
    // Should have called update with onboardingComplete: true
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ onboardingComplete: true })
    );
  });
});
