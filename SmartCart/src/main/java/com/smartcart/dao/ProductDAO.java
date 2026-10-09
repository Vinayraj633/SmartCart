package com.smartcart.dao;

import com.smartcart.model.Product;
import com.smartcart.util.DBConnection;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

@Repository
public class ProductDAO {

    /** ⭐ Store customers see only ACTIVE products */
    public List<Product> getAllProducts() throws SQLException {
        List<Product> list = new ArrayList<>();
        String sql = "SELECT product_id, name, category, price, stock, is_active " +
                "FROM products WHERE is_active = TRUE ORDER BY product_id";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Product p = new Product(
                        rs.getString("product_id"),
                        rs.getString("name"),
                        rs.getString("category"),
                        rs.getBigDecimal("price"),
                        rs.getInt("stock"));
                p.setActive(rs.getBoolean("is_active"));
                list.add(p);
            }
        }
        return list;
    }

    /** ⭐ Admin sees ALL products (active + inactive) */
    public List<Product> getAllProductsForAdmin() throws SQLException {
        List<Product> list = new ArrayList<>();
        String sql = "SELECT product_id, name, category, price, stock, is_active " +
                "FROM products ORDER BY product_id";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Product p = new Product(
                        rs.getString("product_id"),
                        rs.getString("name"),
                        rs.getString("category"),
                        rs.getBigDecimal("price"),
                        rs.getInt("stock"));
                p.setActive(rs.getBoolean("is_active"));
                list.add(p);
            }
        }
        return list;
    }

    public Product getById(String productId) throws SQLException {
        String sql = "SELECT * FROM products WHERE product_id = ?";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, productId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Product p = new Product(
                            rs.getString("product_id"),
                            rs.getString("name"),
                            rs.getString("category"),
                            rs.getBigDecimal("price"),
                            rs.getInt("stock"));
                    p.setActive(rs.getBoolean("is_active"));
                    return p;
                }
            }
        }
        return null;
    }

    public int getStock(String productId) throws SQLException {
        Product p = getById(productId);
        return p == null ? -1 : p.getStock();
    }

    public boolean reduceStock(String productId, int qty) throws SQLException {
        String sql = "UPDATE products SET stock = stock - ? WHERE product_id = ? AND stock >= ?";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setInt(1, qty);
            ps.setString(2, productId);
            ps.setInt(3, qty);
            return ps.executeUpdate() == 1;
        }
    }

    /* ---------------- ADMIN METHODS ---------------- */

    public boolean createProduct(String productId, String name, String category,
                                 BigDecimal price, int stock) throws SQLException {
        String sql = "INSERT INTO products (product_id, name, category, price, stock, is_active) " +
                "VALUES (?,?,?,?,?, TRUE)";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, productId);
            ps.setString(2, name);
            ps.setString(3, category);
            ps.setBigDecimal(4, price);
            ps.setInt(5, stock);
            return ps.executeUpdate() == 1;
        }
    }

    public boolean updateProduct(String productId, String name, String category,
                                 BigDecimal price, int stock) throws SQLException {
        String sql = "UPDATE products SET name = ?, category = ?, price = ?, stock = ? WHERE product_id = ?";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, name);
            ps.setString(2, category);
            ps.setBigDecimal(3, price);
            ps.setInt(4, stock);
            ps.setString(5, productId);
            return ps.executeUpdate() == 1;
        }
    }

    /** ⭐ SOFT DELETE — mark inactive */
    public boolean deleteProduct(String productId) throws SQLException {
        String sql = "UPDATE products SET is_active = FALSE WHERE product_id = ?";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, productId);
            return ps.executeUpdate() == 1;
        }
    }

    /** ⭐ RESTORE — reactivate a soft-deleted product */
    public boolean restoreProduct(String productId) throws SQLException {
        String sql = "UPDATE products SET is_active = TRUE WHERE product_id = ?";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, productId);
            return ps.executeUpdate() == 1;
        }
    }

    public String nextProductId() throws SQLException {
        String sql = "SELECT MAX(CAST(SUBSTRING(product_id, 2) AS UNSIGNED)) FROM products";
        try (Connection c = DBConnection.getConnection();
             PreparedStatement ps = c.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            int max = 100;
            if (rs.next()) max = rs.getInt(1);
            return "P" + (max + 1);
        }
    }
}