import React, { useState } from 'react';
import { X, Loader2, FolderPlus } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { projectsAPI, APIError } from '../services/api';

const NewProjectModal = ({ isOpen, onClose }) => {
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    client: '',
    description: '',
    value: '',
    deadline: '',
    priority: 'medium',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.title || !formData.client || !formData.value || !formData.deadline) {
        showError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      // Call API to create project
      const project = await projectsAPI.create(formData);

      showSuccess('Project created successfully!');

      // Reset form
      setFormData({
        title: '',
        client: '',
        description: '',
        value: '',
        deadline: '',
        priority: 'medium',
      });

      // Close modal
      onClose();

      // Navigate to the projects page after a brief delay
      setTimeout(() => {
        navigate('/projects');
      }, 300);

    } catch (error) {
      console.error('Create project error:', error);

      // Handle specific error types
      if (error instanceof APIError) {
        if (error.status === 401) {
          showError('Session expired. Please log in again.');
          setTimeout(() => navigate('/signin'), 2000);
        } else if (error.status === 403) {
          showError('You do not have permission to create projects.');
        } else if (error.isNetworkError) {
          showError('Network error. Please check your connection and try again.');
        } else if (error.isServerError) {
          showError('Server error. Please try again later.');
        } else {
          showError(error.message || 'Failed to create project. Please try again.');
        }
      } else {
        showError('Failed to create project. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto animate-slideInBottom"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-full flex items-center justify-center">
                <FolderPlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 id="modal-title" className="text-2xl font-bold text-white">Create New Project</h2>
                <p className="text-sm text-gray-400">Set up a new project with secure escrow</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition duration-200"
              disabled={loading}
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Project Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                Project Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., E-commerce Dashboard Redesign"
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
              />
            </div>

            {/* Client Name */}
            <div>
              <label htmlFor="client" className="block text-sm font-medium text-gray-300 mb-2">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="client"
                name="client"
                value={formData.client}
                onChange={handleChange}
                placeholder="e.g., TechCorp Inc."
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                Project Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the project scope, deliverables, and requirements..."
                rows="4"
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200 resize-none"
              />
            </div>

            {/* Value and Deadline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Value */}
              <div>
                <label htmlFor="value" className="block text-sm font-medium text-gray-300 mb-2">
                  Project Value ($) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  id="value"
                  name="value"
                  value={formData.value}
                  onChange={handleChange}
                  placeholder="2500"
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                />
              </div>

              {/* Deadline */}
              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-300 mb-2">
                  Deadline <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  id="deadline"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
                />
              </div>
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-300 mb-2">
                Priority Level
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Info Banner */}
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4">
              <p className="text-sm text-indigo-300">
                💡 <strong>Secure Escrow:</strong> Once created, invite your client to deposit funds into Stripe escrow.
                Payments are released automatically upon milestone completion.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gray-700 text-gray-300 rounded-xl font-semibold hover:bg-gray-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-indigo-400 transition duration-200 shadow-lg shadow-indigo-500/30 disabled:from-indigo-400 disabled:to-indigo-400 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Project...
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-5 h-5" />
                    Create Project
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default NewProjectModal;
