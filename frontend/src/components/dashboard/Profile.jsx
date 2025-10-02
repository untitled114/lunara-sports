import { useState, useEffect, useRef } from 'react';
import { profileAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Loader2, Upload } from 'lucide-react';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('activity');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const avatarInputRef = useRef(null);
  const { showSuccess, showError, showInfo } = useToast();

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const data = await profileAPI.get();
        setProfile(data);
      } catch (error) {
        console.error('Failed to load profile:', error);
        showError('Failed to load profile data');
        // Use fallback data for development
        setProfile({
          name: 'Alex Taylor',
          username: 'alexthedev',
          bio: 'Full-stack developer & UI/UX designer specializing in modern web applications.',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
          verified: true,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [showError]);

  // Handle entering edit mode
  const handleEditProfile = () => {
    setEditMode(true);
    setEditedProfile({
      name: profile.name,
      bio: profile.bio,
      username: profile.username,
    });
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedProfile({});
  };

  // Handle saving profile changes
  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const updatedData = await profileAPI.update(editedProfile);
      setProfile({ ...profile, ...updatedData });
      setEditMode(false);
      showSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      showError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      const data = await profileAPI.uploadAvatar(file);
      setProfile({ ...profile, avatar: data.avatar || URL.createObjectURL(file) });
      showSuccess('Avatar updated successfully!');
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      showError('Failed to upload avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Stub handlers for features not yet implemented
  const handleShareProfile = () => {
    showInfo('Share profile feature coming soon! Will generate shareable link.');
    // TODO: Implement profile sharing with generated link
  };

  const handleDownloadResume = () => {
    showInfo('Resume download feature coming soon! Will generate PDF resume.');
    // TODO: Generate and download PDF resume
  };

  const handleContactInfo = () => {
    showInfo('Contact info modal coming soon! Will show contact details.');
    // TODO: Open modal with contact information
  };

  const handleViewPortfolio = () => {
    showInfo('Portfolio view coming soon! Will open portfolio gallery.');
    // TODO: Navigate to portfolio page or open gallery modal
  };

  const handleSetAvailability = () => {
    showInfo('Set availability feature coming soon! Will open calendar modal.');
    // TODO: Open calendar modal to set availability
  };

  const handleEnhanceVerification = () => {
    showInfo('Enhanced verification coming soon! Will open verification wizard.');
    // TODO: Open verification flow (ID verification, skills tests, etc.)
  };

  const stats = [
    { icon: '📊', label: 'Total Projects', value: '24', subtext: '+3 this month', color: 'bg-blue-900/20 border-blue-500/30' },
    { icon: '💰', label: 'Total Earnings', value: '$18,500', subtext: '+$2.1K this month', color: 'bg-green-900/20 border-green-500/30' },
    { icon: '⭐', label: 'Average Rating', value: '4.9', subtext: 'From 47 reviews', color: 'bg-yellow-900/20 border-yellow-500/30' },
    { icon: '✅', label: 'Completion Rate', value: '98%', subtext: 'On-time delivery', color: 'bg-purple-900/20 border-purple-500/30' },
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
      case 'completed': return 'bg-green-900/30 text-green-400 border-green-500/30';
      case 'in-progress': return 'bg-blue-900/30 text-blue-400 border-blue-500/30';
      case 'pending': return 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-700/50 text-gray-300 border-gray-600';
    }
  };

  const skills = [
    { name: 'React & Next.js', level: 95, category: 'Frontend', color: 'from-cyan-600 to-blue-600' },
    { name: 'Node.js & Express', level: 90, category: 'Backend', color: 'from-green-600 to-emerald-600' },
    { name: 'UI/UX Design', level: 88, category: 'Design', color: 'from-purple-600 to-pink-600' },
    { name: 'Python & Django', level: 85, category: 'Backend', color: 'from-yellow-600 to-orange-600' },
    { name: 'AWS & DevOps', level: 80, category: 'Infrastructure', color: 'from-indigo-600 to-purple-600' },
    { name: 'TypeScript', level: 92, category: 'Frontend', color: 'from-blue-600 to-indigo-600' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Failed to load profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Profile Hero */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="relative group">
              <img
                src={profile.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'}
                alt="User Avatar"
                className="w-32 h-32 rounded-full border-4 border-white shadow-xl object-cover"
                crossOrigin="anonymous"
              />
              <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>

              {/* Avatar upload overlay */}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer disabled:cursor-not-allowed"
                title="Upload new avatar"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-white" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            {/* Info */}
            <div className="flex-1">
              {editMode ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editedProfile.name || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                    className="text-3xl font-bold bg-white/10 text-white rounded-lg px-4 py-2 w-full border-2 border-white/20 focus:border-white/40 focus:outline-none"
                    placeholder="Your Name"
                  />
                  <input
                    type="text"
                    value={editedProfile.username || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                    className="text-lg bg-white/10 text-indigo-200 rounded-lg px-4 py-2 w-full border-2 border-white/20 focus:border-white/40 focus:outline-none"
                    placeholder="username"
                  />
                  <textarea
                    value={editedProfile.bio || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                    className="bg-white/10 text-white/90 rounded-lg px-4 py-2 w-full border-2 border-white/20 focus:border-white/40 focus:outline-none resize-none"
                    rows={3}
                    placeholder="Tell us about yourself..."
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-4xl font-bold mb-2">
                    {profile.name || 'User'} {profile.verified && <span className="text-xl bg-white/20 px-3 py-1 rounded-full">✓ Verified</span>}
                  </h1>
                  <p className="text-indigo-200 text-lg mb-3">@{profile.username || 'user'}</p>
                  <p className="text-white/90 mb-4 max-w-2xl">
                    {profile.bio || 'Welcome to Lunara!'}
                  </p>
                </>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {['React', 'Node.js', 'UI/UX', 'Python', 'AWS'].map((skill) => (
                  <span key={skill} className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button onClick={handleShareProfile} className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Share Profile">🔗</button>
              <button onClick={handleDownloadResume} className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Download Resume">📄</button>
              <button onClick={handleContactInfo} className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Contact Info">📞</button>
              <button onClick={handleViewPortfolio} className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition" title="Portfolio">🎨</button>
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
            {editMode ? (
              <>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      💾 Save Changes
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ❌ Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={handleEditProfile} className="px-6 py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition shadow-lg">
                  ✏️ Edit Profile
                </button>
                <button onClick={handleViewPortfolio} className="px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition">
                  🎨 View Portfolio
                </button>
                <button onClick={handleSetAvailability} className="px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition">
                  📅 Set Availability
                </button>
                <button onClick={handleEnhanceVerification} className="px-6 py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition">
                  🛡️ Enhance Verification
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow mb-6 p-1 flex gap-2 overflow-x-auto">
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
                <div key={activity.id} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{activity.title}</h3>
                      <div className="text-sm text-gray-400">{activity.date}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(activity.status)}`}>
                      {activity.status.toUpperCase().replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-gray-400 mb-4">{activity.description}</p>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-green-600">{activity.amount}</span>
                    <span className="text-sm text-gray-400">Client: {activity.client}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Progress</span>
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
                <div key={review.id} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <img
                      src={review.avatar}
                      alt={review.name}
                      className="w-12 h-12 rounded-full border-2 border-indigo-600"
                      crossOrigin="anonymous"
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-white">{review.name}</h4>
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
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Monthly Earnings</h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl font-bold text-green-600">$4,200</span>
                  <span className="text-green-600 text-lg">↗ +18%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '84%' }}></div>
                </div>
                <p className="text-sm text-gray-400">84% of monthly goal ($5,000)</p>
              </div>

              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Client Satisfaction</h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl font-bold text-yellow-600">4.9/5</span>
                  <span className="text-green-600 text-lg">↗ +0.1</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">47</div>
                    <div className="text-sm text-gray-400">Reviews</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">98%</div>
                    <div className="text-sm text-gray-400">Positive</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'projects' || activeTab === 'payments') && (
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">🚧</div>
              <h3 className="text-2xl font-bold text-white mb-2">Coming Soon</h3>
              <p className="text-gray-400">
                {activeTab === 'projects' ? 'Detailed project history will be available here.' : 'Payment history will be available here.'}
              </p>
            </div>
          )}
        </div>

        {/* Skills Showcase */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 backdrop-blur-sm border border-indigo-500/30 rounded-xl shadow-lg p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">🎯 Technical Skills & Expertise</h2>
              <span className="text-sm text-indigo-300 bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-500/30">
                6 Core Skills
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {skills.map((skill, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-semibold">{skill.name}</span>
                      <span className="ml-2 text-xs text-gray-400 bg-gray-700/50 px-2 py-0.5 rounded-full">
                        {skill.category}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-indigo-300">{skill.level}%</span>
                  </div>
                  <div className="relative w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${skill.color} rounded-full transition-all duration-500 hover:opacity-90`}
                      style={{ width: `${skill.level}%` }}
                    >
                      <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
                <div className="text-2xl font-bold text-cyan-400">8+</div>
                <div className="text-sm text-gray-400">Years Experience</div>
              </div>
              <div className="text-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                <div className="text-2xl font-bold text-green-400">150+</div>
                <div className="text-sm text-gray-400">Projects Completed</div>
              </div>
              <div className="text-center p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">12</div>
                <div className="text-sm text-gray-400">Certifications</div>
              </div>
              <div className="text-center p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                <div className="text-2xl font-bold text-indigo-400">95%</div>
                <div className="text-sm text-gray-400">Client Retention</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Profile;
