-- ═══════════════════════════════════════════════════════════════
-- FoodFlow — Enterprise Relational Database Schema & Catalog
-- Target Database: MySQL 8.0+ / MySQL Workbench
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS `foodflow_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `foodflow_db`;

-- Drop existing tables in reverse foreign key dependency order
DROP TABLE IF EXISTS `platform_settings`;
DROP TABLE IF EXISTS `system_audit_logs`;
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
-- 1. Core Relational Tables
-- ═══════════════════════════════════════════════════════════════

-- Table 1: Users & Authentication Directory
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
  `wallet_balance` DECIMAL(12, 2) NOT NULL DEFAULT 1000.00,
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
  `label` VARCHAR(50) NOT NULL DEFAULT 'Home',
  `recipient_name` VARCHAR(150) NOT NULL,
  `recipient_phone` VARCHAR(30) NOT NULL,
  `address_text` TEXT NOT NULL,
  `city` VARCHAR(100) NOT NULL DEFAULT 'Hyderabad',
  `pincode` VARCHAR(20) NOT NULL DEFAULT '500081',
  `is_default` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_user_addresses_email` (`user_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3: Restaurants Catalog
CREATE TABLE `restaurants` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `cuisine` VARCHAR(100) NOT NULL,
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 4.50,
  `delivery_time` VARCHAR(50) NOT NULL DEFAULT '25–35',
  `delivery_fee` DECIMAL(8, 2) NOT NULL DEFAULT 30.00,
  `image_url` VARCHAR(500) NOT NULL,
  `tag` VARCHAR(50) DEFAULT 'Popular',
  `description` TEXT,
  `location` VARCHAR(200) DEFAULT 'Hyderabad, Telangana',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `orders_count` INT NOT NULL DEFAULT 0,
  `revenue` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_restaurants_cuisine` (`cuisine`),
  INDEX `idx_restaurants_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 4: Menu Items Catalog
CREATE TABLE `menu_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `restaurant_id` INT NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(10, 2) NOT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `emoji` VARCHAR(20) DEFAULT '🍽️',
  `is_veg` BOOLEAN NOT NULL DEFAULT TRUE,
  `is_bestseller` BOOLEAN NOT NULL DEFAULT FALSE,
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 4.50,
  `available` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE,
  INDEX `idx_menu_restaurant` (`restaurant_id`),
  INDEX `idx_menu_category` (`category`),
  INDEX `idx_menu_available` (`available`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 5: Orders Master Ledger
CREATE TABLE `orders` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `customer_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `delivery_address` TEXT NOT NULL,
  `restaurant_id` INT NOT NULL,
  `restaurant_name` VARCHAR(200) NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `delivery_fee` DECIMAL(10, 2) NOT NULL DEFAULT 30.00,
  `platform_fee` DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
  `total` DECIMAL(10, 2) NOT NULL,
  `promo_code` VARCHAR(50) DEFAULT NULL,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'UPI',
  `payment_status` ENUM('pending', 'success', 'failed', 'refunded', 'cancelled') NOT NULL DEFAULT 'pending',
  `status` ENUM('pending', 'preparing', 'on-the-way', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  `cancel_reason` TEXT DEFAULT NULL,
  `cancelled_by` VARCHAR(100) DEFAULT NULL,
  `cancelled_at` TIMESTAMP NULL DEFAULT NULL,
  `refund_status` ENUM('none', 'pending', 'processing', 'refunded', 'not_applicable') NOT NULL DEFAULT 'none',
  `refund_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `refund_ref` VARCHAR(100) DEFAULT NULL,
  `refund_time` TIMESTAMP NULL DEFAULT NULL,
  `kitchen_notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`),
  INDEX `idx_orders_email` (`email`),
  INDEX `idx_orders_status` (`status`),
  INDEX `idx_orders_payment_status` (`payment_status`),
  INDEX `idx_orders_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 6: Order Items Breakdown
CREATE TABLE `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `menu_item_id` INT DEFAULT NULL,
  `item_name` VARCHAR(200) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10, 2) NOT NULL,
  `total_price` DECIMAL(10, 2) NOT NULL,
  `is_veg` BOOLEAN NOT NULL DEFAULT TRUE,
  `image_url` VARCHAR(500) DEFAULT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_order_items_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 7: Real-Time Order Tracking Timeline
