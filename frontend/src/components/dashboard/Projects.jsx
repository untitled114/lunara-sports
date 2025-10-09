import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { projectsAPI } from '../../services/api';
import { Loader2 } from 'lucide-react';
import NewProjectModal from '../NewProjectModal';

const Projects = () => {
  const navigate = useNavigate();
  const { showSuccess, showInfo, showError } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const data = await projectsAPI.getAll();
        // Transform backend data to frontend format
        const transformedProjects = (data.results || data).map(project => ({
          id: project.id,
          title: project.title || project.name,
          client: project.client || project.client_name || 'Unknown Client',
          status: project.status || 'active',
          progress: project.progress || 0,
          value: project.value || project.budget || '$0',
          deadline: project.deadline || 'Not set',
          priority: project.priority || 'medium',
          description: project.description || '',
        }));
        setAllProjects(transformedProjects);
      } catch (error) {
        console.error('Failed to load projects:', error);

        // Only show mock data for eltrozo@lunara.com
        const userEmail = localStorage.getItem('user_email');
        if (userEmail === 'eltrozo@lunara.com') {
          showError('Failed to load projects. Using demo data.');
          // Use fallback data for test user
          setAllProjects([
            {
              id: 1,
              title: 'E-commerce Dashboard Redesign',
              client: 'TechCorp',
              status: 'active',
              progress: 75,
              value: '$2,500',
              deadline: '2 days',
              priority: 'high',
              description: 'Modern React dashboard with real-time analytics',
            },
            {
              id: 2,
              title: 'Mobile Banking App',
              client: 'FinanceFlow',
              status: 'active',
              progress: 45,
              value: '$4,200',
              deadline: '1 week',
              priority: 'medium',
              description: 'Flutter app with biometric authentication',
            },
          ]);
        } else {
          showError('Failed to load projects.');
          setAllProjects([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [showError]);

  // Handle project creation
  const handleCreateProject = async (projectData) => {
    try {
      const newProject = await projectsAPI.create(projectData);
      setAllProjects([...allProjects, {
        id: newProject.id,
        title: newProject.title || newProject.name,
        client: newProject.client || newProject.client_name || 'Unknown Client',
        status: newProject.status || 'active',
        progress: newProject.progress || 0,
        value: newProject.value || newProject.budget || '$0',
        deadline: newProject.deadline || 'Not set',
        priority: newProject.priority || 'medium',
        description: newProject.description || '',
      }]);
      showSuccess('Project created successfully!');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
      showError('Failed to create project. Please try again.');
    }
  };

  // Handle project update
  const handleUpdateProject = async (projectId, updates) => {
    try {
      const updatedProject = await projectsAPI.update(projectId, updates);
      setAllProjects(allProjects.map(p => p.id === projectId ? {
        ...p,
        ...updates,
        ...updatedProject,
      } : p));
      showSuccess('Project updated successfully!');
    } catch (error) {
      console.error('Failed to update project:', error);
      showError('Failed to update project. Please try again.');
    }
  };

  // Handle project deletion
  const handleDeleteProject = async (projectId) => {
    try {
      await projectsAPI.delete(projectId);
      setAllProjects(allProjects.filter(p => p.id !== projectId));
      showSuccess('Project deleted successfully!');
    } catch (error) {
      console.error('Failed to delete project:', error);
      showError('Failed to delete project. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'review': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-gray-100 text-white';
      default: return 'bg-gray-100 text-white';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-400';
    }
  };

  // Filter projects based on active filter
  const filteredProjects = allProjects.filter(project => {
    // Status filter
    if (activeFilter !== 'all') {
      if (activeFilter === 'overdue' && project.deadline !== 'Overdue') return false;
      if (activeFilter !== 'overdue' && project.status !== activeFilter) return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        project.title.toLowerCase().includes(query) ||
        project.client.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Sort projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      case 'deadline':
        if (a.deadline === 'Overdue') return -1;
        if (b.deadline === 'Overdue') return 1;
        return 0; // Would need proper date comparison with actual dates
      case 'progress':
        return b.progress - a.progress;
      case 'value':
        const aValue = parseInt(a.value.replace(/[$,]/g, ''));
        const bValue = parseInt(b.value.replace(/[$,]/g, ''));
        return bValue - aValue;
      default:
        return 0;
    }
  });

  const projects = sortedProjects;

  // Action handlers
  const handleViewDetails = (projectId) => {
    showInfo('Project details page coming soon!');
    // TODO: navigate(`/projects/${projectId}`);
  };

  const handleUpdateStatus = async (projectId) => {
    // Cycle through statuses: active -> review -> completed
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;

    const statusCycle = {
      'active': 'review',
      'review': 'completed',
      'completed': 'active',
    };

    const newStatus = statusCycle[project.status] || 'active';
    await handleUpdateProject(projectId, { status: newStatus });
  };

  const handleMessageClient = (projectId, clientName) => {
    showInfo(`Opening chat with ${clientName}...`);
    // TODO: navigate(`/messages?client=${clientName}`);
    setTimeout(() => navigate('/messages'), 1000);
  };

  const handleCreateInvoice = (projectId) => {
    showInfo('Invoice creation modal coming soon!');
    // TODO: Open invoice modal
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8">
      {/* New Project Modal */}
      <NewProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onCreate={handleCreateProject} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-indigo-600 text-white rounded-xl shadow-xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="w-full md:w-auto">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2">📊 Active Projects</h1>
              <p className="text-indigo-200 text-base sm:text-lg">Manage your ongoing work and track deliverables</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full md:w-auto mt-2 md:mt-0 bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition duration-200 shadow-lg whitespace-nowrap"
            >
              + New Project
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">7</div>
              <div className="text-sm text-indigo-200">Total Active</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">3</div>
              <div className="text-sm text-indigo-200">Due This Week</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">$18.5K</div>
              <div className="text-sm text-indigo-200">Total Value</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">68%</div>
              <div className="text-sm text-indigo-200">Avg Progress</div>
            </div>
          </div>
        </div>

        {/* Search & Sort */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-lg p-3 sm:p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search projects..."
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            >
              <option value="priority">Sort: Priority</option>
              <option value="deadline">Sort: Deadline</option>
              <option value="progress">Sort: Progress</option>
              <option value="value">Sort: Value</option>
            </select>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6 flex flex-wrap gap-2">
          {['all', 'active', 'review', 'completed', 'overdue'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
                activeFilter === filter
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              {filter === 'all' ? 'All Projects' : filter === 'review' ? 'In Review' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Projects List */}
        <div className="space-y-6">
          {projects.length === 0 ? (
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-white mb-2">No Projects Found</h3>
              <p className="text-gray-400 mb-6">
                {searchQuery
                  ? `No projects match "${searchQuery}". Try a different search term.`
                  : activeFilter !== 'all'
                  ? `No projects with status "${activeFilter}". Try a different filter.`
                  : 'Create your first project to get started!'}
              </p>
              {!searchQuery && activeFilter === 'all' && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
                >
                  Create Your First Project
                </button>
              )}
            </div>
          ) : (
            projects.map((project) => (
            <div key={project.id} className="group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 overflow-hidden">
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{project.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(project.status)}`}>
                        {project.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-400 mb-2">{project.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>👤 Client: <strong>{project.client}</strong></span>
                      <span className={getPriorityColor(project.priority)}>
                        🎯 Priority: <strong className="uppercase">{project.priority}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 md:ml-6 text-right">
                    <div className="text-2xl font-bold text-green-600">{project.value}</div>
                    <div className="text-sm text-gray-500">
                      {project.deadline === 'Overdue' ? (
                        <span className="text-red-600 font-semibold">⚠️ {project.deadline}</span>
                      ) : (
                        <span>📅 Due in {project.deadline}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Progress</span>
                    <span className="font-semibold text-white">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        project.progress >= 75 ? 'bg-green-600' : project.progress >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                      }`}
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleViewDetails(project.id)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition text-sm"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(project.id)}
                    className="px-4 py-2 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg font-medium hover:bg-gray-600 transition text-sm"
                  >
                    Update Status
                  </button>
                  <button
                    onClick={() => handleMessageClient(project.id, project.client)}
                    className="px-4 py-2 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg font-medium hover:bg-gray-600 transition text-sm"
                  >
                    Message Client
                  </button>
                  <button
                    onClick={() => handleCreateInvoice(project.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition text-sm"
                  >
                    Create Invoice
                  </button>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Projects;
