package com.smartcart.model;

public class User {
    private int id;
    private String name;
    private String email;
    private String customerType;
    private boolean isAdmin;

    public User() {}

    public User(int id, String name, String email, String customerType) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.customerType = customerType;
        this.isAdmin = false;
    }

    public User(int id, String name, String email, String customerType, boolean isAdmin) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.customerType = customerType;
        this.isAdmin = isAdmin;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getCustomerType() { return customerType; }
    public void setCustomerType(String customerType) { this.customerType = customerType; }
    public boolean isAdmin() { return isAdmin; }
    public void setAdmin(boolean admin) { isAdmin = admin; }
}