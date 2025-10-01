import { useState } from 'react';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('activity');

  const stats = [
    { icon: '📊', label: 'Total Projects', value: '24', subtext: '+3 this month', color: 'bg-blue-50' },
    { icon: '💰', label: 'Total Earnings', value: '$18,500', subtext: '+$2.1K this month', color: 'bg-green-50' },
    { icon: '⭐', label: 'Average Rating', value: '4.9', subtext: 'From 47 reviews', color: 'bg-yellow-50' },
    { icon: '✅', label: 'Completion Rate', value: '98%', subtext: 'On-time delivery', color: 'bg-purple-50' },
  ];

  const activities = [
    {
      id: 1,
      title: 'E-commerce Dashboard',
      client: 'TechCorp',
      status: 'completed',
      description: 'Modern React dashboard with real-time analytics and inventory management.',
      amount: '$1,500',
      progress: 100,
      date: '2 days ago',
    },
    {
      id: 2,
      title: 'Mobile Banking App',
      client: 'FinanceFlow',
      status: 'in-progress',
      description: 'Flutter-based mobile app with biometric authentication and transaction tracking.',
      amount: '$2,800',
      progress: 75,
      date: '5 days ago',
    },
    {
      id: 3,
      title: 'Brand Identity Redesign',
      client: 'StartupXYZ',
      status: 'completed',
      description: 'Complete visual identity overhaul including logo, website, and marketing materials.',
      amount: '$950',
      progress: 100,
      date: '1 week ago',
    },
  ];

  const reviews = [
    {
      id: 1,
      name: 'Sarah Johnson',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop&crop=face',
      rating: 5,
      comment: 'Exceptional work on our e-commerce platform. Alex delivered beyond expectations with clean code and intuitive design.',
      project: 'E-commerce Dashboard',
      date: '3 days ago',
    },
    {
      id: 2,
      name: 'Mike Chen',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face',
      rating: 5,
      comment: 'Professional, responsive, and delivered on time. The API integration was flawless and well-documented.',
      project: 'API Integration',
      date: '1 week ago',
    },
  ];

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Hero */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
                alt="User Avatar"
                className="w-32 h-32 rounded-full border-4 border-white shadow-xl"
                crossOrigin="anonymous"
              />
              <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">
                Alex Taylor <span className="text-xl bg-white/20 px-3 py-1 rounded-full">✓ Verified</span>
              </h1>
              <p className="text-indigo-200 text-lg mb-3">@alexthedev</p>
              <p className="text-white/90 mb-4 max-w-2xl">
                Full-stack developer & UI/UX designer specializing in modern web applications. Passionate about creating seamless user experiences.
              </p>
              <div className="flex flex-wrap gap-2">
                {['React', 'Node.js', 'UI/UX', 'Python', 'AWS'].map((skill) => (
                  <span key={skill} className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Share Profile">🔗</button>
              <button className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Download Resume">📄</button>
              <button className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Contact Info">📞</button>
              <button className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Portfolio">🎨</button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center hover:bg-white/20 transition cursor-pointer">
                <div className="text-3xl mb-2">{stat.icon}</div>
                <div className="text-sm text-white/80 mb-1">{stat.label}</div>
                <div className="text-2xl font-bold mb-1">{stat.value}</div>
                <div className="text-xs text-white/70">{stat.subtext}</div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6">
            <button className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition shadow-lg">
              ✏️ Edit Profile
            </button>
            <button className="px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition">
              🎨 View Portfolio
            </button>
            <button className="px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition">
              📅 Set Availability
            </button>
            <button className="px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition">
              🛡️ Enhance Verification
            </button>
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6 p-1 flex gap-2 overflow-x-auto">
          {['activity', 'projects', 'reviews', 'analytics', 'payments'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-medium capitalize whitespace-nowrap transition ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab === 'activity' && '📊 '}
              {tab === 'projects' && '💼 '}
              {tab === 'reviews' && '⭐ '}
              {tab === 'analytics' && '📈 '}
              {tab === 'payments' && '💰 '}
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'activity' && (
            <div className="grid grid-cols-1 gap-6">
              {activities.map((activity) => (
                <div key={activity.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{activity.title}</h3>
                      <div className="text-sm text-gray-600">{activity.date}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(activity.status)}`}>
                      {activity.status.toUpperCase().replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-4">{activity.description}</p>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-green-600">{activity.amount}</span>
                    <span className="text-sm text-gray-600">Client: {activity.client}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-semibold">{activity.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{ width: `${activity.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="grid grid-cols-1 gap-6">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <img
                      src={review.avatar}
                      alt={review.name}
                      className="w-12 h-12 rounded-full border-2 border-indigo-600"
                      crossOrigin="anonymous"
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">{review.name}</h4>
                      <div className="text-yellow-500">{'⭐'.repeat(review.rating)}</div>
                    </div>
                    <span className="text-sm text-gray-500">{review.date}</span>
                  </div>
                  <p className="text-gray-700 mb-3">"{review.comment}"</p>
                  <div className="text-sm text-gray-500">Project: {review.project}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Earnings</h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl font-bold text-green-600">$4,200</span>
                  <span className="text-green-600 text-lg">↗ +18%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '84%' }}></div>
                </div>
                <p className="text-sm text-gray-600">84% of monthly goal ($5,000)</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Client Satisfaction</h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl font-bold text-yellow-600">4.9/5</span>
                  <span className="text-green-600 text-lg">↗ +0.1</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">47</div>
                    <div className="text-sm text-gray-600">Reviews</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">98%</div>
                    <div className="text-sm text-gray-600">Positive</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'projects' || activeTab === 'payments') && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">🚧</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Coming Soon</h3>
              <p className="text-gray-600">
                {activeTab === 'projects' ? 'Detailed project history will be available here.' : 'Payment history will be available here.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Profile;
