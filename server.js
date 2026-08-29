// ═══════════════════════════════════════════════════════════════
// FoodFlow — Enterprise Node.js Express & MySQL REST API Server
// Production-Ready Backend Architecture (Version 2.0.0)
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Standard Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      const statusColor = res.statusCode >= 400 ? '❌' : '✓';
      console.log(`[API] ${statusColor} ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Serve static frontend files directly from the current directory
app.use(express.static(__dirname));

// MySQL Database Connection Pool Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword123',
  database: process.env.DB_NAME || 'foodflow_db',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: true
};

let pool = null;
let isDbConnected = false;
let lastDbError = null;

// Initialize Database Pool & Self-Healing Migration Check
async function initDbPool() {
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    isDbConnected = true;
    lastDbError = null;
    console.log(`[MySQL] ✓ Connected successfully to MySQL Database "${dbConfig.database}" on ${dbConfig.host}:${dbConfig.port}`);
    conn.release();

    // Verify if database tables exist; if not, attempt auto-migration from schema.sql
    await checkAndAutoMigrateSchema();
  } catch (err) {
    isDbConnected = false;
    lastDbError = err.message;
    console.warn(`[MySQL] ⚠️ Could not connect to MySQL: ${err.message}`);
    console.warn(`[MySQL] 👉 Please ensure MySQL Server is running on port ${dbConfig.port} and your password in .env is correct.`);
  }
}

// Auto-migration helper if schema has not been executed yet
async function checkAndAutoMigrateSchema() {
  if (!pool) return;
  try {
    const [tables] = await pool.query('SHOW TABLES');
    if (tables.length === 0) {
      console.log('[MySQL] 📦 Database is empty. Auto-executing schema.sql to create 16 tables, views, and seed data...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log('[MySQL] ✓ Auto-migration complete: 16 tables, views & seed data initialized successfully!');
      }
    }
  } catch (err) {
    console.warn('[MySQL] Auto-migration check note:', err.message);
  }
}

initDbPool();

// Helper middleware to verify DB connection
async function checkDbConnection(req, res, next) {
  if (!pool || !isDbConnected) {
    return res.status(503).json({
      success: false,
      error: 'Database is currently offline or pool not initialized.',
      dbStatus: 'offline',
      details: lastDbError,
      help: 'Ensure MySQL Server is running on port 3306 and execute schema.sql in MySQL Workbench.'
    });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════
// 1. HEALTH, SYSTEM DIAGNOSTICS & SETUP APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/health', async (req, res) => {
  try {
    if (!pool) throw new Error('Database pool not created');
    const start = Date.now();
    await pool.query('SELECT 1 AS ok');
    const latency = Date.now() - start;

    // Fetch counts across tables
    const [[usersCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [[restCount]] = await pool.query('SELECT COUNT(*) AS count FROM restaurants');
    const [[menuCount]] = await pool.query('SELECT COUNT(*) AS count FROM menu_items');
    const [[ordersCount]] = await pool.query('SELECT COUNT(*) AS count FROM orders');
    const [[txnCount]] = await pool.query('SELECT COUNT(*) AS count FROM payment_transactions');
    const [[refundCount]] = await pool.query('SELECT COUNT(*) AS count FROM refunds');

    isDbConnected = true;
    lastDbError = null;

    res.json({
      status: 'UP',
      database: 'MySQL 8.0 (foodflow_db)',
      connected: true,
      latencyMs: latency,
      stats: {
        users: usersCount.count,
        restaurants: restCount.count,
        menuItems: menuCount.count,
        orders: ordersCount.count,
        transactions: txnCount.count,
        refunds: refundCount.count
      },
      poolConfig: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        connectionLimit: dbConfig.connectionLimit
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    isDbConnected = false;
    lastDbError = err.message;
    res.status(200).json({
      status: 'DEGRADED',
      database: 'MySQL (Disconnected)',
      connected: false,
      error: err.message,
      help: 'Launch MySQL Workbench → Open schema.sql → Click Execute (⚡) to create all 16 tables.',
      timestamp: new Date().toISOString()
    });
  }
});

// Force Re-Run Schema Seed Data
app.post('/api/admin/reset-demo', checkDbConnection, async (req, res) => {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      return res.status(404).json({ success: false, error: 'schema.sql file not found on server' });
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    res.json({ success: true, message: 'MySQL database reset to initial demo state with all 16 tables and seeds!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2. AUTHENTICATION & PASSWORD RECOVERY APIS
// ═══════════════════════════════════════════════════════════════

// Register User
app.post('/api/auth/register', checkDbConnection, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role } = req.body;

    if (!email || !firstName || !phone) {
      return res.status(400).json({ success: false, error: 'First Name, Email, and Phone Number are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    // Duplicate Check
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ?', [cleanEmail, cleanPhone]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'An account with this email or mobile number already exists.' });
    }

    // Generate Sequential ID
    const [[countRow]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const newId = 'U00' + (countRow.count + 1);
    const fullName = `${firstName.trim()} ${(lastName || '').trim()}`.trim();
    const initials = ((firstName[0] || '') + ((lastName && lastName[0]) || 'U')).toUpperCase();

    const insertSql = `
      INSERT INTO users (id, name, first_name, last_name, email, password, phone, role, status, orders_count, total_spent, joined_date, initials)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0.00, DATE_FORMAT(NOW(), '%b %Y'), ?)
    `;

    await pool.query(insertSql, [
      newId,
      fullName,
      firstName.trim(),
      (lastName || '').trim(),
      cleanEmail,
      password || 'Password@123',
      cleanPhone,
      role || 'Customer',
      initials
    ]);

    const [[newUser]] = await pool.query('SELECT id, name, first_name, last_name, email, phone, role, status, orders_count, total_spent, joined_date, initials FROM users WHERE id = ?', [newId]);

    // Audit Log
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `User registered: ${newUser.name} (${newUser.email}) [${newUser.role}]`]);

    res.status(201).json({ success: true, user: newUser, message: 'Account registered successfully in MySQL!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login User
app.post('/api/auth/login', checkDbConnection, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address or mobile number is required.' });
    }

    const clean = email.toLowerCase().trim();
    const cleanDigits = email.replace(/\D/g, '');

    let query = 'SELECT * FROM users WHERE email = ?';
    let params = [clean];

    if (cleanDigits.length >= 10) {
      query += ' OR phone LIKE ?';
      params.push(`%${cleanDigits.slice(-10)}%`);
    }

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No registered account found with these credentials.' });
    }

    const user = rows[0];

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'This account has been suspended. Please contact support.' });
    }

    if (password && user.password && user.password !== password) {
      return res.status(401).json({ success: false, error: 'Incorrect password. Please verify and try again.' });
    }

    delete user.password;

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `User logged in: ${user.email} (${user.name})`]);

    res.json({ success: true, user: user, message: 'Login successful!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Current User Session
app.get('/api/auth/me', checkDbConnection, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ success: false, error: 'Email query parameter required.' });

    const [rows] = await pool.query('SELECT id, name, first_name, last_name, email, phone, role, status, orders_count, total_spent, joined_date, initials FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Profile
app.put('/api/auth/profile', checkDbConnection, async (req, res) => {
  try {
    const { email, id, name, phone, firstName, lastName, initials } = req.body;
    if (!email && !id) return res.status(400).json({ success: false, error: 'Email or User ID is required.' });

    const cleanEmail = (email || '').toLowerCase().trim();
    const fullName = (name || '').trim();
    const parts = fullName.split(' ');
    const fName = firstName || parts[0] || fullName;
    const lName = lastName !== undefined ? lastName : (parts.slice(1).join(' ') || '');
    const userInitials = initials || (((fName[0] || 'U') + (lName ? lName[0] : '')).toUpperCase());

    const updateSql = `
      UPDATE users 
      SET name = ?, 
          first_name = ?, 
          last_name = ?, 
          phone = IFNULL(?, phone), 
          initials = ? 
      WHERE email = ? OR id = ?
    `;

    await pool.query(updateSql, [
      fullName,
      fName,
      lName,
      phone ? phone.trim() : null,
      userInitials,
      cleanEmail,
      id || cleanEmail
    ]);

    const [[updated]] = await pool.query('SELECT id, name, first_name, last_name, email, phone, role, status, orders_count, total_spent, joined_date, initials FROM users WHERE email = ? OR id = ?', [cleanEmail, id || cleanEmail]);

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [
      'INFO',
      `User profile updated in MySQL: "${fullName}" (${cleanEmail})`
    ]);

    res.json({ success: true, user: updated, message: 'Profile updated in MySQL!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Change Password
app.put('/api/auth/change-password', checkDbConnection, async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ success: false, error: 'Email and new password are required.' });

    const [rows] = await pool.query('SELECT password FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });

    if (oldPassword && rows[0].password !== oldPassword) {
      return res.status(401).json({ success: false, error: 'Incorrect current password.' });
    }

    await pool.query('UPDATE users SET password = ? WHERE email = ?', [newPassword, email.toLowerCase().trim()]);
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Password changed by user: ${email}`]);

    res.json({ success: true, message: 'Password changed successfully in MySQL!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Forgot Password - Generate & Send 6-Digit OTP
app.post('/api/auth/forgot-password/request', checkDbConnection, async (req, res) => {
  try {
    const { identifier, email } = req.body;
    const searchTarget = (identifier || email || '').trim();
    if (!searchTarget) return res.status(400).json({ success: false, error: 'Email or mobile number is required.' });

    const clean = searchTarget.toLowerCase();
    const cleanDigits = searchTarget.replace(/\D/g, '');

    let query = 'SELECT id, name, email, phone, status FROM users WHERE email = ?';
    let params = [clean];

    if (cleanDigits.length >= 10) {
      query += ' OR phone LIKE ?';
      params.push(`%${cleanDigits.slice(-10)}%`);
    }

    const [users] = await pool.query(query, params);

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'No registered account found with this email or mobile number.' });
    }

    const user = users[0];
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'This account is suspended. Password recovery is unavailable.' });
    }

    // Generate random 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Mask destination for security
    const isPhoneSearch = cleanDigits.length >= 10 && !clean.includes('@');
    const maskedDest = isPhoneSearch
      ? `+91 ${user.phone.slice(-10, -4)}****${user.phone.slice(-2)}`
      : `${user.email.slice(0, 3)}****@${user.email.split('@')[1]}`;

    // Invalidate prior OTPs
    await pool.query('UPDATE password_resets SET used = TRUE WHERE email = ?', [user.email]);

    // Insert new OTP record
    await pool.query('INSERT INTO password_resets (email, identifier, otp_code, expires_at, used) VALUES (?, ?, ?, ?, FALSE)', [
      user.email,
      searchTarget,
      otp,
      expiresAt
    ]);

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Password reset OTP generated for ${user.email}: ${otp}`]);

    res.json({
      success: true,
      email: user.email,
      phone: user.phone,
      maskedDest: maskedDest,
      isPhone: isPhoneSearch,
      otp: otp, // Returned for instant demo auto-fill push banner
      message: `Verification code sent to ${maskedDest}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify 6-Digit OTP
