package com.smartcart.dao;

import com.smartcart.model.*;
import com.smartcart.util.DBConnection;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.*;

@Repository
public class OrderDAO {

    public int saveOrder(Cart cart, Bill bill, User user, Order address) throws SQLException {
        Connection c = null;
        try {
            c = DBConnection.getConnection();
            c.setAutoCommit(false);

            int orderId;
            String orderSql =
                    "INSERT INTO orders (customer_type, coupon_code, subtotal, " +
                            "total_discount, gst, final_amount, user_id, user_name, user_email, " +
                            "address_line, city, state, pincode, phone) " +
                            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

            try (PreparedStatement ps = c.prepareStatement(orderSql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, cart.getCustomerType());
                ps.setString(2, cart.getCouponCode());

                BigDecimal totalDiscount = bill.getBulkDiscount()
                        .add(bill.getCategoryDiscount())
                        .add(bill.getCustomerDiscount())
                        .add(bill.getCouponDiscount());

                ps.setBigDecimal(3, bill.getSubtotal());
                ps.setBigDecimal(4, totalDiscount);
                ps.setBigDecimal(5, bill.getGst());
                ps.setBigDecimal(6, bill.getFinalAmount());

                if (user != null) {
                    ps.setInt(7, user.getId());
                    ps.setString(8, user.getName());
                    ps.setString(9, user.getEmail());
                } else {
                    ps.setNull(7, Types.INTEGER);
                    ps.setNull(8, Types.VARCHAR);
                    ps.setNull(9, Types.VARCHAR);
                }

                if (address != null) {
                    ps.setString(10, address.getAddressLine());
                    ps.setString(11, address.getCity());
                    ps.setString(12, address.getState());
                    ps.setString(13, address.getPincode());
                    ps.setString(14, address.getPhone());
                } else {
                    ps.setNull(10, Types.VARCHAR);
                    ps.setNull(11, Types.VARCHAR);
                    ps.setNull(12, Types.VARCHAR);
                    ps.setNull(13, Types.VARCHAR);
                    ps.setNull(14, Types.VARCHAR);
                }

                ps.executeUpdate();

                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (!keys.next()) throw new SQLException("No order id generated");
                    orderId = keys.getInt(1);
                }
            }

            String itemSql =
                    "INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) " +
                            "VALUES (?,?,?,?,?)";
            try (PreparedStatement ps = c.prepareStatement(itemSql)) {
                for (CartItem it : cart.getItems()) {
                    ps.setInt(1, orderId);
                    ps.setString(2, it.getProduct().getProductId());
                    ps.setInt(3, it.getQuantity());
                    ps.setBigDecimal(4, it.getProduct().getPrice());
                    ps.setBigDecimal(5, it.getLineTotal());
                    ps.addBatch();
                }
                ps.executeBatch();
            }

            String updSql = "UPDATE products SET stock = stock - ? WHERE product_id = ? AND stock >= ?";
            try (PreparedStatement ps = c.prepareStatement(updSql)) {
                for (CartItem it : cart.getItems()) {
                    ps.setInt(1, it.getQuantity());
                    ps.setString(2, it.getProduct().getProductId());
                    ps.setInt(3, it.getQuantity());
                    if (ps.executeUpdate() != 1) {
                        throw new SQLException("Insufficient stock for " +
                                it.getProduct().getProductId());
                    }
                }
            }

            c.commit();
            return orderId;
        } catch (SQLException e) {
            if (c != null) c.rollback();
            throw e;
        } finally {
            if (c != null) {
                c.setAutoCommit(true);
                c.close();
            }
        }
    }
}