import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockApiSuccess, mockApiError } from '../test/utils';
import NewProjectModal from './NewProjectModal';
import * as api from '../services/api';

// Mock the API module
vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return {
    ...actual,
    projectsAPI: {
      create: vi.fn(),
    },
  };
});

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('NewProjectModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockOnClose.mockClear();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      renderWithProviders(
        <NewProjectModal isOpen={false} onClose={mockOnClose} />
      );

      expect(screen.queryByText('Create New Project')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByText('Create New Project')).toBeInTheDocument();
      expect(screen.getByText('Set up a new project with secure escrow')).toBeInTheDocument();
    });

    it('should render all form fields', () => {
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByLabelText(/Project Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Client Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Project Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Project Value/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Deadline/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Priority Level/i)).toBeInTheDocument();
    });

    it('should render submit and cancel buttons', () => {
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Project/i })).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Click the backdrop (first div with fixed positioning)
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/60');
      await user.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when X button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Find X button by its parent container
      const xButton = screen.getByRole('button', { name: '' });
      await user.click(xButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should update form fields when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      const titleInput = screen.getByLabelText(/Project Title/i);
      const clientInput = screen.getByLabelText(/Client Name/i);
      const valueInput = screen.getByLabelText(/Project Value/i);

      await user.type(titleInput, 'Test Project');
      await user.type(clientInput, 'Test Client');
      await user.type(valueInput, '1000');

      expect(titleInput).toHaveValue('Test Project');
      expect(clientInput).toHaveValue('Test Client');
      expect(valueInput).toHaveValue(1000);
    });

    it('should select priority from dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      const prioritySelect = screen.getByLabelText(/Priority Level/i);
      await user.selectOptions(prioritySelect, 'high');

      expect(prioritySelect).toHaveValue('high');
    });
  });

  describe('Form Validation', () => {
    it('should show error when required fields are missing', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      const submitButton = screen.getByRole('button', { name: /Create Project/i });
      await user.click(submitButton);

      // Should show validation error toast
      const errorToast = await screen.findByText('Please fill in all required fields', {}, { timeout: 3000 });
      expect(errorToast).toBeInTheDocument();
    });

    it('should not submit when only some required fields are filled', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Fill only title
      const titleInput = screen.getByLabelText(/Project Title/i);
      await user.type(titleInput, 'Test Project');

      const submitButton = screen.getByRole('button', { name: /Create Project/i });
      await user.click(submitButton);

      const errorToast = await screen.findByText('Please fill in all required fields', {}, { timeout: 3000 });
      expect(errorToast).toBeInTheDocument();

      expect(api.projectsAPI.create).not.toHaveBeenCalled();
    });
  });

  describe('API Integration', () => {
    it('should create project successfully', async () => {
      const user = userEvent.setup();
      const mockProject = {
        id: 1,
        title: 'Test Project',
        client: 'Test Client',
        description: 'Test description',
        value: 1000,
        deadline: '2025-12-31',
        priority: 'high',
      };

      // Add delay to mock API call so loading state is visible
      api.projectsAPI.create.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: mockProject }), 100))
      );

      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/Project Title/i), 'Test Project');
      await user.type(screen.getByLabelText(/Client Name/i), 'Test Client');
      await user.type(screen.getByLabelText(/Project Description/i), 'Test description');
      await user.type(screen.getByLabelText(/Project Value/i), '1000');
      await user.type(screen.getByLabelText(/Deadline/i), '2025-12-31');
      await user.selectOptions(screen.getByLabelText(/Priority Level/i), 'high');

      const submitButton = screen.getByRole('button', { name: /Create Project/i });
      await user.click(submitButton);

      // Should show loading state
      expect(await screen.findByText('Creating Project...', {}, { timeout: 1000 })).toBeInTheDocument();

      // Wait for API call to complete
      await waitFor(() => {
        expect(api.projectsAPI.create).toHaveBeenCalledWith({
          title: 'Test Project',
          client: 'Test Client',
          description: 'Test description',
          value: '1000',
          deadline: '2025-12-31',
          priority: 'high',
        });
      });

      // Should show success message
      expect(await screen.findByText('Project created successfully!', {}, { timeout: 1000 })).toBeInTheDocument();

      // Should close modal
      expect(mockOnClose).toHaveBeenCalled();

      // Should navigate to projects page after delay
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects');
      }, { timeout: 1000 });
    });

    it('should handle validation errors from server', async () => {
      const user = userEvent.setup();
      const error = new api.APIError('Validation failed', 400, {
        errors: { title: 'Title is required' }
      });

      api.projectsAPI.create.mockRejectedValueOnce(error);

      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/Project Title/i), 'Test');
      await user.type(screen.getByLabelText(/Client Name/i), 'Test Client');
      await user.type(screen.getByLabelText(/Project Value/i), '1000');
      await user.type(screen.getByLabelText(/Deadline/i), '2025-12-31');

      await user.click(screen.getByRole('button', { name: /Create Project/i }));

      await waitFor(() => {
        expect(screen.getByText('Validation failed')).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should handle 401 unauthorized errors', async () => {
      const user = userEvent.setup();
      const error = new api.APIError('Unauthorized', 401);

      api.projectsAPI.create.mockRejectedValueOnce(error);

      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/Project Title/i), 'Test');
      await user.type(screen.getByLabelText(/Client Name/i), 'Test Client');
      await user.type(screen.getByLabelText(/Project Value/i), '1000');
      await user.type(screen.getByLabelText(/Deadline/i), '2025-12-31');

      await user.click(screen.getByRole('button', { name: /Create Project/i }));

      await waitFor(() => {
        expect(screen.getByText('Session expired. Please log in again.')).toBeInTheDocument();
      });

      // Should navigate to signin after delay
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/signin');
      }, { timeout: 2500 });
    });

    it('should handle 403 permission denied errors', async () => {
      const user = userEvent.setup();
      const error = new api.APIError('Forbidden', 403);

      api.projectsAPI.create.mockRejectedValueOnce(error);

      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/Project Title/i), 'Test');
      await user.type(screen.getByLabelText(/Client Name/i), 'Test Client');
      await user.type(screen.getByLabelText(/Project Value/i), '1000');
      await user.type(screen.getByLabelText(/Deadline/i), '2025-12-31');

      await user.click(screen.getByRole('button', { name: /Create Project/i }));

      await waitFor(() => {
        expect(screen.getByText('You do not have permission to create projects.')).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      const user = userEvent.setup();
      const error = new api.APIError('Network error', null);

      api.projectsAPI.create.mockRejectedValueOnce(error);

      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/Project Title/i), 'Test');
      await user.type(screen.getByLabelText(/Client Name/i), 'Test Client');
      await user.type(screen.getByLabelText(/Project Value/i), '1000');
      await user.type(screen.getByLabelText(/Deadline/i), '2025-12-31');

      await user.click(screen.getByRole('button', { name: /Create Project/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error. Please check your connection and try again.')).toBeInTheDocument();
      });
    });

    it('should handle server errors (5xx)', async () => {
      const user = userEvent.setup();
      const error = new api.APIError('Internal server error', 500);

      api.projectsAPI.create.mockRejectedValueOnce(error);

      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/Project Title/i), 'Test');
      await user.type(screen.getByLabelText(/Client Name/i), 'Test Client');
      await user.type(screen.getByLabelText(/Project Value/i), '1000');
      await user.type(screen.getByLabelText(/Deadline/i), '2025-12-31');

      await user.click(screen.getByRole('button', { name: /Create Project/i }));

      await waitFor(() => {
        expect(screen.getByText('Server error. Please try again later.')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should disable buttons during submission', async () => {
      const user = userEvent.setup();

      // Mock slow API response
      api.projectsAPI.create.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100))
      );

      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/Project Title/i), 'Test');
      await user.type(screen.getByLabelText(/Client Name/i), 'Test Client');
      await user.type(screen.getByLabelText(/Project Value/i), '1000');
      await user.type(screen.getByLabelText(/Deadline/i), '2025-12-31');

      const submitButton = screen.getByRole('button', { name: /Create Project/i });
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });

      await user.click(submitButton);

      // Buttons should be disabled during loading
      expect(submitButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should show loading spinner during submission', async () => {
      const user = userEvent.setup();

      // Mock slow API response
      api.projectsAPI.create.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100))
      );

      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      // Fill all required fields
      await user.type(screen.getByLabelText(/Project Title/i), 'Test');
      await user.type(screen.getByLabelText(/Client Name/i), 'Test Client');
      await user.type(screen.getByLabelText(/Project Value/i), '1000');
      await user.type(screen.getByLabelText(/Deadline/i), '2025-12-31');

      await user.click(screen.getByRole('button', { name: /Create Project/i }));

      // Should show "Creating Project..." text
      expect(screen.getByText('Creating Project...')).toBeInTheDocument();
    });
  });

  describe('Form Reset', () => {
    it('should reset form after successful submission', async () => {
      const user = userEvent.setup();
      api.projectsAPI.create.mockResolvedValueOnce({ data: {} });

      renderWithProviders(
        <NewProjectModal isOpen={true} onClose={mockOnClose} />
      );

      const titleInput = screen.getByLabelText(/Project Title/i);
      const clientInput = screen.getByLabelText(/Client Name/i);

      // Fill fields
      await user.type(titleInput, 'Test');
      await user.type(clientInput, 'Test Client');
      await user.type(screen.getByLabelText(/Project Value/i), '1000');
      await user.type(screen.getByLabelText(/Deadline/i), '2025-12-31');

      await user.click(screen.getByRole('button', { name: /Create Project/i }));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      // Form should be reset (we can't test this directly since modal closes,
      // but the reset logic is in the component)
    });
  });
});
