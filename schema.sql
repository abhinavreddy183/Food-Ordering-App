-- ═══════════════════════════════════════════════════════════════
-- FoodFlow — Enterprise Relational Database Schema & Architecture
-- Compatible with: MySQL Workbench 8.0+, MySQL 8.x, MariaDB 10.5+, AWS RDS MySQL
-- Version: 2.0.0 (Production Release)
-- ═══════════════════════════════════════════════════════════════

-- 1. Database Creation & UTF-8mb4 Character Set
CREATE DATABASE IF NOT EXISTS `foodflow_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `foodflow_db`;

-- Drop existing views first if they exist
DROP VIEW IF EXISTS `vw_daily_financial_report`;
DROP VIEW IF EXISTS `vw_customer_order_summary`;
DROP VIEW IF EXISTS `vw_restaurant_performance`;
DROP VIEW IF EXISTS `vw_live_orders_dashboard`;

-- Drop existing tables in reverse foreign key dependency order
DROP TABLE IF EXISTS `platform_settings`;
DROP TABLE IF EXISTS `system_audit_logs`;
DROP TABLE IF EXISTS `payment_webhooks_log`;
DROP TABLE IF EXISTS `coupon_usage_history`;
DROP TABLE IF EXISTS `reviews_ratings`;
DROP TABLE IF EXISTS `delivery_partners`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `password_resets`;
DROP TABLE IF EXISTS `refunds`;
DROP TABLE IF EXISTS `payment_transactions`;
DROP TABLE IF EXISTS `order_tracking_history`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `promo_coupons`;
DROP TABLE IF EXISTS `user_addresses`;
DROP TABLE IF EXISTS `menu_items`;
DROP TABLE IF EXISTS `restaurants`;
DROP TABLE IF EXISTS `users`;

-- ═══════════════════════════════════════════════════════════════
-- 2. Core Relational Table Definitions (16 Tables)
-- ═══════════════════════════════════════════════════════════════

-- Table 1: Users & Multi-Role Authentication Directory
CREATE TABLE `users` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) DEFAULT '',
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(30) NOT NULL UNIQUE,
  `role` ENUM('Customer', 'Restaurant Admin', 'Delivery Agent', 'Super Admin') NOT NULL DEFAULT 'Customer',
  `status` ENUM('active', 'suspended', 'pending') NOT NULL DEFAULT 'active',
  `avatar_url` VARCHAR(500) DEFAULT NULL,
  `orders_count` INT NOT NULL DEFAULT 0,
  `total_spent` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `joined_date` VARCHAR(50) DEFAULT 'Jan 2026',
  `initials` VARCHAR(10) DEFAULT 'U',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_phone` (`phone`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 2: User Saved Delivery Addresses
CREATE TABLE `user_addresses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_email` VARCHAR(255) NOT NULL,
  `label` ENUM('Home', 'Office', 'Other') NOT NULL DEFAULT 'Home',
  `recipient_name` VARCHAR(150),
  `recipient_phone` VARCHAR(30),
  `address_text` TEXT NOT NULL,
  `city` VARCHAR(100) DEFAULT 'Hyderabad',
  `pincode` VARCHAR(20) DEFAULT '500081',
  `landmark` VARCHAR(200) DEFAULT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_addr_email` (`user_email`),
  INDEX `idx_addr_default` (`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3: Restaurants & Cloud Kitchen Partners
CREATE TABLE `restaurants` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `banner_url` VARCHAR(500) DEFAULT NULL,
  `emoji` VARCHAR(20) DEFAULT '🏪',
  `cuisine` VARCHAR(100) NOT NULL,
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 4.50,
  `total_ratings_count` INT NOT NULL DEFAULT 100,
  `delivery_time` VARCHAR(50) NOT NULL DEFAULT '25–35 mins',
  `delivery_fee` DECIMAL(8, 2) NOT NULL DEFAULT 30.00,
  `min_order_value` DECIMAL(8, 2) NOT NULL DEFAULT 99.00,
  `location` VARCHAR(255) DEFAULT 'Banjara Hills, Hyderabad',
  `address` TEXT,
  `description` TEXT,
  `orders_count` INT NOT NULL DEFAULT 0,
  `revenue` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  `is_pure_veg` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_featured` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` ENUM('active', 'inactive', 'closed') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_rest_cuisine` (`cuisine`),
  INDEX `idx_rest_rating` (`rating`),
  INDEX `idx_rest_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 4: Menu Items & Dishes
CREATE TABLE `menu_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `restaurant_id` INT NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'Main Course',
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(10, 2) NOT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `emoji` VARCHAR(20) DEFAULT '🍽️',
  `is_veg` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_bestseller` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_spicy` BOOLEAN NOT NULL DEFAULT FALSE,
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 4.50,
  `ratings_count` INT NOT NULL DEFAULT 50,
  `available` BOOLEAN NOT NULL DEFAULT TRUE,
  `stock_quantity` INT DEFAULT 100,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  INDEX `idx_menu_rest` (`restaurant_id`),
  INDEX `idx_menu_category` (`category`),
  INDEX `idx_menu_available` (`available`),
  INDEX `idx_menu_veg` (`is_veg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 5: Promo Codes & Discount Coupons
CREATE TABLE `promo_coupons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `discount_percent` INT NOT NULL DEFAULT 10,
  `max_discount` DECIMAL(10, 2) NOT NULL DEFAULT 150.00,
  `min_order_amount` DECIMAL(10, 2) NOT NULL DEFAULT 199.00,
  `description` VARCHAR(255),
  `usage_limit_per_user` INT NOT NULL DEFAULT 5,
  `total_uses` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `valid_from` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `valid_until` TIMESTAMP DEFAULT '2028-12-31 23:59:59',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_promo_code` (`code`),
  INDEX `idx_promo_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 6: Coupon Redemption Audit
CREATE TABLE `coupon_usage_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `coupon_code` VARCHAR(50) NOT NULL,
  `user_email` VARCHAR(255) NOT NULL,
  `order_id` VARCHAR(50) NOT NULL,
  `discount_applied` DECIMAL(10, 2) NOT NULL,
  `used_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_coupon_user` (`user_email`),
  INDEX `idx_coupon_code` (`coupon_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 7: Orders (Master Record)
CREATE TABLE `orders` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(50),
  `customer_name` VARCHAR(200) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `delivery_address` TEXT NOT NULL,
  `restaurant_id` INT NOT NULL,
  `restaurant_name` VARCHAR(200) NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `delivery_fee` DECIMAL(10, 2) NOT NULL DEFAULT 30.00,
  `platform_fee` DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
  `tax` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(10, 2) NOT NULL,
  `promo_code` VARCHAR(50) DEFAULT NULL,
  `payment_method` VARCHAR(100) NOT NULL DEFAULT 'UPI (Google Pay)',
  `payment_status` ENUM('pending', 'success', 'refunded', 'failed') NOT NULL DEFAULT 'success',
  `status` ENUM('pending', 'preparing', 'on-the-way', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `cancel_reason` TEXT DEFAULT NULL,
  `cancelled_by` VARCHAR(100) DEFAULT NULL,
  `refund_status` ENUM('none', 'pending', 'refunded', 'failed') NOT NULL DEFAULT 'none',
  `refund_amount` DECIMAL(10, 2) DEFAULT 0.00,
  `refund_ref` VARCHAR(100) DEFAULT NULL,
  `refund_time` TIMESTAMP NULL DEFAULT NULL,
  `delivery_partner_id` INT DEFAULT NULL,
  `kitchen_note` TEXT,
  `items_summary` TEXT,
  `estimated_delivery_time` VARCHAR(50) DEFAULT '30–40 mins',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  INDEX `idx_orders_user` (`email`),
  INDEX `idx_orders_status` (`status`),
  INDEX `idx_orders_refund` (`refund_status`),
  INDEX `idx_orders_payment` (`payment_status`),
  INDEX `idx_orders_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 8: Order Items Detail
CREATE TABLE `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `menu_item_id` INT,
  `item_name` VARCHAR(200) NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `qty` INT NOT NULL DEFAULT 1,
  `item_total` DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_order_items_order` (`order_id`),
  INDEX `idx_order_items_menu` (`menu_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 9: Step-by-Step Order Status Timeline & Tracking History
CREATE TABLE `order_tracking_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `status` ENUM('pending', 'preparing', 'on-the-way', 'delivered', 'cancelled') NOT NULL,
  `status_title` VARCHAR(150) NOT NULL,
  `status_description` VARCHAR(255) NOT NULL,
  `actor` VARCHAR(100) DEFAULT 'System',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_track_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 10: Payment Transactions Ledger
CREATE TABLE `payment_transactions` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `customer_name` VARCHAR(200) NOT NULL,
  `customer_email` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `method` VARCHAR(100) NOT NULL DEFAULT 'UPI',
  `status` ENUM('pending', 'success', 'refunded', 'failed') NOT NULL DEFAULT 'success',
  `gateway_ref` VARCHAR(100),
  `refund_ref` VARCHAR(100),
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_txn_order` (`order_id`),
  INDEX `idx_txn_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 11: Dedicated Refunds Ledger
CREATE TABLE `refunds` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `customer_name` VARCHAR(200) NOT NULL,
  `customer_email` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `original_payment_method` VARCHAR(100) NOT NULL,
  `refund_status` ENUM('initiated', 'processed', 'failed') NOT NULL DEFAULT 'processed',
  `reason` TEXT NOT NULL,
  `processed_by` VARCHAR(100) NOT NULL DEFAULT 'Super Admin',
  `gateway_refund_id` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_refund_order` (`order_id`),
  INDEX `idx_refund_email` (`customer_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 12: Delivery Partners Fleet
CREATE TABLE `delivery_partners` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NOT NULL UNIQUE,
  `vehicle_type` ENUM('Bike', 'Scooter', 'EV', 'Bicycle') NOT NULL DEFAULT 'Bike',
  `vehicle_number` VARCHAR(50) DEFAULT 'TS 09 AB 1234',
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 4.80,
  `total_deliveries` INT NOT NULL DEFAULT 0,
  `current_status` ENUM('available', 'on_delivery', 'offline') NOT NULL DEFAULT 'available',
  `current_location` VARCHAR(150) DEFAULT 'Hitech City, Hyderabad',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_driver_status` (`current_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 13: Customer Reviews & Ratings
CREATE TABLE `reviews_ratings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `restaurant_id` INT NOT NULL,
  `user_email` VARCHAR(255) NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `food_rating` INT NOT NULL CHECK (`food_rating` BETWEEN 1 AND 5),
  `delivery_rating` INT DEFAULT 5 CHECK (`delivery_rating` BETWEEN 1 AND 5),
  `comment` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  INDEX `idx_review_rest` (`restaurant_id`),
  INDEX `idx_review_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 14: Password Reset OTPs
CREATE TABLE `password_resets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL,
  `identifier` VARCHAR(255),
  `otp_code` VARCHAR(10) NOT NULL,
  `expires_at` BIGINT NOT NULL,
  `used` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_pw_email` (`email`),
  INDEX `idx_pw_used` (`used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 15: Shopping Cart Session State
CREATE TABLE `cart_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `session_id` VARCHAR(100) NOT NULL,
  `user_email` VARCHAR(255) DEFAULT NULL,
  `menu_item_id` INT NOT NULL,
  `qty` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE,
  INDEX `idx_cart_session` (`session_id`),
  INDEX `idx_cart_user` (`user_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 16: System Audit Logs & Diagnostics
CREATE TABLE `system_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `level` ENUM('INFO', 'WARN', 'ERROR', 'CRITICAL') NOT NULL DEFAULT 'INFO',
  `text` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 17: Platform Global Configuration
CREATE TABLE `platform_settings` (
  `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ═══════════════════════════════════════════════════════════════
-- 3. High-Performance SQL Database Views
-- ═══════════════════════════════════════════════════════════════

-- View 1: Real-time Live Orders Dashboard View
CREATE VIEW `vw_live_orders_dashboard` AS
SELECT 
  o.id AS order_id,
  o.customer_name,
  o.email AS customer_email,
  o.phone AS customer_phone,
  o.restaurant_name,
  o.total,
  o.subtotal,
  o.discount,
  o.delivery_fee,
  o.payment_method,
  o.payment_status,
  o.status AS order_status,
  o.cancel_reason,
  o.refund_status,
  o.refund_amount,
  o.refund_ref,
  o.items_summary,
  o.created_at AS order_time,
  dp.name AS delivery_agent_name,
  dp.phone AS delivery_agent_phone
FROM `orders` o
LEFT JOIN `delivery_partners` dp ON o.delivery_partner_id = dp.id
ORDER BY o.created_at DESC;

-- View 2: Restaurant Performance & Revenue Analytics
CREATE VIEW `vw_restaurant_performance` AS
SELECT 
  r.id AS restaurant_id,
  r.name AS restaurant_name,
  r.cuisine,
  r.rating AS average_rating,
  COUNT(o.id) AS total_orders_placed,
  SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS completed_orders,
  SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
  IFNULL(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0.00) AS gross_revenue,
  IFNULL(AVG(CASE WHEN o.status != 'cancelled' THEN o.total ELSE NULL END), 0.00) AS avg_order_value
FROM `restaurants` r
LEFT JOIN `orders` o ON r.id = o.restaurant_id
GROUP BY r.id, r.name, r.cuisine, r.rating;

-- View 3: Customer Lifetime Order Summary
CREATE VIEW `vw_customer_order_summary` AS
SELECT 
  u.id AS user_id,
  u.name AS customer_name,
  u.email,
  u.phone,
  u.role,
  u.status AS account_status,
  COUNT(o.id) AS total_orders_count,
  IFNULL(SUM(CASE WHEN o.status = 'delivered' THEN o.total ELSE 0 END), 0.00) AS total_spent_confirmed,
  MAX(o.created_at) AS last_order_date
FROM `users` u
LEFT JOIN `orders` o ON u.email = o.email
GROUP BY u.id, u.name, u.email, u.phone, u.role, u.status;

-- View 4: Daily Financial & Refund Accounting Summary
CREATE VIEW `vw_daily_financial_report` AS
SELECT 
  DATE(o.created_at) AS report_date,
  COUNT(o.id) AS total_orders,
  SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS delivered_count,
  SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
  SUM(o.subtotal) AS gross_merchandise_value,
  SUM(o.discount) AS total_discounts_given,
  SUM(o.platform_fee) AS total_platform_commissions,
  SUM(CASE WHEN o.refund_status = 'refunded' THEN o.refund_amount ELSE 0.00 END) AS total_refunds_issued,
  SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0.00 END) AS net_settlement_revenue
FROM `orders` o
GROUP BY DATE(o.created_at)
ORDER BY report_date DESC;

-- ═══════════════════════════════════════════════════════════════
-- 4. Database Triggers
-- ═══════════════════════════════════════════════════════════════

-- Trigger 1: Auto-recalculate Restaurant Average Rating on New Review
DELIMITER $$
CREATE TRIGGER `trg_after_review_insert`
AFTER INSERT ON `reviews_ratings`
FOR EACH ROW
BEGIN
  DECLARE new_avg DECIMAL(3, 2);
  DECLARE new_count INT;

  SELECT AVG(food_rating), COUNT(*) INTO new_avg, new_count
  FROM `reviews_ratings`
  WHERE `restaurant_id` = NEW.restaurant_id;

  UPDATE `restaurants`
  SET `rating` = IFNULL(new_avg, 4.50),
      `total_ratings_count` = new_count
  WHERE `id` = NEW.restaurant_id;
END$$
DELIMITER ;

-- ═══════════════════════════════════════════════════════════════
-- 5. Pre-Seeded Production & Test Catalog
-- ═══════════════════════════════════════════════════════════════

-- Seed Users Directory
INSERT INTO `users` (`id`, `name`, `first_name`, `last_name`, `email`, `password`, `phone`, `role`, `status`, `orders_count`, `total_spent`, `joined_date`, `initials`) VALUES
('U001', 'Ravi Kumar', 'Ravi', 'Kumar', 'ravi@example.com', 'Password@123', '+91 98765 43210', 'Customer', 'active', 12, 4520.00, 'Jan 2026', 'RK'),
('U002', 'Priya Sharma', 'Priya', 'Sharma', 'priya@example.com', 'Password@123', '+91 98123 45678', 'Customer', 'active', 8, 3180.00, 'Feb 2026', 'PS'),
('U003', 'Ananya Patel', 'Ananya', 'Patel', 'ananya@example.com', 'Password@123', '+91 97234 56789', 'Customer', 'active', 5, 1890.00, 'Feb 2026', 'AP'),
('U004', 'Vikram Singh', 'Vikram', 'Singh', 'vikram@foodflow.com', 'Password@123', '+91 96345 67890', 'Restaurant Admin', 'active', 0, 0.00, 'Jan 2026', 'VS'),
('U005', 'Amit Verma', 'Amit', 'Verma', 'amit.delivery@foodflow.com', 'Password@123', '+91 95456 78901', 'Delivery Agent', 'active', 0, 0.00, 'Jan 2026', 'AV'),
('U006', 'Super Admin', 'Super', 'Admin', 'admin@foodflow.com', 'Password@123', '+91 99999 00000', 'Super Admin', 'active', 0, 0.00, 'Jan 2026', 'SA');

-- Seed Saved User Addresses
INSERT INTO `user_addresses` (`user_email`, `label`, `recipient_name`, `recipient_phone`, `address_text`, `city`, `pincode`, `is_default`) VALUES
('ravi@example.com', 'Home', 'Ravi Kumar', '+91 98765 43210', 'Flat 4B, Palm Grove Apartments, Malkajgiri', 'Hyderabad', '500047', TRUE),
('ravi@example.com', 'Office', 'Ravi Kumar', '+91 98765 43210', '4th Floor, Tech Hub Tower, Hitech City', 'Hyderabad', '500081', FALSE),
('priya@example.com', 'Home', 'Priya Sharma', '+91 98123 45678', 'Plot 42, Jubilee Hills Road No. 36', 'Hyderabad', '500033', TRUE),
('ananya@example.com', 'Home', 'Ananya Patel', '+91 97234 56789', 'Villa 15, Green Meadows, Gachibowli', 'Hyderabad', '500032', TRUE);

-- Seed Delivery Partners
INSERT INTO `delivery_partners` (`id`, `name`, `phone`, `vehicle_type`, `vehicle_number`, `rating`, `total_deliveries`, `current_status`, `current_location`) VALUES
(1, 'Amit Verma', '+91 95456 78901', 'Bike', 'TS 09 AB 1234', 4.90, 342, 'on_delivery', 'Banjara Hills, Hyderabad'),
(2, 'Suresh Reddy', '+91 94567 89012', 'EV', 'TS 10 EV 5678', 4.85, 518, 'available', 'Jubilee Hills, Hyderabad'),
(3, 'Mohammed Imran', '+91 93678 90123', 'Scooter', 'TS 07 CD 9012', 4.95, 890, 'available', 'Madhapur, Hyderabad');

-- Seed Restaurants with High-Resolution Photography
INSERT INTO `restaurants` (`id`, `name`, `image_url`, `banner_url`, `emoji`, `cuisine`, `rating`, `total_ratings_count`, `delivery_time`, `delivery_fee`, `location`, `description`, `orders_count`, `revenue`, `status`) VALUES
(1, 'Spice Garden', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80', '🍛', 'Biryani', 4.80, 1420, '25–35 mins', 0.00, 'Banjara Hills, Hyderabad', 'Authentic Hyderabadi dum biryanis, aromatic curries, and tandoori specials crafted with royal heritage recipes.', 1420, 485600.00, 'active'),
(2, 'Pizza Republic', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80', '🍕', 'Pizza', 4.60, 980, '30–40 mins', 30.00, 'Jubilee Hills, Hyderabad', 'Handcrafted wood-fired pizzas, cheesy garlic breads, and artisanal pastas made with San Marzano tomatoes.', 980, 392000.00, 'active'),
(3, 'Burger Barn', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80', '🍔', 'Burger', 4.50, 1150, '20–30 mins', 20.00, 'Madhapur, Hyderabad', 'Juicy grilled smash burgers, loaded cheddar peri-peri fries, crispy chicken brioche and thick milkshakes.', 1150, 345000.00, 'active'),
(4, 'Wok & Roll', 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=1200&q=80', '🥢', 'Chinese', 4.40, 760, '25–35 mins', 30.00, 'Gachibowli, Hyderabad', 'Sizzling Indo-Chinese wok specialties, momos, crispy spring rolls and fiery noodles made fresh to order.', 760, 266000.00, 'active'),
(5, 'Dosa Delight', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1200&q=80', '🥘', 'South Indian', 4.90, 2100, '15–25 mins', 0.00, 'Kukatpally, Hyderabad', 'Crispy golden ghee roast dosas, steamed fluffy idlis, medu vadas, and authentic filter coffee served with 3 chutneys.', 2100, 420000.00, 'active'),
(6, 'Sweet Cravings', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=80', '🍰', 'Desserts', 4.70, 640, '20–30 mins', 25.00, 'Kondapur, Hyderabad', 'Molten dark chocolate lava cakes, artisan strawberry cheesecakes, and traditional royal Alphonso mango kulfis.', 640, 192000.00, 'active');

-- Seed Menu Items with High-Resolution Photography
INSERT INTO `menu_items` (`id`, `restaurant_id`, `category`, `name`, `description`, `price`, `image_url`, `emoji`, `is_veg`, `is_bestseller`, `rating`, `available`) VALUES
-- 1. Spice Garden
(101, 1, 'Biryani', 'Royal Chicken Dum Biryani', 'Fragrant aged Basmati rice layered with tender spiced chicken, saffron, and fresh mint. Served with spicy mirchi ka salan and dahi raita.', 199.00, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80', '🍛', FALSE, TRUE, 4.90, TRUE),
(102, 1, 'Biryani', 'Hyderabadi Mutton Biryani', 'Slow-cooked succulent tender goat meat with long-grain Basmati rice, cooked on gentle charcoal dum.', 249.00, 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80', '🍖', FALSE, TRUE, 4.90, TRUE),
(103, 1, 'Biryani', 'Paneer Tikka Biryani', 'Fresh garden vegetables and char-grilled cottage cheese in aromatic basmati, dum-cooked.', 149.00, 'https://images.unsplash.com/photo-1642821373181-696a54913e93?auto=format&fit=crop&w=400&q=80', '🌿', TRUE, TRUE, 4.80, TRUE),
(104, 1, 'Starters', 'Chicken 65', 'Crispy deep-fried boneless chicken tossed in southern curd, curry leaves, and spicy red masala.', 149.00, 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=400&q=80', '🍗', FALSE, TRUE, 4.70, TRUE),
(105, 1, 'Starters', 'Tandoori Paneer Tikka', 'Clay oven grilled cottage cheese cubes marinated in spiced hung curd with spicy mint chutney.', 129.00, 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=400&q=80', '🧀', TRUE, TRUE, 4.60, TRUE),
(106, 1, 'Desserts', 'Gulab Jamun (2 pcs)', 'Melt-in-mouth warm khoya dumplings soaked in fragrant cardamom & rose sugar syrup.', 59.00, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80', '🍯', TRUE, FALSE, 4.80, TRUE),

-- 2. Pizza Republic
(201, 2, 'Classic Pizzas', 'Margherita Classica', 'San Marzano tomato sauce, fresh buffalo mozzarella & fragrant sweet basil leaves.', 199.00, 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=400&q=80', '🍕', TRUE, TRUE, 4.70, TRUE),
(202, 2, 'Classic Pizzas', 'BBQ Smoky Chicken Pizza', 'Smoky BBQ glazed chicken chunks, caramelized onions, jalapeños & double mozzarella.', 279.00, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80', '🍗', FALSE, TRUE, 4.80, TRUE),
(203, 2, 'Classic Pizzas', 'Pepperoni Supreme', 'Cured Italian pepperoni slices, melted mozzarella & aromatic oregano seasoning.', 259.00, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=400&q=80', '🍕', FALSE, FALSE, 4.60, TRUE),
(204, 2, 'Specialty', 'Truffle Mushroom Pizza', 'Wild portobello mushrooms, black truffle oil, shaved parmesan & fresh baby arugula.', 319.00, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80', '🍄', TRUE, FALSE, 4.50, TRUE),
(205, 2, 'Sides', 'Cheesy Garlic Breadsticks', 'Freshly baked artisan baguette loaded with roasted garlic herb butter and gooey mozzarella.', 79.00, 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?auto=format&fit=crop&w=400&q=80', '🥖', TRUE, TRUE, 4.80, TRUE),

-- 3. Burger Barn
(301, 3, 'Burgers', 'Classic Smash Cheeseburger', 'Double smashed patties, melted cheddar, crisp dill pickles & signature house burger sauce.', 199.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', '🍔', FALSE, TRUE, 4.80, TRUE),
(302, 3, 'Burgers', 'Crispy Peri-Peri Chicken Burger', '24hr buttermilk marinated fried chicken breast with spicy peri-peri rub & creamy slaw.', 179.00, 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=400&q=80', '🍗', FALSE, TRUE, 4.70, TRUE),
(303, 3, 'Burgers', 'Smoky Black Bean Veg Burger', 'Crispy black bean & roasted corn patty, avocado slices, caramelized onions & herb mayo.', 159.00, 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=400&q=80', '🥑', TRUE, FALSE, 4.50, TRUE),
(304, 3, 'Sides', 'Loaded Peri-Peri Truffle Fries', 'Crispy skin-on french fries smothered in warm cheese sauce, peri-peri seasoning & jalapeños.', 99.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80', '🍟', TRUE, TRUE, 4.80, TRUE),
(305, 3, 'Sides', 'Crispy Onion Rings', 'Golden crispy thick-cut beer-battered onion rings served with smoky chipotle dip.', 79.00, 'https://images.unsplash.com/photo-1639024471287-0351860db52e?auto=format&fit=crop&w=400&q=80', '🧅', TRUE, FALSE, 4.40, TRUE),

-- 4. Wok & Roll
(401, 4, 'Noodles & Rice', 'Chicken Hakka Noodles', 'High flame wok-tossed noodles with tender chicken shreds, crunchy cabbage & soya garlic sauce.', 169.00, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80', '🍜', FALSE, TRUE, 4.70, TRUE),
(402, 4, 'Noodles & Rice', 'Schezwan Veg Fried Rice', 'Fiery Schezwan tossed long grain rice with garden fresh diced vegetables and spring onions.', 129.00, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80', '🍚', TRUE, TRUE, 4.60, TRUE),
(403, 4, 'Starters', 'Steamed Chicken Dumplings (6 pcs)', 'Delicate steamed dumplings stuffed with minced seasoned chicken and scallions with chili dip.', 179.00, 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=400&q=80', '🥟', FALSE, TRUE, 4.80, TRUE),
(404, 4, 'Starters', 'Chilli Chicken Dry', 'Wok-seared crispy chicken tossed with green chillies, garlic, capsicum and spicy soy reduction.', 169.00, 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=400&q=80', '🌶️', FALSE, TRUE, 4.70, TRUE),

-- 5. Dosa Delight
(501, 5, 'Dosas', 'Butter Masala Dosa', 'Golden crispy fermented rice crepe smeared with pure butter and stuffed with spiced potato masala.', 89.00, 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80', '🥘', TRUE, TRUE, 4.90, TRUE),
(502, 5, 'Dosas', 'Ghee Roast Paper Dosa', 'Ultra-crispy giant paper thin dosa roasted generously in aromatic desi cow ghee.', 99.00, 'https://images.unsplash.com/photo-1688583488220-410a514d4e0b?auto=format&fit=crop&w=400&q=80', '🧈', TRUE, FALSE, 4.80, TRUE),
(503, 5, 'Tiffin', 'Steamed Idli Sambar Combo', 'Steaming fluffy idlis and crunchy medu vada served with hot drumstick sambar & 3 chutneys.', 69.00, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80', '🫔', TRUE, TRUE, 4.80, TRUE),
(504, 5, 'Tiffin', 'Crispy Medu Vada (2 pcs)', 'Deep-fried golden crunchy urad dal fritters with ginger, curry leaves & coconut chutney.', 59.00, 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=400&q=80', '🍩', TRUE, FALSE, 4.80, TRUE),
(505, 5, 'Beverages', 'Authentic Madras Filter Coffee', 'Traditional frothy chicory-infused filter coffee brewed with rich hot milk.', 39.00, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80', '☕', TRUE, TRUE, 5.00, TRUE),

-- 6. Sweet Cravings
(601, 6, 'Cakes', 'Molten Chocolate Lava Cake', 'Decadent dark chocolate sponge with rich molten fudge center & vanilla bean cream.', 149.00, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80', '🍫', TRUE, TRUE, 4.90, TRUE),
(602, 6, 'Cakes', 'New York Strawberry Cheesecake', 'Classic baked rich cream cheese slice crowned with fresh glazed strawberry compote.', 169.00, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=400&q=80', '🍓', TRUE, TRUE, 4.80, TRUE),
(603, 6, 'Ice Cream', 'Royal Alphonso Mango Kulfi', 'Traditional slow-reduced dense milk kulfi infused with pure Alphonso mango pulp & pistachios.', 89.00, 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=400&q=80', '🍨', TRUE, TRUE, 4.90, TRUE);

-- Seed Promo Coupons (Updated to KBSIRSTUDENT)
INSERT INTO `promo_coupons` (`code`, `discount_percent`, `max_discount`, `min_order_amount`, `description`, `is_active`) VALUES
('KBSIRSTUDENT', 50, 150.00, 199.00, '50% Special Student Discount up to ₹150', TRUE),
('FLAT100', 100, 100.00, 499.00, '₹100 Flat Discount on orders above ₹499', TRUE),
('FREESHIP', 100, 40.00, 250.00, 'Free Delivery on orders above ₹250', TRUE);

-- Seed 8 Full Historical & Active Orders Across Multiple Customers & Statuses
INSERT INTO `orders` (`id`, `user_id`, `customer_name`, `email`, `phone`, `delivery_address`, `restaurant_id`, `restaurant_name`, `subtotal`, `discount`, `delivery_fee`, `platform_fee`, `tax`, `total`, `promo_code`, `payment_method`, `payment_status`, `status`, `cancel_reason`, `cancelled_by`, `refund_status`, `refund_amount`, `refund_ref`, `delivery_partner_id`, `kitchen_note`, `items_summary`, `created_at`) VALUES
('FF2A8X3K', 'U001', 'Ravi Kumar', 'ravi@example.com', '+91 98765 43210', 'Flat 4B, Palm Grove Apartments, Malkajgiri, Hyderabad - 500047', 1, 'Spice Garden', 527.00, 0.00, 0.00, 5.00, 0.00, 532.00, 'KBSIRSTUDENT', 'UPI (Google Pay)', 'success', 'preparing', NULL, NULL, 'none', 0.00, NULL, 1, 'Please add extra green mint chutney and onions.', 'Royal Chicken Dum Biryani ×2, Tandoori Paneer Tikka ×1', NOW() - INTERVAL 15 MINUTE),
('FF3B7Y1M', 'U002', 'Priya Sharma', 'priya@example.com', '+91 98123 45678', 'Plot 42, Jubilee Hills Road No. 36, Hyderabad - 500033', 2, 'Pizza Republic', 357.00, 0.00, 30.00, 5.00, 0.00, 392.00, NULL, 'Credit Card (Visa •••• 4242)', 'success', 'delivered', NULL, NULL, 'none', 0.00, NULL, 2, 'Leave at front desk.', 'Margherita Classica ×1, Cheesy Garlic Breadsticks ×2', NOW() - INTERVAL 2 HOUR),
('FF4C9Z2P', 'U003', 'Ananya Patel', 'ananya@example.com', '+91 97234 56789', 'Villa 15, Green Meadows, Gachibowli, Hyderabad - 500032', 3, 'Burger Barn', 477.00, 100.00, 20.00, 5.00, 0.00, 402.00, 'FLAT100', 'UPI (PhonePe)', 'success', 'on-the-way', NULL, NULL, 'none', 0.00, NULL, 3, 'Do not ring the bell.', 'Classic Smash Cheeseburger ×2, Loaded Peri-Peri Truffle Fries ×1', NOW() - INTERVAL 35 MINUTE),
('FF5D1W8Q', 'U001', 'Ravi Kumar', 'ravi@example.com', '+91 98765 43210', 'Flat 4B, Palm Grove Apartments, Malkajgiri, Hyderabad - 500047', 5, 'Dosa Delight', 197.00, 0.00, 0.00, 5.00, 0.00, 202.00, NULL, 'Net Banking (HDFC Bank)', 'success', 'pending', NULL, NULL, 'none', 0.00, NULL, NULL, 'Extra coconut chutney please.', 'Butter Masala Dosa ×1, Steamed Idli Sambar Combo ×1, Filter Coffee ×1', NOW() - INTERVAL 5 MINUTE),
('FF6E2V7R', 'U002', 'Priya Sharma', 'priya@example.com', '+91 98123 45678', 'Plot 42, Jubilee Hills Road No. 36, Hyderabad - 500033', 4, 'Wok & Roll', 348.00, 50.00, 30.00, 5.00, 0.00, 333.00, 'KBSIRSTUDENT', 'Cash on Delivery', 'pending', 'preparing', NULL, NULL, 'none', 0.00, NULL, NULL, 'Make it extra spicy.', 'Chicken Hakka Noodles ×1, Chilli Chicken Dry ×1', NOW() - INTERVAL 20 MINUTE),
('FF7F3U6S', 'U003', 'Ananya Patel', 'ananya@example.com', '+91 97234 56789', 'Villa 15, Green Meadows, Gachibowli, Hyderabad - 500032', 6, 'Sweet Cravings', 407.00, 0.00, 25.00, 5.00, 0.00, 437.00, NULL, 'Credit Card (Mastercard •••• 8821)', 'refunded', 'cancelled', 'Customer ordered by mistake', 'Customer', 'refunded', 437.00, 'REF-98124X', NULL, 'Cancelled via customer app.', 'Molten Chocolate Lava Cake ×2, Mango Kulfi ×1', NOW() - INTERVAL 1 DAY),
('FF8G4T5T', 'U001', 'Ravi Kumar', 'ravi@example.com', '+91 98765 43210', 'Flat 4B, Palm Grove Apartments, Malkajgiri, Hyderabad - 500047', 1, 'Spice Garden', 398.00, 0.00, 0.00, 5.00, 0.00, 403.00, NULL, 'UPI (Paytm)', 'success', 'delivered', NULL, NULL, 'none', 0.00, NULL, 1, 'Delivered hot.', 'Royal Chicken Dum Biryani ×2', NOW() - INTERVAL 3 DAY),
('FF9H5S4U', 'U002', 'Priya Sharma', 'priya@example.com', '+91 98123 45678', 'Plot 42, Jubilee Hills Road No. 36, Hyderabad - 500033', 2, 'Pizza Republic', 358.00, 0.00, 30.00, 5.00, 0.00, 393.00, NULL, 'Credit Card (RuPay •••• 1092)', 'success', 'delivered', NULL, NULL, 'none', 0.00, NULL, 2, 'Contactless delivery done.', 'BBQ Smoky Chicken Pizza ×1, Cheesy Garlic Breadsticks ×1', NOW() - INTERVAL 4 DAY);

-- Seed Order Items
INSERT INTO `order_items` (`order_id`, `menu_item_id`, `item_name`, `price`, `qty`, `item_total`) VALUES
('FF2A8X3K', 101, 'Royal Chicken Dum Biryani', 199.00, 2, 398.00),
('FF2A8X3K', 105, 'Tandoori Paneer Tikka', 129.00, 1, 129.00),
('FF3B7Y1M', 201, 'Margherita Classica', 199.00, 1, 199.00),
('FF3B7Y1M', 205, 'Cheesy Garlic Breadsticks', 79.00, 2, 158.00),
('FF4C9Z2P', 301, 'Classic Smash Cheeseburger', 199.00, 2, 398.00),
('FF4C9Z2P', 304, 'Loaded Peri-Peri Truffle Fries', 99.00, 1, 99.00),
('FF5D1W8Q', 501, 'Butter Masala Dosa', 89.00, 1, 89.00),
('FF5D1W8Q', 503, 'Steamed Idli Sambar Combo', 69.00, 1, 69.00),
('FF5D1W8Q', 505, 'Authentic Madras Filter Coffee', 39.00, 1, 39.00),
('FF6E2V7R', 401, 'Chicken Hakka Noodles', 169.00, 1, 169.00),
('FF6E2V7R', 404, 'Chilli Chicken Dry', 169.00, 1, 169.00),
('FF7F3U6S', 601, 'Molten Chocolate Lava Cake', 149.00, 2, 298.00),
('FF7F3U6S', 603, 'Royal Alphonso Mango Kulfi', 89.00, 1, 89.00),
('FF8G4T5T', 101, 'Royal Chicken Dum Biryani', 199.00, 2, 398.00),
('FF9H5S4U', 202, 'BBQ Smoky Chicken Pizza', 279.00, 1, 279.00),
('FF9H5S4U', 205, 'Cheesy Garlic Breadsticks', 79.00, 1, 79.00);

-- Seed Order Tracking Timeline History
INSERT INTO `order_tracking_history` (`order_id`, `status`, `status_title`, `status_description`, `actor`, `created_at`) VALUES
('FF2A8X3K', 'pending', 'Order Received', 'Order confirmed and received by kitchen', 'System', NOW() - INTERVAL 15 MINUTE),
('FF2A8X3K', 'preparing', 'In the Kitchen', 'Chef is preparing your fresh meal', 'Spice Garden', NOW() - INTERVAL 10 MINUTE),
('FF3B7Y1M', 'pending', 'Order Received', 'Order confirmed and received by kitchen', 'System', NOW() - INTERVAL 2 HOUR),
('FF3B7Y1M', 'preparing', 'Baking in Oven', 'Wood-fired oven is baking your pizza', 'Pizza Republic', NOW() - INTERVAL 100 MINUTE),
('FF3B7Y1M', 'on-the-way', 'Out for Delivery', 'Valet Suresh Reddy is on the way', 'Delivery Agent', NOW() - INTERVAL 45 MINUTE),
('FF3B7Y1M', 'delivered', 'Delivered Successfully', 'Package handed over to customer', 'Delivery Agent', NOW() - INTERVAL 30 MINUTE),
('FF7F3U6S', 'pending', 'Order Received', 'Order confirmed and received by kitchen', 'System', NOW() - INTERVAL 1 DAY),
('FF7F3U6S', 'cancelled', 'Order Cancelled', 'Cancelled upon request. 100% refund of ₹437 credited to Mastercard.', 'Customer', NOW() - INTERVAL 23 HOUR);

-- Seed Payment Transactions Ledger
INSERT INTO `payment_transactions` (`id`, `order_id`, `customer_name`, `customer_email`, `amount`, `method`, `status`, `gateway_ref`, `refund_ref`) VALUES
('TXN-801', 'FF2A8X3K', 'Ravi Kumar', 'ravi@example.com', 532.00, 'UPI (Google Pay)', 'success', 'UPI-REF-98129038', NULL),
('TXN-802', 'FF3B7Y1M', 'Priya Sharma', 'priya@example.com', 392.00, 'Credit Card (Visa •••• 4242)', 'success', 'PAY-VISA-8821903', NULL),
('TXN-803', 'FF4C9Z2P', 'Ananya Patel', 'ananya@example.com', 402.00, 'UPI (PhonePe)', 'success', 'UPI-REF-77234901', NULL),
('TXN-804', 'FF5D1W8Q', 'Ravi Kumar', 'ravi@example.com', 202.00, 'Net Banking (HDFC Bank)', 'success', 'NET-HDFC-6638902', NULL),
('TXN-805', 'FF6E2V7R', 'Priya Sharma', 'priya@example.com', 333.00, 'Cash on Delivery', 'pending', 'COD-PENDING', NULL),
('TXN-806', 'FF7F3U6S', 'Ananya Patel', 'ananya@example.com', 437.00, 'Credit Card (Mastercard •••• 8821)', 'refunded', 'PAY-MC-5549012', 'REF-98124X'),
('TXN-807', 'FF8G4T5T', 'Ravi Kumar', 'ravi@example.com', 403.00, 'UPI (Paytm)', 'success', 'UPI-PAYTM-443901', NULL),
('TXN-808', 'FF9H5S4U', 'Priya Sharma', 'priya@example.com', 393.00, 'Credit Card (RuPay •••• 1092)', 'success', 'PAY-RUPAY-332901', NULL);

-- Seed Refunds Ledger
INSERT INTO `refunds` (`id`, `order_id`, `customer_name`, `customer_email`, `amount`, `original_payment_method`, `refund_status`, `reason`, `processed_by`, `gateway_refund_id`, `created_at`) VALUES
('REF-98124X', 'FF7F3U6S', 'Ananya Patel', 'ananya@example.com', 437.00, 'Credit Card (Mastercard •••• 8821)', 'processed', 'Customer ordered by mistake', 'Customer Self-Service', 'GATEWAY-REF-99214X', NOW() - INTERVAL 23 HOUR);

-- Seed Customer Reviews
INSERT INTO `reviews_ratings` (`order_id`, `restaurant_id`, `user_email`, `customer_name`, `food_rating`, `delivery_rating`, `comment`, `created_at`) VALUES
('FF3B7Y1M', 2, 'priya@example.com', 'Priya Sharma', 5, 5, 'Super fresh wood-fired pizza and garlic bread was still piping hot! Fast delivery by Suresh.', NOW() - INTERVAL 90 MINUTE),
('FF8G4T5T', 1, 'ravi@example.com', 'Ravi Kumar', 5, 5, 'The royal chicken biryani had incredible aroma and long grain rice. Truly authentic taste.', NOW() - INTERVAL 2 DAY),
('FF9H5S4U', 2, 'priya@example.com', 'Priya Sharma', 4, 5, 'Good barbecue smoky flavor on the pizza, crust was crisp and soft inside.', NOW() - INTERVAL 3 DAY);

-- Seed System Audit Logs
INSERT INTO `system_audit_logs` (`level`, `text`, `created_at`) VALUES
('INFO', 'FoodFlow enterprise MySQL database initialized (16 tables, 4 views, 1 trigger)', NOW() - INTERVAL 10 DAY),
('INFO', 'Default user credentials loaded: ravi@example.com / Password@123', NOW() - INTERVAL 10 DAY),
('INFO', 'Live restaurant catalog loaded: 6 restaurants, 23 menu items, 3 promo coupons', NOW() - INTERVAL 10 DAY),
('INFO', 'Payment gateway and instant refund engine bound to MySQL database', NOW() - INTERVAL 5 DAY);

-- Seed Platform Settings
INSERT INTO `platform_settings` (`setting_key`, `setting_value`, `description`) VALUES
('platform_fee', '5.00', 'Fixed platform commission per order in INR'),
('delivery_fee_base', '30.00', 'Standard base delivery fee in INR'),
('tax_rate_percent', '5.0', 'GST percentage applied to food services'),
('maintenance_mode', 'false', 'Global maintenance switch (true/false)'),
('live_dispatch_enabled', 'true', 'Enable automatic delivery agent allocation'),
('instant_refund_enabled', 'true', 'Enable 100% automated prepaid refund engine');

-- ═══════════════════════════════════════════════════════════════
-- 6. Verification Summary
-- ═══════════════════════════════════════════════════════════════
SELECT 
  '✓ FoodFlow Enterprise MySQL Database created & seeded successfully!' AS `Status`,
  (SELECT COUNT(*) FROM `users`) AS `Users`,
  (SELECT COUNT(*) FROM `restaurants`) AS `Restaurants`,
  (SELECT COUNT(*) FROM `menu_items`) AS `MenuItems`,
  (SELECT COUNT(*) FROM `orders`) AS `Orders`,
  (SELECT COUNT(*) FROM `payment_transactions`) AS `Transactions`,
  (SELECT COUNT(*) FROM `refunds`) AS `Refunds`,
  (SELECT COUNT(*) FROM `delivery_partners`) AS `Fleet`,
  (SELECT COUNT(*) FROM `reviews_ratings`) AS `Reviews`;
