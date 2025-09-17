# Deployment Guide - Investment Portfolio Manager

This guide covers different deployment options for the Investment Portfolio Manager application.

## Prerequisites

- Node.js 16+ installed
- PostgreSQL 12+ installed
- Git installed
- Docker (optional, for containerized deployment)

## Option 1: Local Development Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd investment-portfolio-manager
npm run install-all
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb investment_portfolio

# Or using psql
psql -c "CREATE DATABASE investment_portfolio;"
```

### 3. Environment Configuration
```bash
# Copy environment template
cp server/.env.example server/.env

# Edit server/.env with your settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=investment_portfolio
DB_USER=your_db_user
DB_PASSWORD=your_db_password
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### 4. Start Development Servers
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run server  # Backend on port 5000
npm run client  # Frontend on port 3000
```

### 5. Access Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Default admin: admin@portfolio.com / admin123

## Option 2: Docker Deployment

### 1. Using Docker Compose (Recommended)
```bash
# Clone repository
git clone <repository-url>
cd investment-portfolio-manager

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 2. Individual Docker Containers
```bash
# Build and run database
docker run -d --name portfolio-db \
  -e POSTGRES_DB=investment_portfolio \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 postgres:13-alpine

# Build and run server
cd server
docker build -t portfolio-server .
docker run -d --name portfolio-server \
  --link portfolio-db:db \
  -e DB_HOST=db \
  -e DB_NAME=investment_portfolio \
  -e DB_USER=postgres \
  -e DB_PASSWORD=password \
  -p 5000:5000 portfolio-server

# Build and run client
cd ../client
docker build -t portfolio-client .
docker run -d --name portfolio-client \
  --link portfolio-server:server \
  -p 3000:80 portfolio-client
```

## Option 3: Cloud Deployment

### Frontend Deployment (Vercel)

1. **Prepare for deployment**
   ```bash
   cd client
   npm run build
   ```

2. **Deploy to Vercel**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel --prod
   ```

3. **Configure environment variables**
   - Set `REACT_APP_API_URL` to your backend URL

### Backend Deployment (Railway/Render)

1. **Prepare server**
   ```bash
   cd server
   # Ensure all dependencies are in package.json
   ```

2. **Deploy to Railway**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and deploy
   railway login
   railway init
   railway up
   ```

3. **Configure environment variables**
   - Database connection string
   - JWT secret
   - Client URL

### Database Deployment (Railway/Render/Heroku)

1. **Create PostgreSQL service**
   ```bash
   # Railway
   railway add postgresql
   
   # Render
   # Create PostgreSQL service in dashboard
   
   # Heroku
   heroku addons:create heroku-postgresql:hobby-dev
   ```

2. **Get connection string**
   ```bash
   # Railway
   railway variables
   
   # Heroku
   heroku config:get DATABASE_URL
   ```

## Option 4: VPS Deployment

### 1. Server Setup (Ubuntu/Debian)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx
sudo apt install nginx -y
```

### 2. Application Setup
```bash
# Clone repository
git clone <repository-url>
cd investment-portfolio-manager

# Install dependencies
npm run install-all

# Set up database
sudo -u postgres createdb investment_portfolio
sudo -u postgres createuser portfolio_user
sudo -u postgres psql -c "ALTER USER portfolio_user PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE investment_portfolio TO portfolio_user;"
```

### 3. Environment Configuration
```bash
# Create production environment file
cp server/.env.example server/.env.production

# Edit with production values
DB_HOST=localhost
DB_PORT=5432
DB_NAME=investment_portfolio
DB_USER=portfolio_user
DB_PASSWORD=secure_password
JWT_SECRET=your-super-secret-production-jwt-key
NODE_ENV=production
CLIENT_URL=https://your-domain.com
```

### 4. Build and Start
```bash
# Build client
cd client
npm run build

# Start server with PM2
cd ../server
npm install -g pm2
pm2 start start.js --name portfolio-server
pm2 startup
pm2 save
```

### 5. Nginx Configuration
```nginx
# /etc/nginx/sites-available/portfolio-manager
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/investment-portfolio-manager/client/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/portfolio-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring and Maintenance

### 1. Log Monitoring
```bash
# PM2 logs
pm2 logs portfolio-server

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. Database Backup
```bash
# Create backup script
#!/bin/bash
pg_dump investment_portfolio > backup_$(date +%Y%m%d_%H%M%S).sql

# Schedule with cron
0 2 * * * /path/to/backup-script.sh
```

### 3. Updates
```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm run install-all

# Restart services
pm2 restart portfolio-server
sudo systemctl reload nginx
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running: `sudo systemctl status postgresql`
   - Verify credentials in `.env`
   - Check firewall settings

2. **Port Already in Use**
   - Find process: `sudo lsof -i :5000`
   - Kill process: `sudo kill -9 <PID>`

3. **Build Failures**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version: `node --version`

4. **Permission Issues**
   - Fix uploads directory: `sudo chown -R www-data:www-data uploads/`
   - Check file permissions: `ls -la`

### Performance Optimization

1. **Enable Gzip Compression**
   ```nginx
   gzip on;
   gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
   ```

2. **Database Optimization**
   ```sql
   -- Create indexes for better performance
   CREATE INDEX idx_assets_portfolio_id ON assets(portfolio_id);
   CREATE INDEX idx_asset_prices_symbol_date ON asset_prices(symbol, date);
   ```

3. **Caching**
   ```nginx
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

## Security Checklist

- [ ] Change default admin password
- [ ] Use strong JWT secret
- [ ] Enable HTTPS
- [ ] Configure firewall
- [ ] Regular security updates
- [ ] Database backups
- [ ] Monitor logs for suspicious activity
- [ ] Use environment variables for secrets
- [ ] Implement rate limiting
- [ ] Validate all inputs

## Support

For deployment issues:
1. Check logs for error messages
2. Verify environment variables
3. Test database connectivity
4. Check firewall and port settings
5. Create an issue in the repository