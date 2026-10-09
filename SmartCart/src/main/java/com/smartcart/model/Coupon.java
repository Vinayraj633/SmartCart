package com.smartcart.model;

import java.math.BigDecimal;

public class Coupon {
    private String code;
    private String discountType;
    private BigDecimal discountValue;
    private BigDecimal minCartValue;
    private BigDecimal maxDiscount;
    private boolean vipOnly;

    public Coupon() {}

    public Coupon(String code, String discountType, BigDecimal discountValue,
                  BigDecimal minCartValue, BigDecimal maxDiscount, boolean vipOnly) {
        this.code = code;
        this.discountType = discountType;
        this.discountValue = discountValue;
        this.minCartValue = minCartValue;
        this.maxDiscount = maxDiscount;
        this.vipOnly = vipOnly;
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getDiscountType() { return discountType; }
    public void setDiscountType(String discountType) { this.discountType = discountType; }
    public BigDecimal getDiscountValue() { return discountValue; }
    public void setDiscountValue(BigDecimal discountValue) { this.discountValue = discountValue; }
    public BigDecimal getMinCartValue() { return minCartValue; }
    public void setMinCartValue(BigDecimal minCartValue) { this.minCartValue = minCartValue; }
    public BigDecimal getMaxDiscount() { return maxDiscount; }
    public void setMaxDiscount(BigDecimal maxDiscount) { this.maxDiscount = maxDiscount; }
    public boolean isVipOnly() { return vipOnly; }
    public void setVipOnly(boolean vipOnly) { this.vipOnly = vipOnly; }

    public static class Product {
        private String productId;
        private String name;
        private String category;
        private BigDecimal price;
        private int stock;

        public Product() {}

        public Product(String productId, String name, String category,
                       BigDecimal price, int stock) {
            this.productId = productId;
            this.name = name;
            this.category = category;
            this.price = price;
            this.stock = stock;
        }

        public String getProductId() { return productId; }
        public void setProductId(String productId) { this.productId = productId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public BigDecimal getPrice() { return price; }
        public void setPrice(BigDecimal price) { this.price = price; }
        public int getStock() { return stock; }
        public void setStock(int stock) { this.stock = stock; }
    }
}