app.post('/api/auth/forgot-password/verify', checkDbConnection, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ valid: false, error: 'Email and OTP are required.' });

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    const [records] = await pool.query(
      'SELECT * FROM password_resets WHERE email = ? AND used = FALSE ORDER BY id DESC LIMIT 1',
      [cleanEmail]
    );

    if (records.length === 0) {
      return res.status(400).json({ valid: false, error: 'No active OTP found. Please request a new code.' });
    }

    const record = records[0];
    if (Date.now() > Number(record.expires_at)) {
      return res.status(400).json({ valid: false, error: 'OTP has expired (10-minute limit). Please request a new code.' });
    }

    if (record.otp_code !== cleanOtp) {
      return res.status(400).json({ valid: false, error: 'Incorrect 6-digit OTP code. Please check and re-enter.' });
    }

    res.json({ valid: true, message: 'OTP verified successfully!' });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// Reset Password with Verified OTP
app.post('/api/auth/forgot-password/reset', checkDbConnection, async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ success: false, error: 'Email and new password are required.' });

    const cleanEmail = email.toLowerCase().trim();
    await pool.query('UPDATE users SET password = ? WHERE email = ?', [newPassword, cleanEmail]);
    await pool.query('UPDATE password_resets SET used = TRUE WHERE email = ?', [cleanEmail]);

    // Return the updated user for instant automatic login
    const [[user]] = await pool.query('SELECT id, name, first_name, last_name, email, phone, role, status, orders_count, total_spent, joined_date, initials FROM users WHERE email = ?', [cleanEmail]);

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Password securely reset in MySQL for: ${cleanEmail}`]);

    res.json({ success: true, user: user, message: 'Password reset successfully in MySQL! Auto-logged in.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 3. USERS MANAGEMENT APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/users', checkDbConnection, async (req, res) => {
  try {
    const { role, search, status } = req.query;
    let query = 'SELECT id, name, first_name, last_name, email, phone, role, status, orders_count, total_spent, joined_date, initials, created_at FROM users WHERE 1=1';
    let params = [];

    if (role && role !== 'All' && role !== 'All Roles') {
      query += ' AND role = ?';
      params.push(role);
    }
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/users/:id/status', checkDbConnection, async (req, res) => {
  try {
    const userId = req.params.id;
    const [users] = await pool.query('SELECT status, name, email FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ success: false, error: 'User not found' });

    const newStatus = users[0].status === 'active' ? 'suspended' : 'active';
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['WARN', `Admin changed user #${userId} (${users[0].name}) status to ${newStatus.toUpperCase()}`]);

    res.json({ success: true, userId, status: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 4. RESTAURANTS & CUISINES APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/restaurants', checkDbConnection, async (req, res) => {
  try {
    const { cuisine, search, sort } = req.query;
    let query = 'SELECT * FROM restaurants WHERE 1=1';
    let params = [];

    if (cuisine && cuisine !== 'All') {
      query += ' AND cuisine = ?';
      params.push(cuisine);
    }
    if (search) {
      query += ' AND (name LIKE ? OR cuisine LIKE ? OR description LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    if (sort === 'rating') query += ' ORDER BY rating DESC';
    else if (sort === 'delivery_time') query += ' ORDER BY delivery_time ASC';
    else query += ' ORDER BY rating DESC, orders_count DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/restaurants/:id', checkDbConnection, async (req, res) => {
  try {
    const restId = req.params.id;
    const [rows] = await pool.query('SELECT * FROM restaurants WHERE id = ?', [restId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Restaurant not found' });

    const [menu] = await pool.query('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY id ASC', [restId]);
    const [reviews] = await pool.query('SELECT * FROM reviews_ratings WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 10', [restId]);

    res.json({
      success: true,
      data: {
        ...rows[0],
        menu: menu.map((m) => ({
          ...m,
          is_veg: Boolean(m.is_veg),
          is_bestseller: Boolean(m.is_bestseller),
          available: Boolean(m.available),
          price: Number(m.price)
        })),
        reviews
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/restaurants', checkDbConnection, async (req, res) => {
  try {
    const { name, image_url, emoji, cuisine, delivery_time, delivery_fee, location, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Restaurant name is required.' });

    const insertSql = `
      INSERT INTO restaurants (name, image_url, emoji, cuisine, rating, delivery_time, delivery_fee, location, description, orders_count, revenue, status)
      VALUES (?, ?, ?, ?, 4.50, ?, ?, ?, ?, 0, 0.00, 'active')
    `;

    const [result] = await pool.query(insertSql, [
      name.trim(),
      image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
      emoji || '🏪',
      cuisine || 'Multi-Cuisine',
      delivery_time || '25–35 mins',
      delivery_fee || 30.00,
      location || 'Hyderabad',
      description || ''
    ]);

    const [[newRest]] = await pool.query('SELECT * FROM restaurants WHERE id = ?', [result.insertId]);
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `New restaurant added: ${newRest.name} (ID: ${newRest.id})`]);

    res.status(201).json({ success: true, data: newRest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/restaurants/:id/status', checkDbConnection, async (req, res) => {
  try {
    const restId = req.params.id;
    const [rows] = await pool.query('SELECT status, name FROM restaurants WHERE id = ?', [restId]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Restaurant not found' });

    const newStatus = rows[0].status === 'active' ? 'inactive' : 'active';
    await pool.query('UPDATE restaurants SET status = ? WHERE id = ?', [newStatus, restId]);

    res.json({ success: true, id: restId, status: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. MENU ITEMS MANAGEMENT APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/menu', checkDbConnection, async (req, res) => {
  try {
    const { restaurantId, category, is_veg, search } = req.query;
    let query = 'SELECT m.*, r.name AS restaurant_name FROM menu_items m JOIN restaurants r ON m.restaurant_id = r.id WHERE 1=1';
    let params = [];

    if (restaurantId && restaurantId !== 'all') {
      query += ' AND m.restaurant_id = ?';
      params.push(restaurantId);
    }
    if (category) {
      query += ' AND m.category = ?';
      params.push(category);
    }
    if (is_veg === 'true') {
      query += ' AND m.is_veg = TRUE';
    }
    if (search) {
      query += ' AND (m.name LIKE ? OR m.description LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s);
    }
    query += ' ORDER BY m.id ASC';

    const [rows] = await pool.query(query, params);
    const formatted = rows.map((item) => ({
      ...item,
      is_veg: Boolean(item.is_veg),
      is_bestseller: Boolean(item.is_bestseller),
      available: Boolean(item.available),
      price: Number(item.price)
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/menu', checkDbConnection, async (req, res) => {
  try {
    const { restaurant_id, category, name, description, price, image_url, emoji, is_veg, is_bestseller } = req.body;
    if (!restaurant_id || !name || !price) {
      return res.status(400).json({ success: false, error: 'Restaurant ID, Item Name and Price are required.' });
    }

    const insertSql = `
      INSERT INTO menu_items (restaurant_id, category, name, description, price, image_url, emoji, is_veg, is_bestseller, rating, available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 4.50, TRUE)
    `;

    const [result] = await pool.query(insertSql, [
      restaurant_id,
      category || 'Main Course',
      name.trim(),
      description || '',
      price,
      image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
      emoji || '🍽️',
      Boolean(is_veg),
      Boolean(is_bestseller)
    ]);

    const [[newItem]] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: newItem });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/menu/:id/availability', checkDbConnection, async (req, res) => {
  try {
    const itemId = req.params.id;
    const { available } = req.body;
    await pool.query('UPDATE menu_items SET available = ? WHERE id = ?', [Boolean(available), itemId]);
    res.json({ success: true, id: itemId, available: Boolean(available) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/menu/:id', checkDbConnection, async (req, res) => {
  try {
    const itemId = req.params.id;
    await pool.query('DELETE FROM menu_items WHERE id = ?', [itemId]);
    res.json({ success: true, id: itemId, message: 'Item deleted from MySQL' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6. PROMO COUPONS & DISCOUNT ENGINE
// ═══════════════════════════════════════════════════════════════

app.get('/api/promos', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM promo_coupons WHERE is_active = TRUE ORDER BY discount_percent DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/promos/validate/:code', checkDbConnection, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const orderTotal = Number(req.query.orderTotal || 0);

    const [rows] = await pool.query('SELECT * FROM promo_coupons WHERE UPPER(code) = ? AND is_active = TRUE', [code]);
    if (rows.length === 0) {
      return res.json({ valid: false, message: `Coupon code "${code}" is invalid or expired.` });
    }

    const promo = rows[0];
    if (orderTotal < Number(promo.min_order_amount)) {
      return res.json({
        valid: false,
        message: `Minimum order amount of ₹${promo.min_order_amount} required to apply ${promo.code}`
      });
    }

    const rawDiscount = (orderTotal * Number(promo.discount_percent)) / 100;
    const discountAmount = Math.min(rawDiscount, Number(promo.max_discount));

    res.json({
      valid: true,
      code: promo.code,
      discountPercent: promo.discount_percent,
      discountAmount: Math.round(discountAmount),
      message: `🎉 Promo ${promo.code} applied! Saved ₹${Math.round(discountAmount)}.`
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});
app.post('/api/promos', checkDbConnection, async (req, res) => {
  try {
    const { code, discount, discount_percent, maxDiscount, max_discount, minOrder, min_order_amount, description } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Promo code is required.' });

    const cleanCode = code.trim().toUpperCase();
    const pct = discount_percent || discount || 20;
    const maxD = max_discount || maxDiscount || 150.00;
    const minO = min_order_amount || minOrder || 199.00;

    await pool.query(`
      INSERT INTO promo_coupons (code, discount_percent, max_discount, min_order_amount, description, is_active)
      VALUES (?, ?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE 
        discount_percent = VALUES(discount_percent),
        max_discount = VALUES(max_discount),
        min_order_amount = VALUES(min_order_amount),
        description = VALUES(description),
        is_active = TRUE
    `, [cleanCode, pct, maxD, minO, description || 'Special discount coupon']);

    const [[newPromo]] = await pool.query('SELECT * FROM promo_coupons WHERE code = ?', [cleanCode]);
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Promo coupon created/updated: ${cleanCode}`]);

    res.status(201).json({ success: true, data: newPromo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/promos/:code', checkDbConnection, async (req, res) => {
  try {
    const cleanCode = req.params.code.trim().toUpperCase();
    await pool.query('UPDATE promo_coupons SET is_active = FALSE WHERE UPPER(code) = ?', [cleanCode]);
    res.json({ success: true, message: `Promo ${cleanCode} deactivated` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 7. ORDERS & TRANSACTIONS (ACID TRANSACTION MANAGER)
// ═══════════════════════════════════════════════════════════════

app.get('/api/orders', checkDbConnection, async (req, res) => {
  try {
    const { email, status, restaurantId, search } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    let params = [];

    if (email) {
      query += ' AND email = ?';
      params.push(email.toLowerCase().trim());
    }
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (restaurantId && restaurantId !== 'all') {
      query += ' AND restaurant_id = ?';
      params.push(restaurantId);
    }
    if (search) {
      query += ' AND (id LIKE ? OR customer_name LIKE ? OR restaurant_name LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/orders/:id', checkDbConnection, async (req, res) => {
  try {
    const rawId = req.params.id.replace(/^#/, '').trim();
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ? OR id = ?', [rawId, '#' + rawId]);
    if (orders.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });

    const order = orders[0];
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const [timeline] = await pool.query('SELECT * FROM order_tracking_history WHERE order_id = ? ORDER BY created_at ASC', [order.id]);
    const [payments] = await pool.query('SELECT * FROM payment_transactions WHERE order_id = ?', [order.id]);
    const [refunds] = await pool.query('SELECT * FROM refunds WHERE order_id = ?', [order.id]);

    res.json({
      success: true,
      data: {
        ...order,
        items,
        timeline,
        paymentDetails: payments[0] || null,
        refundDetails: refunds[0] || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Atomic Order Placement ACID Transaction
app.post('/api/orders', checkDbConnection, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const orderData = req.body;
    const orderId = orderData.id || `FF${Math.floor(1000 + Math.random() * 9000).toString(36).toUpperCase()}${Math.floor(1000 + Math.random() * 9000).toString(36).toUpperCase()}`;
    const txnId = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;

    const itemsSummary = (orderData.items || []).map((i) => `${i.name} ×${i.qty}`).join(', ') || orderData.itemsSummary || 'Delicious Meal';

    const orderInsertSql = `
      INSERT INTO orders (id, user_id, customer_name, email, phone, delivery_address, restaurant_id, restaurant_name, subtotal, discount, delivery_fee, platform_fee, tax, total, promo_code, payment_method, payment_status, status, kitchen_note, items_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', 'pending', ?, ?)
    `;

    await conn.query(orderInsertSql, [
      orderId,
      orderData.userId || null,
      orderData.customer || orderData.customerName || 'Customer',
      (orderData.email || 'customer@example.com').toLowerCase().trim(),
      orderData.phone || '+91 98765 43210',
      orderData.deliveryAddress || orderData.address || 'Address',
      orderData.restaurantId || 1,
      orderData.restaurant || orderData.restaurantName || 'Spice Garden',
      orderData.subtotal || orderData.total || 0,
      orderData.discount || 0,
      orderData.deliveryFee || 30.00,
      orderData.platformFee || 5.00,
      orderData.tax || 0,
      orderData.total || 0,
      orderData.promoCode || null,
      orderData.paymentMethod || 'UPI (Google Pay)',
      orderData.kitchenNote || null,
      itemsSummary
    ]);

    // Insert order items
    if (orderData.items && orderData.items.length > 0) {
      const itemSql = 'INSERT INTO order_items (order_id, menu_item_id, item_name, price, qty, item_total) VALUES ?';
      const itemValues = orderData.items.map((i) => [
        orderId,
        i.id || i.menu_item_id || 101,
        i.name,
        i.price,
        i.qty,
        (i.price * i.qty)
      ]);
      await conn.query(itemSql, [itemValues]);
    }

    // Insert Initial Timeline Step
    await conn.query(`
      INSERT INTO order_tracking_history (order_id, status, status_title, status_description, actor)
      VALUES (?, 'pending', 'Order Received', 'Your order has been confirmed and received by the kitchen', 'System')
    `, [orderId]);

    // Insert Payment Transaction Record
    await conn.query(`
      INSERT INTO payment_transactions (id, order_id, customer_name, customer_email, amount, method, status, gateway_ref)
      VALUES (?, ?, ?, ?, ?, ?, 'success', ?)
    `, [
      txnId,
      orderId,
      orderData.customer || 'Customer',
      (orderData.email || '').toLowerCase().trim(),
      orderData.total || 0,
      orderData.paymentMethod || 'UPI',
      `GATEWAY-${Math.floor(10000000 + Math.random() * 90000000)}`
    ]);

    // Record Coupon Usage if coupon was applied
    if (orderData.promoCode) {
      await conn.query(`
        INSERT INTO coupon_usage_history (coupon_code, user_email, order_id, discount_applied)
        VALUES (?, ?, ?, ?)
      `, [orderData.promoCode, (orderData.email || '').toLowerCase().trim(), orderId, orderData.discount || 0]);

      await conn.query('UPDATE promo_coupons SET total_uses = total_uses + 1 WHERE code = ?', [orderData.promoCode]);
    }

    // Update Customer Lifetime Stats
    if (orderData.email) {
      await conn.query('UPDATE users SET orders_count = orders_count + 1, total_spent = total_spent + ? WHERE email = ?', [
        orderData.total || 0,
        orderData.email.toLowerCase().trim()
      ]);
    }

    // Update Restaurant Revenue
    if (orderData.restaurantId) {
      await conn.query('UPDATE restaurants SET orders_count = orders_count + 1, revenue = revenue + ? WHERE id = ?', [
        orderData.total || 0,
        orderData.restaurantId
      ]);
    }

    // Audit Log
    await conn.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [
      'INFO',
      `Order placed #${orderId} by ${orderData.customer} (${orderData.paymentMethod} - ₹${orderData.total})`
    ]);

    await conn.commit();

    const [[createdOrder]] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.status(201).json({ success: true, order: createdOrder, message: 'Order created & payment confirmed in MySQL!' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// Update Order Status
app.put('/api/orders/:id/status', checkDbConnection, async (req, res) => {
  try {
    const rawId = req.params.id.replace(/^#/, '').trim();
    const { status, note, actor } = req.body;
    const cleanStatus = (status || 'pending').toLowerCase().trim();

    const statusDescriptions = {
      pending: { title: 'Order Confirmed', desc: 'Order received and confirmed by restaurant' },
      preparing: { title: 'Preparing Food', desc: 'Chef is preparing your fresh meal with authentic spices' },
      'on-the-way': { title: 'Out for Delivery', desc: 'Delivery valet is on the way to your doorstep' },
      delivered: { title: 'Order Delivered', desc: 'Order delivered successfully. Enjoy your meal!' },
      cancelled: { title: 'Order Cancelled', desc: note || 'Order has been cancelled' }
    };

    const info = statusDescriptions[cleanStatus] || { title: cleanStatus, desc: note || 'Status update' };

    await pool.query(`
      UPDATE orders 
      SET status = ?, 
          kitchen_note = IFNULL(?, kitchen_note),
          payment_status = IF(? = 'delivered' AND payment_status = 'pending', 'success', payment_status)
      WHERE id = ? OR id = ?
    `, [cleanStatus, note || null, cleanStatus, rawId, '#' + rawId]);

    // Append to Timeline History
    await pool.query(`
      INSERT INTO order_tracking_history (order_id, status, status_title, status_description, actor)
      VALUES (?, ?, ?, ?, ?)
    `, [rawId, cleanStatus, info.title, info.desc, actor || 'Restaurant']);

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [
      'INFO',
      `Order #${rawId} status transitioned to "${cleanStatus.toUpperCase()}"`
    ]);

    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ? OR id = ?', [rawId, '#' + rawId]);
    res.json({ success: true, order: rows[0] || null, message: `Status updated to ${cleanStatus} in MySQL` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Order Cancellation & Instant Prepaid Refund Engine
app.post('/api/orders/:id/cancel', checkDbConnection, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const rawId = req.params.id.replace(/^#/, '').trim();
    const { reason, cancelledBy, refundStatus, refundAmount, refundRef } = req.body;

    const [orders] = await conn.query('SELECT * FROM orders WHERE id = ? OR id = ?', [rawId, '#' + rawId]);
    if (orders.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = orders[0];
    const isPrepaid = order.payment_method !== 'Cash on Delivery';
    const computedRefundAmount = refundAmount || order.total;
    const finalRefundRef = refundRef || `REF-${Math.floor(100000 + Math.random() * 900000)}`;

    const effectiveRefundStatus = isPrepaid ? (refundStatus || 'refunded') : 'none';

    // Update order status & refund fields
    await conn.query(`
      UPDATE orders 
      SET status = 'cancelled', 
          cancel_reason = ?, 
          cancelled_by = ?,
          refund_status = ?, 
          refund_amount = ?, 
          refund_ref = ?, 
          refund_time = IF(? = 'refunded', NOW(), NULL),
          payment_status = IF(? = 'refunded', 'refunded', payment_status)
      WHERE id = ?
    `, [
      reason || 'Customer requested cancellation',
      cancelledBy || 'Customer',
      effectiveRefundStatus,
      isPrepaid ? computedRefundAmount : 0.00,
      isPrepaid ? finalRefundRef : null,
      effectiveRefundStatus,
      effectiveRefundStatus,
      order.id
    ]);

    // Append to Timeline History
    await conn.query(`
      INSERT INTO order_tracking_history (order_id, status, status_title, status_description, actor)
      VALUES (?, 'cancelled', 'Order Cancelled', ?, ?)
    `, [
      order.id,
      `Cancelled by ${cancelledBy || 'Customer'}. Reason: "${reason}". ${isPrepaid ? `100% refund of ₹${computedRefundAmount} issued.` : 'Cash on Delivery order.'}`,
      cancelledBy || 'Customer'
    ]);

    // If Prepaid, Record in Dedicated Refunds Table & Payment Transactions Ledger
    if (isPrepaid && effectiveRefundStatus === 'refunded') {
      // Insert to refunds table
      await conn.query(`
        INSERT INTO refunds (id, order_id, customer_name, customer_email, amount, original_payment_method, refund_status, reason, processed_by, gateway_refund_id)
        VALUES (?, ?, ?, ?, ?, ?, 'processed', ?, ?, ?)
      `, [
        finalRefundRef,
        order.id,
        order.customer_name,
        order.email,
        computedRefundAmount,
        order.payment_method,
        reason || 'Order cancelled',
        cancelledBy || 'System',
        `GW-${finalRefundRef}`
      ]);

      // Insert reversal into payment_transactions ledger
      await conn.query(`
        INSERT INTO payment_transactions (id, order_id, customer_name, customer_email, amount, method, status, refund_ref, notes)
        VALUES (?, ?, ?, ?, ?, ?, 'refunded', ?, ?)
      `, [
        `TXN-REF-${Math.floor(100000 + Math.random() * 900000)}`,
        order.id,
        order.customer_name,
        order.email,
        computedRefundAmount,
        `${order.payment_method} (Refund)`,
        finalRefundRef,
        `Refund for cancelled order #${order.id}. Reason: ${reason}`
      ]);
    }

    // Audit Log
    await conn.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [
      'WARN',
      `Order #${order.id} CANCELLED by ${cancelledBy || 'User'}. Reason: "${reason}". Refund Status: ${effectiveRefundStatus} (₹${isPrepaid ? computedRefundAmount : 0})`
    ]);

    await conn.commit();

    const [[updatedOrder]] = await pool.query('SELECT * FROM orders WHERE id = ?', [order.id]);
    res.json({
      success: true,
      order: updatedOrder,
      refundRef: isPrepaid ? finalRefundRef : null,
      message: `Order #${order.id} cancelled. ${isPrepaid ? `100% refund of ₹${computedRefundAmount} processed!` : 'No payment deduction to refund.'}`
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 8. PAYMENTS & REFUNDS LEDGER APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/payments', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payment_transactions ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/refunds', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM refunds ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 9. REVIEWS & RATINGS APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/reviews/restaurant/:restaurantId', checkDbConnection, async (req, res) => {
  try {
    const restId = req.params.restaurantId;
    const [rows] = await pool.query('SELECT * FROM reviews_ratings WHERE restaurant_id = ? ORDER BY created_at DESC', [restId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/reviews', checkDbConnection, async (req, res) => {
  try {
    const { order_id, restaurant_id, user_email, customer_name, food_rating, delivery_rating, comment } = req.body;
    if (!order_id || !restaurant_id || !food_rating) {
      return res.status(400).json({ success: false, error: 'Order ID, Restaurant ID and Rating are required.' });
    }

    await pool.query(`
      INSERT INTO reviews_ratings (order_id, restaurant_id, user_email, customer_name, food_rating, delivery_rating, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      order_id,
      restaurant_id,
      (user_email || '').toLowerCase().trim(),
      customer_name || 'Customer',
      food_rating,
      delivery_rating || 5,
      comment || ''
    ]);

    res.status(201).json({ success: true, message: 'Review submitted and restaurant rating updated in MySQL!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 10. SAVED ADDRESSES APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/addresses', checkDbConnection, async (req, res) => {
  try {
    const userEmail = req.query.email;
    if (!userEmail) return res.status(400).json({ success: false, error: 'Email parameter is required.' });

    const [rows] = await pool.query('SELECT * FROM user_addresses WHERE user_email = ? ORDER BY is_default DESC, created_at DESC', [userEmail.toLowerCase().trim()]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/addresses', checkDbConnection, async (req, res) => {
  try {
    const { userEmail, label, recipient_name, recipient_phone, addressText, city, pincode, is_default } = req.body;
    if (!userEmail || !addressText) {
      return res.status(400).json({ success: false, error: 'User email and street address are required.' });
    }

    if (is_default) {
      await pool.query('UPDATE user_addresses SET is_default = FALSE WHERE user_email = ?', [userEmail.toLowerCase().trim()]);
    }

    await pool.query(`
      INSERT INTO user_addresses (user_email, label, recipient_name, recipient_phone, address_text, city, pincode, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userEmail.toLowerCase().trim(),
      label || 'Home',
      recipient_name || 'Customer',
      recipient_phone || '+91 98765 43210',
      addressText,
      city || 'Hyderabad',
      pincode || '500081',
      Boolean(is_default)
    ]);

    res.status(201).json({ success: true, message: 'Address saved to MySQL!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/addresses/:id', checkDbConnection, async (req, res) => {
  try {
    const addrId = req.params.id;
    await pool.query('DELETE FROM user_addresses WHERE id = ?', [addrId]);
    res.json({ success: true, message: 'Address removed from MySQL' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Platform Settings APIs
app.get('/api/settings', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM platform_settings');
    const settings = {};
    rows.forEach((r) => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/settings', checkDbConnection, async (req, res) => {
  try {
    const settings = req.body;
    for (const [key, val] of Object.entries(settings)) {
      await pool.query(`
        INSERT INTO platform_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `, [key, String(val)]);
    }
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', 'Platform global settings updated in MySQL']);
    res.json({ success: true, message: 'Platform settings saved in MySQL!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 11. ADMIN ANALYTICS & CSV EXPORT APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/admin/analytics/dashboard', checkDbConnection, async (req, res) => {
  try {
    const [[todayOrders]] = await pool.query('SELECT COUNT(*) AS count, IFNULL(SUM(total), 0) AS revenue FROM orders WHERE DATE(created_at) = CURDATE() AND status != "cancelled"');
    const [[allOrders]] = await pool.query('SELECT COUNT(*) AS count, IFNULL(SUM(total), 0) AS revenue FROM orders WHERE status != "cancelled"');
    const [[pendingOrders]] = await pool.query('SELECT COUNT(*) AS count FROM orders WHERE status IN ("pending", "preparing")');
    const [[activeUsers]] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE status = "active"');
    const [cuisineShare] = await pool.query('SELECT cuisine, COUNT(*) AS count, SUM(revenue) AS revenue FROM restaurants GROUP BY cuisine');

    res.json({
      success: true,
      stats: {
        totalOrdersToday: todayOrders.count || 0,
        revenueToday: todayOrders.revenue || 0,
        totalOrdersAllTime: allOrders.count || 0,
        totalRevenueAllTime: allOrders.revenue || 0,
        pendingOrdersCount: pendingOrders.count || 0,
        activeUsersCount: activeUsers.count || 0,
        cuisineBreakdown: cuisineShare
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/export/orders.csv', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    const headers = ['Order ID', 'Customer Name', 'Email', 'Phone', 'Restaurant', 'Subtotal', 'Discount', 'Delivery Fee', 'Total', 'Payment Method', 'Status', 'Cancel Reason', 'Refund Status', 'Refund Amount', 'Date'];
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach((o) => {
      const row = [
        `"${o.id}"`,
        `"${o.customer_name}"`,
        `"${o.email}"`,
        `"${o.phone}"`,
        `"${o.restaurant_name}"`,
        o.subtotal,
        o.discount,
        o.delivery_fee,
        o.total,
        `"${o.payment_method}"`,
        `"${o.status}"`,
        `"${o.cancel_reason || ''}"`,
        `"${o.refund_status}"`,
        o.refund_amount,
        `"${new Date(o.created_at).toISOString()}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="foodflow_orders_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 12. SYSTEM AUDIT LOGS APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/logs', checkDbConnection, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM system_audit_logs ORDER BY id DESC LIMIT 50');
    const formatted = rows.map((r) => ({
      id: r.id,
      level: r.level,
      text: r.text,
      time: new Date(r.created_at).toLocaleTimeString()
    }));
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/logs', checkDbConnection, async (req, res) => {
  try {
    const { level, text } = req.body;
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [level || 'INFO', text || 'System event']);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback Route to serve index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server with Auto-Fallback on Port Conflict (EADDRINUSE)
function startServer(portToTry) {
  const server = app.listen(portToTry, '0.0.0.0' ,() => {
    console.log(`
  ═══════════════════════════════════════════════════════════════
  🚀 FoodFlow Enterprise MySQL REST API Server Online (${portToTry})
  ═══════════════════════════════════════════════════════════════
  ➜ Web App URL:       http://localhost:${portToTry}
  ➜ Customer Portal:   http://localhost:${portToTry}/customer.html
  ➜ Admin Portal:      http://localhost:${portToTry}/admin.html
  ➜ QA Test Suite:     http://localhost:${portToTry}/test-suite.html
  ➜ MySQL Health API:  http://localhost:${portToTry}/api/health
  ➜ Orders API:        http://localhost:${portToTry}/api/orders
  ➜ Database Config:   MySQL ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}
  ═══════════════════════════════════════════════════════════════
    `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n⚠️  Port ${portToTry} is in use by another background process.`);
      console.warn(`🔄 Automatically switching to fallback port ${portToTry + 1}...\n`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(Number(PORT) || 5000);
