package com.smartcart.dao;

import com.smartcart.model.User;
import com.smartcart.util.DBConnection;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;

@Repository
public class UserDAO {

    public static String hash(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] h = md.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : h) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public User findByEmail(String email) throws SQLException {
        String sql = "SELECT id, name, email, customer_type, is_admin FROM users WHERE email = ?";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return new User(
                            rs.getInt("id"),
                            rs.getString("name"),
                            rs.getString("email"),
                            rs.getString("customer_type"),
                            rs.getBoolean("is_admin"));
                }
            }
        }
        return null;
    }

    public boolean emailExists(String email) throws SQLException {
        return findByEmail(email) != null;
    }

    public boolean validateLogin(String email, String password) throws SQLException {
        String sql = "SELECT password_hash FROM users WHERE email = ?";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("password_hash").equals(hash(password));
                }
            }
        }
        return false;
    }

    public int createUser(String name, String email, String password, String customerType) throws SQLException {
        String sql = "INSERT INTO users (name, email, password_hash, customer_type) VALUES (?,?,?,?)";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.setString(2, email);
            ps.setString(3, hash(password));
            ps.setString(4, customerType);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) return keys.getInt(1);
            }
        }
        return -1;
    }

    public boolean updateTier(int userId, String newTier) throws SQLException {
        String sql = "UPDATE users SET customer_type = ? WHERE id = ?";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, newTier);
            ps.setInt(2, userId);
            return ps.executeUpdate() == 1;
        }
    }
}