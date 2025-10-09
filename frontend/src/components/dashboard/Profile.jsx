import { useState, useEffect, useRef } from 'react';
import { profileAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Loader2, Upload } from 'lucide-react';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('overview');
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
    <div className="min-h-screen bg-transparent py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Hero Section */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-xl shadow-xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              <img
                src={profile.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'}
                alt="User Avatar"
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-xl object-cover"
                crossOrigin="anonymous"
              />
              <div className="absolute bottom-2 right-2 w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full border-2 border-white"></div>

              {/* Avatar upload overlay */}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer disabled:cursor-not-allowed"
                title="Upload new avatar"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-white animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
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

            {/* Profile Info */}
            <div className="flex-1 w-full">
              {editMode ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editedProfile.name || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                    className="text-2xl sm:text-3xl font-bold bg-white/10 text-white rounded-lg px-4 py-2 w-full border-2 border-white/20 focus:border-white/40 focus:outline-none"
                    placeholder="Your Name"
                  />
                  <input
                    type="text"
                    value={editedProfile.username || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                    className="text-base sm:text-lg bg-white/10 text-indigo-200 rounded-lg px-4 py-2 w-full border-2 border-white/20 focus:border-white/40 focus:outline-none"
                    placeholder="username"
                  />
                  <textarea
                    value={editedProfile.bio || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                    className="bg-white/10 text-white/90 rounded-lg px-4 py-2 w-full border-2 border-white/20 focus:border-white/40 focus:outline-none resize-none text-sm sm:text-base"
                    rows={2}
                    placeholder="Tell us about yourself..."
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="px-4 sm:px-6 py-2 sm:py-3 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm sm:text-base"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="px-4 sm:px-6 py-2 sm:py-3 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2">
                    {profile.name || 'User'} {profile.verified && <span className="text-sm sm:text-base bg-white/20 px-2 sm:px-3 py-1 rounded-full ml-2">✓ Verified</span>}
                  </h1>
                  <p className="text-indigo-200 text-base sm:text-lg mb-2">@{profile.username || 'user'}</p>
                  <p className="text-white/90 text-sm sm:text-base mb-4">
                    {profile.bio || 'Welcome to Lunara!'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['React', 'Node.js', 'UI/UX', 'Python', 'AWS'].map((skill) => (
                      <span key={skill} className="px-2 sm:px-3 py-1 bg-white/20 rounded-full text-xs sm:text-sm font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button onClick={handleEditProfile} className="px-4 sm:px-6 py-2 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition shadow-lg text-sm sm:text-base">
                      Edit Profile
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">📊</div>
              <div className="text-xs sm:text-sm text-white/80 mb-1">Total Projects</div>
              <div className="text-xl sm:text-2xl font-bold mb-1">24</div>
              <div className="text-xs text-white/70">+3 this month</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">💰</div>
              <div className="text-xs sm:text-sm text-white/80 mb-1">Total Earnings</div>
              <div className="text-xl sm:text-2xl font-bold mb-1">$18,500</div>
              <div className="text-xs text-white/70">+$2.1K this month</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">⭐</div>
              <div className="text-xs sm:text-sm text-white/80 mb-1">Average Rating</div>
              <div className="text-xl sm:text-2xl font-bold mb-1">4.9</div>
              <div className="text-xs text-white/70">From 47 reviews</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">✅</div>
              <div className="text-xs sm:text-sm text-white/80 mb-1">Completion Rate</div>
              <div className="text-xl sm:text-2xl font-bold mb-1">98%</div>
              <div className="text-xs text-white/70">On-time delivery</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-gray-500/20 hover:border-gray-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 mb-4 sm:mb-6 p-1 flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-gray-600 to-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {['overview', 'activity', 'skills'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium text-sm sm:text-base capitalize whitespace-nowrap transition ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              {tab === 'overview' && '🏠 '}
              {tab === 'activity' && '📊 '}
              {tab === 'skills' && '🎯 '}
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Widgets - Full Width Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {activeTab === 'overview' && (
            <>
              {/* Recent Activity */}
              <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">E-commerce Dashboard</span>
                    <span className="font-bold text-green-400">$1,500</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Mobile Banking App</span>
                    <span className="font-bold text-yellow-400">In Progress</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Brand Identity</span>
                    <span className="font-bold text-green-400">$950</span>
                  </div>
                </div>
              </div>

              {/* Monthly Earnings */}
              <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-green-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-green-500/20 hover:border-green-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-green-600 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <h3 className="text-lg font-bold text-white mb-4">Monthly Earnings</h3>
                <div className="text-3xl sm:text-4xl font-bold text-green-400 mb-2">$4,200</div>
                <div className="text-sm text-gray-400 mb-4">84% of monthly goal ($5,000)</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '84%' }}></div>
                </div>
              </div>

              {/* Client Satisfaction */}
              <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-yellow-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-yellow-500/20 hover:border-yellow-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-yellow-600 to-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <h3 className="text-lg font-bold text-white mb-4">Client Satisfaction</h3>
                <div className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-4">4.9/5</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">47</div>
                    <div className="text-xs text-gray-400">Reviews</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">98%</div>
                    <div className="text-xs text-gray-400">Positive</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'activity' && (
            <>
              <div className="col-span-full group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">E-commerce Dashboard</h3>
                    <div className="text-xs text-gray-400">TechCorp • 2 days ago</div>
                  </div>
                  <div className="text-2xl font-bold text-green-400">$1,500</div>
                </div>
                <p className="text-sm text-gray-400 mb-4">Modern React dashboard with real-time analytics and inventory management.</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              <div className="col-span-full group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Mobile Banking App</h3>
                    <div className="text-xs text-gray-400">FinanceFlow • 5 days ago</div>
                  </div>
                  <div className="text-2xl font-bold text-green-400">$2,800</div>
                </div>
                <p className="text-sm text-gray-400 mb-4">Flutter-based mobile app with biometric authentication and transaction tracking.</p>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'skills' && (
            <div className="col-span-full group relative bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <h2 className="text-xl font-bold text-white mb-6">Technical Skills</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { name: 'React & Next.js', level: 95, color: 'from-cyan-600 to-blue-600' },
                  { name: 'Node.js & Express', level: 90, color: 'from-green-600 to-emerald-600' },
                  { name: 'UI/UX Design', level: 88, color: 'from-purple-600 to-pink-600' },
                  { name: 'Python & Django', level: 85, color: 'from-yellow-600 to-orange-600' },
                ].map((skill, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white font-semibold">{skill.name}</span>
                      <span className="text-purple-300 font-bold">{skill.level}%</span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-2">
                      <div
                        className={`h-2 bg-gradient-to-r ${skill.color} rounded-full`}
                        style={{ width: `${skill.level}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
