package com.glpi.dto.reset;

public class SqliteTableDto {

    private String name;
    private long rowCount;

    public SqliteTableDto(String name, long rowCount) {
        this.name = name;
        this.rowCount = rowCount;
    }

    public String getName() { return name; }
    public long getRowCount() { return rowCount; }
}
