package com.smartcart.controller;

import com.smartcart.dao.ProductDAO;
import com.smartcart.model.*;
import com.smartcart.service.DiscountService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.SQLException;
import java.util.Map;

@RestController
@RequestMapping("/api/cart")
public class CartController {

    private final ProductDAO productDAO;
    private final DiscountService discountService;

    public CartController(ProductDAO productDAO, DiscountService discountService) {
        this.productDAO = productDAO;
        this.discountService = discountService;
    }

    /** Private helper — renamed to avoid clash with @GetMapping method */
    private Cart getOrCreateCart(HttpSession session) {
        Cart cart = (Cart) session.getAttribute("cart");
        if (cart == null) {
            cart = new Cart();
            session.setAttribute("cart", cart);
        }
        User user = (User) session.getAttribute("user");
        if (user != null && user.getCustomerType() != null) {
            cart.setCustomerType(user.getCustomerType());
        }
        return cart;
    }

    @GetMapping
    public Cart getCart(HttpSession session) {
        return getOrCreateCart(session);
    }

    @GetMapping("/bill")
    public ResponseEntity<?> getBill(HttpSession session) throws SQLException {
        Cart cart = getOrCreateCart(session);
        if (cart.isEmpty()) return ResponseEntity.ok(Map.of("empty", true));
        Bill bill = discountService.calculate(cart);
        return ResponseEntity.ok(bill);
    }

    @PostMapping("/add")
    public ResponseEntity<?> add(@RequestBody Map<String, Object> body, HttpSession session) throws SQLException {
        try {
            Cart cart = getOrCreateCart(session);
            String pid = (String) body.get("productId");
            int qty = (int) Double.parseDouble(body.get("quantity").toString());

            if (qty <= 0) throw new IllegalArgumentException("Quantity must be > 0");

            Product p = productDAO.getById(pid);
            if (p == null) throw new IllegalArgumentException("Product not found");

            CartItem existing = cart.findItem(pid);
            int newQty = (existing == null ? 0 : existing.getQuantity()) + qty;

            if (newQty > p.getStock())
                throw new IllegalArgumentException("Quantity exceeds stock (" + p.getStock() + ")");

            if (existing == null) cart.getItems().add(new CartItem(p, qty));
            else existing.setQuantity(newQty);

            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/update")
    public ResponseEntity<?> update(@RequestBody Map<String, Object> body, HttpSession session) throws SQLException {
        try {
            Cart cart = getOrCreateCart(session);
            String pid = (String) body.get("productId");
            int qty = (int) Double.parseDouble(body.get("quantity").toString());

            CartItem item = cart.findItem(pid);
            if (item == null) throw new IllegalArgumentException("Item not in cart");

            if (qty <= 0) {
                cart.getItems().remove(item);
            } else {
                Product p = productDAO.getById(pid);
                if (qty > p.getStock()) throw new IllegalArgumentException("Quantity exceeds stock");
                item.setQuantity(qty);
            }
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/remove")
    public Map<String, Object> remove(@RequestParam String productId, HttpSession session) {
        Cart cart = getOrCreateCart(session);
        CartItem item = cart.findItem(productId);
        if (item != null) cart.getItems().remove(item);
        return Map.of("success", true);
    }
}