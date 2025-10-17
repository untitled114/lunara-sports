import { useState, useEffect } from 'react';
import { payoutsAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Loader2, DollarSign, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';

const Payouts = () => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bank_transfer');
  const { showSuccess, showError, showInfo } = useToast();

  const isDemo = localStorage.getItem('is_demo') === 'true';

  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        setLoading(true);
        const data = await payoutsAPI.getAll();
        setPayouts(data.results || data);
      } catch (error) {
        console.error('Failed to load payouts:', error);
        if (isDemo) {
          setPayouts([
            {
              id: 1,
              amount: 2500,
              status: 'completed',
              method: 'Bank Transfer',
              requested_date: '2024-12-10',
              completed_date: '2024-12-12',
              reference: 'PO-2024-001',
            },
            {
              id: 2,
              amount: 1800,
              status: 'pending',
              method: 'PayPal',
              requested_date: '2024-12-18',
              completed_date: null,
              reference: 'PO-2024-002',
            },
            {
              id: 3,
              amount: 3200,
              status: 'processing',
              method: 'Bank Transfer',
              requested_date: '2024-12-15',
              completed_date: null,
              reference: 'PO-2024-003',
            },
          ]);
        } else {
          setPayouts([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPayouts();
  }, [isDemo]);

  const handleRequestPayout = async (e) => {
    e.preventDefault();

    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    try {
      setRequesting(true);
      await payoutsAPI.request({
        amount: parseFloat(payoutAmount),
        method: payoutMethod,
      });
      showSuccess('Payout request submitted successfully!');
      setPayoutAmount('');

      // Refresh payouts list
      const data = await payoutsAPI.getAll();
      setPayouts(data.results || data);
    } catch (error) {
      console.error('Failed to request payout:', error);
      showError('Failed to submit payout request. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  const getFilteredPayouts = () => {
    if (activeTab === 'all') return payouts;
    if (activeTab === 'completed') return payouts.filter(p => p.status === 'completed');
    if (activeTab === 'pending') return payouts.filter(p => p.status === 'pending');
    if (activeTab === 'processing') return payouts.filter(p => p.status === 'processing');
    return payouts;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const filteredPayouts = getFilteredPayouts();
  const hasPayouts = filteredPayouts.length > 0;

  // Calculate available balance (mock for now)
  const availableBalance = isDemo ? 5800 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading payouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-green-700 text-white rounded-xl shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-extrabold mb-2">Request Payout</h1>
          <p className="text-emerald-100 text-lg">Withdraw your earnings to your preferred payment method</p>
        </div>

        {/* Available Balance Card */}
        <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-emerald-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-emerald-500/20 hover:border-emerald-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6 mb-8">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-emerald-600 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">Available Balance</h3>
              <div className="text-4xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-8 h-8 text-emerald-400" />
                {availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">Minimum Payout</div>
              <div className="text-xl font-semibold text-emerald-400">$50.00</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Request Payout Form */}
          <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-600 to-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <h3 className="text-2xl font-bold text-white mb-6">New Payout Request</h3>

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="50"
                    max={availableBalance}
                    className="w-full pl-8 pr-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Minimum: $50.00 • Maximum: ${availableBalance.toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Payment Method
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="paypal">PayPal</option>
                  <option value="stripe">Stripe</option>
                  <option value="wise">Wise</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={requesting || availableBalance < 50}
                className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-semibold hover:from-emerald-700 hover:to-green-700 transition shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {requesting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-5 h-5" />
                    Request Payout
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Payment Methods Info */}
          <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-6">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <h3 className="text-2xl font-bold text-white mb-6">Payment Methods</h3>

            <div className="space-y-4">
              <div className="p-4 bg-gray-900/30 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">Bank Transfer</span>
                  <span className="text-xs text-green-400">✓ Verified</span>
                </div>
                <p className="text-sm text-gray-400">Processing time: 2-5 business days</p>
                <p className="text-xs text-gray-500 mt-1">Fee: $0 (Free)</p>
              </div>

              <div className="p-4 bg-gray-900/30 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">PayPal</span>
                  <span className="text-xs text-green-400">✓ Verified</span>
                </div>
                <p className="text-sm text-gray-400">Processing time: Instant - 1 day</p>
                <p className="text-xs text-gray-500 mt-1">Fee: 2.9% + $0.30</p>
              </div>

              <div className="p-4 bg-gray-900/30 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">Stripe</span>
                  <span className="text-xs text-yellow-400">⚠ Not Setup</span>
                </div>
                <p className="text-sm text-gray-400">Processing time: 1-2 business days</p>
                <p className="text-xs text-gray-500 mt-1">Fee: 2.5% + $0.25</p>
              </div>

              <div className="p-4 bg-gray-900/30 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">Wise</span>
                  <span className="text-xs text-yellow-400">⚠ Not Setup</span>
                </div>
                <p className="text-sm text-gray-400">Processing time: 1-3 business days</p>
                <p className="text-xs text-gray-500 mt-1">Fee: 0.5% (Low fee)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-gray-500/20 hover:border-gray-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-3 sm:p-4 mb-6 flex flex-wrap gap-2">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-gray-600 to-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              activeTab === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            All Payouts
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              activeTab === 'completed' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setActiveTab('processing')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              activeTab === 'processing' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            Processing
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              activeTab === 'pending' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            Pending
          </button>
        </div>

        {/* Payout History */}
        <div className="space-y-4">
          {!hasPayouts && (
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">💰</div>
              <h3 className="text-2xl font-bold text-white mb-2">No Payout History</h3>
              <p className="text-gray-400">Your payout requests will appear here once submitted.</p>
            </div>
          )}

          {hasPayouts && filteredPayouts.map((payout) => (
            <div key={payout.id} className="group relative bg-gray-800/50 backdrop-blur-sm border border-emerald-500/20 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-emerald-500/20 hover:border-emerald-500/50 hover:transform hover:-translate-y-1 transition-all duration-300 p-6">
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-emerald-600 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(payout.status)}
                    <h3 className="text-xl font-bold text-white">
                      ${payout.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(payout.status)}`}>
                      {payout.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-400 mt-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Requested: {new Date(payout.requested_date).toLocaleDateString()}</span>
                    </div>
                    {payout.completed_date && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Completed: {new Date(payout.completed_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-gray-400 mb-1">Method</div>
                  <div className="font-semibold text-white">{payout.method}</div>
                  <div className="text-xs text-gray-500 mt-2">Ref: {payout.reference}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Payouts;
