package com.smartcart.controller;

import com.smartcart.util.DBConnection;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Connection;

@RestController
public class TestController {

    @GetMapping("/api/test")
    public String test() {
        try (Connection c = DBConnection.getConnection()) {
            return "OK - DB connected: " + c.getCatalog();
        } catch (Exception e) {
            return "DB ERROR: " + e.getMessage();
        }
    }
}