CREATE TABLE `order_tracking_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `status` ENUM('pending', 'preparing', 'on-the-way', 'delivered', 'cancelled') NOT NULL,
  `status_title` VARCHAR(150) NOT NULL,
  `status_description` VARCHAR(255) NOT NULL,
  `actor` VARCHAR(100) NOT NULL DEFAULT 'System',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_tracking_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 8: Payment Transactions Ledger
CREATE TABLE `payment_transactions` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `customer_email` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `method` VARCHAR(50) NOT NULL,
  `status` ENUM('success', 'failed', 'refunded', 'pending') NOT NULL DEFAULT 'success',
  `refund_ref` VARCHAR(100) DEFAULT NULL,
  `gateway_txn_id` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_payment_order_id` (`order_id`),
  INDEX `idx_payment_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 9: Refunds & Financial Reversals
CREATE TABLE `refunds` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `customer_email` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `original_payment_method` VARCHAR(50) NOT NULL,
  `refund_status` ENUM('initiated', 'processing', 'processed', 'failed') NOT NULL DEFAULT 'processed',
  `reason` TEXT NOT NULL,
  `processed_by` VARCHAR(100) NOT NULL DEFAULT 'System',
  `gateway_refund_id` VARCHAR(100) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_refunds_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 10: Promo Coupons & Discounts
CREATE TABLE `promo_coupons` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `discount_percent` INT NOT NULL DEFAULT 20,
  `max_discount` DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
  `min_order_amount` DECIMAL(10, 2) NOT NULL DEFAULT 199.00,
  `description` VARCHAR(255) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `valid_until` DATE DEFAULT '2026-12-31',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_promo_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 11: Coupon Usage History
CREATE TABLE `coupon_usage_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `coupon_id` INT NOT NULL,
  `order_id` VARCHAR(50) NOT NULL,
  `user_email` VARCHAR(255) NOT NULL,
  `discount_availed` DECIMAL(10, 2) NOT NULL,
  `used_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`coupon_id`) REFERENCES `promo_coupons`(`id`),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 12: Customer Reviews & Ratings
CREATE TABLE `reviews_ratings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(50) NOT NULL,
  `restaurant_id` INT NOT NULL,
  `user_email` VARCHAR(255) NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `food_rating` INT NOT NULL CHECK (`food_rating` BETWEEN 1 AND 5),
  `delivery_rating` INT NOT NULL DEFAULT 5 CHECK (`delivery_rating` BETWEEN 1 AND 5),
  `comment` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 13: Delivery Partners Network
CREATE TABLE `delivery_partners` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) NOT NULL UNIQUE,
  `vehicle_type` ENUM('Bike', 'Scooter', 'EV Bike') NOT NULL DEFAULT 'Bike',
  `status` ENUM('active', 'on-delivery', 'offline') NOT NULL DEFAULT 'active',
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 4.80,
  `total_deliveries` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 14: Password Resets & OTP Validation
CREATE TABLE `password_resets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `otp_code` VARCHAR(10) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `used` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_resets_email_otp` (`email`, `otp_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 15: Shopping Cart Items (Server Sync)
CREATE TABLE `cart_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_email` VARCHAR(255) NOT NULL,
  `menu_item_id` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE,
  INDEX `idx_cart_user` (`user_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 16: System Audit Logs
CREATE TABLE `system_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `level` ENUM('INFO', 'WARN', 'ERROR') NOT NULL DEFAULT 'INFO',
  `text` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 17: Platform Global Settings
CREATE TABLE `platform_settings` (
  `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ═══════════════════════════════════════════════════════════════
-- 2. Analytical Reporting Views
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW `vw_live_orders_dashboard` AS
SELECT 
  o.id AS order_id,
  o.customer_name,
  o.phone,
  o.restaurant_name,
  o.total,
  o.payment_method,
  o.payment_status,
  o.status AS order_status,
  o.refund_status,
  o.created_at,
  COUNT(oi.id) AS total_items_count
FROM `orders` o
LEFT JOIN `order_items` oi ON o.id = oi.order_id
GROUP BY o.id
ORDER BY o.created_at DESC;

CREATE OR REPLACE VIEW `vw_restaurant_performance` AS
SELECT 
  r.id AS restaurant_id,
  r.name AS restaurant_name,
  r.cuisine,
  r.rating,
  r.status,
  COUNT(DISTINCT o.id) AS total_orders,
  IFNULL(SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END), 0) AS total_revenue,
  COUNT(DISTINCT m.id) AS menu_items_count
