package com.smartcart.model;

import java.util.ArrayList;
import java.util.List;

public class Cart {
    private List<CartItem> items = new ArrayList<>();
    private String customerType = "REGULAR";
    private String couponCode = null;

    public List<CartItem> getItems() { return items; }
    public void setItems(List<CartItem> items) { this.items = items; }
    public String getCustomerType() { return customerType; }
    public void setCustomerType(String customerType) { this.customerType = customerType; }
    public String getCouponCode() { return couponCode; }
    public void setCouponCode(String couponCode) { this.couponCode = couponCode; }

    public CartItem findItem(String productId) {
        for (CartItem it : items) {
            if (it.getProduct().getProductId().equals(productId)) return it;
        }
        return null;
    }

    public boolean isEmpty() { return items.isEmpty(); }

    public void clear() {
        items.clear();
        customerType = "REGULAR";
        couponCode = null;
    }
}