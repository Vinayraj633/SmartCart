package com.smartcart.dao;

import com.smartcart.model.Coupon;
import com.smartcart.util.DBConnection;
import org.springframework.stereotype.Repository;

import java.sql.*;

@Repository
public class CouponDAO {

    public Coupon getByCode(String code) throws SQLException {
        String sql = "SELECT * FROM coupons WHERE code = ?";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, code);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return new Coupon(
                            rs.getString("code"),
                            rs.getString("discount_type"),
                            rs.getBigDecimal("discount_value"),
                            rs.getBigDecimal("min_cart_value"),
                            rs.getBigDecimal("max_discount"),
                            rs.getBoolean("vip_only"));
                }
            }
        }
        return null;
    }
}