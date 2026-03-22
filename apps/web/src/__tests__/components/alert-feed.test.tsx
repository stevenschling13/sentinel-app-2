import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlertFeed } from '@/components/dashboard/alert-feed';

function makeAlert(
  overrides: Partial<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    triggered_at: string;
  }> = {},
) {
  return {
    id: overrides.id ?? '1',
    severity: overrides.severity ?? 'info',
    title: overrides.title ?? 'Test Alert',
    message: overrides.message ?? 'Test message',
    triggered_at: overrides.triggered_at ?? new Date().toISOString(),
  };
}

describe('AlertFeed', () => {
  it('renders "No alerts" message when empty', () => {
    render(<AlertFeed alerts={[]} />);
    expect(screen.getByText('No alerts. System operating normally.')).toBeInTheDocument();
  });

  it('renders alert items with correct severity styling', () => {
    const alerts = [
      makeAlert({ id: '1', severity: 'info', title: 'Info alert' }),
      makeAlert({ id: '2', severity: 'warning', title: 'Warning alert' }),
      makeAlert({ id: '3', severity: 'critical', title: 'Critical alert' }),
    ];
    render(<AlertFeed alerts={alerts} />);

    expect(screen.getByText('Info alert')).toBeInTheDocument();
    expect(screen.getByText('Warning alert')).toBeInTheDocument();
    expect(screen.getByText('Critical alert')).toBeInTheDocument();

    // Check severity background colors on the container divs
    const infoItem = screen.getByText('Info alert').closest('[class*="bg-blue"]');
    expect(infoItem).toBeTruthy();

    const warningItem = screen.getByText('Warning alert').closest('[class*="bg-yellow"]');
    expect(warningItem).toBeTruthy();

    const criticalItem = screen.getByText('Critical alert').closest('[class*="bg-red"]');
    expect(criticalItem).toBeTruthy();
  });

  it('limits display to 10 alerts', () => {
    const alerts = Array.from({ length: 15 }, (_, i) =>
      makeAlert({ id: String(i), title: `Alert ${i}` }),
    );
    render(<AlertFeed alerts={alerts} />);

    // First 10 should be visible, the rest should not
    for (let i = 0; i < 10; i++) {
      expect(screen.getByText(`Alert ${i}`)).toBeInTheDocument();
    }
    for (let i = 10; i < 15; i++) {
      expect(screen.queryByText(`Alert ${i}`)).not.toBeInTheDocument();
    }
  });
});
