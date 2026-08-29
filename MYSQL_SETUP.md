# FoodFlow — Enterprise MySQL Workbench & Backend API Guide

This guide details the complete setup, architecture, table schema, and REST API specification for the **FoodFlow Enterprise Backend & MySQL Database**.

---

## 📋 Prerequisites
1. **MySQL Server 8.0+** (or MySQL Community Server / MariaDB 10.5+) installed on your machine.
2. **MySQL Workbench 8.0+** installed on your machine.
3. **Node.js (v16+)** & **npm** installed.

---

## 🚀 Quick 3-Step Setup

### Step 1: Execute `schema.sql` in MySQL Workbench

1. Launch **MySQL Workbench**.
2. Connect to your MySQL Server instance (e.g., `Local instance MySQL80` on `localhost:3306`).
3. Click **File → Open SQL Script...** (or press `Ctrl + Shift + O`).
4. Select the file:
   ```
   C:\Users\abhin\.gemini\antigravity\scratch\FoodFlow_Fresh\schema.sql
   ```
5. Click the ⚡ **Execute (Lightning Bolt icon)** button in MySQL Workbench.
6. In the **SCHEMAS** panel on the left, right-click and select **Refresh All**. You will see `foodflow_db` with all **16 relational tables, 4 views, and triggers**!

```
foodflow_db
 ├── Tables (16 Relational Tables)
 │    ├── users                     (Customer & Admin directory)
 │    ├── user_addresses            (Saved multi-address book)
 │    ├── restaurants               (Partner restaurants & metrics)
 │    ├── menu_items                (Categorized food catalog)
 │    ├── orders                    (Master order header & financial audit)
 │    ├── order_items               (Relational item line details)
 │    ├── order_tracking_history    (Step-by-step chronological status timeline)
 │    ├── payment_transactions      (Transactions & payment methods ledger)
 │    ├── refunds                   (100% automated refund processing ledger)
 │    ├── promo_coupons             (Promo codes including KBSIRSTUDENT)
 │    ├── coupon_usage_history      (Per-user coupon redemption history)
 │    ├── reviews_ratings           (Customer ratings & feedback)
 │    ├── delivery_partners         (Live delivery fleet roster)
 │    ├── password_resets           (Swiggy/Zomato 6-digit OTPs & TTL)
 │    ├── cart_items                (Shopping cart persistence)
 │    ├── system_audit_logs         (Real-time server & DB event logs)
 │    └── platform_settings         (Global platform commission & taxes)
 ├── Views (4 Reporting Views)
 │    ├── vw_live_orders_dashboard
 │    ├── vw_restaurant_performance
 │    ├── vw_customer_order_summary
 │    └── vw_daily_financial_report
 └── Triggers
      └── trg_after_review_insert   (Auto-recalculates restaurant ratings)
```

---

### Step 2: Configure Database Credentials in `.env`

Edit the `.env` file in `C:\Users\abhin\.gemini\antigravity\scratch\FoodFlow_Fresh\.env`:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=foodflow_db
DB_CONNECTION_LIMIT=20
```

> Replace `your_mysql_password` with your local MySQL Server root password.

---

### Step 3: Launch the Backend REST API Server

Open terminal in `C:\Users\abhin\.gemini\antigravity\scratch\FoodFlow_Fresh` and run:

```bash
# 1. Install dependencies
npm install

