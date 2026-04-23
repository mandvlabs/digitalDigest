import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArticleCard from './ArticleCard.jsx';

const ARTICLE = {
  id: 'a1',
  headline: 'Big news today',
  excerpt: 'A short preview of the article body text.',
  source: 'Dnevnik',
  url: 'https://example.com/news/big-news',
  imageUrl: 'https://example.com/img.jpg',
  publishedAt: { toDate: () => new Date(Date.now() - 5 * 60 * 1000) },
};

describe('ArticleCard', () => {
  it('renders headline, source, excerpt', () => {
    render(<ArticleCard article={ARTICLE} />);
    expect(screen.getByText('Big news today')).toBeDefined();
    expect(screen.getByText('Dnevnik')).toBeDefined();
    expect(screen.getByText(/short preview/i)).toBeDefined();
  });

  it('renders a link pointing to the article URL with target=_blank rel=noopener', () => {
    render(<ArticleCard article={ARTICLE} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://example.com/news/big-news');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders image when imageUrl is present', () => {
    render(<ArticleCard article={ARTICLE} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('https://example.com/img.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('omits image when imageUrl is null', () => {
    const a = { ...ARTICLE, imageUrl: null };
    render(<ArticleCard article={a} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders relative time', () => {
    render(<ArticleCard article={ARTICLE} />);
    expect(screen.getByText(/ago|just now/i)).toBeDefined();
  });
});
