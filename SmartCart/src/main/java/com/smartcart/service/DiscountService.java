package com.smartcart.service;

import com.smartcart.dao.CouponDAO;
import com.smartcart.model.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.SQLException;

@Service
public class DiscountService {

    private static final BigDecimal FIVE_PCT = new BigDecimal("0.05");
    private static final BigDecimal TEN_PCT = new BigDecimal("0.10");
    private static final BigDecimal EIGHTEEN_PCT = new BigDecimal("0.18");
    private static final BigDecimal ELECTRONICS_THRESHOLD = new BigDecimal("5000");

    private final CouponDAO couponDAO;

    public DiscountService(CouponDAO couponDAO) {
        this.couponDAO = couponDAO;
    }

    public Bill calculate(Cart cart) throws SQLException {

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal bulkDiscount = BigDecimal.ZERO;
        BigDecimal electronicsSubtotal = BigDecimal.ZERO;

        if (cart == null || cart.getItems() == null) {
            return new Bill(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }

        for (CartItem it : cart.getItems()) {
            if (it == null || it.getProduct() == null) continue;
            BigDecimal line = it.getLineTotal();
            if (line == null) continue;

            subtotal = subtotal.add(line);

            if (it.getQuantity() >= 5) {
                bulkDiscount = bulkDiscount.add(
                        line.multiply(FIVE_PCT).setScale(2, RoundingMode.HALF_UP));
            }
            if ("Electronics".equalsIgnoreCase(it.getProduct().getCategory())) {
                electronicsSubtotal = electronicsSubtotal.add(line);
            }
        }

        BigDecimal afterBulk = subtotal.subtract(bulkDiscount);

        BigDecimal categoryDiscount = BigDecimal.ZERO;
        if (electronicsSubtotal.compareTo(ELECTRONICS_THRESHOLD) > 0) {
            categoryDiscount = electronicsSubtotal.multiply(FIVE_PCT)
                    .setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal afterCategory = afterBulk.subtract(categoryDiscount);

        String ct = cart.getCustomerType() == null ? "REGULAR" : cart.getCustomerType();
        BigDecimal customerRate = switch (ct) {
            case "PREMIUM" -> FIVE_PCT;
            case "VIP"     -> TEN_PCT;
            default        -> BigDecimal.ZERO;
        };
        BigDecimal customerDiscount = afterCategory.multiply(customerRate)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal afterCustomer = afterCategory.subtract(customerDiscount);

        BigDecimal couponDiscount = BigDecimal.ZERO;
        String code = cart.getCouponCode();
        if (code != null && !code.isBlank()) {
            Coupon c = couponDAO.getByCode(code);
            if (c == null) throw new IllegalArgumentException("Invalid coupon");
            if (c.isVipOnly() && !"VIP".equals(ct))
                throw new IllegalArgumentException("VIP20 is for VIP customers only");
            if (afterCustomer.compareTo(c.getMinCartValue()) < 0)
                throw new IllegalArgumentException("Coupon minimum cart value not reached");

            if ("PERCENT".equals(c.getDiscountType())) {
                couponDiscount = afterCustomer.multiply(
                                c.getDiscountValue().divide(new BigDecimal("100")))
                        .setScale(2, RoundingMode.HALF_UP);
            } else {
                couponDiscount = c.getDiscountValue();
            }
            if (couponDiscount.compareTo(c.getMaxDiscount()) > 0)
                couponDiscount = c.getMaxDiscount();
        }

        BigDecimal afterCoupon = afterCustomer.subtract(couponDiscount);
        if (afterCoupon.compareTo(BigDecimal.ZERO) < 0)
            afterCoupon = BigDecimal.ZERO;

        BigDecimal gst = afterCoupon.multiply(EIGHTEEN_PCT)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal finalAmount = afterCoupon.add(gst)
                .setScale(2, RoundingMode.HALF_UP);

        return new Bill(subtotal, bulkDiscount, categoryDiscount,
                customerDiscount, couponDiscount, gst, finalAmount);
    }
}