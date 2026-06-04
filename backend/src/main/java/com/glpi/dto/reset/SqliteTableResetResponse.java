package com.glpi.dto.reset;

import java.util.List;

public class SqliteTableResetResponse {

    private boolean success;
    private String message;
    private long totalDeleted;
    private List<String> resetTables;

    public SqliteTableResetResponse(boolean success, String message, long totalDeleted, List<String> resetTables) {
        this.success = success;
        this.message = message;
        this.totalDeleted = totalDeleted;
        this.resetTables = resetTables;
    }

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public long getTotalDeleted() { return totalDeleted; }
    public List<String> getResetTables() { return resetTables; }
}
