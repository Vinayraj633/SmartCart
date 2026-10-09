package com.smartcart.model;

import java.math.BigDecimal;

public class Product {
    private String productId;
    private String name;
    private String category;
    private BigDecimal price;
    private int stock;
    private boolean isActive = true;

    public Product() {}

    public Product(String productId, String name, String category,
                   BigDecimal price, int stock) {
        this.productId = productId;
        this.name = name;
        this.category = category;
        this.price = price;
        this.stock = stock;
        this.isActive = true;
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
    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }
}