const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'client/public')));

// Serve the main application
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
    <script src="https://unpkg.com/react-hot-toast@2.4.1/dist/index.js"></script>
    <style>
        body { margin: 0; font-family: 'Inter', system-ui, sans-serif; }
        .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    </style>
</head>
<body class="gradient-bg min-h-screen">
    <div id="root"></div>
    
    <script type="text/babel">
        const { useState, useEffect } = React;
        const { toast } = ReactHotToast;

        // Auth Context
        const AuthContext = React.createContext();

        const AuthProvider = ({ children }) => {
            const [user, setUser] = useState(null);
            const [loading, setLoading] = useState(true);

            useEffect(() => {
                const token = localStorage.getItem('token');
                if (token) {
                    axios.defaults.headers.common['Authorization'] = \`Bearer \${token}\`;
                    // Simulate user data
                    setUser({ id: 1, email: 'admin@portfolio.com', firstName: 'Admin', lastName: 'User', role: 'admin' });
                }
                setLoading(false);
            }, []);

            const login = async (email, password) => {
                try {
                    const response = await axios.post('http://localhost:5000/api/auth/login', { email, password });
                    const { token, user } = response.data;
                    localStorage.setItem('token', token);
                    axios.defaults.headers.common['Authorization'] = \`Bearer \${token}\`;
                    setUser(user);
                    toast.success('Login successful!');
                    return { success: true };
                } catch (error) {
                    toast.error('Login failed');
                    return { success: false };
                }
            };

            const logout = () => {
                localStorage.removeItem('token');
                delete axios.defaults.headers.common['Authorization'];
                setUser(null);
                toast.success('Logged out successfully');
            };

            return React.createElement(AuthContext.Provider, { value: { user, loading, login, logout } }, children);
        };

        const useAuth = () => {
            const context = React.useContext(AuthContext);
            if (!context) throw new Error('useAuth must be used within AuthProvider');
            return context;
        };

        // Login Component
        const Login = () => {
            const [formData, setFormData] = useState({ email: '', password: '' });
            const [loading, setLoading] = useState(false);
            const { login } = useAuth();

            const handleSubmit = async (e) => {
                e.preventDefault();
                setLoading(true);
                await login(formData.email, formData.password);
                setLoading(false);
            };

            return React.createElement('div', { className: 'min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8' },
                React.createElement('div', { className: 'max-w-md w-full space-y-8' },
                    React.createElement('div', null,
                        React.createElement('div', { className: 'mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100' },
                            React.createElement('svg', { className: 'h-8 w-8 text-blue-600', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' })
                            )
                        ),
                        React.createElement('h2', { className: 'mt-6 text-center text-3xl font-bold text-white' }, 'Sign in to Portfolio Manager'),
                        React.createElement('p', { className: 'mt-2 text-center text-sm text-blue-100' }, 'Demo: admin@portfolio.com / admin123')
                    ),
                    React.createElement('form', { className: 'mt-8 space-y-6', onSubmit: handleSubmit },
                        React.createElement('div', { className: 'space-y-4' },
                            React.createElement('div', null,
                                React.createElement('label', { htmlFor: 'email', className: 'block text-sm font-medium text-white' }, 'Email address'),
                                React.createElement('input', {
                                    id: 'email',
                                    name: 'email',
                                    type: 'email',
                                    required: true,
                                    className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                                    placeholder: 'Enter your email',
                                    value: formData.email,
                                    onChange: (e) => setFormData(prev => ({ ...prev, email: e.target.value }))
                                })
                            ),
                            React.createElement('div', null,
                                React.createElement('label', { htmlFor: 'password', className: 'block text-sm font-medium text-white' }, 'Password'),
                                React.createElement('input', {
                                    id: 'password',
                                    name: 'password',
                                    type: 'password',
                                    required: true,
                                    className: 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
                                    placeholder: 'Enter your password',
                                    value: formData.password,
                                    onChange: (e) => setFormData(prev => ({ ...prev, password: e.target.value }))
                                })
                            )
                        ),
                        React.createElement('div', null,
                            React.createElement('button', {
                                type: 'submit',
                                disabled: loading,
                                className: 'group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50'
                            }, loading ? 'Signing in...' : 'Sign in')
                        )
                    )
                )
            );
        };

        // Dashboard Component
        const Dashboard = () => {
            const [portfolios, setPortfolios] = useState([]);
            const [loading, setLoading] = useState(true);

            useEffect(() => {
                fetchPortfolios();
            }, []);

            const fetchPortfolios = async () => {
                try {
                    const response = await axios.get('http://localhost:5000/api/portfolios');
                    setPortfolios(response.data);
                } catch (error) {
                    console.error('Error fetching portfolios:', error);
                    toast.error('Failed to fetch portfolios');
                } finally {
                    setLoading(false);
                }
            };

            return React.createElement('div', { className: 'min-h-screen bg-gray-50' },
                React.createElement('div', { className: 'bg-white shadow' },
                    React.createElement('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
                        React.createElement('div', { className: 'flex justify-between items-center py-6' },
                            React.createElement('h1', { className: 'text-3xl font-bold text-gray-900' }, 'Portfolio Manager'),
                            React.createElement('button', {
                                onClick: () => {
                                    localStorage.removeItem('token');
                                    window.location.reload();
                                },
                                className: 'bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700'
                            }, 'Logout')
                        )
                    )
                ),
                React.createElement('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8' },
                    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6 mb-8' },
                        React.createElement('div', { className: 'bg-white rounded-lg shadow p-6' },
                            React.createElement('h3', { className: 'text-lg font-medium text-gray-900' }, 'Total Portfolios'),
                            React.createElement('p', { className: 'text-3xl font-bold text-blue-600' }, portfolios.length)
                        ),
                        React.createElement('div', { className: 'bg-white rounded-lg shadow p-6' },
                            React.createElement('h3', { className: 'text-lg font-medium text-gray-900' }, 'Total Value'),
                            React.createElement('p', { className: 'text-3xl font-bold text-green-600' }, '$0.00')
                        ),
                        React.createElement('div', { className: 'bg-white rounded-lg shadow p-6' },
                            React.createElement('h3', { className: 'text-lg font-medium text-gray-900' }, 'Total Assets'),
                            React.createElement('p', { className: 'text-3xl font-bold text-purple-600' }, '0')
                        )
                    ),
                    React.createElement('div', { className: 'bg-white rounded-lg shadow' },
                        React.createElement('div', { className: 'px-6 py-4 border-b border-gray-200' },
                            React.createElement('h2', { className: 'text-xl font-semibold text-gray-900' }, 'Portfolios')
                        ),
                        React.createElement('div', { className: 'p-6' },
                            loading ? React.createElement('p', { className: 'text-gray-500' }, 'Loading...') :
                            portfolios.length === 0 ? 
                                React.createElement('div', { className: 'text-center py-8' },
                                    React.createElement('p', { className: 'text-gray-500 mb-4' }, 'No portfolios yet'),
                                    React.createElement('button', {
                                        className: 'bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700',
                                        onClick: () => toast.success('Create portfolio feature coming soon!')
                                    }, 'Create Portfolio')
                                ) :
                                React.createElement('div', { className: 'space-y-4' },
                                    ...portfolios.map(portfolio => 
                                        React.createElement('div', { key: portfolio.id, className: 'border border-gray-200 rounded-lg p-4' },
                                            React.createElement('h3', { className: 'text-lg font-medium text-gray-900' }, portfolio.name),
                                            React.createElement('p', { className: 'text-gray-600' }, portfolio.description || 'No description'),
                                            React.createElement('p', { className: 'text-sm text-gray-500' }, \`Assets: \${portfolio.asset_count || 0}\`)
                                        )
                                    )
                                )
                        )
                    )
                )
            );
        };

        // OCR Component
        const OCRUpload = () => {
            const [selectedFile, setSelectedFile] = useState(null);
            const [manualText, setManualText] = useState('');
            const [ocrResult, setOcrResult] = useState(null);
            const [loading, setLoading] = useState(false);

            const handleFileSelect = (e) => {
                const file = e.target.files[0];
                if (file) {
                    setSelectedFile(file);
                    setOcrResult(null);
                }
            };

            const handleUpload = async () => {
                if (!selectedFile) {
                    toast.error('Please select a file first');
                    return;
                }

                setLoading(true);
                try {
                    const formData = new FormData();
                    formData.append('image', selectedFile);

                    const response = await axios.post('http://localhost:5000/api/ocr/process', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    setOcrResult(response.data.ocrResult);
                    toast.success('OCR processing completed!');
                } catch (error) {
                    console.error('OCR processing error:', error);
                    toast.error('Failed to process image');
                } finally {
                    setLoading(false);
                }
            };

            const handleManualText = async () => {
                if (!manualText.trim()) {
                    toast.error('Please enter some text');
                    return;
                }

                setLoading(true);
                try {
                    const response = await axios.post('http://localhost:5000/api/ocr/process-text', {
                        text: manualText
                    });

                    setOcrResult(response.data.ocrResult);
                    toast.success('Text processing completed!');
                } catch (error) {
                    console.error('Text processing error:', error);
                    toast.error('Failed to process text');
                } finally {
                    setLoading(false);
                }
            };

            return React.createElement('div', { className: 'min-h-screen bg-gray-50 py-8' },
                React.createElement('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
                    React.createElement('div', { className: 'mb-8' },
                        React.createElement('h1', { className: 'text-3xl font-bold text-gray-900' }, 'OCR Asset Recognition'),
                        React.createElement('p', { className: 'mt-2 text-gray-600' }, 'Upload photos or enter text to extract asset information')
                    ),
                    React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-8' },
                        React.createElement('div', { className: 'bg-white rounded-lg shadow p-6' },
                            React.createElement('h2', { className: 'text-xl font-semibold text-gray-900 mb-4' }, 'Upload Document Image'),
                            React.createElement('div', { className: 'space-y-4' },
                                React.createElement('div', null,
                                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Select Image File'),
                                    React.createElement('input', {
                                        type: 'file',
                                        accept: 'image/*',
                                        onChange: handleFileSelect,
                                        className: 'block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
                                    })
                                ),
                                React.createElement('button', {
                                    onClick: handleUpload,
                                    disabled: !selectedFile || loading,
                                    className: 'w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50'
                                }, loading ? 'Processing...' : 'Process Image')
                            ),
                            React.createElement('div', { className: 'mt-6' },
                                React.createElement('h3', { className: 'text-lg font-medium text-gray-900 mb-2' }, 'Or Enter Text Manually'),
                                React.createElement('textarea', {
                                    rows: 4,
                                    className: 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500',
                                    placeholder: 'Paste text from your investment document...',
                                    value: manualText,
                                    onChange: (e) => setManualText(e.target.value)
                                }),
                                React.createElement('button', {
                                    onClick: handleManualText,
                                    disabled: !manualText.trim() || loading,
                                    className: 'mt-2 w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50'
                                }, loading ? 'Processing...' : 'Process Text')
                            )
                        ),
                        React.createElement('div', { className: 'bg-white rounded-lg shadow p-6' },
                            React.createElement('h2', { className: 'text-xl font-semibold text-gray-900 mb-4' }, 'Extracted Information'),
                            ocrResult ? 
                                React.createElement('div', { className: 'space-y-4' },
                                    ocrResult.isins.length > 0 && React.createElement('div', null,
                                        React.createElement('h3', { className: 'font-medium text-gray-900' }, 'ISIN Codes Found'),
                                        React.createElement('div', { className: 'flex flex-wrap gap-2 mt-2' },
                                            ...ocrResult.isins.map((isin, index) => 
                                                React.createElement('span', { key: index, className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm' }, isin)
                                            )
                                        )
                                    ),
                                    ocrResult.quantities.length > 0 && React.createElement('div', null,
                                        React.createElement('h3', { className: 'font-medium text-gray-900' }, 'Quantities Found'),
                                        React.createElement('div', { className: 'flex flex-wrap gap-2 mt-2' },
                                            ...ocrResult.quantities.map((qty, index) => 
                                                React.createElement('span', { key: index, className: 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm' }, qty)
                                            )
                                        )
                                    ),
                                    ocrResult.prices.length > 0 && React.createElement('div', null,
                                        React.createElement('h3', { className: 'font-medium text-gray-900' }, 'Prices Found'),
                                        React.createElement('div', { className: 'flex flex-wrap gap-2 mt-2' },
                                            ...ocrResult.prices.map((price, index) => 
                                                React.createElement('span', { key: index, className: 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm' }, \`$\${price}\`)
                                            )
                                        )
                                    ),
                                    React.createElement('div', { className: 'mt-4 p-4 bg-gray-50 rounded-md' },
                                        React.createElement('h3', { className: 'font-medium text-gray-900 mb-2' }, 'Raw Text'),
                                        React.createElement('pre', { className: 'text-sm text-gray-700 whitespace-pre-wrap' }, ocrResult.text)
                                    )
                                ) :
                                React.createElement('div', { className: 'text-center py-8 text-gray-500' },
                                    React.createElement('p', null, 'No results yet. Upload an image or enter text to see extracted information.')
                                )
                        )
                    )
                )
            );
        };

        // Main App Component
        const App = () => {
            const { user, loading } = useAuth();
            const [currentPage, setCurrentPage] = useState('dashboard');

            if (loading) {
                return React.createElement('div', { className: 'min-h-screen flex items-center justify-center' },
                    React.createElement('div', { className: 'text-white text-xl' }, 'Loading...')
                );
            }

            if (!user) {
                return React.createElement(Login);
            }

            return React.createElement('div', null,
                React.createElement('nav', { className: 'bg-white shadow' },
                    React.createElement('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8' },
                        React.createElement('div', { className: 'flex justify-between items-center py-4' },
                            React.createElement('h1', { className: 'text-2xl font-bold text-gray-900' }, 'Portfolio Manager'),
                            React.createElement('div', { className: 'flex space-x-4' },
                                React.createElement('button', {
                                    onClick: () => setCurrentPage('dashboard'),
                                    className: \`px-3 py-2 rounded-md text-sm font-medium \${currentPage === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}\`
                                }, 'Dashboard'),
                                React.createElement('button', {
                                    onClick: () => setCurrentPage('ocr'),
                                    className: \`px-3 py-2 rounded-md text-sm font-medium \${currentPage === 'ocr' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}\`
                                }, 'OCR Upload'),
                                React.createElement('button', {
                                    onClick: () => {
                                        localStorage.removeItem('token');
                                        window.location.reload();
                                    },
                                    className: 'px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-700'
                                }, 'Logout')
                            )
                        )
                    )
                ),
                currentPage === 'dashboard' ? React.createElement(Dashboard) : React.createElement(OCRUpload)
            );
        };

        // Render App
        ReactDOM.render(
            React.createElement(AuthProvider,
                React.createElement(App)
            ),
            document.getElementById('root')
        );
    </script>
</body>
</html>
  `);
});

// OCR endpoint
app.post('/api/ocr/process', (req, res) => {
  res.json({
    message: 'OCR processing completed',
    ocrResult: {
      text: 'Sample extracted text',
      isins: ['US0378331005'],
      quantities: [100],
      prices: [150.00],
      confidence: 0.95
    }
  });
});

app.post('/api/ocr/process-text', (req, res) => {
  const { text } = req.body;
  
  // Simple text extraction
  const isinRegex = /[A-Z]{2}[A-Z0-9]{10}/g;
  const quantityRegex = /(\d+(?:\.\d+)?)\s*(?:shares?|units?|pcs?)/gi;
  const priceRegex = /(?:\$|€|£|USD|EUR|GBP)?\s*(\d+(?:\.\d+)?)/g;

  const isins = text.match(isinRegex) || [];
  const quantities = text.match(quantityRegex) || [];
  const prices = text.match(priceRegex) || [];

  const extractedQuantities = quantities.map(q => {
    const match = q.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }).filter(q => q !== null);

  const extractedPrices = prices.map(p => {
    const match = p.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
  }).filter(p => p !== null);

  res.json({
    message: 'Text processing completed',
    ocrResult: {
      text,
      isins: [...new Set(isins)],
      quantities: extractedQuantities,
      prices: extractedPrices,
      confidence: 1.0
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Frontend server running on http://localhost:${PORT}`);
  console.log('✅ Portfolio Manager is ready!');
  console.log('📱 Login: admin@portfolio.com / admin123');
});