package com.smartcart.controller;

import com.smartcart.dao.ProductDAO;
import com.smartcart.model.Product;
import com.smartcart.util.DBConnection;
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
@RequestMapping("/api/products")
public class ProductController {

    private final ProductDAO dao;

    public ProductController(ProductDAO dao) {
        this.dao = dao;
    }

    /* ====================================================================
       GET ALL PRODUCTS
       ==================================================================== */
    @GetMapping
    public List<Product> getAll() throws SQLException {
        return dao.getAllProducts();
    }

    /* ====================================================================
       GET SINGLE PRODUCT — for product.html
       ==================================================================== */
    @GetMapping("/{productId}")
    public ResponseEntity<?> getOne(@PathVariable String productId) throws SQLException {
        Product p = dao.getById(productId);
        if (p == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Product not found"));
        }
        return ResponseEntity.ok(p);
    }

    /* ====================================================================
       GET ALL REVIEWS FOR A PRODUCT — public
       ==================================================================== */
    @GetMapping("/{productId}/reviews")
    public ResponseEntity<?> getProductReviews(@PathVariable String productId) {
        try (Connection c = DBConnection.getConnection()) {
            String sql =
                    "SELECT review_id, user_name, rating, feedback, created_at " +
                            "FROM reviews WHERE product_id = ? ORDER BY created_at DESC";

            List<Map<String, Object>> list = new ArrayList<>();

            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setString(1, productId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        Map<String, Object> r = new HashMap<>();
                        r.put("reviewId",  rs.getInt("review_id"));
                        r.put("userName",  rs.getString("user_name"));
                        r.put("rating",    rs.getInt("rating"));
                        r.put("feedback",  rs.getString("feedback"));
                        Timestamp ts = rs.getTimestamp("created_at");
                        r.put("createdAt", ts != null ? ts.toString() : "");
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
       GET AVERAGE RATING + COUNT FOR A PRODUCT — public
       ==================================================================== */
    @GetMapping("/{productId}/rating")
    public ResponseEntity<?> getProductRating(@PathVariable String productId) {
        try (Connection c = DBConnection.getConnection()) {
            String sql = "SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt " +
                    "FROM reviews WHERE product_id = ?";
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setString(1, productId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        int cnt = rs.getInt("cnt");
                        double avg = cnt > 0 ? rs.getDouble("avg_rating") : 0.0;
                        double rounded = Math.round(avg * 10.0) / 10.0;
                        return ResponseEntity.ok(Map.of(
                                "average", rounded,
                                "count", cnt
                        ));
                    }
                }
            }
            return ResponseEntity.ok(Map.of("average", 0.0, "count", 0));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}