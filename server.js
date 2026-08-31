/**
 * ═══════════════════════════════════════════════════════════════
 * FoodFlow — Enterprise Express REST API Server
 * Fully Synchronized with MySQL Relational Database
 * ═══════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT || '5000', 10);

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// MySQL Database Connection Pool Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'foodflow_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

let pool = null;
let isDbConnected = false;
let lastDbError = null;

async function initDbPool() {
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    isDbConnected = true;
    lastDbError = null;
    console.log(`[MySQL] ✓ Connected successfully to MySQL database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}`);
  } catch (err) {
    isDbConnected = false;
    lastDbError = err.message;
    console.warn(`[MySQL] ⚠️ Connection warning: ${err.message}`);
    console.warn(`[MySQL] 👉 Please ensure MySQL Server is running and "foodflow_db" is created via schema.sql.`);
  }
}

// Database Connection Check Middleware
const checkDbConnection = (req, res, next) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({
      success: false,
      error: 'MySQL Database is not connected.',
      details: lastDbError || 'Please start MySQL Server and check your .env settings.'
    });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════
// 1. HEALTH CHECK & DIAGNOSTICS APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/health', async (req, res) => {
  if (!pool) {
    await initDbPool();
  }
  let dbStatus = 'disconnected';
  let tableCount = 0;
  let errorMsg = lastDbError;

  if (pool) {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      const [rows] = await conn.query('SHOW TABLES');
      conn.release();
      dbStatus = 'connected';
      tableCount = rows.length;
      isDbConnected = true;
      errorMsg = null;
    } catch (err) {
      dbStatus = 'error';
      isDbConnected = false;
      errorMsg = err.message;
    }
  }

  res.json({
    success: true,
    status: 'online',
    serverPort: app.get('port') || DEFAULT_PORT,
    database: {
      status: dbStatus,
      host: dbConfig.host,
      port: dbConfig.port,
      name: dbConfig.database,
      tablesCount: tableCount,
      error: errorMsg
    },
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. AUTHENTICATION & PROFILE APIS
// ═══════════════════════════════════════════════════════════════

// Register User
app.post('/api/auth/register', checkDbConnection, async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role } = req.body;

    if (!email || !firstName || !phone) {
      return res.status(400).json({ success: false, error: 'First Name, Email, and Phone Number are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    const digitsOnly = phone.replace(/\D/g, '');
    const cleanPhoneDigits = digitsOnly.slice(-10);
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhoneDigits)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit Indian mobile number.' });
    }

    // Duplicate Check for Email
    const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingEmail.length > 0) {
      return res.status(409).json({ success: false, error: 'An account with this email address already exists. Please log in.' });
    }

    // Duplicate Check for Phone Number
    const [existingPhone] = await pool.query('SELECT id FROM users WHERE phone LIKE ?', [`%${cleanPhoneDigits}%`]);
    if (existingPhone.length > 0) {
      return res.status(409).json({ success: false, error: 'An account with this mobile number already exists. Please use a different number or log in.' });
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
      cleanPhoneDigits,
      role || 'Customer',
      initials
    ]);

    const [[newUser]] = await pool.query('SELECT id, name, first_name, last_name, email, phone, role, status, orders_count, total_spent, joined_date, initials FROM users WHERE id = ?', [newId]);

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `User registered in MySQL: ${newUser.name} (${newUser.email})`]);

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
      return res.status(404).json({ success: false, error: 'No registered account found with these credentials. Please create an account first.' });
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
    const { email, oldEmail, id, name, phone, firstName, lastName, initials } = req.body;
    if (!email && !id && !oldEmail) return res.status(400).json({ success: false, error: 'Email or User ID is required.' });

    const lookupEmail = (oldEmail || email || '').toLowerCase().trim();
    const newEmail = (email || lookupEmail).toLowerCase().trim();
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
          email = ?,
          phone = IFNULL(?, phone), 
          initials = ? 
      WHERE email = ? OR id = ?
    `;

    await pool.query(updateSql, [
      fullName,
      fName,
      lName,
      newEmail,
      phone ? phone.trim() : null,
      userInitials,
      lookupEmail,
      id || lookupEmail
    ]);

    if (newEmail !== lookupEmail) {
      await pool.query('UPDATE user_addresses SET user_email = ? WHERE user_email = ?', [newEmail, lookupEmail]);
      await pool.query('UPDATE orders SET email = ? WHERE email = ?', [newEmail, lookupEmail]);
    }

    const [[updated]] = await pool.query('SELECT id, name, first_name, last_name, email, phone, role, status, orders_count, total_spent, joined_date, initials FROM users WHERE email = ? OR id = ?', [newEmail, id || newEmail]);

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [
      'INFO',
      `User profile updated in MySQL: "${fullName}" (${newEmail})`
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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      'INSERT INTO password_resets (email, phone, otp_code, expires_at, used) VALUES (?, ?, ?, ?, FALSE)',
      [user.email, user.phone, otp, expiresAt]
    );

    const isPhoneSearch = cleanDigits.length >= 10 && !clean.includes('@');
    const maskedDest = isPhoneSearch
      ? `+91 ${user.phone.slice(-10, -4)}****${user.phone.slice(-2)}`
      : `${user.email.slice(0, 2)}••••@${user.email.split('@')[1]}`;

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Password reset OTP generated for: ${user.email}`]);

    res.json({
      success: true,
      message: `A 6-digit OTP has been dispatched to ${maskedDest}.`,
      destination: maskedDest,
      email: user.email,
      phone: user.phone,
      otp: otp,
      isPhone: isPhoneSearch
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify 6-Digit OTP
app.post('/api/auth/forgot-password/verify', checkDbConnection, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, error: 'Email and OTP code are required.' });

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    const [rows] = await pool.query(
      'SELECT * FROM password_resets WHERE email = ? AND otp_code = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [cleanEmail, cleanOtp]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired 6-digit OTP. Please request a new code.' });
    }

    res.json({ success: true, message: 'OTP verified successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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

    const [[user]] = await pool.query('SELECT id, name, first_name, last_name, email, phone, role, status, orders_count, total_spent, joined_date, initials FROM users WHERE email = ?', [cleanEmail]);

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Password securely reset in MySQL for: ${cleanEmail}`]);

    res.json({ success: true, user: user, message: 'Password reset successfully in MySQL!' });
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
    const [[user]] = await pool.query('SELECT status, name, email FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, userId]);
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['WARN', `User ${user.name} (${user.email}) status set to ${newStatus}`]);

    res.json({ success: true, id: userId, status: newStatus, message: `User status changed to ${newStatus}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 4. RESTAURANTS APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/restaurants', checkDbConnection, async (req, res) => {
  try {
    const { cuisine, search } = req.query;
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
    query += ' ORDER BY rating DESC, id ASC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/restaurants', checkDbConnection, async (req, res) => {
  try {
    const { name, cuisine, deliveryTime, feeValue, image, desc, location } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Restaurant name is required.' });

    const insertSql = `
      INSERT INTO restaurants (name, cuisine, rating, delivery_time, delivery_fee, image_url, tag, description, location, status)
      VALUES (?, ?, 4.50, ?, ?, ?, 'New', ?, ?, 'active')
    `;

    const [result] = await pool.query(insertSql, [
      name.trim(),
      cuisine || 'Multi-Cuisine',
      deliveryTime || '25–35',
      feeValue !== undefined ? Number(feeValue) : 30.00,
      image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
      desc || 'Fresh gourmet dishes prepared to order.',
      location || 'Hyderabad, Telangana'
    ]);

    const [[newRest]] = await pool.query('SELECT * FROM restaurants WHERE id = ?', [result.insertId]);
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Restaurant added to MySQL: "${newRest.name}"`]);

    res.status(201).json({ success: true, data: newRest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/restaurants/:id/status', checkDbConnection, async (req, res) => {
  try {
    const restId = req.params.id;
    const [[rest]] = await pool.query('SELECT status, name FROM restaurants WHERE id = ?', [restId]);
    if (!rest) return res.status(404).json({ success: false, error: 'Restaurant not found' });

    const newStatus = rest.status === 'active' ? 'inactive' : 'active';
    await pool.query('UPDATE restaurants SET status = ? WHERE id = ?', [newStatus, restId]);
    res.json({ success: true, id: restId, status: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. MENU ITEMS APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/menu', checkDbConnection, async (req, res) => {
  try {
    const { restaurant_id, category, is_veg, search } = req.query;
    let query = `
      SELECT m.*, r.name AS restaurant_name 
      FROM menu_items m 
      JOIN restaurants r ON m.restaurant_id = r.id 
      WHERE 1=1
    `;
    let params = [];

    if (restaurant_id && restaurant_id !== 'all') {
      query += ' AND m.restaurant_id = ?';
      params.push(restaurant_id);
    }
    if (category && category !== 'all') {
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
// 6. PROMO COUPONS APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/promos', checkDbConnection, async (req, res) => {
  try {
    const includeInactive = req.query.all === 'true';
    const sql = includeInactive 
      ? 'SELECT * FROM promo_coupons ORDER BY created_at DESC, discount_percent DESC'
      : 'SELECT * FROM promo_coupons WHERE is_active = TRUE ORDER BY discount_percent DESC';
    const [rows] = await pool.query(sql);
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
      message: `Promo ${promo.code} applied! Saved ₹${Math.round(discountAmount)}.`
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

app.post('/api/promos', checkDbConnection, async (req, res) => {
  try {
    const { code, discount, discount_percent, maxDiscount, max_discount, minOrder, min_order_amount, description, desc, active, is_active } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Promo code is required.' });

    const cleanCode = code.trim().toUpperCase();
    const pct = discount_percent || discount || 20;
    const maxD = max_discount || maxDiscount || 150.00;
    const minO = min_order_amount || minOrder || 199.00;
    const isActive = active !== undefined ? Boolean(active) : (is_active !== undefined ? Boolean(is_active) : true);

    await pool.query(`
      INSERT INTO promo_coupons (code, discount_percent, max_discount, min_order_amount, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        discount_percent = VALUES(discount_percent),
        max_discount = VALUES(max_discount),
        min_order_amount = VALUES(min_order_amount),
        description = VALUES(description),
        is_active = VALUES(is_active)
    `, [cleanCode, pct, maxD, minO, description || desc || 'Special discount coupon', isActive]);

    const [[newPromo]] = await pool.query('SELECT * FROM promo_coupons WHERE code = ?', [cleanCode]);
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Promo coupon created/saved: ${cleanCode}`]);

    res.status(201).json({ success: true, data: newPromo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/promos/:code', checkDbConnection, async (req, res) => {
  try {
    const oldCode = req.params.code.toUpperCase().trim();
    const { code, discount, discount_percent, maxDiscount, max_discount, minOrder, min_order_amount, description, desc, active, is_active } = req.body;

    const newCode = (code || oldCode).trim().toUpperCase();
    const pct = discount_percent !== undefined ? discount_percent : (discount !== undefined ? discount : 20);
    const maxD = max_discount !== undefined ? max_discount : (maxDiscount !== undefined ? maxDiscount : 150.00);
    const minO = min_order_amount !== undefined ? min_order_amount : (minOrder !== undefined ? minOrder : 199.00);
    const descText = description || desc || 'Special discount coupon';
    const isActive = active !== undefined ? Boolean(active) : (is_active !== undefined ? Boolean(is_active) : true);

    await pool.query(`
      UPDATE promo_coupons
      SET code = ?,
          discount_percent = ?,
          max_discount = ?,
          min_order_amount = ?,
          description = ?,
          is_active = ?
      WHERE UPPER(code) = ?
    `, [newCode, pct, maxD, minO, descText, isActive, oldCode]);

    const [[updatedPromo]] = await pool.query('SELECT * FROM promo_coupons WHERE UPPER(code) = ?', [newCode]);
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Promo coupon updated: ${newCode}`]);

    res.json({ success: true, data: updatedPromo, message: `Promo coupon ${newCode} updated in MySQL!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/promos/:code/status', checkDbConnection, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const { active, is_active } = req.body;
    const targetStatus = active !== undefined ? Boolean(active) : Boolean(is_active);

    await pool.query('UPDATE promo_coupons SET is_active = ? WHERE UPPER(code) = ?', [targetStatus, code]);
    res.json({ success: true, code, is_active: targetStatus, message: `Promo ${code} is now ${targetStatus ? 'Active' : 'Disabled'}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/promos/:code', checkDbConnection, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    await pool.query('DELETE FROM promo_coupons WHERE UPPER(code) = ?', [code]);
    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', ['INFO', `Promo coupon deleted: ${code}`]);
    res.json({ success: true, code, message: `Promo coupon ${code} deleted from MySQL` });
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
      query += ' AND (id LIKE ? OR customer_name LIKE ? OR phone LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }
    query += ' ORDER BY created_at DESC';

    const [orders] = await pool.query(query, params);

    for (let order of orders) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      order.items = items;
      order.itemsSummary = items.map((i) => `${i.item_name} ×${i.quantity}`).join(', ');
      order.total = Number(order.total);
      order.subtotal = Number(order.subtotal);
      order.discount = Number(order.discount);
      order.delivery_fee = Number(order.delivery_fee);
      order.platform_fee = Number(order.platform_fee);
      order.refund_amount = Number(order.refund_amount);
    }

    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/orders/:id', checkDbConnection, async (req, res) => {
  try {
    const orderId = req.params.id;
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });

    const order = orders[0];
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    const [tracking] = await pool.query('SELECT * FROM order_tracking_history WHERE order_id = ? ORDER BY created_at ASC', [orderId]);

    order.items = items;
    order.tracking = tracking;

    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ACID Atomic Order Placement
app.post('/api/orders', checkDbConnection, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      id,
      customer,
      email,
      phone,
      deliveryAddress,
      restaurantId,
      restaurant,
      items,
      subtotal,
      discount,
      deliveryFee,
      total,
      promoCode,
      paymentMethod,
      kitchenNote
    } = req.body;

    const orderId = id || ('FF' + Math.random().toString(36).substring(2, 8).toUpperCase());
    const isCod = paymentMethod === 'Cash on Delivery';
    const payStatus = isCod ? 'pending' : 'success';

    // Insert Order Master Record
    const insertOrderSql = `
      INSERT INTO orders (id, customer_name, email, phone, delivery_address, restaurant_id, restaurant_name, subtotal, discount, delivery_fee, platform_fee, total, promo_code, payment_method, payment_status, status, refund_status, kitchen_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5.00, ?, ?, ?, ?, 'pending', 'none', ?)
    `;

    await conn.query(insertOrderSql, [
      orderId,
      customer || 'Customer',
      email.toLowerCase().trim(),
      phone || '9876543210',
      deliveryAddress || 'Standard Delivery Address',
      restaurantId || 1,
      restaurant || 'Spice Garden',
      subtotal || total,
      discount || 0.00,
      deliveryFee || 0.00,
      total,
      promoCode || null,
      paymentMethod || 'UPI',
      payStatus,
      kitchenNote || null
    ]);

    // Insert Order Items
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await conn.query(`
          INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, is_veg, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderId,
          item.id || item.menu_item_id || null,
          item.name || 'Delicious Dish',
          item.qty || 1,
          item.price || 0,
          (item.price || 0) * (item.qty || 1),
          Boolean(item.veg !== false),
          item.image || null
        ]);
      }
    }

    // Insert Initial Tracking Step
    await conn.query(`
      INSERT INTO order_tracking_history (order_id, status, status_title, status_description, actor)
      VALUES (?, 'pending', 'Order Confirmed', 'The kitchen has received your order and is reviewing it.', 'Customer')
    `, [orderId]);

    // Insert Payment Transaction Record
    await conn.query(`
      INSERT INTO payment_transactions (id, order_id, customer_name, customer_email, amount, method, status, gateway_txn_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      orderId,
      customer,
      email.toLowerCase().trim(),
      total,
      paymentMethod || 'UPI',
      payStatus,
      `GW-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    ]);

    // Update User Total Spent, Orders Count & FoodFlow Wallet Balance
    let walletDeductSql = '';
    const cleanPayment = String(paymentMethod || '').trim();
    if (cleanPayment === 'FoodFlow Wallet' || cleanPayment === 'Wallet (FoodFlow Wallet)') {
      walletDeductSql = ', wallet_balance = GREATEST(0, wallet_balance - ' + Number(total) + ')';
    }

    await conn.query(`
      UPDATE users 
      SET orders_count = orders_count + 1, 
          total_spent = total_spent + ?
          ${walletDeductSql}
      WHERE email = ?
    `, [total, email.toLowerCase().trim()]);

    // Update Restaurant Revenue & Orders Count
    await conn.query(`
      UPDATE restaurants 
      SET orders_count = orders_count + 1, 
          revenue = revenue + ?
      WHERE id = ?
    `, [total, restaurantId || 1]);

    // Record Audit Log
    await conn.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [
      'INFO',
      `Order #${orderId} placed by ${customer} for ₹${total} at ${restaurant} (${paymentMethod})`
    ]);

    await conn.commit();

    const [[createdOrder]] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.status(201).json({ success: true, order: createdOrder, message: 'Order created in MySQL!' });
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
    const orderId = req.params.id;
    const { status, note, actor } = req.body;

    const validStatuses = ['pending', 'preparing', 'on-the-way', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const titleMap = {
      pending: 'Order Confirmed',
      preparing: 'Chef is preparing your meal',
      'on-the-way': 'Valet is on the way',
      delivered: 'Order Delivered Successfully!',
      cancelled: 'Order Cancelled'
    };

    const descMap = {
      pending: 'Kitchen has accepted your order.',
      preparing: 'Fresh ingredients are being cooked to perfection.',
      'on-the-way': 'Your delivery partner has picked up your food package.',
      delivered: 'Enjoy your hot meal. Thank you for choosing FoodFlow!',
      cancelled: note || 'Order was cancelled.'
    };

    let payUpdate = '';
    if (status === 'delivered') {
      payUpdate = ", payment_status = 'success'";
    }

    await pool.query(`UPDATE orders SET status = ? ${payUpdate} WHERE id = ?`, [status, orderId]);

    await pool.query(`
      INSERT INTO order_tracking_history (order_id, status, status_title, status_description, actor)
      VALUES (?, ?, ?, ?, ?)
    `, [orderId, status, titleMap[status] || status, descMap[status] || '', actor || 'Restaurant']);

    await pool.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [
      'INFO',
      `Order #${orderId} status changed to: ${status.toUpperCase()} (${actor || 'Admin'})`
    ]);

    const [[updated]] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.json({ success: true, order: updated, message: `Order #${orderId} status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cancel Order & 100% Refund Engine
app.post('/api/orders/:id/cancel', checkDbConnection, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const orderId = req.params.id;
    const { reason, cancelledBy } = req.body;

    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.status === 'delivered') {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Delivered orders cannot be cancelled.' });
    }

    const isPrepaid = order.payment_method !== 'Cash on Delivery' && order.payment_status !== 'failed';
    const computedRefundAmount = isPrepaid ? Number(order.total) : 0.00;
    const finalRefundRef = isPrepaid ? ('REF-' + Math.random().toString(36).substring(2, 9).toUpperCase()) : null;
    const effectiveRefundStatus = isPrepaid ? 'refunded' : 'not_applicable';

    // Update Master Order
    await conn.query(`
      UPDATE orders 
      SET status = 'cancelled',
          cancel_reason = ?,
          cancelled_by = ?,
          cancelled_at = NOW(),
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
      computedRefundAmount,
      finalRefundRef,
      effectiveRefundStatus,
      effectiveRefundStatus,
      order.id
    ]);

    // Timeline History
    await conn.query(`
      INSERT INTO order_tracking_history (order_id, status, status_title, status_description, actor)
      VALUES (?, 'cancelled', 'Order Cancelled', ?, ?)
    `, [
      order.id,
      `Cancelled by ${cancelledBy || 'Customer'}. Reason: "${reason}". ${isPrepaid ? `100% refund of ₹${computedRefundAmount} issued.` : 'For Cash on Delivery (COD), any cash collected will be refunded directly via the delivery executive.'}`,
      cancelledBy || 'Customer'
    ]);

    if (isPrepaid && effectiveRefundStatus === 'refunded') {
      // Insert Refund Record
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

      // Insert Reversal in Payment Ledger
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

      // Decrement User Total Spent & Orders Count in MySQL (+ Refund to FoodFlow Wallet if used)
      let walletRefundSql = '';
      const cleanOrderPayment = String(order.payment_method || '').trim();
      if (cleanOrderPayment === 'FoodFlow Wallet' || cleanOrderPayment === 'Wallet (FoodFlow Wallet)') {
        walletRefundSql = ', wallet_balance = wallet_balance + ' + Number(computedRefundAmount);
      }

      await conn.query(`
        UPDATE users 
        SET total_spent = GREATEST(0, total_spent - ?),
            orders_count = GREATEST(0, orders_count - 1)
            ${walletRefundSql}
        WHERE email = ?
      `, [computedRefundAmount, order.email]);

      // Decrement Restaurant Revenue & Orders Count in MySQL
      await conn.query(`
        UPDATE restaurants 
        SET revenue = GREATEST(0, revenue - ?),
            orders_count = GREATEST(0, orders_count - 1)
        WHERE id = ?
      `, [computedRefundAmount, order.restaurant_id]);
    }

    // Audit Log
    await conn.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [
      'WARN',
      `Order #${order.id} CANCELLED by ${cancelledBy || 'User'}. Reason: "${reason}". Refund: ${effectiveRefundStatus} (₹${isPrepaid ? computedRefundAmount : 0})`
    ]);

    await conn.commit();

    const [[updatedOrder]] = await pool.query('SELECT * FROM orders WHERE id = ?', [order.id]);
    res.json({
      success: true,
      order: updatedOrder,
      refundRef: isPrepaid ? finalRefundRef : null,
      message: `Order #${order.id} cancelled. ${isPrepaid ? `100% refund of ₹${computedRefundAmount} processed!` : 'For Cash on Delivery, any cash paid will be refunded directly via the delivery executive.'}`
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 8. WALLET RECHARGE & TRANSACTIONS APIS
// ═══════════════════════════════════════════════════════════════

app.get('/api/wallet/balance', checkDbConnection, async (req, res) => {
  try {
    const userEmail = req.query.email;
    if (!userEmail) return res.status(400).json({ success: false, error: 'Email parameter is required.' });
    const [[user]] = await pool.query('SELECT id, name, email, wallet_balance FROM users WHERE email = ?', [userEmail.toLowerCase().trim()]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, balance: Number(user.wallet_balance) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/wallet/topup', checkDbConnection, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { email, amount, paymentMethod, note } = req.body;
    const numAmt = Number(amount);
    if (!email || isNaN(numAmt) || numAmt <= 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: 'Valid user email and positive top-up amount are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const [[user]] = await conn.query('SELECT id, name, email, wallet_balance FROM users WHERE email = ?', [cleanEmail]);
    if (!user) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'User not found in MySQL.' });
    }

    await conn.query('UPDATE users SET wallet_balance = wallet_balance + ? WHERE email = ?', [numAmt, cleanEmail]);
    const updatedBalance = Number(user.wallet_balance) + numAmt;

    const txnId = `TXN-TOPUP-${Math.floor(100000 + Math.random() * 900000)}`;
    await conn.query(`
      INSERT INTO payment_transactions (id, order_id, customer_name, customer_email, amount, method, status, notes)
      VALUES (?, 'TOPUP', ?, ?, ?, ?, 'success', ?)
    `, [
      txnId,
      user.name,
      cleanEmail,
      numAmt,
      paymentMethod || 'Online Top-Up',
      note || 'FoodFlow Wallet Recharge'
    ]);

    await conn.query('INSERT INTO system_audit_logs (level, text) VALUES (?, ?)', [
      'INFO',
      `Wallet top-up of ₹${numAmt} for ${user.name} (${cleanEmail}). New balance: ₹${updatedBalance.toFixed(2)}`
    ]);

    await conn.commit();
    res.json({ success: true, newBalance: updatedBalance, message: `₹${numAmt} added to FoodFlow Wallet in MySQL!` });
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
// 9. SAVED ADDRESSES APIS
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

    const cleanEmail = userEmail.toLowerCase().trim();
    const cleanAddress = addressText.trim();

    const [existing] = await pool.query('SELECT * FROM user_addresses WHERE user_email = ? AND address_text = ?', [cleanEmail, cleanAddress]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'This address is already saved in your address book.' });
    }

    if (is_default) {
      await pool.query('UPDATE user_addresses SET is_default = FALSE WHERE user_email = ?', [cleanEmail]);
    }

    await pool.query(`
      INSERT INTO user_addresses (user_email, label, recipient_name, recipient_phone, address_text, city, pincode, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanEmail,
      label || 'Home',
      recipient_name || 'Customer',
      recipient_phone || '+91 98765 43210',
      cleanAddress,
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
// 10. ADMIN ANALYTICS & CSV EXPORT
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
    res.setHeader('Content-Disposition', 'attachment; filename="foodflow_orders_export.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback HTML routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ═══════════════════════════════════════════════════════════════
// 11. AUTOMATIC PORT DISCOVERY & SERVER BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

function startServer(port) {
  const server = app.listen(port, () => {
    app.set('port', port);
    console.log(`\n======================================================`);
    console.log(`🍕 FoodFlow Production Backend API Server`);
    console.log(`🚀 Server Running Live at: http://localhost:${port}`);
    console.log(`🐬 Database Target: MySQL (${dbConfig.database})`);
    console.log(`📋 Admin Dashboard: http://localhost:${port}/admin.html`);
    console.log(`======================================================\n`);
    initDbPool();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Port Conflict] Port ${port} is currently busy. Trying next port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[Server Error]', err);
    }
  });
}

startServer(DEFAULT_PORT);
