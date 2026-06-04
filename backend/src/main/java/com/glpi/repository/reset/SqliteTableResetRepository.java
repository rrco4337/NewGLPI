package com.glpi.repository.reset;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class SqliteTableResetRepository {

    private final JdbcTemplate jdbcTemplate;

    public SqliteTableResetRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<String> listTableNames() {
        return jdbcTemplate.queryForList(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            String.class
        );
    }

    public long countRows(String tableName) {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM \"" + tableName + "\"", Long.class);
        return count != null ? count : 0;
    }

    public int deleteAllRows(String tableName) {
        return jdbcTemplate.update("DELETE FROM \"" + tableName + "\"");
    }
}
