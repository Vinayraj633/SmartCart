DROP DATABASE IF EXISTS smart_cart;
CREATE DATABASE smart_cart;
USE smart_cart;

CREATE TABLE products (
    product_id VARCHAR(10) PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    category   VARCHAR(50)  NOT NULL,
    price      DECIMAL(10,2) NOT NULL,
    stock      INT NOT NULL
);

CREATE TABLE coupons (
    code           VARCHAR(20) PRIMARY KEY,
    discount_type  ENUM('PERCENT','FLAT') NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    min_cart_value DECIMAL(10,2) NOT NULL,
    max_discount   DECIMAL(10,2) NOT NULL,
    vip_only       BOOLEAN DEFAULT FALSE
);

CREATE TABLE orders (
    order_id       INT AUTO_INCREMENT PRIMARY KEY,
    customer_type  VARCHAR(20),
    coupon_code    VARCHAR(20),
    subtotal       DECIMAL(10,2),
    total_discount DECIMAL(10,2),
    gst            DECIMAL(10,2),
    final_amount   DECIMAL(10,2),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id   INT,
    product_id VARCHAR(10),
    quantity   INT,
    unit_price DECIMAL(10,2),
    line_total DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

INSERT INTO products VALUES
('P101','Wireless Mouse','Electronics',799.00,50),
('P102','Mechanical Keyboard','Electronics',2499.00,30),
('P103','USB-C Cable','Accessories',399.00,100),
('P104','Laptop Stand','Accessories',1499.00,25),
('P105','Webcam','Electronics',3299.00,20),
('P106','Headphones','Electronics',1999.00,40),
('P107','Office Chair','Furniture',8999.00,15),
('P108','Desk Lamp','Home',1299.00,35),
('P109','Notebook','Stationery',199.00,200),
('P110','Backpack','Accessories',1799.00,45),
('P111','Water Bottle','Home',699.00,80),
('P112','Monitor 24 inch','Electronics',10999.00,10),
('P113','Phone Stand','Accessories',599.00,60),
('P114','Keyboard Wrist Rest','Accessories',899.00,40),
('P115','Desk Mat','Home',999.00,50);

INSERT INTO coupons VALUES
('SAVE10','PERCENT',10,3000,1000,FALSE),
('SAVE15','PERCENT',15,7000,2000,FALSE),
('FLAT500','FLAT',500,5000,500,FALSE),
('VIP20','PERCENT',20,10000,3000,TRUE);

SELECT * FROM products;  
SELECT COUNT(*) FROM coupons;

USE smart_cart;

CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    customer_type VARCHAR(20) NOT NULL DEFAULT 'REGULAR',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
DESCRIBE users;

USE smart_cart;

-- Add is_admin column to users
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Create an admin user (password: admin123)
-- Hash is SHA-256 of "admin123"
INSERT INTO users (name, email, password_hash, customer_type, is_admin)
VALUES (
  'Admin',
  'admin@gmail.com',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'REGULAR',
  TRUE
) ON DUPLICATE KEY UPDATE is_admin = TRUE;

USE smart_cart;

-- Add user columns to orders
ALTER TABLE orders
  ADD COLUMN user_id    INT,
  ADD COLUMN user_name  VARCHAR(100),
  ADD COLUMN user_email VARCHAR(120);

-- Verify
DESCRIBE orders;

USE smart_cart;

ALTER TABLE orders
  ADD COLUMN address_line VARCHAR(255),
  ADD COLUMN city VARCHAR(100),
  ADD COLUMN state VARCHAR(100),
  ADD COLUMN pincode VARCHAR(10),
  ADD COLUMN phone VARCHAR(20);
  
USE smart_cart;

-- Ensure table is original
DESCRIBE products;

USE smart_cart;

SELECT 'products' AS table_name, COUNT(*) AS columns_count
FROM information_schema.columns WHERE table_schema='smart_cart' AND table_name='products'
UNION ALL
SELECT 'coupons', COUNT(*)
FROM information_schema.columns WHERE table_schema='smart_cart' AND table_name='coupons'
UNION ALL
SELECT 'users', COUNT(*)
FROM information_schema.columns WHERE table_schema='smart_cart' AND table_name='users'
UNION ALL
SELECT 'orders', COUNT(*)
FROM information_schema.columns WHERE table_schema='smart_cart' AND table_name='orders'
UNION ALL
SELECT 'order_items', COUNT(*)
FROM information_schema.columns WHERE table_schema='smart_cart' AND table_name='order_items';

USE smart_cart;

-- Users table columns
SHOW COLUMNS FROM users;

-- Orders table columns
SHOW COLUMNS FROM orders;

USE smart_cart;
ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Verify
DESCRIBE products;

ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT 'PLACED';
ALTER TABLE orders ADD COLUMN cancel_reason VARCHAR(200);
ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMP;

ALTER TABLE products ADD COLUMN active BOOLEAN DEFAULT TRUE;

-- Set all existing products as active
UPDATE products SET active = TRUE WHERE product_id IS NOT NULL;

SET SQL_SAFE_UPDATES = 0;
UPDATE products SET active = TRUE WHERE active IS NULL;
SET SQL_SAFE_UPDATES = 1;

USE smart_cart;

CREATE TABLE IF NOT EXISTS reviews (
    review_id   INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT DEFAULT NULL,
    product_id  VARCHAR(20) NOT NULL,
    user_id     INT NOT NULL,
    user_name   VARCHAR(100),
    rating      TINYINT NOT NULL,
    feedback    VARCHAR(500),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_user_product (user_id, product_id),
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
    INDEX idx_reviews_product (product_id),
    INDEX idx_reviews_user    (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

USE smart_cart;
SELECT order_id, status, created_at FROM orders WHERE user_id = 2;

USE smart_cart;

CREATE TABLE IF NOT EXISTS wishlist (
    wishlist_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    product_id  VARCHAR(20) NOT NULL,
    added_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_product_wish (user_id, product_id),
    INDEX idx_wish_user (user_id),
    INDEX idx_wish_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

USE smart_cart;

CREATE TABLE IF NOT EXISTS membership_payments (
    payment_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    tier            VARCHAR(20) NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    payment_method  VARCHAR(40),
    paid_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mp_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE membership_payments
  ADD COLUMN status      VARCHAR(20) DEFAULT 'PAID',
  ADD COLUMN invoice_no  VARCHAR(40) DEFAULT NULL,
  ADD COLUMN starts_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN ends_at     TIMESTAMP NULL DEFAULT NULL;
  
  CREATE TABLE IF NOT EXISTS memberships (
    membership_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id           INT NOT NULL UNIQUE,
    tier              VARCHAR(20) NOT NULL DEFAULT 'REGULAR',
    started_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    renews_at         TIMESTAMP NULL DEFAULT NULL,
    auto_renew        TINYINT(1) DEFAULT 1,
    cancelled_at      TIMESTAMP NULL DEFAULT NULL,
    cancellation_note VARCHAR(255) DEFAULT NULL,
    INDEX idx_mem_user (user_id),
    INDEX idx_mem_renews (renews_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO memberships (user_id, tier, renews_at, auto_renew)
SELECT id, customer_type, NULL, 1 FROM users;

SELECT * FROM memberships;
SELECT * FROM membership_payments;