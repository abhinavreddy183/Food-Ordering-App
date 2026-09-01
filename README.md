# 🍕 FoodFlow – Full-Stack Enterprise Food Ordering & Administration Platform

> **Production Release (Zero-Error, Clean Architecture)**  
> Built with unified theme tokens (`#E85D2F` brand orange, `#1A1A2E` dark secondary, `#F8F6F2` warm surface), real-time bi-directional synchronized state, MySQL Workbench backend (16 relational tables + 4 analytical views), Swiggy/Zomato multi-method payment gateway with strict NPCI UPI verification, automated refund engine, 6-digit OTP password recovery, and 31-test QA integration suite.

---

## 🌟 Table of Contents
1. [Platform Overview & Architecture](#-platform-overview--architecture)
2. [Key Features](#-key-features)
3. [File & Project Structure](#-file--project-structure)
4. [Getting Started & Local Setup](#-getting-started--local-setup)
5. [MySQL Database Setup (MySQL Workbench)](#-mysql-database-setup-mysql-workbench)
6. [Automated System Integration Testing (31 Tests)](#-automated-system-integration-testing-31-tests)

---

## 🚀 Platform Overview & Architecture

FoodFlow delivers an enterprise food ordering ecosystem uniting two distinct yet tightly integrated portals:
- **Customer Portal**: For browsing top restaurants, exploring dishes with dietary badges, intelligent multi-field search (restaurants, cuisines, locations, dishes), managing cart items, applying promo coupons (`KBSIRSTUDENT`), checking out via Swiggy/Zomato end-to-end payment gateway (strict NPCI UPI VPA verification + collect countdown, 3D Secure Card OTP, Net Banking, Wallets, COD), on-demand 5-minute dynamic QR code, dedicated FoodFlow Wallet recharge gateway, cancelling orders with instant prepaid refund, and tracking live orders step-by-step.
- **Admin Management Panel**: For tracking real-time order streams, updating order fulfillment statuses, cancelling orders with mandatory reasons & automated refund processing, managing customer & staff accounts, adding/editing dishes, toggling availability, inspecting financial receipts, and observing live server health metrics & streaming logs.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSERS                                   |
|                                                                                   |
|  +-------------------------------------+   +------------------------------------+  |
|  |       CUSTOMER PORTAL               |   |        ADMIN MANAGEMENT PANEL      |  |
|  |  - Restaurant & Dish Search         |   |  - Live Dashboard                  |  |
|  |  - Categorized Menus                |   |  - Order Status Updater & Cancel   |  |
|  |  - Cart & Checkout                  |   |  - Menu Management                 |  |
|  |  - Swiggy/Zomato Payment Gateway    |   |  - User Directory                  |  |
|  |  - NPCI UPI Verification & Collect  |   |  - Payment Transaction & Refund Log|  |
|  |  - On-Demand 5-Min QR Code          |   |  - Cancellation Reason Selector    |  |
|  |  - Wallet Top-Up Gateway            |   |                                    |  |
|  |  - Live Order Tracker & Refund      |   |                                    |  |
|  |  - Order History & Cancel Option    |   |                                    |  |
|  +------------------+------------------+   +------------------+-----------------+  |
|                     |                                         |                   |
|                     +--------------------+--------------------+                   |
|                                          |                                        |
|                                          v                                        |
|                     +-----------------------------------------+                   |
|                     |     CENTRAL REACTIVE STATE STORE        |                   |
|                     |      (window.FoodFlowStore)             |                   |
|                     |  - Orders, Users, Restaurants, Menu     |                   |
|                     |  - Payments, Promos, Settings, Logs     |                   |
|                     +--------------------+--------------------+                   |
|                                          |                                        |
|                                          v                                        |
|                     +-----------------------------------------+                   |
|                     |       MYSQL DATABASE & REST API         |                   |
|                     |  (foodflow_db via Express Backend)      |                   |
|                     +-----------------------------------------+                   |
+-----------------------------------------------------------------------------------+
```

---

## 📁 File & Project Structure

```
FoodFlow_Master/
├── index.html          # Main Unified Customer Portal Storefront
├── customer.html       # Standalone Customer Portal View
├── admin.html          # Dedicated Admin Management Panel
├── test-suite.html     # Automated System Integration Test Runner (31 Tests)
├── store.js            # Reactive Data Store, Multi-Wallet Engine & MySQL REST Sync
├── app.js              # Shared Controllers, Payment Gateway, Refund Logic & QR Timer
├── styles.css          # Unified Design System Stylesheet & Responsive Breakpoints
├── schema.sql          # Full 16-table MySQL Database Schema, 4 Views, Triggers & Seeds
├── server.js           # Express REST API Server with MySQL Connection Pool & ACID Transactions
├── MYSQL_SETUP.md      # MySQL Workbench & Database Connection Guide
├── .env & .env.example # Server & MySQL configuration settings
├── package.json        # Dependencies and execution scripts
└── README.md           # Project Documentation & User Manual
```

---

## 💻 Getting Started & Local Setup

### Running with Node.js & MySQL Server:
```bash
# 1. Open terminal in FoodFlow_Master directory
cd FoodFlow_Master

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```
Then visit:
- **Customer Storefront:** `http://localhost:5000` (or `http://localhost:5000/customer.html`)
- **Admin Dashboard:** `http://localhost:5000/admin.html`
- **Integration Test Suite:** `http://localhost:5000/test-suite.html`

---

## 🗄️ MySQL Database Setup (MySQL Workbench)

1. Open **MySQL Workbench** and connect to your local MySQL instance (`localhost:3306`).
2. Open and run `schema.sql` located at:
   `C:\Users\abhin\.gemini\antigravity\scratch\FoodFlow_Master\schema.sql`
3. Verify that `foodflow_db` is created with all 16 tables and 4 analytical views.
4. Update `.env` with your MySQL password and run `npm start`.

---

## 🧪 Automated System Integration Testing (31 Tests)

Access `http://localhost:5000/test-suite.html` or open `test-suite.html` directly in any web browser to execute all 31 automated integration assertions:
1. Store Initialization & Seeded Data Verification
2. Customer User Registration & Strict Validation
3. User Authentication & Password Verification
4. OTP Generation, Phone/Email Verification & Password Reset
5. Restaurant Catalog Retrieval & Cuisine Filter
6. Menu Retrieval & Item Availability Assertion
7. Cart Item Insertion & Quantity Recalculation
8. Promo Coupon Validation & Math Engine (`KBSIRSTUDENT`)
9. Order Placement & Unique ID Generation
10. Admin Order Reception & Status Progression
11. Admin Menu Item Availability Real-Time Toggle
12. Admin User Account Suspend & Activate Toggle
13. Prepaid Order Cancellation & Automated Refund Engine
14. Cash on Delivery (COD) Cancellation
15. Unique Phone Number Enforcement on Registration
16. Cart Auto-Flush on Order Placement
17. Profile Name and Phone Synchronization with MySQL
18. Reorder Flow Reliability & Cart Population
19. User Total Spent & Orders Adjustment after Refund
20. Address Deduplication Enforcement
21. Profile Phone/Email 6-Digit OTP Verification
22. Intelligent Search (Dishes, Restaurants, Cuisines, Locations)
23. Strict NPCI UPI VPA Regex Validation
24. End-to-End Verified UPI Checkout
25. FoodFlow Wallet Balance Deducts ONLY on FoodFlow Wallet Payment
26. External Wallet Balance Deducts ONLY on Respective Wallet Payment
27. FoodFlow Wallet Top-Up & Automated Passbook Accounting
28. On-Demand QR Code Display & 5-Minute (300s) Timeout Auto-Reset Engine
29. Multi-Channel Wallet Recharge & Passbook Ledger Sync (UPI / Card / NetBanking)
30. Admin Order Cancellation with Reason Specification & Customer Ledger Refund
31. Customer Order Cancellation & Real-Time Wallet Balance + Passbook Sync

---
© 2026 FoodFlow Engineering. 0 Errors. Production Ready.
