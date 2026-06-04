package com.glpi.dto.reset;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public class SqliteTableResetRequest {

    @NotEmpty
    private List<String> tableNames;

    public List<String> getTableNames() { return tableNames; }
    public void setTableNames(List<String> tableNames) { this.tableNames = tableNames; }
}
