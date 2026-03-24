import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies base classes', () => {
    const { container } = render(<Card>Test</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('rounded-lg');
    expect(card.className).toContain('border');
    expect(card.className).toContain('bg-card');
    expect(card.className).toContain('shadow-sm');
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="my-card">Test</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('my-card');
    expect(card.className).toContain('rounded-lg');
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('applies base classes', () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex');
    expect(el.className).toContain('p-6');
  });

  it('merges custom className', () => {
    const { container } = render(<CardHeader className="custom-header">H</CardHeader>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('custom-header');
  });
});

describe('CardTitle', () => {
  it('renders as h3 element', () => {
    render(<CardTitle>My Title</CardTitle>);
    const heading = screen.getByText('My Title');
    expect(heading.tagName).toBe('H3');
  });

  it('applies base classes', () => {
    render(<CardTitle>Title</CardTitle>);
    const el = screen.getByText('Title');
    expect(el.className).toContain('text-lg');
    expect(el.className).toContain('font-semibold');
  });

  it('merges custom className', () => {
    render(<CardTitle className="custom-title">Title</CardTitle>);
    const el = screen.getByText('Title');
    expect(el.className).toContain('custom-title');
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Content here</CardContent>);
    expect(screen.getByText('Content here')).toBeInTheDocument();
  });

  it('applies base classes', () => {
    const { container } = render(<CardContent>Content</CardContent>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('p-6');
    expect(el.className).toContain('pt-0');
  });

  it('merges custom className', () => {
    const { container } = render(<CardContent className="extra">C</CardContent>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('extra');
  });
});

describe('Card composition', () => {
  it('renders all sub-components together', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Composed Title</CardTitle>
        </CardHeader>
        <CardContent>Composed Content</CardContent>
      </Card>,
    );

    expect(screen.getByText('Composed Title')).toBeInTheDocument();
    expect(screen.getByText('Composed Content')).toBeInTheDocument();
    expect(screen.getByText('Composed Title').tagName).toBe('H3');
  });
});
