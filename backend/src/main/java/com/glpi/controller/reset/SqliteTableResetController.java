package com.glpi.controller.reset;

import com.glpi.dto.reset.SqliteTableDto;
import com.glpi.dto.reset.SqliteTableResetRequest;
import com.glpi.dto.reset.SqliteTableResetResponse;
import com.glpi.service.reset.SqliteTableResetService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sqlite")
public class SqliteTableResetController {

    private final SqliteTableResetService service;

    public SqliteTableResetController(SqliteTableResetService service) {
        this.service = service;
    }

    @GetMapping("/tables")
    public ResponseEntity<List<SqliteTableDto>> listTables() {
        return ResponseEntity.ok(service.listTables());
    }

    @PostMapping("/tables/reset")
    public ResponseEntity<SqliteTableResetResponse> resetTables(@Valid @RequestBody SqliteTableResetRequest request) {
        SqliteTableResetResponse response = service.resetTables(request.getTableNames());
        return ResponseEntity.ok(response);
    }
}
