import { sqliteTable, integer, text, real, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('customer'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  hasLocalAccess: integer('has_local_access', { mode: 'boolean' }).default(false),
  storeName: text('store_name'),
  storeLogo: text('store_logo'),
  storeMarkup: real('store_markup').default(0),
  totalSpent: real('total_spent').default(0),
  cashbackBalance: real('cashback_balance').default(0),
  subUsersEnabled: integer('sub_users_enabled', { mode: 'boolean' }).default(false),
  credits: real('credits').default(0),
  lastCancelledDepositAt: text('last_cancelled_deposit_at'),
  createdAt: text('created_at').notNull(),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull(),
  imageUrl: text('image_url'),
  category: text('category'),
  mainCategory: text('main_category').notNull(),
  subCategory: text('sub_category'),
  brand: text('brand'),
  volume: text('volume'),
  stockQuantity: integer('stock_quantity').default(0),
  isAvailable: integer('is_available', { mode: 'boolean' }).default(true),
  sourceType: text('source_type'),
  sourceId: text('source_id'),
  apiConfigId: integer('api_config_id'),
  isLocalOnly: integer('is_local_only', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'),
  totalAmount: real('total_amount').notNull(),
  shippingAddress: text('shipping_address'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  priceAtPurchase: real('price_at_purchase').notNull(),
  createdAt: text('created_at').notNull(),
});

export const trackingInfo = sqliteTable('tracking_info', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().unique().references(() => orders.id),
  trackingNumber: text('tracking_number'),
  carrier: text('carrier'),
  status: text('status'),
  estimatedDelivery: text('estimated_delivery'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const supportTickets = sqliteTable('support_tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  orderId: integer('order_id').references(() => orders.id),
  subject: text('subject').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('medium'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const ticketMessages = sqliteTable('ticket_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticketId: integer('ticket_id').notNull().references(() => supportTickets.id),
  userId: integer('user_id').notNull().references(() => users.id),
  message: text('message').notNull(),
  createdAt: text('created_at').notNull(),
});

export const productVariants = sqliteTable('product_variants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  variantName: text('variant_name').notNull(),
  variantType: text('variant_type').notNull(),
  stockQuantity: integer('stock_quantity').default(0),
  priceModifier: real('price_modifier').default(0),
  isAvailable: integer('is_available', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
});

export const apiConfigurations = sqliteTable('api_configurations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  sourceType: text('source_type').notNull(),
  sourceUrl: text('source_url'),
  sourceContent: text('source_content'),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  isTestMode: integer('is_test_mode', { mode: 'boolean' }).default(true),
  autoSyncEnabled: integer('auto_sync_enabled', { mode: 'boolean' }).default(false),
  syncIntervalMinutes: integer('sync_interval_minutes'),
  lastSyncedAt: text('last_synced_at'),
  loadImages: integer('load_images', { mode: 'boolean' }).default(true),
  enableDuplicateMerging: integer('enable_duplicate_merging', { mode: 'boolean' }).default(true),
  categoryMappingRules: text('category_mapping_rules'),
  createdAt: text('created_at').notNull(),
});

export const apiLogs = sqliteTable('api_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  configId: integer('config_id').notNull().references(() => apiConfigurations.id),
  action: text('action').notNull(),
  status: text('status').notNull(),
  message: text('message').notNull(),
  details: text('details'),
  productsProcessed: integer('products_processed'),
  productsCreated: integer('products_created'),
  productsUpdated: integer('products_updated'),
  createdAt: text('created_at').notNull(),
});

export const bulkPricingRules = sqliteTable('bulk_pricing_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  minQuantity: integer('min_quantity').notNull(),
  discountType: text('discount_type').notNull(),
  discountValue: real('discount_value').notNull(),
  finalPrice: real('final_price'),
  createdAt: text('created_at').notNull(),
});

export const productImages = sqliteTable('product_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  imageUrl: text('image_url').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  displayOrder: integer('display_order').default(0),
  createdAt: text('created_at').notNull(),
});

export const productReviews = sqliteTable('product_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  productId: integer('product_id').notNull().references(() => products.id),
  orderId: integer('order_id').references(() => orders.id),
  rating: integer('rating').notNull(),
  title: text('title').notNull(),
  comment: text('comment'),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false),
  helpfulCount: integer('helpful_count').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const reviewImages = sqliteTable('review_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reviewId: integer('review_id').notNull().references(() => productReviews.id),
  imageUrl: text('image_url').notNull(),
  createdAt: text('created_at').notNull(),
});

