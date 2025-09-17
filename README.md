# Investment Portfolio Manager

A professional investment portfolio management application built with React, Node.js, and PostgreSQL.

## Features

- **User Management**: Secure authentication with JWT tokens
- **Portfolio Management**: Create, edit, and delete investment portfolios
- **Asset Tracking**: Add and manage individual assets with real-time pricing
- **OCR Integration**: Extract asset information from document photos using Tesseract.js
- **Financial Data**: Real-time stock prices and historical data via Yahoo Finance API
- **Interactive Charts**: Visualize portfolio performance with Chart.js
- **Admin Panel**: Comprehensive admin interface for user and portfolio management
- **Responsive Design**: Professional UI that works on all devices

## Tech Stack

### Frontend
- React 18
- Tailwind CSS
- Chart.js / React-ChartJS-2
- Axios
- React Router DOM
- React Hot Toast

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT Authentication
- Bcrypt
- Multer (file uploads)
- Tesseract.js (OCR)
- Axios (API calls)

## Quick Start

### Prerequisites
- Node.js 16+ 
- PostgreSQL 12+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd investment-portfolio-manager
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb investment_portfolio
   
   # Update server/.env with your database credentials
   cp server/.env.example server/.env
   ```

4. **Configure environment variables**
   ```bash
   # Edit server/.env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=investment_portfolio
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   JWT_SECRET=your-super-secret-jwt-key
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000

### Default Admin Account
- Email: admin@portfolio.com
- Password: admin123

## Project Structure

```
investment-portfolio-manager/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   └── App.js         # Main app component
│   ├── package.json
│   └── tailwind.config.js
├── server/                 # Node.js backend
│   ├── config/            # Database configuration
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── index.js          # Server entry point
│   └── package.json
├── package.json           # Root package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Portfolios
- `GET /api/portfolios` - Get user's portfolios
- `GET /api/portfolios/:id` - Get specific portfolio
- `POST /api/portfolios` - Create new portfolio
- `PUT /api/portfolios/:id` - Update portfolio
- `DELETE /api/portfolios/:id` - Delete portfolio

### Assets
- `GET /api/assets/portfolio/:portfolioId` - Get portfolio assets
- `GET /api/assets/:id` - Get specific asset
- `POST /api/assets` - Create new asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset

### Financial Data
- `GET /api/financial/quote/:symbol` - Get stock quote
- `GET /api/financial/historical/:symbol` - Get historical data
- `POST /api/financial/update-prices/:portfolioId` - Update portfolio prices
- `GET /api/financial/search` - Search for symbols

### OCR
- `POST /api/ocr/process` - Process image with OCR
- `POST /api/ocr/process-text` - Process manual text
- `GET /api/ocr/history` - Get OCR history

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id/role` - Update user role
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/portfolios` - Get all portfolios
- `GET /api/admin/stats` - Get system statistics

## Deployment

### Using Docker

1. **Create Dockerfile**
   ```dockerfile
   # Dockerfile
   FROM node:16-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Create docker-compose.yml**
   ```yaml
   version: '3.8'
   services:
     db:
       image: postgres:13
       environment:
         POSTGRES_DB: investment_portfolio
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: password
       volumes:
         - postgres_data:/var/lib/postgresql/data
       ports:
         - "5432:5432"
   
     server:
       build: ./server
       environment:
         DB_HOST: db
         DB_NAME: investment_portfolio
         DB_USER: postgres
         DB_PASSWORD: password
       depends_on:
         - db
       ports:
         - "5000:5000"
   
     client:
       build: ./client
       ports:
         - "3000:3000"
   
   volumes:
     postgres_data:
   ```

3. **Deploy**
   ```bash
   docker-compose up -d
   ```

### Manual Deployment

#### Frontend (Vercel/Netlify)
1. Build the client: `cd client && npm run build`
2. Deploy the `build` folder to your hosting service
3. Set environment variables for API URL

#### Backend (Railway/Render/Heroku)
1. Set up PostgreSQL database
2. Configure environment variables
3. Deploy the server folder
4. Update client API base URL

## Environment Variables

### Server (.env)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=investment_portfolio
DB_USER=postgres
DB_PASSWORD=password
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
CLIENT_URL=https://your-frontend-url.com
YAHOO_FINANCE_API_KEY=your-api-key
ALPHA_VANTAGE_API_KEY=your-api-key
TESSERACT_LANG=eng
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support, email support@portfolio-manager.com or create an issue in the repository.