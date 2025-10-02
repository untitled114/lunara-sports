import { useState, useEffect } from 'react';
import { paymentsAPI, invoicesAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Loader2 } from 'lucide-react';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // Handle invoice download
  const handleDownloadInvoice = async (paymentId) => {
    try {
      const invoiceData = await invoicesAPI.download(paymentId);
      // Trigger download (implementation depends on backend response format)
      showSuccess('Invoice download started!');
    } catch (error) {
      console.error('Failed to download invoice:', error);
      showError('Failed to download invoice. Please try again.');
    }
  };

  // Handle receipt download
  const handleDownloadReceipt = async (paymentId) => {
    try {
      const receiptData = await paymentsAPI.downloadReceipt(paymentId);
      // Trigger download (implementation depends on backend response format)
      showSuccess('Receipt download started!');
    } catch (error) {
      console.error('Failed to download receipt:', error);
      showError('Failed to download receipt. Please try again.');
    }
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
              <button className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">
                Contact Client
              </button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-xl shadow-xl p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">💰 Payments & Earnings</h1>
              <p className="text-green-100 text-lg">Track your income and manage invoices</p>
            </div>
            <button className="mt-4 md:mt-0 bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition duration-200 shadow-lg">
              + Create Invoice
            </button>
          </div>

          {/* Financial Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
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
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow mb-6 p-1 flex gap-2 overflow-x-auto">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium whitespace-nowrap">All Payments</button>
          <button className="px-4 py-2 text-gray-300 hover:bg-gray-700/50 rounded-lg font-medium whitespace-nowrap">Paid</button>
          <button className="px-4 py-2 text-gray-300 hover:bg-gray-700/50 rounded-lg font-medium whitespace-nowrap">Pending</button>
          <button className="px-4 py-2 text-gray-300 hover:bg-gray-700/50 rounded-lg font-medium whitespace-nowrap">Overdue</button>
          <button className="px-4 py-2 text-gray-300 hover:bg-gray-700/50 rounded-lg font-medium whitespace-nowrap">Invoices</button>
        </div>

        {/* Payments List */}
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment.id} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg hover:shadow-xl transition duration-300 p-6">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Left Section */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{getStatusIcon(payment.status)}</span>
                    <div>
                      <h3 className="text-xl font-bold text-white">{payment.project}</h3>
                      <p className="text-gray-400 text-sm">Client: {payment.client}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-400 ml-12">
                    <span>📄 {payment.invoice}</span>
                    <span>💳 {payment.method}</span>
                    <span>📅 {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {payment.daysOverdue && (
                      <span className="text-red-600 font-semibold">⚠️ {payment.daysOverdue} days overdue</span>
                    )}
                  </div>
                </div>

                {/* Center - Amount */}
                <div className="text-center lg:mx-6">
                  <div className="text-3xl font-bold text-white">${payment.amount.toLocaleString()}</div>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(payment.status)}`}>
                    {payment.status.toUpperCase()}
                  </span>
                </div>

                {/* Right - Actions */}
                <div className="flex flex-wrap gap-2">
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
          ))}
        </div>

        {/* Payment Methods Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">💳 Payment Methods</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏦</span>
                  <div>
                    <div className="font-semibold text-white">Bank Transfer</div>
                    <div className="text-xs text-gray-400">Primary method</div>
                  </div>
                </div>
                <span className="text-green-400 font-bold">$8,200</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💰</span>
                  <div>
                    <div className="font-semibold text-white">Lunara Wallet</div>
                    <div className="text-xs text-gray-400">Fast & secure</div>
                  </div>
                </div>
                <span className="text-blue-400 font-bold">$6,400</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <div className="font-semibold text-white">PayPal</div>
                    <div className="text-xs text-gray-400">International</div>
                  </div>
                </div>
                <span className="text-purple-400 font-bold">$3,900</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">📊 Payment Analytics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Average Invoice Value</span>
                  <span className="font-bold text-white">$2,800</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Payment Success Rate</span>
                  <span className="font-bold text-green-400">94%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '94%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Avg Payment Time</span>
                  <span className="font-bold text-yellow-400">8.5 days</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '58%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Revenue Chart */}
        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 backdrop-blur-sm border border-indigo-500/30 rounded-xl shadow-lg p-6 mt-8">
          <h3 className="text-lg font-bold text-white mb-6">📈 Monthly Revenue Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => {
              const heights = ['60%', '75%', '45%', '85%', '70%', '90%'];
              const amounts = ['$2.1K', '$2.8K', '$1.9K', '$3.2K', '$2.6K', '$3.5K'];
              return (
                <div key={month} className="flex flex-col items-center">
                  <div className="w-full flex items-end justify-center h-32 mb-2">
                    <div
                      className="w-12 bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-lg transition-all hover:from-indigo-500 hover:to-purple-400 cursor-pointer"
                      style={{ height: heights[index] }}
                      title={`${month}: ${amounts[index]}`}
                    ></div>
                  </div>
                  <div className="text-xs font-semibold text-gray-400">{month}</div>
                  <div className="text-sm font-bold text-indigo-300">{amounts[index]}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-500"></div>
              <span className="text-gray-400">Revenue Trend</span>
            </div>
            <div className="text-green-400 font-semibold">↗ +18% this quarter</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payments;
