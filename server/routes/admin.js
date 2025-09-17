const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
        COUNT(p.id) as portfolio_count,
        COUNT(a.id) as asset_count
      FROM users u
      LEFT JOIN portfolios p ON u.id = p.user_id
      LEFT JOIN assets a ON p.id = a.portfolio_id
    `;

    const queryParams = [];
    let paramCount = 1;

    if (search) {
      query += ` WHERE (u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM users u';
    if (search) {
      countQuery += ` WHERE (u.email ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1)`;
    }
    const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);

    res.json({
      users: result.rows.map(user => ({
        ...user,
        portfolio_count: parseInt(user.portfolio_count),
        asset_count: parseInt(user.asset_count)
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get user info
    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user's portfolios
    const portfoliosResult = await pool.query(`
      SELECT 
        p.*,
        COUNT(a.id) as asset_count,
        COALESCE(SUM(a.quantity * COALESCE(a.current_price, a.purchase_price)), 0) as total_value,
        COALESCE(SUM(a.quantity * a.purchase_price), 0) as total_invested
      FROM portfolios p
      LEFT JOIN assets a ON p.id = a.portfolio_id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [id]);

    // Get user activity
    const activityResult = await pool.query(`
      SELECT action, details, created_at
      FROM user_activity
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [id]);

    res.json({
      user,
      portfolios: portfoliosResult.rows.map(portfolio => ({
        ...portfolio,
        total_value: parseFloat(portfolio.total_value),
        total_invested: parseFloat(portfolio.total_invested),
        asset_count: parseInt(portfolio.asset_count)
      })),
      recent_activity: activityResult.rows
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role
router.put('/users/:id/role', [
  body('role').isIn(['user', 'admin'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { role } = req.body;

    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log role change
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'change_user_role', { target_user_id: id, new_role: role }]
    );

    res.json({
      message: 'User role updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userEmail = userResult.rows[0].email;

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Delete user (cascade will delete portfolios and assets)
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    // Log user deletion
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'delete_user', { deleted_user_email: userEmail }]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all portfolios (admin view)
router.get('/portfolios', async (req, res) => {
  try {
    const { page = 1, limit = 20, userId = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        p.*,
        u.email as user_email,
        u.first_name,
        u.last_name,
        COUNT(a.id) as asset_count,
        COALESCE(SUM(a.quantity * COALESCE(a.current_price, a.purchase_price)), 0) as total_value,
        COALESCE(SUM(a.quantity * a.purchase_price), 0) as total_invested
      FROM portfolios p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN assets a ON p.id = a.portfolio_id
    `;

    const queryParams = [];
    let paramCount = 1;

    if (userId) {
      query += ` WHERE p.user_id = $${paramCount}`;
      queryParams.push(userId);
      paramCount++;
    }

    query += ` GROUP BY p.id, u.email, u.first_name, u.last_name ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM portfolios p';
    if (userId) {
      countQuery += ' WHERE p.user_id = $1';
    }
    const countResult = await pool.query(countQuery, userId ? [userId] : []);

    res.json({
      portfolios: result.rows.map(portfolio => ({
        ...portfolio,
        total_value: parseFloat(portfolio.total_value),
        total_invested: parseFloat(portfolio.total_invested),
        asset_count: parseInt(portfolio.asset_count)
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Get portfolios error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    // Get user count
    const userCountResult = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(userCountResult.rows[0].count);

    // Get portfolio count
    const portfolioCountResult = await pool.query('SELECT COUNT(*) FROM portfolios');
    const portfolioCount = parseInt(portfolioCountResult.rows[0].count);

    // Get asset count
    const assetCountResult = await pool.query('SELECT COUNT(*) FROM assets');
    const assetCount = parseInt(assetCountResult.rows[0].count);

    // Get total value
    const totalValueResult = await pool.query(`
      SELECT COALESCE(SUM(quantity * COALESCE(current_price, purchase_price)), 0) as total_value
      FROM assets
    `);
    const totalValue = parseFloat(totalValueResult.rows[0].total_value);

    // Get recent activity
    const recentActivityResult = await pool.query(`
      SELECT 
        ua.action,
        ua.details,
        ua.created_at,
        u.email as user_email
      FROM user_activity ua
      JOIN users u ON ua.user_id = u.id
      ORDER BY ua.created_at DESC
      LIMIT 10
    `);

    res.json({
      stats: {
        user_count: userCount,
        portfolio_count: portfolioCount,
        asset_count: assetCount,
        total_value: totalValue
      },
      recent_activity: recentActivityResult.rows
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;