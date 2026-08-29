# 🍕 FoodFlow – Full-Stack Food Ordering & Administration Platform

> **Comprehensive DevOps Agile Project Deliverable | Sprints 1 to 6 (PB-01 to PB-30)**  
> Built with unified theme tokens (`#E85D2F` brand orange, `#1A1A2E` dark secondary, `#F8F6F2` warm surface), real-time bi-directional synchronized state, MySQL Workbench backend, Swiggy/Zomato payment gateway, automated refund engine, Swiggy/Zomato 6-box OTP password recovery, and Docker/Jenkins automation.

---

## 🌟 Table of Contents
1. [Platform Overview & Architecture](#-platform-overview--architecture)
2. [Product Backlog Traceability (PB-01 to PB-30)](#-product-backlog-traceability-pb-01-to-pb-30)
3. [Key Features](#-key-features)
   - [Customer Experience Portal](#1-customer-experience-portal)
   - [Admin Management Panel](#2-admin-management-panel)
   - [Real-Time Synchronization Engine](#3-real-time-synchronization-engine)
4. [File & Project Structure](#-file--project-structure)
5. [Getting Started & Local Setup](#-getting-started--local-setup)
6. [MySQL Database Setup (MySQL Workbench)](#-mysql-database-setup-mysql-workbench)
7. [Docker Deployment Guide (PB-11, PB-27, PB-28)](#-docker-deployment-guide-pb-11-pb-27-pb-28)
8. [Jenkins CI/CD Automation (PB-10)](#-jenkins-cicd-automation-pb-10)
9. [Automated System Integration Testing (PB-26)](#-automated-system-integration-testing-pb-26)
10. [User Manual & Test Scenarios (PB-30)](#-user-manual--test-scenarios-pb-30)

---

## 🚀 Platform Overview & Architecture

FoodFlow delivers an end-to-end food ordering ecosystem uniting two distinct yet tightly integrated portals:
- **Customer Portal**: For browsing top restaurants, exploring dishes with dietary badges, managing cart items, applying promo coupons (`KBSIRSTUDENT`), checking out via Swiggy/Zomato multi-method payment gateway (UPI, Cards, Net Banking, Wallets, COD), cancelling orders with instant prepaid refund, and tracking live orders step-by-step.
- **Admin Management Panel**: For tracking real-time order streams, updating order fulfillment statuses, cancelling orders with mandatory reasons & automated refund processing, managing customer & staff accounts, adding/editing dishes, toggling availability, inspecting financial receipts, and observing live server health metrics & streaming logs.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSERS                                   |
|                                                                                   |
|  +-------------------------------------+   +------------------------------------+  |
|  |       CUSTOMER PORTAL               |   |        ADMIN MANAGEMENT PANEL      |  |
|  |  - Restaurant Search                |   |  - Live Dashboard                  |  |
|  |  - Categorized Menus                |   |  - Order Status Updater & Cancel   |  |
|  |  - Cart & Checkout                  |   |  - Menu Management                 |  |
|  |  - Swiggy/Zomato Payment Gateway    |   |  - User Directory                  |  |
|  |  - Live Order Tracker & Refund      |   |  - Payment Transaction & Refund Log|  |
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

## 📋 Product Backlog Traceability (PB-01 to PB-30)

| Backlog ID | Sprint | User Story / Requirement | Priority | Status | Implemented In |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PB-01** | Sprint 1 | Gather requirements from stakeholders and clients | High | Completed | `docs.html`, `README.md` |
| **PB-02** | Sprint 1 | Create Software Requirements Specification (SRS) | High | Completed | `docs.html` (SRS Section) |
| **PB-03** | Sprint 1 | Design system architecture | High | Completed | `docs.html`, `README.md` |
| **PB-04** | Sprint 1 | Design database schema | High | Completed | `schema.sql`, `server.js` |
| **PB-09** | Sprint 1 | Set up GitHub repository & branching strategy | Medium | Completed | `docs.html`, `Jenkinsfile` |
| **PB-10** | Sprint 1 | Configure Jenkins CI pipeline for automated builds | High | Completed | `Jenkinsfile` |
| **PB-11** | Sprint 2 | Create Docker environment for deployment | High | Completed | `Dockerfile`, `docker-compose.yml` |
| **PB-05** | Sprint 2 | User Registration | High | Completed | `index.html`, `store.js` (`registerUser`) |
| **PB-06** | Sprint 2 | User Login & Authentication Guard | High | Completed | `app.js` (`handleCustomerLogin`) |
| **PB-07** | Sprint 2 | Password Reset flow | Medium | Completed | `app.js` (`handleCustomerForgot`) |
| **PB-08** | Sprint 2 | Admin Manage User Accounts (suspend/activate, add) | Medium | Completed | `app.js` (`renderAdminUsers`, Add Modal) |
| **PB-12** | Sprint 3 | View Restaurant List | High | Completed | `app.js` (`renderCustomerHome`) |
| **PB-13** | Sprint 3 | Search & Filter Restaurants | Medium | Completed | `app.js` (`handleCustomerSearch`) |
| **PB-14** | Sprint 3 | View Restaurant Menus | High | Completed | `app.js` (`renderCustomerMenuItems`) |
| **PB-15** | Sprint 3 | Admin Manage Menu Items (add, delete, toggle) | Medium | Completed | `app.js` (`renderAdminMenu`) |
| **PB-16** | Sprint 3 | View Food Item Details, Badges & Prices | High | Completed | `store.js`, `app.js` |
| **PB-17** | Sprint 4 | Add Food Items to Cart | High | Completed | `store.js` (`addToCart`), `app.js` |
| **PB-18** | Sprint 4 | Update Cart Quantities (+/-) | High | Completed | `store.js` (`updateCartQty`) |
| **PB-19** | Sprint 4 | Remove Items from Cart | High | Completed | `store.js` (`updateCartQty` <= 0) |
| **PB-20** | Sprint 4 | Place Order with Address & Notes | High | Completed | `app.js` (`handlePlaceOrder`) |
| **PB-21** | Sprint 4 | View Customer Order History & Reorder | Medium | Completed | `app.js` (`renderProfileContent`) |
| **PB-22** | Sprint 4 | Restaurant Admin Receive Orders & Status Updater | High | Completed | `app.js` (`renderAdminOrders`, Status Modal) |
| **PB-23** | Sprint 5 | Online Payment Integration (UPI, Card, Net Banking, COD) | High | Completed | `store.js` (`recordPayment`), `app.js` |
| **PB-24** | Sprint 5 | Order Confirmation Notifications & Tax Invoice | Medium | Completed | `app.js` (`openAdminReceiptModal`) |
| **PB-25** | Sprint 5 | Live Order Status Tracking Stepper & Refund Badge | High | Completed | `app.js` (`renderLiveOrderTracker`) |
| **PB-26** | Sprint 5 | System Integration Testing Suite | High | Completed | `test-suite.html` (14 Test Cases) |
| **PB-27** | Sprint 6 | Containerize Application Using Docker | High | Completed | `Dockerfile` |
| **PB-28** | Sprint 6 | Deploy Application to Production Environment | High | Completed | `docker-compose.yml` |
| **PB-29** | Sprint 6 | Monitor Application Health and Live Server Logs | Medium | Completed | `app.js` (`renderAdminHealth`) |
| **PB-30** | Sprint 6 | Prepare Project Documentation and User Manual | Medium | Completed | `README.md`, `docs.html` |

---

## 📁 File & Project Structure

```
FoodFlow_Fresh/
├── index.html          # Main Customer Portal Storefront
├── customer.html       # Standalone Customer Portal View
├── admin.html          # Dedicated Admin Management Panel
├── docs.html           # Interactive SRS, Architecture Diagrams & Backlog Spec
├── test-suite.html     # Automated System Integration Test Runner (14 Cases)
├── store.js            # Reactive Data Store, Promo Engine & MySQL REST Sync
├── app.js              # Shared Controllers, Swiggy/Zomato Gateway, Refund Logic & OTP Wizard
├── styles.css          # Design System Stylesheet & Responsive Breakpoints
├── schema.sql          # Full 12-table MySQL Database Schema & Seed Data
├── server.js           # Express REST API Server with MySQL connection pool
├── MYSQL_SETUP.md      # MySQL Workbench & Database Connection Guide
├── .env & .env.example # Server & MySQL configuration settings
├── package.json        # Dependencies and execution scripts
├── Dockerfile          # Production Docker container
├── docker-compose.yml  # Multi-container orchestration (App + MySQL Database)
├── Jenkinsfile         # Automated Declarative CI/CD Pipeline
└── README.md           # Project Documentation & User Manual
```

---

## 💻 Getting Started & Local Setup

### Running with Node.js & MySQL Server:
```bash
# 1. Open terminal in FoodFlow_Fresh directory
cd FoodFlow_Fresh

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```
Then visit:
- **Customer Storefront:** `http://localhost:5000` (or `http://localhost:5000/customer.html`)
- **Admin Dashboard:** `http://localhost:5000/admin.html`
- **Integration Test Suite:** `http://localhost:5000/test-suite.html`
- **Documentation:** `http://localhost:5000/docs.html`

---
© 2026 FoodFlow Engineering. All Sprints (1 to 6) & Product Backlogs (PB-01 to PB-30) Delivered.