FROM `restaurants` r
LEFT JOIN `orders` o ON r.id = o.restaurant_id
LEFT JOIN `menu_items` m ON r.id = m.restaurant_id
GROUP BY r.id
ORDER BY total_revenue DESC;

CREATE OR REPLACE VIEW `vw_customer_order_summary` AS
SELECT 
  u.id AS user_id,
  u.name AS customer_name,
  u.email,
  u.phone,
  u.orders_count,
  u.total_spent,
  u.status AS user_status,
  MAX(o.created_at) AS last_order_date
FROM `users` u
LEFT JOIN `orders` o ON u.email = o.email
GROUP BY u.id
ORDER BY u.total_spent DESC;

-- ═══════════════════════════════════════════════════════════════
-- 3. Production Seed Records
-- ═══════════════════════════════════════════════════════════════

-- Initial Users
INSERT INTO `users` (`id`, `name`, `first_name`, `last_name`, `email`, `password`, `phone`, `role`, `status`, `orders_count`, `total_spent`, `joined_date`, `initials`) VALUES
('U001', 'Ravi Kumar', 'Ravi', 'Kumar', 'ravi@example.com', 'Password@123', '9876543210', 'Customer', 'active', 4, 1840.00, 'Jan 2026', 'RK'),
('U002', 'Priya Sharma', 'Priya', 'Sharma', 'priya@example.com', 'Password@123', '9123456789', 'Customer', 'active', 2, 780.00, 'Feb 2026', 'PS'),
('U003', 'Vikram Patel', 'Vikram', 'Patel', 'vikram@example.com', 'Password@123', '9898989898', 'Customer', 'active', 1, 350.00, 'Feb 2026', 'VP'),
('U004', 'Ananya Roy', 'Ananya', 'Roy', 'ananya@example.com', 'Password@123', '9765432100', 'Customer', 'suspended', 0, 0.00, 'Mar 2026', 'AR'),
('U005', 'Chef Mehboob', 'Chef', 'Mehboob', 'mehboob@spicegarden.com', 'Password@123', '9876500001', 'Restaurant Admin', 'active', 0, 0.00, 'Jan 2026', 'CM'),
('U006', 'Super Administrator', 'Super', 'Administrator', 'admin@foodflow.com', 'Admin@2026', '9999988888', 'Super Admin', 'active', 0, 0.00, 'Jan 2026', 'SA');

-- User Addresses
INSERT INTO `user_addresses` (`user_email`, `label`, `recipient_name`, `recipient_phone`, `address_text`, `city`, `pincode`, `is_default`) VALUES
('ravi@example.com', 'Home', 'Ravi Kumar', '9876543210', 'Flat 4B, Palm Grove Apartments, Malkajgiri', 'Hyderabad', '500047', TRUE),
('ravi@example.com', 'Office', 'Ravi Kumar', '9876543210', 'Building 12, Mindspace IT Park, Hitec City', 'Hyderabad', '500081', FALSE),
('priya@example.com', 'Home', 'Priya Sharma', '9123456789', 'Plot 42, Jubilee Hills, Road No. 36', 'Hyderabad', '500033', TRUE);

