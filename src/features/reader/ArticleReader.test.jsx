import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (..._args) => ({ __doc: _args.slice(1).join('/') }),
  getDoc: (...args) => mockGetDoc(...args),
}));

vi.mock('../../services/firebase.js', () => ({
  db: {},
}));

const { default: ArticleReader } = await import('./ArticleReader.jsx');

beforeEach(() => {
  vi.clearAllMocks();
});

function mkSnap({ exists, data }) {
  return {
    exists: () => exists,
    id: 'doc-abc',
    data: () => data,
  };
}

describe('ArticleReader', () => {
  it('shows spinner while loading', () => {
    mockGetDoc.mockReturnValue(new Promise(() => {}));
    render(<ArticleReader articleId="doc-abc" onBack={() => {}} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders headline, source, excerpt and Open article link after fetch', async () => {
    mockGetDoc.mockResolvedValue(
      mkSnap({
        exists: true,
        data: {
          headline: 'Big news',
          excerpt: 'A short preview.',
          source: 'Dnevnik',
          url: 'https://example.com/a',
          imageUrl: 'https://example.com/img.jpg',
          publishedAt: { toDate: () => new Date(Date.now() - 60_000) },
        },
      }),
    );
    render(<ArticleReader articleId="doc-abc" onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Big news')).toBeInTheDocument();
    });
    expect(screen.getByText('A short preview.')).toBeInTheDocument();
    expect(screen.getByText(/Dnevnik/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /open article/i });
    expect(link.getAttribute('href')).toBe('https://example.com/a');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('shows "Article not found" when doc does not exist', async () => {
    mockGetDoc.mockResolvedValue(mkSnap({ exists: false }));
    const onBack = vi.fn();
    render(<ArticleReader articleId="missing" onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByText(/article not found/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('hides broken image via onError', async () => {
    mockGetDoc.mockResolvedValue(
      mkSnap({
        exists: true,
        data: {
          headline: 'H',
          source: 'S',
          url: 'https://example.com/a',
          imageUrl: 'https://example.com/bad.jpg',
          publishedAt: null,
        },
      }),
    );
    render(<ArticleReader articleId="doc-abc" onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('Back button calls onBack', async () => {
    mockGetDoc.mockResolvedValue(
      mkSnap({
        exists: true,
        data: {
          headline: 'H',
          source: 'S',
          url: 'https://example.com/a',
          imageUrl: null,
          publishedAt: null,
        },
      }),
    );
    const onBack = vi.fn();
    render(<ArticleReader articleId="doc-abc" onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByText('H')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
