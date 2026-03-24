import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('applies default variant classes', () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText('Default');
    expect(el.className).toContain('bg-primary');
  });

  it('applies secondary variant classes', () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    const el = screen.getByText('Secondary');
    expect(el.className).toContain('bg-secondary');
  });

  it('applies destructive variant classes', () => {
    render(<Badge variant="destructive">Error</Badge>);
    const el = screen.getByText('Error');
    expect(el.className).toContain('bg-destructive');
  });

  it('applies outline variant classes', () => {
    render(<Badge variant="outline">Outline</Badge>);
    const el = screen.getByText('Outline');
    expect(el.className).toContain('text-foreground');
  });

  it('applies profit variant classes', () => {
    render(<Badge variant="profit">+5%</Badge>);
    const el = screen.getByText('+5%');
    expect(el.className).toContain('text-emerald-400');
    expect(el.className).toContain('bg-emerald-500/15');
  });

  it('applies loss variant classes', () => {
    render(<Badge variant="loss">-3%</Badge>);
    const el = screen.getByText('-3%');
    expect(el.className).toContain('text-red-400');
    expect(el.className).toContain('bg-red-500/15');
  });

  it('merges custom className', () => {
    render(<Badge className="extra-class">Custom</Badge>);
    const el = screen.getByText('Custom');
    expect(el.className).toContain('extra-class');
    expect(el.className).toContain('rounded-full');
  });
});
