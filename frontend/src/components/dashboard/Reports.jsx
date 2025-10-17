import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Briefcase, Users, Calendar } from 'lucide-react';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('month');
  const [stats, setStats] = useState(null);

  const isDemo = localStorage.getItem('is_demo') === 'true';

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        // TODO: Implement API call to fetch reports
        // const data = await reportsAPI.get(timeframe);
        // setStats(data);

        // Mock data for now
        await new Promise(resolve => setTimeout(resolve, 800));

        if (isDemo) {
          setStats({
            totalEarnings: 18500,
            earningsChange: 12.5,
            projectsCompleted: 24,
            projectsChange: -3.2,
            activeClients: 12,
            clientsChange: 8.7,
            averageProjectValue: 770,
            averageChange: 15.3,
            monthlyBreakdown: [
              { month: 'Jan', earnings: 2400, projects: 3 },
              { month: 'Feb', earnings: 3100, projects: 4 },
              { month: 'Mar', earnings: 2800, projects: 3 },
              { month: 'Apr', earnings: 3900, projects: 5 },
              { month: 'May', earnings: 3200, projects: 4 },
              { month: 'Jun', earnings: 3100, projects: 5 },
            ],
            topClients: [
              { name: 'TechCorp', projects: 8, earnings: 6400 },
              { name: 'MedCare Plus', projects: 5, earnings: 4200 },
              { name: 'EcoTech', projects: 4, earnings: 3100 },
              { name: 'FinanceFlow', projects: 3, earnings: 2800 },
            ],
            categoryBreakdown: [
              { category: 'Web Development', earnings: 8200, percentage: 44 },
              { category: 'UI/UX Design', earnings: 5400, percentage: 29 },
              { category: 'Mobile Apps', earnings: 3200, percentage: 17 },
              { category: 'Consulting', earnings: 1700, percentage: 10 },
            ],
          });
        } else {
          setStats({
            totalEarnings: 0,
            earningsChange: 0,
            projectsCompleted: 0,
            projectsChange: 0,
            activeClients: 0,
            clientsChange: 0,
            averageProjectValue: 0,
            averageChange: 0,
            monthlyBreakdown: [],
            topClients: [],
            categoryBreakdown: [],
          });
        }
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [timeframe, isDemo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  const hasData = stats && (stats.totalEarnings > 0 || stats.projectsCompleted > 0);

  return (
    <div className="min-h-screen bg-transparent py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-xl shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-extrabold mb-2">Analytics & Reports</h1>
          <p className="text-indigo-100 text-lg">Track your performance and business insights</p>
        </div>

        {/* Timeframe Filter */}
        <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-gray-500/20 hover:border-gray-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-3 sm:p-4 mb-8 flex flex-wrap gap-2">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-gray-600 to-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <button
            onClick={() => setTimeframe('week')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              timeframe === 'week' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              timeframe === 'month' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setTimeframe('quarter')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              timeframe === 'quarter' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            This Quarter
          </button>
          <button
            onClick={() => setTimeframe('year')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              timeframe === 'year' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            This Year
          </button>
        </div>

        {!hasData ? (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Data Available</h3>
            <p className="text-gray-400">Complete some projects to see your analytics and reports here.</p>
          </div>
        ) : (
          <>
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Earnings */}
              <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-green-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-green-500/20 hover:border-green-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-green-600 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="flex items-center justify-between mb-4">
                  <DollarSign className="w-8 h-8 text-green-400" />
                  <span className={`flex items-center gap-1 text-sm font-semibold ${stats.earningsChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.earningsChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(stats.earningsChange)}%
                  </span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  ${stats.totalEarnings.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">Total Earnings</div>
              </div>

              {/* Projects Completed */}
              <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-blue-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-blue-600 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="flex items-center justify-between mb-4">
                  <Briefcase className="w-8 h-8 text-blue-400" />
                  <span className={`flex items-center gap-1 text-sm font-semibold ${stats.projectsChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.projectsChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(stats.projectsChange)}%
                  </span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {stats.projectsCompleted}
                </div>
                <div className="text-sm text-gray-400">Projects Completed</div>
              </div>

              {/* Active Clients */}
              <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="flex items-center justify-between mb-4">
                  <Users className="w-8 h-8 text-purple-400" />
                  <span className={`flex items-center gap-1 text-sm font-semibold ${stats.clientsChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.clientsChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(stats.clientsChange)}%
                  </span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {stats.activeClients}
                </div>
                <div className="text-sm text-gray-400">Active Clients</div>
              </div>

              {/* Average Project Value */}
              <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-yellow-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-yellow-500/20 hover:border-yellow-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-yellow-600 to-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="flex items-center justify-between mb-4">
                  <Calendar className="w-8 h-8 text-yellow-400" />
                  <span className={`flex items-center gap-1 text-sm font-semibold ${stats.averageChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.averageChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(stats.averageChange)}%
                  </span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  ${stats.averageProjectValue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">Avg Project Value</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Monthly Earnings Chart */}
              <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <h3 className="text-xl font-bold text-white mb-6">Monthly Earnings Trend</h3>

                <div className="space-y-4">
                  {stats.monthlyBreakdown.map((month, index) => {
                    const maxEarnings = Math.max(...stats.monthlyBreakdown.map(m => m.earnings));
                    const percentage = (month.earnings / maxEarnings) * 100;

                    return (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-300 font-medium">{month.month}</span>
                          <span className="text-white font-semibold">${month.earnings.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{month.projects} projects</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Clients */}
              <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-cyan-500/20 hover:border-cyan-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-cyan-600 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <h3 className="text-xl font-bold text-white mb-6">Top Clients</h3>

                <div className="space-y-4">
                  {stats.topClients.map((client, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-900/30 border border-gray-700 rounded-lg hover:bg-gray-900/50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{client.name}</div>
                          <div className="text-sm text-gray-400">{client.projects} projects</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">${client.earnings.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">earned</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-emerald-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-emerald-500/20 hover:border-emerald-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-emerald-600 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <h3 className="text-xl font-bold text-white mb-6">Earnings by Category</h3>

              <div className="space-y-4">
                {stats.categoryBreakdown.map((category, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-300 font-medium">{category.category}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-semibold">${category.earnings.toLocaleString()}</span>
                        <span className="text-emerald-400 font-semibold">{category.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 bg-gradient-to-r from-emerald-600 to-green-600 rounded-full transition-all duration-500"
                        style={{ width: `${category.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
