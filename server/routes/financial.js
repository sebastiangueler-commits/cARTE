const express = require('express');
const axios = require('axios');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Yahoo Finance API helper
class YahooFinanceAPI {
  constructor() {
    this.baseURL = 'https://query1.finance.yahoo.com/v8/finance/chart';
  }

  async getQuote(symbol) {
    try {
      const response = await axios.get(`${this.baseURL}/${symbol}`, {
        params: {
          interval: '1d',
          range: '1d'
        }
      });

      const data = response.data.chart.result[0];
      const meta = data.meta;
      const quote = data.indicators.quote[0];

      return {
        symbol: meta.symbol,
        currency: meta.currency,
        regularMarketPrice: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
        marketState: meta.marketState,
        exchange: meta.exchangeName,
        shortName: meta.shortName,
        longName: meta.longName
      };
    } catch (error) {
      console.error('Yahoo Finance API error:', error);
      throw new Error('Failed to fetch quote data');
    }
  }

  async getHistoricalData(symbol, period = '1mo') {
    try {
      const response = await axios.get(`${this.baseURL}/${symbol}`, {
        params: {
          interval: '1d',
          range: period
        }
      });

      const data = response.data.chart.result[0];
      const timestamps = data.timestamp;
      const quotes = data.indicators.quote[0];

      const historicalData = timestamps.map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: quotes.open[index],
        high: quotes.high[index],
        low: quotes.low[index],
        close: quotes.close[index],
        volume: quotes.volume[index]
      }));

      return historicalData.filter(item => item.close !== null);
    } catch (error) {
      console.error('Yahoo Finance historical data error:', error);
      throw new Error('Failed to fetch historical data');
    }
  }
}

const yahooAPI = new YahooFinanceAPI();

// Get current price for a symbol
router.get('/quote/:symbol', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await yahooAPI.getQuote(symbol);
    
    res.json(quote);
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get historical data for a symbol
router.get('/historical/:symbol', authenticateToken, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '1mo' } = req.query;
    
    const historicalData = await yahooAPI.getHistoricalData(symbol, period);
    
    res.json(historicalData);
  } catch (error) {
    console.error('Get historical data error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update all asset prices in a portfolio
router.post('/update-prices/:portfolioId', authenticateToken, async (req, res) => {
  try {
    const { portfolioId } = req.params;

    // Check if portfolio exists and user has access
    const portfolioResult = await pool.query(
      'SELECT user_id FROM portfolios WHERE id = $1',
      [portfolioId]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    const portfolio = portfolioResult.rows[0];
    if (portfolio.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all assets in the portfolio
    const assetsResult = await pool.query(
      'SELECT id, symbol FROM assets WHERE portfolio_id = $1',
      [portfolioId]
    );

    const assets = assetsResult.rows;
    const updateResults = [];

    // Update prices for each asset
    for (const asset of assets) {
      try {
        const quote = await yahooAPI.getQuote(asset.symbol);
        
        await pool.query(
          'UPDATE assets SET current_price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [quote.regularMarketPrice, asset.id]
        );

        // Store price history
        await pool.query(`
          INSERT INTO asset_prices (asset_id, symbol, price, date)
          VALUES ($1, $2, $3, CURRENT_DATE)
          ON CONFLICT (asset_id, date) DO UPDATE SET price = $3
        `, [asset.id, asset.symbol, quote.regularMarketPrice]);

        updateResults.push({
          assetId: asset.id,
          symbol: asset.symbol,
          price: quote.regularMarketPrice,
          success: true
        });
      } catch (error) {
        console.error(`Failed to update price for ${asset.symbol}:`, error);
        updateResults.push({
          assetId: asset.id,
          symbol: asset.symbol,
          error: error.message,
          success: false
        });
      }
    }

    // Log price update
    await pool.query(
      'INSERT INTO user_activity (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'update_prices', { 
        portfolio_id: portfolioId, 
        results: updateResults 
      }]
    );

    res.json({
      message: 'Price update completed',
      results: updateResults
    });
  } catch (error) {
    console.error('Update prices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get price history for an asset
router.get('/price-history/:assetId', authenticateToken, async (req, res) => {
  try {
    const { assetId } = req.params;
    const { days = 30 } = req.query;

    // Check if asset exists and user has access
    const assetResult = await pool.query(`
      SELECT a.*, p.user_id 
      FROM assets a
      JOIN portfolios p ON a.portfolio_id = p.id
      WHERE a.id = $1
    `, [assetId]);

    if (assetResult.rows.length === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const asset = assetResult.rows[0];
    if (asset.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get price history
    const result = await pool.query(`
      SELECT date, price
      FROM asset_prices
      WHERE asset_id = $1
      ORDER BY date DESC
      LIMIT $2
    `, [assetId, parseInt(days)]);

    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Get price history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search for symbols
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    // Use Yahoo Finance search API
    const response = await axios.get('https://query1.finance.yahoo.com/v1/finance/search', {
      params: { q }
    });

    const results = response.data.quotes.map(quote => ({
      symbol: quote.symbol,
      shortName: quote.shortname,
      longName: quote.longname,
      exchange: quote.exchange,
      type: quote.typeDisp
    }));

    res.json(results);
  } catch (error) {
    console.error('Search symbols error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;