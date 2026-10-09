package com.smartcart.service;

import com.smartcart.dao.OrderDAO;
import com.smartcart.dao.ProductDAO;
import com.smartcart.model.*;
import org.springframework.stereotype.Service;

import java.sql.SQLException;

@Service
public class CheckoutService {

    private final ProductDAO productDAO;
    private final DiscountService discountService;
    private final OrderDAO orderDAO;

    public CheckoutService(ProductDAO productDAO,
                           DiscountService discountService,
                           OrderDAO orderDAO) {
        this.productDAO = productDAO;
        this.discountService = discountService;
        this.orderDAO = orderDAO;
    }

    public int checkout(Cart cart, User user, Order address) throws SQLException {
        if (cart == null || cart.isEmpty())
            throw new IllegalArgumentException("Cart is empty");

        String ct = cart.getCustomerType() == null ? "REGULAR" : cart.getCustomerType();
        if (!ct.equals("REGULAR") && !ct.equals("PREMIUM") && !ct.equals("VIP"))
            throw new IllegalArgumentException("Invalid customer type");

        for (CartItem it : cart.getItems()) {
            Product db = productDAO.getById(it.getProduct().getProductId());
            if (db == null)
                throw new IllegalArgumentException("Product not found: " +
                        it.getProduct().getProductId());
            if (it.getQuantity() <= 0)
                throw new IllegalArgumentException("Quantity must be > 0");
            if (it.getQuantity() > db.getStock())
                throw new IllegalArgumentException("Insufficient stock for " +
                        it.getProduct().getName() + " (available: " + db.getStock() + ")");
        }

        Bill bill = discountService.calculate(cart);
        int orderId = orderDAO.saveOrder(cart, bill, user, address);
        cart.clear();
        return orderId;
    }

    public Bill previewBill(Cart cart) throws SQLException {
        return discountService.calculate(cart);
    }
}