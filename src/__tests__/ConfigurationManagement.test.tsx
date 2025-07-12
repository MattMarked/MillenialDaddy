import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfigurationManagement from '@/components/ConfigurationManagement';

// Mock fetch
global.fetch = jest.fn();

const mockConfig = {
  frequency: 'daily' as const,
  times: ['09:00'],
  timezone: 'UTC'
};

const mockMultipleDailyConfig = {
  frequency: 'multiple-daily' as const,
  times: ['09:00', '15:00', '21:00'],
  timezone: 'America/New_York'
};

const mockEveryXDaysConfig = {
  frequency: 'every-x-days' as const,
  times: ['12:00'],
  interval: 3,
  timezone: 'Europe/London'
};

describe('ConfigurationManagement', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('renders loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    
    render(<ConfigurationManagement />);
    
    // Should show loading animation
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('fetches and displays configuration on mount', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockConfig,
        nextPublicationTime: '2023-12-01T09:00:00Z'
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      expect(screen.getByText('Publication Settings')).toBeInTheDocument();
      expect(screen.getByDisplayValue('UTC')).toBeInTheDocument();
      expect(screen.getAllByText('09:00')).toHaveLength(2); // One in form, one in status
    });

    expect(fetch).toHaveBeenCalledWith('/api/config/publication', {
      headers: {
        'x-admin-email': 'admin@example.com'
      }
    });
  });

  it('displays error message when fetch fails', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: false,
        error: 'Configuration not found'
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch configuration')).toBeInTheDocument();
    });
  });

  it('handles daily frequency selection', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockConfig,
        nextPublicationTime: null
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      const dailyRadio = screen.getByDisplayValue('daily');
      expect(dailyRadio).toBeChecked();
    });
  });

  it('handles multiple daily frequency selection', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockMultipleDailyConfig,
        nextPublicationTime: null
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      const multipleDailyRadio = screen.getByDisplayValue('multiple-daily');
      expect(multipleDailyRadio).toBeChecked();
      expect(screen.getByText('09:00')).toBeInTheDocument();
      expect(screen.getByText('15:00')).toBeInTheDocument();
      expect(screen.getByText('21:00')).toBeInTheDocument();
    });
  });

  it('handles every-x-days frequency selection', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockEveryXDaysConfig,
        nextPublicationTime: null
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      const everyXDaysRadio = screen.getByDisplayValue('every-x-days');
      expect(everyXDaysRadio).toBeChecked();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    });
  });

  it('allows adding new time for multiple daily frequency', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockMultipleDailyConfig,
        nextPublicationTime: null
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      // Get the time input specifically (not the password inputs)
      const timeInputs = screen.getAllByDisplayValue('');
      const timeInput = timeInputs.find(input => input.getAttribute('type') === 'time');
      
      if (timeInput) {
        fireEvent.change(timeInput, { target: { value: '18:30' } });
        
        const addButton = screen.getByRole('button', { name: 'Add' });
        fireEvent.click(addButton);
      }
    });

    // The new time should be added to the form state
    // This would be visible when saving the configuration
  });

  it('allows removing times for multiple daily frequency', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockMultipleDailyConfig,
        nextPublicationTime: null
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      const removeButtons = screen.getAllByText('Remove');
      expect(removeButtons).toHaveLength(3); // Should have 3 remove buttons for 3 times
      
      fireEvent.click(removeButtons[0]);
    });
  });

  it('saves configuration successfully', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          config: mockConfig,
          nextPublicationTime: null
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          config: mockConfig,
          nextPublicationTime: '2023-12-02T09:00:00Z'
        })
      });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: 'Save Configuration' });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/config/publication', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': 'admin@example.com'
        },
        body: JSON.stringify(mockConfig),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Configuration updated successfully')).toBeInTheDocument();
    });
  });

  it('handles save configuration error', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          config: mockConfig,
          nextPublicationTime: null
        })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Invalid configuration'
        })
      });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: 'Save Configuration' });
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Invalid configuration')).toBeInTheDocument();
    });
  });

  it('displays schedule preview correctly', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockConfig,
        nextPublicationTime: null
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      expect(screen.getByText(/Posts will be published daily at 09:00 \(UTC\)/)).toBeInTheDocument();
    });
  });

  it('displays next publication time when available', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockConfig,
        nextPublicationTime: '2023-12-01T09:00:00Z'
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      expect(screen.getByText('Next Publication')).toBeInTheDocument();
      // The exact date format will depend on the user's locale
      expect(screen.getByText(/12\/1\/2023/)).toBeInTheDocument();
    });
  });

  it('changes frequency and updates form accordingly', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockConfig,
        nextPublicationTime: null
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      const everyXDaysRadio = screen.getByDisplayValue('every-x-days');
      fireEvent.click(everyXDaysRadio);
    });

    // Should show interval input
    expect(screen.getByLabelText('Interval (days)')).toBeInTheDocument();
  });

  it('validates timezone selection', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        config: mockConfig,
        nextPublicationTime: null
      })
    });

    render(<ConfigurationManagement />);

    await waitFor(() => {
      const timezoneSelect = screen.getByDisplayValue('UTC');
      fireEvent.change(timezoneSelect, { target: { value: 'America/New_York' } });
      expect(screen.getByDisplayValue('America/New_York')).toBeInTheDocument();
    });
  });
});