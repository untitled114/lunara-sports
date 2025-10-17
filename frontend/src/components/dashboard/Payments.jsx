import { useState, useEffect } from 'react';
import { paymentsAPI } from '../../services/api';
import { Loader2 } from 'lucide-react';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

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
        const isDemo = localStorage.getItem('is_demo') === 'true';
        if (isDemo) {
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
              daysOverdue: 0,
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
        } else {
          setPayments([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  const getFilteredPayments = () => {
    if (activeTab === 'all') return payments;
    if (activeTab === 'paid') return payments.filter(p => p.status === 'paid');
    if (activeTab === 'pending') return payments.filter(p => p.status === 'pending' || p.status === 'processing');
    if (activeTab === 'overdue') return payments.filter(p => p.daysOverdue > 0);
    return payments;
  };

  const filteredPayments = getFilteredPayments();
  const hasPayments = filteredPayments.length > 0;

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

        <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-xl shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-extrabold mb-2">Payments and Earnings</h1>
          <p className="text-green-100 text-lg">Track your income and manage invoices</p>
        </div>

        {/* Filters */}
        <div className="group relative bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-gray-500/20 hover:border-gray-500/50 hover:transform hover:-translate-y-2 transition-all duration-300 p-3 sm:p-4 mb-6 flex flex-wrap gap-2">
          {/* Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-gray-600 to-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              activeTab === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            All Payments
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              activeTab === 'paid' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            Paid
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              activeTab === 'pending' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition ${
              activeTab === 'overdue' ? 'bg-indigo-600 text-white' : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            Overdue
          </button>
        </div>

        <div className="space-y-4">
          {!hasPayments && (
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl shadow-lg p-12 text-center">
              <h3 className="text-2xl font-bold text-white mb-2">No Payments Found</h3>
              <p className="text-gray-400">No payment transactions found for this filter.</p>
            </div>
          )}

          {hasPayments && filteredPayments.map((payment) => (
            <div key={payment.id} className="bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-white">{payment.project}</h3>
                  <p className="text-gray-400 text-sm">Client: {payment.client}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">${payment.amount.toLocaleString()}</div>
                  <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                    {payment.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-400">
                <span>Invoice: {payment.invoice}</span>
                <span className="mx-2">•</span>
                <span>Method: {payment.method}</span>
                <span className="mx-2">•</span>
                <span>Date: {new Date(payment.date).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Payments;
