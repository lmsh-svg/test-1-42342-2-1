# Secure Private Marketplace - Deployment Guide

## 🚀 Overview

This is a secure, privacy-first private marketplace built with Next.js 15, designed for maximum OPSEC security. Users cannot create their own accounts - only administrators can provision access.

## 🔑 Admin Credentials

**Default Admin Account:**
- Email: `admin@marketplace.local`
- Password: `SecureAdmin123!`

⚠️ **IMPORTANT**: Change these credentials in `src/lib/auth.ts` before deploying to production!

## 📦 Features

- **Admin Dashboard**: Order management, tracking numbers, user management, support tickets
- **Marketplace**: Amazon-like shopping experience for provisioned users
- **Security**: Hardcoded admin credentials, protected routes, session-based authentication
- **Order Tracking**: Complete shipping tracking system
- **Support System**: Built-in ticket system for customer support
- **Database**: Turso (SQLite) for privacy and portability

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+ or Bun
- Git

### Step 1: Install Dependencies

```bash
npm install
# or
bun install
```

### Step 2: Initialize Database

The database is already configured with Turso. The schema will be automatically created on first run.

### Step 3: Initialize Admin User

Start the development server and visit the init endpoint:

```bash
npm run dev
# or
bun dev
```

Then visit: `http://localhost:3000/api/auth/init`

This will create the admin user with the default credentials.

### Step 4: Login

Navigate to `http://localhost:3000` and you'll be redirected to the login page.

Login with:
- Email: `admin@marketplace.local`
- Password: `SecureAdmin123!`

## 🗂️ Project Structure

```
src/
├── app/
│   ├── admin/              # Admin dashboard pages
│   │   ├── page.tsx        # Main dashboard with stats
│   │   ├── orders/         # Order management
│   │   ├── users/          # User management
│   │   └── tickets/        # Support tickets
│   ├── marketplace/        # Customer marketplace
│   │   ├── page.tsx        # Product catalog
│   │   ├── cart/           # Shopping cart
│   │   ├── orders/         # Customer orders
│   │   └── support/        # Customer support tickets
│   ├── login/              # Login page
│   └── api/                # API routes
│       ├── auth/           # Authentication APIs
│       ├── orders/         # Order APIs
│       ├── products/       # Product APIs
│       ├── users/          # User APIs
│       ├── tracking-info/  # Tracking APIs
│       └── support-tickets/# Support APIs
├── components/             # Reusable UI components
├── db/                     # Database schema & seeds
├── hooks/                  # Custom React hooks
└── lib/                    # Utility functions
```

## 👥 User Management (Admin Only)

### Creating New Users

1. Login as admin
2. Navigate to Admin Dashboard → User Management
3. Click "Create User"
4. Fill in:
   - Email
   - Full Name
   - Password (provide this to the user securely)
   - Role (leave as "customer" for regular users)
5. User can now login with provided credentials

## 📦 Product Management

Products are currently managed through the database. You can:
1. Add products via the API: `POST /api/products`
2. Or use the seeded sample products in `src/db/seeds/products.ts`

Sample product structure:
```json
{
  "name": "Product Name",
  "description": "Product description",
  "price": 99.99,
  "category": "Electronics",
  "stockQuantity": 50,
  "isAvailable": true,
  "imageUrl": "https://example.com/image.jpg"
}
```

## 📊 Admin Features

### Order Management
- View all orders with status
- Update order status (pending → processing → shipped → delivered)
- Add/edit tracking numbers
- View customer shipping addresses

### Tracking Management
- Add tracking numbers to orders
- Specify carrier (UPS, FedEx, USPS, etc.)
- Set estimated delivery dates
- Update tracking status
- Add tracking notes

### User Management
- Create new user accounts
- Activate/deactivate users
- Delete users
- View user details and join dates

### Support Tickets
- View all customer support tickets
- Reply to tickets
- Close/reopen tickets
- Priority management

## 🔒 Security Features

1. **No Self-Registration**: Only admins can create accounts
2. **Session-Based Auth**: Secure token-based sessions
3. **Protected Routes**: Middleware guards all sensitive pages
4. **Role-Based Access**: Admin vs Customer permissions
5. **Password Hashing**: bcrypt with salt rounds
6. **OPSEC Ready**: Designed for Onion site deployment

## 🌐 Production Deployment

### Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Manual Deployment

1. Build the application:
```bash
npm run build
```

2. Start production server:
```bash
npm start
```

### Environment Variables

The `.env` file is already configured with Turso database credentials. For production:

1. Create new Turso database: https://turso.tech
2. Update `.env` with production credentials:
```env
TURSO_DATABASE_URL=your_production_url
TURSO_AUTH_TOKEN=your_production_token
```

## 🧅 Tor Onion Site Deployment

For maximum privacy and OPSEC:

### Step 1: Setup Tor Hidden Service

1. Install Tor on your server
2. Configure `torrc`:
```
HiddenServiceDir /var/lib/tor/marketplace/
HiddenServicePort 80 127.0.0.1:3000
```

3. Restart Tor:
```bash
sudo systemctl restart tor
```

4. Get your onion address:
```bash
sudo cat /var/lib/tor/marketplace/hostname
```

### Step 2: Run Application

```bash
npm run build
npm start
```

Your marketplace is now accessible via `.onion` address!

### Additional Onion Site Recommendations

- Use a VPS with no logging policy
- Enable HTTPS even on onion (Let's Encrypt)
- Implement rate limiting
- Add CAPTCHA for login attempts
- Regular security audits

## 🧪 Testing

### Initialize Test Data

1. Products are auto-seeded on first database connection
2. Create test orders by:
   - Login as customer
   - Add products to cart
   - Complete checkout

### Test Accounts

After initializing, create test customer accounts via Admin Dashboard → Users.

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/init` - Initialize admin user

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `GET /api/order-items` - List order items

### Tracking
- `GET /api/tracking-info` - Get tracking info
- `POST /api/tracking-info` - Add tracking
- `PUT /api/tracking-info/:id` - Update tracking

### Support
- `GET /api/support-tickets` - List tickets
- `POST /api/support-tickets` - Create ticket
- `PUT /api/support-tickets/:id` - Update ticket
- `GET /api/ticket-messages` - Get messages
- `POST /api/ticket-messages` - Send message

### Users
- `GET /api/users` - List users (admin)
- `POST /api/users` - Create user (admin)
- `PUT /api/users/:id` - Update user (admin)
- `DELETE /api/users/:id` - Delete user (admin)

## 🔧 Troubleshooting

### Admin can't login
- Visit `/api/auth/init` to reinitialize admin user
- Check credentials in `src/lib/auth.ts`

### Database errors
- Check Turso connection in `.env`
- Run: `npx drizzle-kit push` to sync schema

### Products not showing
- Database may not be seeded
- Check `/api/products` returns data
- Add products via admin or API

## 📞 Support

For issues or questions about this marketplace system, create a support ticket within the application or contact the system administrator.

## 🎯 Next Steps

1. ✅ Change default admin credentials
2. ✅ Create customer accounts
3. ✅ Add/update products
4. ✅ Test complete order flow
5. ✅ Setup Tor hidden service (optional)
6. ✅ Deploy to production

---

**Built with security and privacy in mind. Stay safe! 🔒**