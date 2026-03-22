import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '@/components/ui/offline-banner';

describe('OfflineBanner', () => {
  it('renders service name', () => {
    render(<OfflineBanner service="engine" />);
    expect(screen.getByText('engine')).toBeInTheDocument();
  });

  it('displays offline warning message', () => {
    render(<OfflineBanner service="agents" />);
    expect(screen.getByText(/is offline/)).toBeInTheDocument();
  });
});