-- Restaurants Catalog
INSERT INTO `restaurants` (`id`, `name`, `cuisine`, `rating`, `delivery_time`, `delivery_fee`, `image_url`, `tag`, `description`, `location`, `status`, `orders_count`, `revenue`) VALUES
(1, 'Spice Garden', 'Biryani', 4.80, '25–35', 0.00, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80', 'Bestseller', 'Authentic Hyderabadi Dum Biryani, Rich Kebabs & Mughlai Specials.', 'Banjara Hills, Hyderabad', 'active', 142, 68900.00),
(2, 'Pizza Republic', 'Pizza', 4.60, '20–30', 30.00, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80', 'Popular', 'Wood-fired gourmet sourdough pizzas, creamy pasta & Italian desserts.', 'Jubilee Hills, Hyderabad', 'active', 98, 44200.00),
(3, 'Dragon Wok', 'Chinese', 4.40, '30–40', 30.00, 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=600&q=80', 'Trending', 'Sizzling Hakka noodles, crispy Manchurian & authentic dim sums.', 'Hitec City, Hyderabad', 'active', 64, 28700.00),
(4, 'Burger Barn', 'Burger', 4.50, '15–25', 0.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', 'Fast Delivery', 'Juicy grilled smash burgers, loaded cheddar peri-peri fries, crispy chicken brioche and thick milkshakes.', 'Madhapur, Hyderabad', 'active', 115, 39800.00),
(5, 'Dosa Delight', 'South Indian', 4.70, '20–30', 20.00, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80', 'Top Rated', 'Crispy golden ghee roast dosas, fluffy idlis & piping hot sambar.', 'Gachibowli, Hyderabad', 'active', 88, 22100.00),
(6, 'Sweet Cravings', 'Desserts', 4.90, '15–20', 25.00, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80', 'Sweet Treats', 'Artisan Belgian waffles, double chocolate brownies & rich ice creams.', 'Kondapur, Hyderabad', 'active', 72, 19400.00);

-- Menu Items Catalog
INSERT INTO `menu_items` (`id`, `restaurant_id`, `category`, `name`, `description`, `price`, `image_url`, `emoji`, `is_veg`, `is_bestseller`, `rating`, `available`) VALUES
(101, 1, 'Biryani Specials', 'Royal Chicken Dum Biryani', 'Slow-cooked aromatic basmati rice with tender spiced chicken cuts.', 320.00, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80', '🍗', FALSE, TRUE, 4.90, TRUE),
(102, 1, 'Biryani Specials', 'Hyderabadi Mutton Dum Biryani', 'Succulent tender mutton pieces dum-cooked with saffron spices.', 420.00, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80', '🥩', FALSE, TRUE, 4.85, TRUE),
(103, 1, 'Biryani Specials', 'Shahi Paneer Dum Biryani', 'Fresh cottage cheese cubes marinated in royal spices & basmati rice.', 280.00, 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?auto=format&fit=crop&w=400&q=80', '🌿', TRUE, FALSE, 4.70, TRUE),
(104, 1, 'Starters', 'Chicken 65 (Crispy Spiced)', 'Crispy fried chicken with curry leaves, crushed garlic and green chillies.', 240.00, 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=400&q=80', '🍗', FALSE, TRUE, 4.80, TRUE),
(105, 2, 'Pizzas', 'Margherita Supreme Pizza', 'Classic fresh mozzarella, Italian basil, San Marzano tomato sauce on sourdough.', 349.00, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80', '🍕', TRUE, TRUE, 4.75, TRUE),
(106, 2, 'Pizzas', 'Spicy Peri Peri Paneer Pizza', 'Fiery peri-peri paneer, roasted peppers, onions and melted cheese.', 399.00, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80', '🍕', TRUE, FALSE, 4.60, TRUE),
(107, 2, 'Pizzas', 'BBQ Smoked Chicken Pizza', 'Tender BBQ chicken chunks, caramelized onions and double mozzarella.', 449.00, 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&w=400&q=80', '🍗', FALSE, TRUE, 4.80, TRUE),
(108, 3, 'Noodles & Rice', 'Schezwan Chicken Hakka Noodles', 'Wok-tossed noodles with spicy Schezwan sauce, tender chicken & scallions.', 260.00, 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=400&q=80', '🍜', FALSE, TRUE, 4.65, TRUE),
(109, 3, 'Noodles & Rice', 'Vegetable Fried Rice', 'Aromatic wok-fried rice with assorted crispy seasonal garden vegetables.', 210.00, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80', '🌿', TRUE, FALSE, 4.50, TRUE),
(110, 4, 'Burgers', 'The Classic Smash Cheeseburger', 'Double grilled patty, melted cheddar, crisp lettuce, secret house relish.', 249.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', '🍔', FALSE, TRUE, 4.70, TRUE),
(111, 4, 'Burgers', 'Crispy Golden Veggie Burger', 'Crunchy mixed-vegetable patty with spiced chipotle mayo and pickles.', 199.00, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=400&q=80', '🌿', TRUE, FALSE, 4.45, TRUE),
(112, 4, 'Burgers', 'Fiery Peri-Peri Crispy Chicken Brioche', '24-hour buttermilk soaked fried chicken breast with spicy peri-peri rub.', 279.00, 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=400&q=80', '🍗', FALSE, TRUE, 4.90, TRUE),
(113, 4, 'Sides & Fries', 'Loaded Peri-Peri Truffle Fries', 'Crispy skin-on french fries with cheddar cheese sauce, peri-peri dust & jalapeños.', 149.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80', '🌿', TRUE, TRUE, 4.75, TRUE),
(114, 5, 'South Indian Classics', 'Ghee Roast Masala Dosa', 'Golden crispy rice crepe smeared with pure ghee and spiced potato mash.', 140.00, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80', '🥘', TRUE, TRUE, 4.90, TRUE),
(115, 5, 'South Indian Classics', 'Steamed Ghee Idli (4 Pcs)', 'Melt-in-mouth steamed rice cakes served with sambar & two chutneys.', 99.00, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80', '🌿', TRUE, FALSE, 4.80, TRUE),
(116, 6, 'Desserts & Shakes', 'Belgian Chocolate Waffle', 'Warm freshly baked waffle smothered in rich warm Belgian chocolate.', 180.00, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80', '🍰', TRUE, TRUE, 4.95, TRUE),
(117, 6, 'Desserts & Shakes', 'Gourmet Red Velvet Pastry', 'Layered soft sponge cake with cream cheese frosting.', 150.00, 'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?auto=format&fit=crop&w=400&q=80', '🍰', TRUE, FALSE, 4.75, TRUE);

-- Promo Coupons
INSERT INTO `promo_coupons` (`code`, `discount_percent`, `max_discount`, `min_order_amount`, `description`, `is_active`) VALUES
('KBSIRSTUDENT', 50, 150.00, 199.00, '50% Special Student Discount up to ₹150', TRUE),
('FOODFLOW50', 50, 100.00, 199.00, '50% off on your first food order', TRUE),
('WEEKEND20', 20, 80.00, 249.00, '20% off on all weekend family orders', TRUE),
('TASTY100', 30, 100.00, 299.00, 'Flat ₹100 discount on orders above ₹299', TRUE);

-- Initial Orders
INSERT INTO `orders` (`id`, `customer_name`, `email`, `phone`, `delivery_address`, `restaurant_id`, `restaurant_name`, `subtotal`, `discount`, `delivery_fee`, `platform_fee`, `total`, `promo_code`, `payment_method`, `payment_status`, `status`, `refund_status`, `refund_amount`) VALUES
('FF88219A', 'Ravi Kumar', 'ravi@example.com', '9876543210', 'Flat 4B, Palm Grove Apartments, Malkajgiri', 1, 'Spice Garden', 560.00, 100.00, 0.00, 5.00, 465.00, 'FOODFLOW50', 'UPI (Google Pay)', 'success', 'delivered', 'none', 0.00),
('FF94821C', 'Priya Sharma', 'priya@example.com', '9123456789', 'Plot 42, Jubilee Hills, Road No. 36', 2, 'Pizza Republic', 748.00, 0.00, 30.00, 5.00, 783.00, NULL, 'Credit Card (Visa)', 'success', 'on-the-way', 'none', 0.00),
('FF77312D', 'Ravi Kumar', 'ravi@example.com', '9876543210', 'Building 12, Mindspace IT Park, Hitec City', 4, 'Burger Barn', 448.00, 50.00, 0.00, 5.00, 403.00, 'WEEKEND20', 'UPI (PhonePe)', 'success', 'preparing', 'none', 0.00);

-- Order Items
INSERT INTO `order_items` (`order_id`, `menu_item_id`, `item_name`, `quantity`, `unit_price`, `total_price`, `is_veg`, `image_url`) VALUES
('FF88219A', 101, 'Royal Chicken Dum Biryani', 1, 320.00, 320.00, FALSE, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80'),
('FF88219A', 104, 'Chicken 65 (Crispy Spiced)', 1, 240.00, 240.00, FALSE, 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=400&q=80'),
('FF94821C', 105, 'Margherita Supreme Pizza', 1, 349.00, 349.00, TRUE, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80'),
('FF94821C', 106, 'Spicy Peri Peri Paneer Pizza', 1, 399.00, 399.00, TRUE, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80'),
('FF77312D', 110, 'The Classic Smash Cheeseburger', 1, 249.00, 249.00, FALSE, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80'),
('FF77312D', 111, 'Crispy Golden Veggie Burger', 1, 199.00, 199.00, TRUE, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=400&q=80');

-- Order Tracking History
INSERT INTO `order_tracking_history` (`order_id`, `status`, `status_title`, `status_description`, `actor`) VALUES
('FF88219A', 'pending', 'Order Confirmed', 'Received by kitchen', 'Customer'),
('FF88219A', 'preparing', 'Chef is preparing your meal', 'Fresh ingredients cooking', 'Spice Garden'),
('FF88219A', 'on-the-way', 'Valet is on the way', 'Order picked up by partner', 'Delivery Valet'),
('FF88219A', 'delivered', 'Order Delivered', 'Delivered at door', 'Delivery Valet'),
('FF94821C', 'pending', 'Order Confirmed', 'Received by kitchen', 'Customer'),
('FF94821C', 'preparing', 'Chef is preparing your meal', 'Pizza in wood-fired oven', 'Pizza Republic'),
('FF94821C', 'on-the-way', 'Valet is on the way', 'En route to Jubilee Hills', 'Delivery Valet'),
('FF77312D', 'pending', 'Order Confirmed', 'Received by kitchen', 'Customer'),
('FF77312D', 'preparing', 'Chef is preparing your meal', 'Burgers sizzling on grill', 'Burger Barn');

-- Payment Transactions
INSERT INTO `payment_transactions` (`id`, `order_id`, `customer_name`, `customer_email`, `amount`, `method`, `status`) VALUES
('TXN-882101', 'FF88219A', 'Ravi Kumar', 'ravi@example.com', 465.00, 'UPI (Google Pay)', 'success'),
('TXN-948202', 'FF94821C', 'Priya Sharma', 'priya@example.com', 783.00, 'Credit Card (Visa)', 'success'),
('TXN-773103', 'FF77312D', 'Ravi Kumar', 'ravi@example.com', 403.00, 'UPI (PhonePe)', 'success');

-- Delivery Partners
INSERT INTO `delivery_partners` (`name`, `phone`, `vehicle_type`, `status`, `rating`, `total_deliveries`) VALUES
('Suresh Goud', '9848011223', 'Bike', 'on-delivery', 4.90, 312),
('Mohammed Arif', '9848033445', 'EV Bike', 'active', 4.85, 248),
('Rajesh Varma', '9848055667', 'Scooter', 'active', 4.75, 189);

-- Platform Settings
INSERT INTO `platform_settings` (`setting_key`, `setting_value`, `description`) VALUES
('platform_fee', '5.00', 'Flat platform service fee per order in INR'),
('delivery_fee_base', '30.00', 'Default base delivery fee in INR'),
('tax_rate_percent', '0.00', 'GST rate percentage'),
('maintenance_mode', 'false', 'Global platform maintenance toggle');

-- System Audit Logs
INSERT INTO `system_audit_logs` (`level`, `text`) VALUES
('INFO', 'FoodFlow Enterprise Database initialized successfully with 16 tables.'),
('INFO', 'Catalog loaded with 6 restaurants and 17 dishes.');
