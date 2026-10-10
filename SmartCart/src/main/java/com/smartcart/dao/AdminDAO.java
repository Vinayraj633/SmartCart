package com.smartcart.dao;

import com.smartcart.model.Order;
import com.smartcart.model.OrderItem;
import com.smartcart.util.DBConnection;
import org.springframework.stereotype.Repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class AdminDAO {

    /* ====================================================================
       STATS
       ==================================================================== */
    public Map<String, Object> getStats() throws Exception {
        Map<String, Object> stats = new HashMap<>();

        try (Connection c = DBConnection.getConnection()) {

            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM products")) {
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) stats.put("totalProducts", rs.getInt(1));
                }
            }

            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT COUNT(*), COALESCE(SUM(final_amount),0) FROM orders " +
                            "WHERE status IS NULL OR status <> 'CANCELLED'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        stats.put("totalOrders", rs.getInt(1));
                        stats.put("totalRevenue", rs.getBigDecimal(2));
                    }
                }
            }

            try (PreparedStatement ps = c.prepareStatement("SELECT COUNT(*) FROM users")) {
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) stats.put("totalUsers", rs.getInt(1));
                }
            }
        }

        return stats;
    }

    /* ====================================================================
       ALL PRODUCTS (admin — includes inactive)
       ==================================================================== */
    public List<Map<String, Object>> getAllProducts() throws Exception {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT product_id, name, category, price, stock, active " +
                "FROM products ORDER BY product_id";

        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                Map<String, Object> p = new HashMap<>();
                p.put("productId", rs.getString("product_id"));
                p.put("name", rs.getString("name"));
                p.put("category", rs.getString("category"));
                p.put("price", rs.getBigDecimal("price"));
                p.put("stock", rs.getInt("stock"));
                p.put("active", rs.getBoolean("active"));
                list.add(p);
            }
        }
        return list;
    }

    /* ====================================================================
       ALL USERS (admin view)
       ==================================================================== */
    public List<Map<String, Object>> getAllUsers() throws Exception {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT id, name, email, customer_type, is_admin, created_at " +
                "FROM users ORDER BY created_at DESC";

        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                Map<String, Object> u = new HashMap<>();
                u.put("id", rs.getInt("id"));
                u.put("name", rs.getString("name"));
                u.put("email", rs.getString("email"));
                u.put("customerType", rs.getString("customer_type"));
                u.put("isAdmin", rs.getBoolean("is_admin"));
                Object created = rs.getObject("created_at");
                u.put("createdAt", created != null ? created.toString() : null);
                list.add(u);
            }
        }
        return list;
    }

    /* ====================================================================
       ALL ORDERS (admin)
       ==================================================================== */
    public List<Order> getAllOrders() throws Exception {
        String sql =
                "SELECT order_id, user_id, user_name, user_email, " +
                        "subtotal, total_discount, gst, final_amount, " +
                        "customer_type, coupon_code, address_line, city, state, pincode, phone, " +
                        "created_at, status, cancel_reason " +
                        "FROM orders ORDER BY created_at DESC";

        List<Order> orders = new ArrayList<>();

        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                Order o = mapOrder(rs);
                o.setItems(loadOrderItems(c, o.getOrderId()));
                orders.add(o);
            }
        }
        return orders;
    }

    /* ====================================================================
       ORDERS BY USER — used by profile page
       ==================================================================== */
    public List<Order> getOrdersByUserId(int userId) throws Exception {
        String sql =
                "SELECT order_id, user_id, user_name, user_email, " +
                        "subtotal, total_discount, gst, final_amount, " +
                        "customer_type, coupon_code, address_line, city, state, pincode, phone, " +
                        "created_at, status, cancel_reason " +
                        "FROM orders WHERE user_id = ? ORDER BY created_at DESC";

        List<Order> orders = new ArrayList<>();

        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {

            ps.setInt(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Order o = mapOrder(rs);
                    o.setItems(loadOrderItems(c, o.getOrderId()));
                    orders.add(o);
                }
            }
        }
        return orders;
    }

    /* ====================================================================
       Helper — map one row to an Order object
       ==================================================================== */
    private Order mapOrder(ResultSet rs) throws Exception {
        Order o = new Order();
        o.setOrderId(rs.getInt("order_id"));
        o.setUserId(rs.getInt("user_id"));
        o.setUserName(rs.getString("user_name"));
        o.setUserEmail(rs.getString("user_email"));
        o.setSubtotal(rs.getBigDecimal("subtotal"));
        o.setTotalDiscount(rs.getBigDecimal("total_discount"));
        o.setGst(rs.getBigDecimal("gst"));
        o.setFinalAmount(rs.getBigDecimal("final_amount"));
        o.setCustomerType(rs.getString("customer_type"));
        o.setCouponCode(rs.getString("coupon_code"));
        o.setAddressLine(rs.getString("address_line"));
        o.setCity(rs.getString("city"));
        o.setState(rs.getString("state"));
        o.setPincode(rs.getString("pincode"));
        o.setPhone(rs.getString("phone"));

        Object createdObj = rs.getObject("created_at");
        o.setCreatedAt(createdObj != null ? createdObj.toString() : null);

        o.setStatus(rs.getString("status"));
        o.setCancelReason(rs.getString("cancel_reason"));

        return o;
    }

    /* ====================================================================
       Helper — load the items for one order
       ==================================================================== */
    private List<OrderItem> loadOrderItems(Connection c, int orderId) throws Exception {
        List<OrderItem> items = new ArrayList<>();
        String sql =
                "SELECT product_id, quantity, unit_price, line_total " +
                        "FROM order_items WHERE order_id = ?";

        try (PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, orderId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    OrderItem it = new OrderItem();
                    it.setProductId(rs.getString("product_id"));
                    it.setQuantity(rs.getInt("quantity"));
                    it.setUnitPrice(rs.getBigDecimal("unit_price"));
                    it.setLineTotal(rs.getBigDecimal("line_total"));
                    items.add(it);
                }
            }
        }
        return items;
    }

    /* ====================================================================
       NEXT PRODUCT ID
       ==================================================================== */
    public String getNextProductId() throws Exception {
        String sql = "SELECT product_id FROM products ORDER BY product_id DESC LIMIT 1";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) {
                String last = rs.getString("product_id");
                if (last != null && last.length() > 1) {
                    try {
                        int n = Integer.parseInt(last.substring(1));
                        return "P" + (n + 1);
                    } catch (NumberFormatException ignored) {}
                }
            }
        }
        return "P101";
    }
}