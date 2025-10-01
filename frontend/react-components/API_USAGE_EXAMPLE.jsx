/**
 * API_USAGE_EXAMPLE.jsx - Example of using API in React components
 *
 * This file demonstrates how to communicate with the Django backend
 * from React components using the ReactAPI bridge.
 *
 * DO NOT ADD TO index.html - This is just documentation/example
 */

// ===== EXAMPLE 1: Simple API Call in Component =====

const ExampleComponentWithAPI = () => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    async function fetchUser() {
      try {
        // Check if authenticated
        const isAuth = await window.ReactAPI.isAuthenticated();

        if (isAuth) {
          // Get current user data
          const userData = await window.ReactAPI.getCurrentUser();
          setUser(userData);
        }

        setLoading(false);
      } catch (err) {
        setError(window.ReactAPI.handleError(err, 'Fetching user'));
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>Not logged in</div>;

  return (
    <div>
      <h2>Welcome, {user.first_name || user.username}!</h2>
      <p>Email: {user.email}</p>
    </div>
  );
};

// ===== EXAMPLE 2: API Call on Button Click =====

const ProjectCreator = () => {
  const [projectName, setProjectName] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');

    try {
      const projectData = {
        title: projectName,
        description: 'Project created from React',
        total_amount: 1000.00,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'USD',
        status: 'draft'
      };

      const newProject = await window.ReactAPI.createProject(projectData);
      setMessage(`✅ Project created: ${newProject.title}`);
      setProjectName('');
    } catch (err) {
      setMessage(`❌ Error: ${window.ReactAPI.handleError(err, 'Creating project')}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={handleCreateProject}>
      <input
        type="text"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Project name"
        disabled={creating}
      />
      <button type="submit" disabled={creating || !projectName}>
        {creating ? 'Creating...' : 'Create Project'}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
};

// ===== EXAMPLE 3: Fetching List Data =====

const ProjectsList = () => {
  const [projects, setProjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadProjects() {
      try {
        const projectsData = await window.ReactAPI.getProjects();
        setProjects(projectsData);
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, []);

  if (loading) return <div>Loading projects...</div>;

  return (
    <div>
      <h2>My Projects</h2>
      {projects.length === 0 ? (
        <p>No projects yet</p>
      ) : (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              {project.title} - ${project.total_amount}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ===== EXAMPLE 4: Authentication Actions =====

const AuthButtons = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    async function checkAuth() {
      const auth = await window.ReactAPI.isAuthenticated();
      setIsAuthenticated(auth);
    }
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await window.ReactAPI.logout();
      setIsAuthenticated(false);
      // Redirect to home
      window.location.href = '/';
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleLogin = () => {
    window.location.href = '/signin.html';
  };

  return (
    <div>
      {isAuthenticated ? (
        <button onClick={handleLogout}>Logout</button>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  );
};

// ===== EXAMPLE 5: Using API in Event Handlers (like current Hero component) =====

const HeroWithAPI = () => {
  const handleSignUp = async (e) => {
    e.preventDefault();

    // Check if already authenticated
    const isAuth = await window.ReactAPI.isAuthenticated();

    if (isAuth) {
      // Already logged in, go to dashboard
      window.location.href = '/dashboard.html';
    } else {
      // Not logged in, go to signup
      window.location.href = '/signup.html';
    }
  };

  return (
    <section className="hero">
      <div className="container">
        <h1>Your Projects. Fully Protected.</h1>
        <button onClick={handleSignUp}>Get Started</button>
      </div>
    </section>
  );
};

// ===== EXAMPLE 6: Real-time Data Updates =====

const DashboardStats = () => {
  const [stats, setStats] = React.useState(null);
  const [lastUpdate, setLastUpdate] = React.useState(new Date());

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const dashboardData = await window.ReactAPI.getDashboardData();
        setStats(dashboardData.stats);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }

    // Initial fetch
    fetchStats();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <div>Loading stats...</div>;

  return (
    <div className="stats">
      <div>Active Projects: {stats.active_projects}</div>
      <div>Completed: {stats.completed_projects}</div>
      <div>Total Earned: ${stats.total_earned}</div>
      <small>Last updated: {lastUpdate.toLocaleTimeString()}</small>
    </div>
  );
};

// ===== AVAILABLE API METHODS =====

/*
  Authentication:
  - ReactAPI.isAuthenticated() → boolean
  - ReactAPI.getCurrentUser() → user object
  - ReactAPI.login(email, password) → user + tokens
  - ReactAPI.register(userData) → user + tokens
  - ReactAPI.logout() → void

  Projects:
  - ReactAPI.getProjects() → array of projects
  - ReactAPI.getProject(id) → single project
  - ReactAPI.createProject(data) → new project
  - ReactAPI.updateProject(id, data) → updated project
  - ReactAPI.deleteProject(id) → void

  Dashboard:
  - ReactAPI.getDashboardData() → { stats, projects }

  Utilities:
  - ReactAPI.getBaseURL() → API base URL
  - ReactAPI.isDevelopment() → boolean
  - ReactAPI.handleError(error, context) → error message
*/

// ===== HOW TO USE IN YOUR COMPONENTS =====

/*
  1. Import the API bridge in index.html (already done):
     <script src="/js/react-api-bridge.js"></script>

  2. Use in your React components:
     const data = await window.ReactAPI.getProjects();

  3. Handle loading and errors:
     try {
       setLoading(true);
       const result = await window.ReactAPI.someMethod();
       setData(result);
     } catch (error) {
       setError(window.ReactAPI.handleError(error, 'Operation name'));
     } finally {
       setLoading(false);
     }

  4. Check authentication before API calls:
     const isAuth = await window.ReactAPI.isAuthenticated();
     if (!isAuth) {
       window.location.href = '/signin.html';
       return;
     }
*/