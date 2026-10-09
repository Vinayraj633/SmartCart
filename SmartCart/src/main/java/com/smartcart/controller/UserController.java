package com.smartcart.controller;

import com.smartcart.dao.AdminDAO;
import com.smartcart.dao.ProductDAO;
import com.smartcart.dao.UserDAO;
import com.smartcart.model.Order;
import com.smartcart.model.OrderItem;
import com.smartcart.model.Product;
import com.smartcart.model.User;
import com.smartcart.util.DBConnection;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserDAO userDAO;
    private final AdminDAO adminDAO;
    private final ProductDAO productDAO;

    public UserController(UserDAO userDAO, AdminDAO adminDAO, ProductDAO productDAO) {
        this.userDAO = userDAO;
        this.adminDAO = adminDAO;
        this.productDAO = productDAO;
    }

    /* ====================================================================
       SIGNUP
       ==================================================================== */
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> body, HttpSession session) throws SQLException {
        try {
            String name = body.get("name").trim();
            String email = body.get("email").trim().toLowerCase();
            String password = body.get("password");
            String customerType = body.getOrDefault("customerType", "REGULAR").toUpperCase();

            if (name.isEmpty()) throw new IllegalArgumentException("Name required");
            if (email.isEmpty() || !email.contains("@")) throw new IllegalArgumentException("Invalid email");
            if (password.length() < 4) throw new IllegalArgumentException("Password too short");
            if (!customerType.equals("REGULAR") && !customerType.equals("PREMIUM") && !customerType.equals("VIP"))
                throw new IllegalArgumentException("Invalid customer type");

            if (userDAO.emailExists(email))
                throw new IllegalArgumentException("Email already registered");

            int id = userDAO.createUser(name, email, password, customerType);
            User u = new User(id, name, email, customerType);

            // Create default memberships row (REGULAR, no renewal)
            try (Connection c = DBConnection.getConnection()) {
                String memSql =
                        "INSERT IGNORE INTO memberships (user_id, tier, renews_at, auto_renew) " +
                                "VALUES (?, 'REGULAR', NULL, 1)";
                try (PreparedStatement ps = c.prepareStatement(memSql)) {
                    ps.setInt(1, id);
                    ps.executeUpdate();
                }
            } catch (SQLException ignored) {
                // memberships table may not exist yet — non-fatal
            }

            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("isAdmin", false);
            res.put("user", u);
            return ResponseEntity.ok(res);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       LOGIN
       ==================================================================== */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body, HttpSession session) throws SQLException {
        try {
            String email = body.get("email").trim().toLowerCase();
            String password = body.get("password");

            User u = userDAO.findByEmail(email);
            if (u == null) throw new IllegalArgumentException("User not found");
            if (!userDAO.validateLogin(email, password))
                throw new IllegalArgumentException("Wrong password");

            session.setAttribute("user", u);

            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("isAdmin", u.isAdmin());
            res.put("user", u);
            return ResponseEntity.ok(res);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       ME
       ==================================================================== */
    @GetMapping("/me")
    public Map<String, Object> me(HttpSession session) {
        User u = (User) session.getAttribute("user");
        if (u == null) return Map.of("loggedIn", false);
        return Map.of("loggedIn", true, "isAdmin", u.isAdmin(), "user", u);
    }

    /* ====================================================================
       LOGOUT
       ==================================================================== */
    @PostMapping("/logout")
    public Map<String, Object> logout(HttpSession session) {
        session.invalidate();
        return Map.of("success", true);
    }

    /* ====================================================================
       UPGRADE TIER (simple, no payment) — used for downgrade to REGULAR
       ==================================================================== */
    @PostMapping("/upgrade")
    public ResponseEntity<?> upgrade(@RequestBody Map<String, String> body, HttpSession session) throws SQLException {
        try {
            User sessionUser = (User) session.getAttribute("user");
            if (sessionUser == null)
                throw new IllegalArgumentException("Please login first");

            String newTier = body.get("customerType").toUpperCase();
            if (!newTier.equals("REGULAR") && !newTier.equals("PREMIUM") && !newTier.equals("VIP"))
                throw new IllegalArgumentException("Invalid tier");

            userDAO.updateTier(sessionUser.getId(), newTier);
            sessionUser.setCustomerType(newTier);
            session.setAttribute("user", sessionUser);

            // Sync memberships table
            try (Connection c = DBConnection.getConnection()) {
                String memSql =
                        "INSERT INTO memberships (user_id, tier, renews_at, auto_renew) " +
                                "VALUES (?, ?, NULL, 1) " +
                                "ON DUPLICATE KEY UPDATE " +
                                "  tier = VALUES(tier), " +
                                "  renews_at = NULL, " +
                                "  auto_renew = 1, " +
                                "  cancelled_at = NULL";
                try (PreparedStatement ps = c.prepareStatement(memSql)) {
                    ps.setInt(1, sessionUser.getId());
                    ps.setString(2, newTier);
                    ps.executeUpdate();
                }
            } catch (SQLException ignored) {}

            return ResponseEntity.ok(Map.of("success", true, "user", sessionUser));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       Helper — safe timestamp to string
       ==================================================================== */
    private String tsToStr(Timestamp ts) {
        return ts != null ? ts.toString() : null;
    }

    /* ====================================================================
       GET MEMBERSHIP INFO — current state + billing history
       ==================================================================== */
    @GetMapping("/membership")
    public ResponseEntity<?> getMembership(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Please login first"));
        }

        Map<String, Object> res = new HashMap<>();

        try (Connection c = DBConnection.getConnection()) {

            // 1. Current membership row
            String memSql =
                    "SELECT tier, started_at, renews_at, auto_renew, cancelled_at " +
                            "FROM memberships WHERE user_id = ?";
            try (PreparedStatement ps = c.prepareStatement(memSql)) {
                ps.setInt(1, user.getId());
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        Map<String, Object> mem = new HashMap<>();
                        mem.put("tier",        rs.getString("tier"));
                        mem.put("startedAt",   tsToStr(rs.getTimestamp("started_at")));
                        mem.put("renewsAt",    tsToStr(rs.getTimestamp("renews_at")));
                        mem.put("autoRenew",   rs.getBoolean("auto_renew"));
                        mem.put("cancelledAt", tsToStr(rs.getTimestamp("cancelled_at")));
                        res.put("membership", mem);
                    } else {
                        // No row — fall back to users.customer_type
                        res.put("membership", Map.of(
                                "tier", user.getCustomerType(),
                                "autoRenew", true
                        ));
                    }
                }
            }

            // 2. Billing history
            String paySql =
                    "SELECT payment_id, tier, amount, payment_method, status, " +
                            "       paid_at, invoice_no, starts_at, ends_at " +
                            "FROM membership_payments " +
                            "WHERE user_id = ? ORDER BY paid_at DESC LIMIT 50";

            List<Map<String, Object>> history = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(paySql)) {
                ps.setInt(1, user.getId());
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> p = new HashMap<>();
                        p.put("paymentId", rs.getInt("payment_id"));
                        p.put("tier",      rs.getString("tier"));
                        p.put("amount",    rs.getDouble("amount"));
                        p.put("method",    rs.getString("payment_method"));
                        p.put("status",    rs.getString("status"));
                        p.put("paidAt",    tsToStr(rs.getTimestamp("paid_at")));
                        p.put("invoiceNo", rs.getString("invoice_no"));
                        p.put("startsAt",  tsToStr(rs.getTimestamp("starts_at")));
                        p.put("endsAt",    tsToStr(rs.getTimestamp("ends_at")));
                        history.add(p);
                    }
                }
            }
            res.put("history", history);

            return ResponseEntity.ok(res);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       UPGRADE MEMBERSHIP (paid) — records payment + updates state
       ==================================================================== */
    @PostMapping("/upgrade/paid")
    public ResponseEntity<?> upgradePaid(@RequestBody Map<String, Object> body, HttpSession session) {
        User sessionUser = (User) session.getAttribute("user");
        if (sessionUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Please login first"));
        }

        Object tierObj    = body.get("customerType");
        Object paymentObj = body.get("paymentMethod");
        Object amountObj  = body.get("amount");

        if (tierObj == null || paymentObj == null || amountObj == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Missing customerType, paymentMethod, or amount"));
        }

        String newTier = tierObj.toString().toUpperCase();
        String paymentMethod = paymentObj.toString();
        double amount;
        try {
            amount = Double.parseDouble(amountObj.toString());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid amount"));
        }

        if (!newTier.equals("PREMIUM") && !newTier.equals("VIP")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid tier"));
        }

        double expected = newTier.equals("VIP") ? 2999.0 : 999.0;
        if (Math.abs(amount - expected) > 0.01) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid payment amount"));
        }

        try (Connection c = DBConnection.getConnection()) {

            String invoiceNo = "SC-" + System.currentTimeMillis();

            Timestamp now = new Timestamp(System.currentTimeMillis());
            Timestamp renewsAt = new Timestamp(
                    System.currentTimeMillis() + 365L * 24 * 60 * 60 * 1000
            );

            // 1. Insert payment row
            String paySql =
                    "INSERT INTO membership_payments " +
                            "(user_id, tier, amount, payment_method, status, invoice_no, starts_at, ends_at) " +
                            "VALUES (?, ?, ?, ?, 'PAID', ?, ?, ?)";
            try (PreparedStatement ps = c.prepareStatement(paySql)) {
                ps.setInt(1, sessionUser.getId());
                ps.setString(2, newTier);
                ps.setDouble(3, amount);
                ps.setString(4, paymentMethod);
                ps.setString(5, invoiceNo);
                ps.setTimestamp(6, now);
                ps.setTimestamp(7, renewsAt);
                ps.executeUpdate();
            }

            // 2. Upsert membership state
            String memSql =
                    "INSERT INTO memberships (user_id, tier, started_at, renews_at, auto_renew, cancelled_at) " +
                            "VALUES (?, ?, CURRENT_TIMESTAMP, ?, 1, NULL) " +
                            "ON DUPLICATE KEY UPDATE " +
                            "  tier = VALUES(tier), " +
                            "  renews_at = VALUES(renews_at), " +
                            "  auto_renew = 1, " +
                            "  cancelled_at = NULL";
            try (PreparedStatement ps = c.prepareStatement(memSql)) {
                ps.setInt(1, sessionUser.getId());
                ps.setString(2, newTier);
                ps.setTimestamp(3, renewsAt);
                ps.executeUpdate();
            }

            // 3. Update user tier
            userDAO.updateTier(sessionUser.getId(), newTier);
            sessionUser.setCustomerType(newTier);
            session.setAttribute("user", sessionUser);

            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("user", sessionUser);
            res.put("amountPaid", amount);
            res.put("paymentMethod", paymentMethod);
            res.put("invoiceNo", invoiceNo);
            res.put("renewsAt", renewsAt.toString());
            return ResponseEntity.ok(res);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Upgrade failed: " + e.getMessage()));
        }
    }

    /* ====================================================================
       CANCEL MEMBERSHIP — immediate drop to REGULAR
       ==================================================================== */
    @PostMapping("/membership/cancel")
    public ResponseEntity<?> cancelMembership(@RequestBody Map<String, Object> body,
                                              HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Please login first"));
        }

        String reason = body.get("reason") != null
                ? body.get("reason").toString()
                : "Not specified";

        try (Connection c = DBConnection.getConnection()) {

            // 1. Reset memberships row → REGULAR, no renewal, auto-renew off
            String memSql =
                    "UPDATE memberships SET " +
                            "  tier = 'REGULAR', " +
                            "  renews_at = NULL, " +
                            "  auto_renew = 0, " +
                            "  cancelled_at = CURRENT_TIMESTAMP, " +
                            "  cancellation_note = ? " +
                            "WHERE user_id = ?";
            try (PreparedStatement ps = c.prepareStatement(memSql)) {
                ps.setString(1, reason);
                ps.setInt(2, user.getId());
                int updated = ps.executeUpdate();
                if (updated == 0) {
                    return ResponseEntity.badRequest()
                            .body(Map.of("error", "No active membership found"));
                }
            }

            // 2. Downgrade the user immediately
            userDAO.updateTier(user.getId(), "REGULAR");
            user.setCustomerType("REGULAR");
            session.setAttribute("user", user);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "user", user,
                    "tier", "REGULAR"
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       PROMOTE DELIVERED ORDERS
       ==================================================================== */
    private void promoteDeliveredOrders(Connection c, int userId) throws SQLException {
        String sql =
                "UPDATE orders SET status = 'DELIVERED' " +
                        "WHERE user_id = ? " +
                        "  AND status IN ('ORDERED','PLACED','SHIPPED','OUT_FOR_DELIVERY') " +
                        "  AND created_at <= NOW() - INTERVAL 24 HOUR";
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, userId);
            ps.executeUpdate();
        }
    }

    /* ====================================================================
       MY ORDERS
       ==================================================================== */
    @GetMapping("/orders")
    public ResponseEntity<?> getMyOrders(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Please login first"));
        }

        try (Connection c = DBConnection.getConnection()) {
            promoteDeliveredOrders(c, user.getId());
        } catch (Exception e) {
            e.printStackTrace();
        }

        try {
            List<Order> orders = adminDAO.getOrdersByUserId(user.getId());

            for (Order o : orders) {
                for (OrderItem it : o.getItems()) {
                    Product p = productDAO.getById(it.getProductId());
                    if (p != null) {
                        it.setProductName(p.getName());
                        it.setProductCategory(p.getCategory());
                    } else {
                        it.setProductName(it.getProductId());
                    }
                }
            }

            return ResponseEntity.ok(orders);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       CANCEL ORDER
       ==================================================================== */
    @PostMapping("/orders/cancel")
    public ResponseEntity<?> cancelOrder(@RequestBody Map<String, Object> body, HttpSession session) {
        Map<String, Object> res = new HashMap<>();

        User user = (User) session.getAttribute("user");
        if (user == null) {
            res.put("error", "Please login first");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(res);
        }

        Object orderIdObj = body.get("orderId");
        if (orderIdObj == null) {
            res.put("error", "Missing orderId");
            return ResponseEntity.badRequest().body(res);
        }

        int orderId;
        try {
            orderId = Integer.parseInt(orderIdObj.toString());
        } catch (NumberFormatException e) {
            res.put("error", "Invalid orderId");
            return ResponseEntity.badRequest().body(res);
        }

        String reason = body.get("reason") != null
                ? body.get("reason").toString()
                : "Not specified";

        try (Connection c = DBConnection.getConnection()) {

            String checkSql = "SELECT status FROM orders WHERE order_id = ? AND user_id = ?";
            try (PreparedStatement ps = c.prepareStatement(checkSql)) {
                ps.setInt(1, orderId);
                ps.setInt(2, user.getId());
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        res.put("error", "Order not found");
                        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(res);
                    }
                    String status = rs.getString("status");
                    if (status != null && "CANCELLED".equalsIgnoreCase(status)) {
                        res.put("error", "Order already cancelled");
                        return ResponseEntity.badRequest().body(res);
                    }
                }
            }

            c.setAutoCommit(false);
            try {
                String itemsSql = "SELECT product_id, quantity FROM order_items WHERE order_id = ?";
                List<Map<String, Object>> orderItems = new ArrayList<>();

                try (PreparedStatement ps = c.prepareStatement(itemsSql)) {
                    ps.setInt(1, orderId);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            Map<String, Object> it = new HashMap<>();
                            it.put("productId", rs.getString("product_id"));
                            it.put("quantity", rs.getInt("quantity"));
                            orderItems.add(it);
                        }
                    }
                }

                String restoreSql = "UPDATE products SET stock = stock + ? WHERE product_id = ?";
                try (PreparedStatement ps = c.prepareStatement(restoreSql)) {
                    for (Map<String, Object> it : orderItems) {
                        ps.setInt(1, (int) it.get("quantity"));
                        ps.setString(2, (String) it.get("productId"));
                        ps.addBatch();
                    }
                    ps.executeBatch();
                }

                String updateSql =
                        "UPDATE orders SET status = 'CANCELLED', " +
                                "cancel_reason = ?, cancelled_at = CURRENT_TIMESTAMP " +
                                "WHERE order_id = ? AND user_id = ?";
                try (PreparedStatement ps = c.prepareStatement(updateSql)) {
                    ps.setString(1, reason);
                    ps.setInt(2, orderId);
                    ps.setInt(3, user.getId());
                    ps.executeUpdate();
                }

                c.commit();

                res.put("success", true);
                res.put("orderId", orderId);
                res.put("restoredItems", orderItems.size());
                return ResponseEntity.ok(res);

            } catch (Exception ex) {
                c.rollback();
                throw ex;
            } finally {
                c.setAutoCommit(true);
            }

        } catch (Exception e) {
            e.printStackTrace();
            res.put("error", "Failed to cancel: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(res);
        }
    }

    /* ====================================================================
       SUBMIT REVIEW
       ==================================================================== */
    @PostMapping("/reviews/submit")
    public ResponseEntity<?> submitReview(@RequestBody Map<String, Object> body,
                                          HttpSession session) {
        Map<String, Object> res = new HashMap<>();

        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Please login first"));
        }

        Object orderIdObj   = body.get("orderId");
        Object productIdObj = body.get("productId");
        Object ratingObj    = body.get("rating");

        if (orderIdObj == null || productIdObj == null || ratingObj == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Missing orderId, productId, or rating"));
        }

        int orderId, rating;
        try {
            orderId = Integer.parseInt(orderIdObj.toString());
            rating  = Integer.parseInt(ratingObj.toString());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid number format"));
        }
        if (rating < 1 || rating > 5) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Rating must be between 1 and 5"));
        }

        String productId = productIdObj.toString().trim();
        String feedback  = body.get("feedback") != null ? body.get("feedback").toString().trim() : "";
        if (feedback.length() > 500) feedback = feedback.substring(0, 500);

        try (Connection c = DBConnection.getConnection()) {

            String checkSql = "SELECT status FROM orders WHERE order_id = ? AND user_id = ?";
            try (PreparedStatement ps = c.prepareStatement(checkSql)) {
                ps.setInt(1, orderId);
                ps.setInt(2, user.getId());
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(Map.of("error", "Order not found"));
                    }
                    String status = rs.getString("status");
                    if (!"DELIVERED".equalsIgnoreCase(status)) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "You can review only after the order is delivered"));
                    }
                }
            }

            String itemSql = "SELECT 1 FROM order_items WHERE order_id = ? AND product_id = ?";
            try (PreparedStatement ps = c.prepareStatement(itemSql)) {
                ps.setInt(1, orderId);
                ps.setString(2, productId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "Product is not part of this order"));
                    }
                }
            }

            String dupSql = "SELECT review_id FROM reviews WHERE user_id = ? AND product_id = ?";
            try (PreparedStatement ps = c.prepareStatement(dupSql)) {
                ps.setInt(1, user.getId());
                ps.setString(2, productId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "You have already reviewed this product"));
                    }
                }
            }

            String insertSql =
                    "INSERT INTO reviews (order_id, product_id, user_id, user_name, rating, feedback) " +
                            "VALUES (?, ?, ?, ?, ?, ?)";
            try (PreparedStatement ps = c.prepareStatement(insertSql)) {
                ps.setInt(1, orderId);
                ps.setString(2, productId);
                ps.setInt(3, user.getId());
                ps.setString(4, user.getName());
                ps.setInt(5, rating);
                ps.setString(6, feedback);
                ps.executeUpdate();
            }

            return ResponseEntity.ok(Map.of("success", true));

        } catch (java.sql.SQLIntegrityConstraintViolationException dup) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "You have already reviewed this product"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to submit review: " + e.getMessage()));
        }
    }

    /* ====================================================================
       GET MY REVIEWS
       ==================================================================== */
    @GetMapping("/reviews/my")
    public ResponseEntity<?> getMyReviews(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Please login first"));
        }

        try (Connection c = DBConnection.getConnection()) {
            String sql = "SELECT order_id, product_id, rating, feedback " +
                    "FROM reviews WHERE user_id = ?";
            List<Map<String, Object>> list = new ArrayList<>();

            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setInt(1, user.getId());
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> r = new HashMap<>();
                        r.put("orderId",   rs.getInt("order_id"));
                        r.put("productId", String.valueOf(rs.getString("product_id")));
                        r.put("rating",    rs.getInt("rating"));
                        r.put("feedback",  rs.getString("feedback"));
                        list.add(r);
                    }
                }
            }
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       WISHLIST — add
       ==================================================================== */
    @PostMapping("/wishlist/add")
    public ResponseEntity<?> addToWishlist(@RequestBody Map<String, Object> body,
                                           HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Please login first"));
        }
        Object pidObj = body.get("productId");
        if (pidObj == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing productId"));
        }
        String productId = pidObj.toString();

        try (Connection c = DBConnection.getConnection()) {
            String sql = "INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)";
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setInt(1, user.getId());
                ps.setString(2, productId);
                ps.executeUpdate();
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       WISHLIST — remove
       ==================================================================== */
    @PostMapping("/wishlist/remove")
    public ResponseEntity<?> removeFromWishlist(@RequestBody Map<String, Object> body,
                                                HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Please login first"));
        }
        Object pidObj = body.get("productId");
        if (pidObj == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing productId"));
        }
        try (Connection c = DBConnection.getConnection()) {
            String sql = "DELETE FROM wishlist WHERE user_id = ? AND product_id = ?";
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setInt(1, user.getId());
                ps.setString(2, pidObj.toString());
                ps.executeUpdate();
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       WISHLIST — list mine
       ==================================================================== */
    @GetMapping("/wishlist")
    public ResponseEntity<?> getWishlist(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Please login first"));
        }
        try (Connection c = DBConnection.getConnection()) {
            String sql =
                    "SELECT p.product_id, p.name, p.category, p.price, p.stock " +
                            "FROM wishlist w JOIN products p ON p.product_id = w.product_id " +
                            "WHERE w.user_id = ? ORDER BY w.added_at DESC";

            List<Map<String, Object>> list = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setInt(1, user.getId());
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> m = new HashMap<>();
                        m.put("productId", rs.getString("product_id"));
                        m.put("name",      rs.getString("name"));
                        m.put("category",  rs.getString("category"));
                        m.put("price",     rs.getDouble("price"));
                        m.put("stock",     rs.getInt("stock"));
                        list.add(m);
                    }
                }
            }
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* ====================================================================
       WISHLIST — just IDs
       ==================================================================== */
    @GetMapping("/wishlist/ids")
    public ResponseEntity<?> getWishlistIds(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) return ResponseEntity.ok(List.of());
        try (Connection c = DBConnection.getConnection()) {
            String sql = "SELECT product_id FROM wishlist WHERE user_id = ?";
            List<String> ids = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setInt(1, user.getId());
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) ids.add(rs.getString("product_id"));
                }
            }
            return ResponseEntity.ok(ids);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}