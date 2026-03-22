import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import GlobalError from '@/app/error';

// Suppress console.error from the useEffect in the component
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('GlobalError (error boundary)', () => {
  it('renders error message', () => {
    const error = new Error('Something broke');
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('An unexpected error occurred. This has been logged for investigation.'),
    ).toBeInTheDocument();
  });

  it('shows error digest when provided', () => {
    const error = Object.assign(new Error('fail'), { digest: 'abc-123' });
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    expect(screen.getByText('Error ID: abc-123')).toBeInTheDocument();
  });

  it('does not show error digest when not provided', () => {
    const error = new Error('fail');
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument();
  });

  it('calls reset on button click', async () => {
    const user = userEvent.setup();
    const error = new Error('fail');
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
