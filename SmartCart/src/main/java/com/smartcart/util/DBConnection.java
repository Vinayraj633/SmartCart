package com.smartcart.util;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

@Component
public class DBConnection {

    private static DataSource staticDataSource;

    @Autowired
    public void setDataSource(DataSource dataSource) {
        DBConnection.staticDataSource = dataSource;
    }

    public static Connection getConnection() throws SQLException {
        if (staticDataSource == null) {
            throw new SQLException("DataSource not initialized");
        }
        return staticDataSource.getConnection();
    }
}