package com.smartcart.controller;

import com.smartcart.dao.AdminDAO;
import com.smartcart.dao.ProductDAO;
import com.smartcart.model.*;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final ProductDAO productDAO;
    private final AdminDAO adminDAO;

    public AdminController(ProductDAO productDAO, AdminDAO adminDAO) {
        this.productDAO = productDAO;
        this.adminDAO = adminDAO;
    }

    private User requireAdmin(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null || !user.isAdmin()) return null;
        return user;
    }

    /* ---------------- ORDERS (admin view) ---------------- */
    @GetMapping("/orders")
    public ResponseEntity<?> getOrders(HttpSession session) throws Exception {
        if (requireAdmin(session) == null)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));

        List<Order> orders = adminDAO.getAllOrders();
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
    }

    /* ---------------- USERS (admin view) ---------------- */
    @GetMapping("/users")
    public ResponseEntity<?> getUsers(HttpSession session) throws Exception {
        if (requireAdmin(session) == null)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));
        return ResponseEntity.ok(adminDAO.getAllUsers());
    }

    /* ---------------- PRODUCTS (admin view — all) ---------------- */
    @GetMapping("/products")
    public ResponseEntity<?> getAllProductsForAdmin(HttpSession session) throws SQLException {
        if (requireAdmin(session) == null)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));
        return ResponseEntity.ok(productDAO.getAllProductsForAdmin());
    }

    /* ---------------- STATS ---------------- */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(HttpSession session) throws Exception {
        if (requireAdmin(session) == null)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));
        return ResponseEntity.ok(adminDAO.getStats());
    }

    /* ---------------- NEXT ID ---------------- */
    @GetMapping("/next-id")
    public ResponseEntity<?> nextId(HttpSession session) throws SQLException {
        if (requireAdmin(session) == null)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));
        return ResponseEntity.ok(Map.of("productId", productDAO.nextProductId()));
    }

    /* ---------------- CREATE PRODUCT ---------------- */
    @PostMapping("/product/create")
    public ResponseEntity<?> createProduct(@RequestBody Map<String, Object> body, HttpSession session) throws SQLException {
        if (requireAdmin(session) == null)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));
        try {
            String id = body.get("productId").toString().trim().toUpperCase();
            String name = body.get("name").toString().trim();
            String category = body.get("category").toString().trim();
            BigDecimal price = new BigDecimal(body.get("price").toString());
            int stock = (int) Double.parseDouble(body.get("stock").toString());

            if (id.isEmpty() || name.isEmpty() || category.isEmpty())
                throw new IllegalArgumentException("All fields are required");
            if (price.compareTo(BigDecimal.ZERO) < 0)
                throw new IllegalArgumentException("Price cannot be negative");
            if (stock < 0)
                throw new IllegalArgumentException("Stock cannot be negative");
            if (productDAO.getById(id) != null)
                throw new IllegalArgumentException("Product ID already exists");

            productDAO.createProduct(id, name, category, price, stock);
            return ResponseEntity.ok(Map.of("success", true, "productId", id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /* ---------------- UPDATE PRODUCT ---------------- */
    @PostMapping("/product/update")
    public ResponseEntity<?> updateProduct(@RequestBody Map<String, Object> body, HttpSession session) throws SQLException {
        if (requireAdmin(session) == null)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));
        try {
            String id = body.get("productId").toString();
            String name = body.get("name").toString().trim();
            String category = body.get("category").toString().trim();
            BigDecimal price = new BigDecimal(body.get("price").toString());
            int stock = (int) Double.parseDouble(body.get("stock").toString());

            productDAO.updateProduct(id, name, category, price, stock);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /* ---------------- SOFT DELETE ---------------- */
    @DeleteMapping("/product")
    public ResponseEntity<?> deleteProduct(@RequestParam String productId, HttpSession session) throws SQLException {
        if (requireAdmin(session) == null)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));
        try {
            if (productDAO.getById(productId) == null)
                throw new IllegalArgumentException("Product not found");

            productDAO.deleteProduct(productId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /* ---------------- RESTORE ---------------- */
    @PostMapping("/product/restore")
    public ResponseEntity<?> restoreProduct(@RequestBody Map<String, String> body, HttpSession session) throws SQLException {
        if (requireAdmin(session) == null)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access required"));
        try {
            String id = body.get("productId");
            productDAO.restoreProduct(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}