import { useState, useEffect } from 'react';
import { paymentsAPI, invoicesAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Loader2 } from 'lucide-react';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const { showSuccess, showError } = useToast();

  // Fetch payments on mount
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const data = await paymentsAPI.getAll();
        const transformedPayments = (data.results || data).map(payment => ({
          id: payment.id,
          project: payment.project || payment.project_name || 'Unknown Project',
          client: payment.client || payment.client_name || 'Unknown Client',
          amount: payment.amount || 0,
          status: payment.status || 'pending',
          date: payment.date || payment.created_at || new Date().toISOString(),
          method: payment.payment_method || payment.method || 'Unknown',
          invoice: payment.invoice || payment.invoice_number || 'N/A',
          daysOverdue: payment.days_overdue || 0,
        }));
        setPayments(transformedPayments);
      } catch (error) {
        console.error('Failed to load payments:', error);
        showError('Failed to load payments. Using demo data.');
        // Use fallback data for development
        setPayments([
          {
            id: 1,
            project: 'E-commerce Dashboard',
            client: 'TechCorp',
            amount: 2500,
            status: 'paid',
            date: '2024-12-15',
            method: 'Bank Transfer',
            invoice: 'INV-2024-001',
          },
          {
            id: 2,
            project: 'Healthcare Portal',
            client: 'MedCare Plus',
            amount: 3800,
            status: 'pending',
            date: '2024-12-20',
            method: 'Lunara Wallet',
            invoice: 'INV-2024-002',
            daysOverdue: 3,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [showError]);

  // Handle payment reminder
  const handleSendReminder = async (paymentId) => {
    try {
      await paymentsAPI.sendReminder(paymentId);
      showSuccess('Payment reminder sent successfully!');
    } catch (error) {
      console.error('Failed to send reminder:', error);
      showError('Failed to send payment reminder. Please try again.');
    }
  };

  // Handle invoice download - STUB (backend endpoint doesn't exist yet)
  const handleDownloadInvoice = async (paymentId) => {
    showSuccess('Invoice download feature coming soon! Backend endpoint in development.');
    // TODO: Implement when /api/invoices/download/ endpoint is ready
  };

  // Handle receipt download - STUB (backend endpoint doesn't exist yet)
  const handleDownloadReceipt = async (paymentId) => {
    showSuccess('Receipt download feature coming soon! Backend endpoint in development.');
    // TODO: Implement when /api/payments/{id}/receipt/ endpoint is ready
  };

  // Handle create invoice - STUB
  const handleCreateInvoice = () => {
    showSuccess('Create invoice feature coming soon! Modal will open here.');
    // TODO: Open modal to create new invoice
  };

  // Handle contact client - STUB
  const handleContactClient = (clientName) => {
    showSuccess(`Contact ${clientName} feature coming soon! Will open messaging.`);
    // TODO: Navigate to messages with pre-selected client
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-white border-gray-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return '✅';
      case 'pending': return '⏳';
      case 'overdue': return '⚠️';
      case 'processing': return '🔄';
      default: return '📄';
    }
  };

  // Filter payments based on active tab
  const filteredPayments = payments.filter(payment => {
    if (activeTab === 'all') return true;
    if (activeTab === 'paid') return payment.status === 'paid';
    if (activeTab === 'pending') return payment.status === 'pending' || payment.status === 'processing';
    if (activeTab === 'overdue') return payment.daysOverdue > 0;
    if (activeTab === 'invoices') return true; // Show all for invoices tab
    return true;
  });

  const totalEarned = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'pending' || p.status === 'processing').reduce((sum, p) => sum + p.amount, 0);
  const totalOverdue = payments.filter(p => p.daysOverdue).reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Alert */}
        {totalOverdue > 0 && (
          <div className="bg-red-900/20 border-l-4 border-red-600 p-4 mb-6 rounded-lg border border-red-500/30">
            <div className="flex items-center">
              <span className="text-2xl mr-3">⚠️</span>
              <div>
                <h3 className="text-red-400 font-semibold">Payment Overdue</h3>
                <p className="text-gray-400 text-sm">TechFlow's milestone payment is 3 days late. Automatic escrow release in 4 days.</p>
              </div>
              <button
                onClick={() => handleContactClient('TechFlow')}
                className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
              >
                Contact Client
              </button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-xl shadow-xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="w-full md:w-auto">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2">💰 Payments & Earnings</h1>
              <p className="text-green-100 text-base sm:text-lg">Track your income and manage invoices</p>
            </div>
            <button
              onClick={handleCreateInvoice}
              className="w-full md:w-auto mt-2 md:mt-0 bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition duration-200 shadow-lg whitespace-nowrap"
            >
              + Create Invoice
            </button>
          </div>

          {/* Financial Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-green-100 text-sm mb-1">This Month Earned</div>
              <div className="text-3xl font-bold">${totalEarned.toLocaleString()}</div>
              <div className="text-green-200 text-xs mt-1">✅ Paid & Cleared</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-green-100 text-sm mb-1">Pending Payments</div>
              <div className="text-3xl font-bold">${totalPending.toLocaleString()}</div>
              <div className="text-yellow-200 text-xs mt-1">⏳ Awaiting Payment</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-green-100 text-sm mb-1">Total Revenue (YTD)</div>
              <div className="text-3xl font-bold">$18,500</div>
              <div className="text-green-200 text-xs mt-1">📈 +23% vs last year</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-gray-500/20 hover:border-gray-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 mb-4 sm:mb-6 p-1 flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
          {/* Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-gray-600 to-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base whitespace-nowrap transition ${
              activeTab === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            All Payments
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base whitespace-nowrap transition ${
              activeTab === 'paid' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            Paid
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base whitespace-nowrap transition ${
              activeTab === 'pending' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base whitespace-nowrap transition ${
              activeTab === 'overdue' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            Overdue
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base whitespace-nowrap transition ${
              activeTab === 'invoices' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            Invoices
          </button>
        </div>

        {/* KPI Cards - Full Width Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-500/50 hover:transform hover:-translate-y-2 transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-blue-600 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-300 mb-1">Avg Invoice Value</div>
                <div className="text-2xl font-bold text-white">$2,800</div>
                <div className="text-xs text-blue-300 mt-1">↗ +12%</div>
              </div>
              <span className="text-3xl">💵</span>
            </div>
          </div>

          <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-green-500/20 rounded-2xl p-6 hover:shadow-2xl hover:shadow-green-500/20 hover:border-green-500/50 hover:transform hover:-translate-y-2 transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-green-600 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-green-300 mb-1">Success Rate</div>
                <div className="text-2xl font-bold text-white">94%</div>
                <div className="text-xs text-green-300 mt-1">On-time payments</div>
              </div>
              <span className="text-3xl">✓</span>
            </div>
          </div>

          <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6 hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50 hover:transform hover:-translate-y-2 transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-purple-300 mb-1">Avg Payment Time</div>
                <div className="text-2xl font-bold text-white">8.5d</div>
                <div className="text-xs text-purple-300 mt-1">Industry: 12d</div>
              </div>
              <span className="text-3xl">⏱</span>
            </div>
          </div>
        </div>

        {/* Additional Widgets - 2 Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Payment Methods Widget */}
          <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <h3 className="text-lg font-bold text-white mb-4">Payment Methods</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <span className="text-lg">🏦</span>
                    </div>
                    <div>
                      <div className="font-semibold text-white">Bank Transfer</div>
                      <div className="text-xs text-gray-400">44.5% of total</div>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-green-400">$8.2K</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div className="bg-gradient-to-r from-green-600 to-green-500 h-2 rounded-full" style={{ width: '44.5%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="text-lg">💰</span>
                    </div>
                    <div>
                      <div className="font-semibold text-white">Lunara Wallet</div>
                      <div className="text-xs text-gray-400">34.8% of total</div>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-blue-400">$6.4K</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-500 h-2 rounded-full" style={{ width: '34.8%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <span className="text-lg">📱</span>
                    </div>
                    <div>
                      <div className="font-semibold text-white">PayPal</div>
                      <div className="text-xs text-gray-400">20.7% of total</div>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-purple-400">$3.9K</span>
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2">
                  <div className="bg-gradient-to-r from-purple-600 to-purple-500 h-2 rounded-full" style={{ width: '20.7%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Clients Widget */}
          <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-green-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-green-500/20 hover:border-green-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-green-600 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <h3 className="text-lg font-bold text-white mb-4">Top Clients</h3>
            <div className="space-y-3">
              {[
                { name: 'TechCorp', amount: '$8,200', percentage: 44, color: 'indigo' },
                { name: 'MedCare Plus', amount: '$5,600', percentage: 30, color: 'blue' },
                { name: 'StartupX', amount: '$2,900', percentage: 16, color: 'purple' },
                { name: 'DesignHub', amount: '$1,800', percentage: 10, color: 'pink' },
              ].map((client, idx) => (
                <div key={idx} className="group hover:bg-gray-700/30 p-3 rounded-lg transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-${client.color}-500/20 flex items-center justify-center text-xs font-bold text-${client.color}-400`}>
                        {idx + 1}
                      </div>
                      <span className="font-semibold text-white">{client.name}</span>
                    </div>
                    <span className="text-lg font-bold text-white">{client.amount}</span>
                  </div>
                  <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                    <div
                      className={`bg-gradient-to-r from-${client.color}-600 to-${client.color}-500 h-1.5 rounded-full transition-all group-hover:h-2`}
                      style={{ width: `${client.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payments List - Full Width */}
        <div className="space-y-4 mb-6 sm:mb-8">
          {filteredPayments.length === 0 ? (
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-2xl font-bold text-white mb-2">No Payments Found</h3>
              <p className="text-gray-400">
                {activeTab === 'all' && 'You have no payment transactions yet.'}
                {activeTab === 'paid' && 'You have no paid transactions.'}
                {activeTab === 'pending' && 'You have no pending payments.'}
                {activeTab === 'overdue' && 'You have no overdue payments.'}
                {activeTab === 'invoices' && 'You have no invoices yet.'}
              </p>
            </div>
          ) : (
            filteredPayments.map((payment) => (
              <div key={payment.id} className="group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
                {/* Top Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="flex flex-col gap-4">
                  {/* Top Section - Project & Amount */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl sm:text-3xl flex-shrink-0">{getStatusIcon(payment.status)}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl font-bold text-white truncate">{payment.project}</h3>
                        <p className="text-gray-400 text-xs sm:text-sm">Client: {payment.client}</p>
                      </div>
                    </div>

                    {/* Amount - Desktop */}
                    <div className="hidden sm:block text-center">
                      <div className="text-2xl sm:text-3xl font-bold text-white">${payment.amount.toLocaleString()}</div>
                      <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(payment.status)}`}>
                        {payment.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Amount - Mobile */}
                  <div className="sm:hidden flex items-center justify-between">
                    <div className="text-2xl font-bold text-white">${payment.amount.toLocaleString()}</div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(payment.status)}`}>
                      {payment.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Payment Details */}
                  <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                    <span className="flex items-center gap-1">📄 {payment.invoice}</span>
                    <span className="flex items-center gap-1">💳 {payment.method}</span>
                    <span className="flex items-center gap-1">📅 {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {payment.daysOverdue && (
                      <span className="text-red-600 font-semibold">⚠️ {payment.daysOverdue} days overdue</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    <button
                      onClick={() => handleDownloadInvoice(payment.id)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition text-sm"
                    >
                      View Invoice
                    </button>
                    {payment.status === 'pending' && (
                      <button
                        onClick={() => handleSendReminder(payment.id)}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition text-sm"
                      >
                        Send Reminder
                      </button>
                    )}
                    {payment.status === 'paid' && (
                      <button
                        onClick={() => handleDownloadReceipt(payment.id)}
                        className="px-4 py-2 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg font-medium hover:bg-gray-600 transition text-sm"
                      >
                        Download Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Revenue Analytics Chart - Full Width */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-white">Revenue Analytics</h3>
              <p className="text-sm text-gray-400 mt-1">Monthly performance overview</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span className="text-xs text-gray-400">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-xs text-gray-400">Target</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="grid grid-cols-6 gap-3">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => {
                const revenueHeights = ['60%', '75%', '45%', '85%', '70%', '90%'];
                const targetHeights = ['65%', '70%', '65%', '75%', '75%', '85%'];
                const amounts = ['$2.1K', '$2.8K', '$1.9K', '$3.2K', '$2.6K', '$3.5K'];
                return (
                  <div key={month} className="flex flex-col items-center">
                    <div className="w-full flex items-end justify-center gap-1 h-40 mb-3">
                      <div
                        className="w-6 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all hover:from-indigo-500 hover:to-indigo-300 cursor-pointer shadow-lg"
                        style={{ height: revenueHeights[index] }}
                        title={`Revenue: ${amounts[index]}`}
                      ></div>
                      <div
                        className="w-6 bg-gradient-to-t from-green-600/50 to-green-400/50 rounded-t-md border border-green-500/50 transition-all hover:from-green-500/70 hover:to-green-300/70 cursor-pointer"
                        style={{ height: targetHeights[index] }}
                        title="Target"
                      ></div>
                    </div>
                    <div className="text-xs font-semibold text-gray-400 mb-1">{month}</div>
                    <div className="text-sm font-bold text-indigo-300">{amounts[index]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700/50 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">Total Revenue</div>
              <div className="text-2xl font-bold text-white">$15.5K</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Growth Rate</div>
              <div className="text-2xl font-bold text-green-400">+18%</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Projection (Jul)</div>
              <div className="text-2xl font-bold text-indigo-400">$4.2K</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payments;
