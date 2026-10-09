package com.smartcart.controller;

import com.smartcart.dao.CouponDAO;
import com.smartcart.model.*;
import com.smartcart.service.DiscountService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.SQLException;
import java.util.Map;

@RestController
@RequestMapping("/api/coupon")
public class CouponController {

    private final CouponDAO couponDAO;
    private final DiscountService discountService;

    public CouponController(CouponDAO couponDAO, DiscountService discountService) {
        this.couponDAO = couponDAO;
        this.discountService = discountService;
    }

    @PostMapping
    public ResponseEntity<?> apply(@RequestBody Map<String, String> body, HttpSession session) throws SQLException {
        try {
            String code = body.get("code").trim().toUpperCase();

            if (!code.matches("^[A-Z0-9]{1,20}$"))
                throw new IllegalArgumentException("Coupon code must contain only A–Z and 0–9");

            Coupon c = couponDAO.getByCode(code);
            if (c == null) throw new IllegalArgumentException("Invalid coupon");

            Cart cart = (Cart) session.getAttribute("cart");
            if (cart == null || cart.isEmpty())
                throw new IllegalArgumentException("Cart is empty");

            User user = (User) session.getAttribute("user");
            if (user != null && user.getCustomerType() != null)
                cart.setCustomerType(user.getCustomerType());

            if (c.isVipOnly() && !"VIP".equals(cart.getCustomerType()))
                throw new IllegalArgumentException("Coupon is for VIP customers only");

            String previous = cart.getCouponCode();
            cart.setCouponCode(code);
            try {
                discountService.calculate(cart);
            } catch (IllegalArgumentException iae) {
                cart.setCouponCode(previous);
                throw iae;
            } catch (Exception e) {
                cart.setCouponCode(previous);
                throw new IllegalArgumentException("Coupon cannot be applied");
            }

            return ResponseEntity.ok(Map.of("success", true, "code", code));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}