export const userRewardTiers = sqliteTable('user_reward_tiers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique().references(() => users.id),
  tierName: text('tier_name').notNull().default('bronze'),
  totalReviews: integer('total_reviews').default(0),
  totalReviewsWithImages: integer('total_reviews_with_images').default(0),
  rewardPoints: integer('reward_points').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const userPreferences = sqliteTable('user_preferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().unique().references(() => users.id),
  theme: text('theme').notNull().default('light'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const cryptoWalletAddresses = sqliteTable('crypto_wallet_addresses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cryptocurrency: text('cryptocurrency').notNull().unique(),
  address: text('address').notNull(),
  label: text('label'),
  logoUrl: text('logo_url'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const deposits = sqliteTable('deposits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  amount: real('amount').notNull(),
  cryptocurrency: text('cryptocurrency').notNull(),
  walletAddress: text('wallet_address').notNull(),
  status: text('status').notNull().default('pending'),
  transactionHash: text('transaction_hash'),
  transactionId: text('transaction_id'),
  confirmations: integer('confirmations').default(0),
  verifiedAt: text('verified_at'),
  verificationError: text('verification_error'),
  credits: real('credits').notNull(),
  notes: text('notes'),
  agreedToTerms: integer('agreed_to_terms', { mode: 'boolean' }).default(false),
  agreedToTermsAt: text('agreed_to_terms_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const incomingVerifications = sqliteTable('incoming_verifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  txid: text('txid').notNull(),
  currency: text('currency').notNull(),
  matchedAddress: text('matched_address').notNull(),
  amountSats: integer('amount_sats').notNull(),
  amountFloat: real('amount_float').notNull(),
  confirmed: integer('confirmed', { mode: 'boolean' }).default(false).notNull(),
  confirmedAt: text('confirmed_at'),
  credited: integer('credited', { mode: 'boolean' }).default(false).notNull(),
  creditedAt: text('credited_at'),
  firstSeen: text('first_seen').notNull(),
  lastChecked: text('last_checked').notNull(),
  meta: text('meta'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  userId: integer('user_id').references(() => users.id),
  retryCount: integer('retry_count').default(0).notNull(),
  errorMessage: text('error_message'),
}, (table) => ({
  uniqueTxidCurrency: unique('unique_txid_currency').on(table.txid, table.currency),
}));

export const manualCredits = sqliteTable('manual_credits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adminId: integer('admin_id').notNull().references(() => users.id),
  userId: integer('user_id').notNull().references(() => users.id),
  amount: real('amount').notNull(),
  creditType: text('credit_type').notNull(),
  transactionId: text('transaction_id'),
  referenceNumber: text('reference_number'),
  notes: text('notes').notNull(),
  verified: integer('verified', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  uniqueTransactionId: unique('unique_transaction_id').on(table.transactionId),
}));

export const markups = sqliteTable('markups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  targetId: text('target_id'),
  markupType: text('markup_type').notNull(),
  markupValue: real('markup_value').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  priority: integer('priority').default(0),
  startDate: text('start_date'),
  endDate: text('end_date'),
  compoundStrategy: text('compound_strategy').notNull().default('replace'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const markupTiers = sqliteTable('markup_tiers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  markupId: integer('markup_id').notNull().references(() => markups.id),
  minQuantity: integer('min_quantity').notNull(),
  maxQuantity: integer('max_quantity'),
  markupValue: real('markup_value').notNull(),
  createdAt: text('created_at').notNull(),
});