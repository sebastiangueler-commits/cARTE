import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  UsersIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  
  // Pagination
  const [usersPage, setUsersPage] = useState(1);
  const [portfoliosPage, setPortfoliosPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [portfoliosSearch, setPortfoliosSearch] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'portfolios') {
      fetchPortfolios();
    }
  }, [activeTab, usersPage, portfoliosPage, usersSearch, portfoliosSearch]);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await axios.get('/api/admin/users', {
        params: {
          page: usersPage,
          limit: 10,
          search: usersSearch
        }
      });
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchPortfolios = async () => {
    setPortfoliosLoading(true);
    try {
      const response = await axios.get('/api/admin/portfolios', {
        params: {
          page: portfoliosPage,
          limit: 10,
          search: portfoliosSearch
        }
      });
      setPortfolios(response.data.portfolios);
    } catch (error) {
      console.error('Error fetching portfolios:', error);
      toast.error('Failed to fetch portfolios');
    } finally {
      setPortfoliosLoading(false);
    }
  };

  const handleUserRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`/api/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      toast.success('User role updated successfully');
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete user "${userEmail}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/users/${userId}`);
      setUsers(prev => prev.filter(user => user.id !== userId));
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <LoadingSpinner size="large" className="py-12" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage users, portfolios, and system statistics
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: ChartBarIcon },
            { id: 'users', name: 'Users', icon: UsersIcon },
            { id: 'portfolios', name: 'Portfolios', icon: UserGroupIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UsersIcon className="h-8 w-8 text-primary-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Users
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.stats.user_count}
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
                    <UserGroupIcon className="h-8 w-8 text-success-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Portfolios
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.stats.portfolio_count}
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
                    <ChartBarIcon className="h-8 w-8 text-warning-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Assets
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.stats.asset_count}
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
                    <CurrencyDollarIcon className="h-8 w-8 text-primary-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Value
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(stats.stats.total_value)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            </div>
            <div className="card-body">
              <div className="flow-root">
                <ul className="-mb-8">
                  {stats.recent_activity.map((activity, activityIdx) => (
                    <li key={activityIdx}>
                      <div className="relative pb-8">
                        {activityIdx !== stats.recent_activity.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center ring-8 ring-white">
                              <div className="h-2 w-2 bg-primary-600 rounded-full"></div>
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                <span className="font-medium text-gray-900">
                                  {activity.user_email}
                                </span>{' '}
                                {activity.action.replace('_', ' ')}
                              </p>
                              {activity.details && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {JSON.stringify(activity.details)}
                                </p>
                              )}
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              {formatDate(activity.created_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Search */}
          <div className="card">
            <div className="card-body">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  className="input pl-10"
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Users</h3>
            </div>
            <div className="overflow-x-auto">
              {usersLoading ? (
                <div className="py-12">
                  <LoadingSpinner size="large" />
                </div>
              ) : (
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell">Name</th>
                      <th className="table-header-cell">Email</th>
                      <th className="table-header-cell">Role</th>
                      <th className="table-header-cell">Portfolios</th>
                      <th className="table-header-cell">Assets</th>
                      <th className="table-header-cell">Joined</th>
                      <th className="table-header-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="table-cell">
                          {user.first_name} {user.last_name}
                        </td>
                        <td className="table-cell">{user.email}</td>
                        <td className="table-cell">
                          <select
                            value={user.role}
                            onChange={(e) => handleUserRoleChange(user.id, e.target.value)}
                            className="text-sm border-gray-300 rounded-md"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="table-cell">{user.portfolio_count}</td>
                        <td className="table-cell">{user.asset_count}</td>
                        <td className="table-cell">{formatDate(user.created_at)}</td>
                        <td className="table-cell">
                          <div className="flex space-x-2">
                            <button className="btn-secondary p-1">
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Portfolios Tab */}
      {activeTab === 'portfolios' && (
        <div className="space-y-6">
          {/* Search */}
          <div className="card">
            <div className="card-body">
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search portfolios..."
                  className="input pl-10"
                  value={portfoliosSearch}
                  onChange={(e) => setPortfoliosSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Portfolios Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Portfolios</h3>
            </div>
            <div className="overflow-x-auto">
              {portfoliosLoading ? (
                <div className="py-12">
                  <LoadingSpinner size="large" />
                </div>
              ) : (
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell">Name</th>
                      <th className="table-header-cell">Owner</th>
                      <th className="table-header-cell">Value</th>
                      <th className="table-header-cell">Assets</th>
                      <th className="table-header-cell">Created</th>
                      <th className="table-header-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {portfolios.map((portfolio) => (
                      <tr key={portfolio.id}>
                        <td className="table-cell font-medium">{portfolio.name}</td>
                        <td className="table-cell">
                          {portfolio.first_name} {portfolio.last_name}
                          <br />
                          <span className="text-xs text-gray-500">{portfolio.user_email}</span>
                        </td>
                        <td className="table-cell font-medium">
                          {formatCurrency(portfolio.total_value)}
                        </td>
                        <td className="table-cell">{portfolio.asset_count}</td>
                        <td className="table-cell">{formatDate(portfolio.created_at)}</td>
                        <td className="table-cell">
                          <div className="flex space-x-2">
                            <button className="btn-secondary p-1">
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button className="btn-secondary p-1">
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button className="btn-danger p-1">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;