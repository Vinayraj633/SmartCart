package com.smartcart.model;

import java.math.BigDecimal;

public class Bill {
    private BigDecimal subtotal;
    private BigDecimal bulkDiscount;
    private BigDecimal categoryDiscount;
    private BigDecimal customerDiscount;
    private BigDecimal couponDiscount;
    private BigDecimal gst;
    private BigDecimal finalAmount;

    public Bill() {
        this.subtotal = BigDecimal.ZERO;
        this.bulkDiscount = BigDecimal.ZERO;
        this.categoryDiscount = BigDecimal.ZERO;
        this.customerDiscount = BigDecimal.ZERO;
        this.couponDiscount = BigDecimal.ZERO;
        this.gst = BigDecimal.ZERO;
        this.finalAmount = BigDecimal.ZERO;
    }

    public Bill(BigDecimal subtotal, BigDecimal bulkDiscount,
                BigDecimal categoryDiscount, BigDecimal customerDiscount,
                BigDecimal couponDiscount, BigDecimal gst, BigDecimal finalAmount) {
        this.subtotal = nz(subtotal);
        this.bulkDiscount = nz(bulkDiscount);
        this.categoryDiscount = nz(categoryDiscount);
        this.customerDiscount = nz(customerDiscount);
        this.couponDiscount = nz(couponDiscount);
        this.gst = nz(gst);
        this.finalAmount = nz(finalAmount);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    public BigDecimal getSubtotal() { return nz(subtotal); }
    public BigDecimal getBulkDiscount() { return nz(bulkDiscount); }
    public BigDecimal getCategoryDiscount() { return nz(categoryDiscount); }
    public BigDecimal getCustomerDiscount() { return nz(customerDiscount); }
    public BigDecimal getCouponDiscount() { return nz(couponDiscount); }
    public BigDecimal getGst() { return nz(gst); }
    public BigDecimal getFinalAmount() { return nz(finalAmount); }
}