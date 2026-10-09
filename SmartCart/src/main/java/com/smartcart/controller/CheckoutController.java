package com.smartcart.controller;

import com.smartcart.model.*;
import com.smartcart.service.CheckoutService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/checkout")
public class CheckoutController {

    private final CheckoutService checkoutService;

    public CheckoutController(CheckoutService checkoutService) {
        this.checkoutService = checkoutService;
    }

    @PostMapping
    public ResponseEntity<?> checkout(@RequestBody(required = false) Map<String, String> body,
                                      HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "error", "Please login to complete your order"));
        }

        try {
            Cart cart = (Cart) session.getAttribute("cart");
            if (cart == null) throw new IllegalArgumentException("Cart is empty");

            if (user.getCustomerType() != null)
                cart.setCustomerType(user.getCustomerType());

            Order address = new Order();
            if (body != null) {
                address.setAddressLine(body.getOrDefault("addressLine", ""));
                address.setCity(body.getOrDefault("city", ""));
                address.setState(body.getOrDefault("state", ""));
                address.setPincode(body.getOrDefault("pincode", ""));
                address.setPhone(body.getOrDefault("phone", ""));

                if (address.getAddressLine().isBlank() || address.getCity().isBlank()
                        || address.getPincode().isBlank() || address.getPhone().isBlank())
                    throw new IllegalArgumentException("Please fill all address fields");
            }

            Bill bill = checkoutService.previewBill(cart);
            int orderId = checkoutService.checkout(cart, user, address);

            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("orderId", orderId);
            res.put("bill", bill);
            return ResponseEntity.ok(res);

        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}