import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Portfolio = () => {
  const { id } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showEditAssetModal, setShowEditAssetModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [newAsset, setNewAsset] = useState({
    symbol: '',
    name: '',
    quantity: '',
    purchasePrice: '',
    purchaseDate: '',
    isin: '',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      fetchPortfolio();
    }
  }, [id]);

  const fetchPortfolio = async () => {
    try {
      const response = await axios.get(`/api/portfolios/${id}`);
      setPortfolio(response.data);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      toast.error('Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    try {
      const assetData = {
        ...newAsset,
        portfolioId: parseInt(id),
        quantity: parseFloat(newAsset.quantity),
        purchasePrice: parseFloat(newAsset.purchasePrice)
      };
      
      const response = await axios.post('/api/assets', assetData);
      setPortfolio(prev => ({
        ...prev,
        assets: [response.data.asset, ...prev.assets]
      }));
      setNewAsset({
        symbol: '',
        name: '',
        quantity: '',
        purchasePrice: '',
        purchaseDate: '',
        isin: '',
        notes: ''
      });
      setShowAddAssetModal(false);
      toast.success('Asset added successfully!');
    } catch (error) {
      console.error('Error adding asset:', error);
      toast.error('Failed to add asset');
    }
  };

  const handleEditAsset = async (e) => {
    e.preventDefault();
    try {
      const assetData = {
        ...selectedAsset,
        quantity: parseFloat(selectedAsset.quantity),
        purchasePrice: parseFloat(selectedAsset.purchasePrice)
      };
      
      await axios.put(`/api/assets/${selectedAsset.id}`, assetData);
      setPortfolio(prev => ({
        ...prev,
        assets: prev.assets.map(asset => 
          asset.id === selectedAsset.id ? { ...asset, ...assetData } : asset
        )
      }));
      setShowEditAssetModal(false);
      setSelectedAsset(null);
      toast.success('Asset updated successfully!');
    } catch (error) {
      console.error('Error updating asset:', error);
      toast.error('Failed to update asset');
    }
  };

  const handleDeleteAsset = async (assetId, assetName) => {
    if (!window.confirm(`Are you sure you want to delete "${assetName}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/assets/${assetId}`);
      setPortfolio(prev => ({
        ...prev,
        assets: prev.assets.filter(asset => asset.id !== assetId)
      }));
      toast.success('Asset deleted successfully!');
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error('Failed to delete asset');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (percentage) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (!portfolio?.assets) return null;

    const assetNames = portfolio.assets.map(asset => asset.name);
    const assetValues = portfolio.assets.map(asset => asset.current_value || 0);
    const assetChanges = portfolio.assets.map(asset => asset.price_change_percent || 0);

    return {
      doughnut: {
        labels: assetNames,
        datasets: [{
          data: assetValues,
          backgroundColor: [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      bar: {
        labels: assetNames,
        datasets: [{
          label: 'Price Change %',
          data: assetChanges,
          backgroundColor: assetChanges.map(change => 
            change >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'
          ),
          borderColor: assetChanges.map(change => 
            change >= 0 ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'
          ),
          borderWidth: 1
        }]
      }
    };
  };

  const chartData = prepareChartData();

  if (loading) {
    return <LoadingSpinner size="large" className="py-12" />;
  }

  if (!portfolio) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Portfolio not found</h3>
        <Link to="/dashboard" className="btn-primary mt-4">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard" className="btn-secondary">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{portfolio.name}</h2>
            {portfolio.description && (
              <p className="text-sm text-gray-500">{portfolio.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAddAssetModal(true)}
          className="btn-primary"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Asset
        </button>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Value
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(portfolio.total_value || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-8 w-8 text-success-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Invested
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(portfolio.total_invested || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {portfolio.total_change_percent >= 0 ? (
                  <TrendingUpIcon className="h-8 w-8 text-success-600" />
                ) : (
                  <TrendingDownIcon className="h-8 w-8 text-danger-600" />
                )}
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Change
                  </dt>
                  <dd className={`text-lg font-medium ${
                    portfolio.total_change_percent >= 0 ? 'text-success-600' : 'text-danger-600'
                  }`}>
                    {formatPercentage(portfolio.total_change_percent || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-bold">{portfolio.asset_count || 0}</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Assets
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {portfolio.asset_count || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      {chartData && portfolio.assets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Asset Distribution</h3>
            </div>
            <div className="card-body">
              <div className="h-64">
                <Doughnut
                  data={chartData.doughnut}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom'
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Performance by Asset</h3>
            </div>
            <div className="card-body">
              <div className="h-64">
                <Bar
                  data={chartData.bar}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true
                      }
                    },
                    plugins: {
                      legend: {
                        display: false
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assets Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Assets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Symbol</th>
                <th className="table-header-cell">Name</th>
                <th className="table-header-cell">Quantity</th>
                <th className="table-header-cell">Purchase Price</th>
                <th className="table-header-cell">Current Price</th>
                <th className="table-header-cell">Change</th>
                <th className="table-header-cell">Value</th>
                <th className="table-header-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {portfolio.assets?.map((asset) => (
                <tr key={asset.id}>
                  <td className="table-cell font-medium">{asset.symbol}</td>
                  <td className="table-cell">{asset.name}</td>
                  <td className="table-cell">{asset.quantity}</td>
                  <td className="table-cell">{formatCurrency(asset.purchase_price)}</td>
                  <td className="table-cell">
                    {asset.current_price ? formatCurrency(asset.current_price) : 'N/A'}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center">
                      {asset.price_change_percent >= 0 ? (
                        <ArrowUpIcon className="h-4 w-4 text-success-500 mr-1" />
                      ) : (
                        <ArrowDownIcon className="h-4 w-4 text-danger-500 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        asset.price_change_percent >= 0 ? 'text-success-600' : 'text-danger-600'
                      }`}>
                        {formatPercentage(asset.price_change_percent || 0)}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell font-medium">
                    {formatCurrency(asset.current_value || 0)}
                  </td>
                  <td className="table-cell">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAsset(asset);
                          setShowEditAssetModal(true);
                        }}
                        className="btn-secondary p-1"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id, asset.name)}
                        className="btn-danger p-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset Modal */}
      {showAddAssetModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Add New Asset
              </h3>
              <form onSubmit={handleAddAsset}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Symbol *
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="e.g., AAPL"
                      value={newAsset.symbol}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, symbol: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="e.g., Apple Inc."
                      value={newAsset.name}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        className="input"
                        placeholder="0.00"
                        value={newAsset.quantity}
                        onChange={(e) => setNewAsset(prev => ({ ...prev, quantity: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Purchase Price *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="input"
                        placeholder="0.00"
                        value={newAsset.purchasePrice}
                        onChange={(e) => setNewAsset(prev => ({ ...prev, purchasePrice: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Date *
                    </label>
                    <input
                      type="date"
                      required
                      className="input"
                      value={newAsset.purchaseDate}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, purchaseDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ISIN (Optional)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., US0378331005"
                      value={newAsset.isin}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, isin: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      className="input"
                      rows="3"
                      placeholder="Additional notes..."
                      value={newAsset.notes}
                      onChange={(e) => setNewAsset(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddAssetModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Add Asset
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {showEditAssetModal && selectedAsset && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Edit Asset
              </h3>
              <form onSubmit={handleEditAsset}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Symbol *
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={selectedAsset.symbol}
                      onChange={(e) => setSelectedAsset(prev => ({ ...prev, symbol: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={selectedAsset.name}
                      onChange={(e) => setSelectedAsset(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        className="input"
                        value={selectedAsset.quantity}
                        onChange={(e) => setSelectedAsset(prev => ({ ...prev, quantity: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Purchase Price *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="input"
                        value={selectedAsset.purchase_price}
                        onChange={(e) => setSelectedAsset(prev => ({ ...prev, purchase_price: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Date *
                    </label>
                    <input
                      type="date"
                      required
                      className="input"
                      value={selectedAsset.purchase_date}
                      onChange={(e) => setSelectedAsset(prev => ({ ...prev, purchase_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ISIN (Optional)
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={selectedAsset.isin || ''}
                      onChange={(e) => setSelectedAsset(prev => ({ ...prev, isin: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      className="input"
                      rows="3"
                      value={selectedAsset.notes || ''}
                      onChange={(e) => setSelectedAsset(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditAssetModal(false);
                      setSelectedAsset(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Update Asset
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;