# 2. Launch production API server
npm start
```

Console Output:
```
═══════════════════════════════════════════════════════════════
🚀 FoodFlow Enterprise MySQL REST API Server Online (5000)
═══════════════════════════════════════════════════════════════
➜ Web App URL:       http://localhost:5000
➜ Customer Portal:   http://localhost:5000/customer.html
➜ Admin Portal:      http://localhost:5000/admin.html
➜ QA Test Suite:     http://localhost:5000/test-suite.html
➜ MySQL Health API:  http://localhost:5000/api/health
➜ Database Config:   MySQL root@localhost:3306/foodflow_db
═══════════════════════════════════════════════════════════════
[MySQL] ✓ Connected successfully to MySQL Database "foodflow_db"
```

---

## 📡 Complete REST API Endpoint Specification

### 1. Health & Diagnostics
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Deep database health probe (pool latency, table counts, connection status) |
| `POST` | `/api/admin/reset-demo` | Resets MySQL schema and restores fresh seed data |

### 2. Authentication & Account Recovery
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user account with phone, email, and password |
| `POST` | `/api/auth/login` | Authenticate user via email or mobile phone |
| `GET` | `/api/auth/me?email=...` | Retrieve currently authenticated user profile |
| `PUT` | `/api/auth/profile` | Update user name and phone number |
| `PUT` | `/api/auth/change-password` | Update account password |
| `POST` | `/api/auth/forgot-password/request` | Generate 6-digit OTP for phone/email |
| `POST` | `/api/auth/forgot-password/verify` | Verify 6-digit OTP code |
| `POST` | `/api/auth/forgot-password/reset` | Update password and automatically log user in |

### 3. Restaurants & Menus
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/restaurants` | List restaurants (filters: `cuisine`, `search`, `sort`) |
| `GET` | `/api/restaurants/:id` | Get restaurant details, categorized menu, and reviews |
| `POST` | `/api/restaurants` | Admin adds new restaurant partner |
| `PUT` | `/api/restaurants/:id/status` | Toggle restaurant status (`active` / `inactive`) |
| `GET` | `/api/menu` | List dishes (filters: `restaurantId`, `category`, `is_veg`) |
| `POST` | `/api/menu` | Add dish to restaurant menu |
| `PUT` | `/api/menu/:id/availability` | Instantly toggle dish in/out of stock |
| `DELETE` | `/api/menu/:id` | Remove dish from menu |

### 4. Promo Coupons
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/promos` | List active promo coupons |
| `GET` | `/api/promos/validate/:code?orderTotal=...` | Dynamic discount calculation & min order validation |

### 5. Orders & ACID Transactions
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/orders` | List orders (filters: `email`, `status`, `restaurantId`, `search`) |
| `GET` | `/api/orders/:id` | Get complete order details, items, timeline, and refund info |
| `POST` | `/api/orders` | **ACID Transaction:** Places order, inserts items, payment record, timeline log |
| `PUT` | `/api/orders/:id/status` | Update status (`pending`, `preparing`, `on-the-way`, `delivered`) |
| `POST` | `/api/orders/:id/cancel` | Cancel order with mandatory reason + automated 100% prepaid refund |

### 6. Payments, Refunds & Reviews
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/payments` | List payment transactions ledger |
| `GET` | `/api/refunds` | List dedicated refunds ledger |
| `GET` | `/api/reviews/restaurant/:id` | List reviews for restaurant |
| `POST` | `/api/reviews` | Submit food & delivery rating |

### 7. Admin Analytics & Reporting
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/analytics/dashboard` | Aggregated dashboard statistics from MySQL |
| `GET` | `/api/admin/export/orders.csv` | Live streaming CSV export of all orders |
| `GET` | `/api/logs` | Real-time system audit log stream |

---

## 🔍 Useful SQL Queries in MySQL Workbench

```sql
-- 1. View Live Orders Dashboard (via View)
SELECT * FROM vw_live_orders_dashboard;

-- 2. View Restaurant Financial Performance (via View)
SELECT * FROM vw_restaurant_performance;

-- 3. View Daily Revenue & Refund Accounting (via View)
SELECT * FROM vw_daily_financial_report;

-- 4. View Refund Ledger for Cancelled Orders
SELECT * FROM refunds ORDER BY created_at DESC;

-- 5. View Order Timeline Steps for Order #FF3B7Y1M
SELECT * FROM order_tracking_history WHERE order_id = 'FF3B7Y1M' ORDER BY created_at ASC;
```
