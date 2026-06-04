package com.glpi.service.reset;

import com.glpi.dto.reset.SqliteTableDto;
import com.glpi.dto.reset.SqliteTableResetResponse;
import com.glpi.repository.reset.SqliteTableResetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SqliteTableResetService {

    private final SqliteTableResetRepository repository;

    public SqliteTableResetService(SqliteTableResetRepository repository) {
        this.repository = repository;
    }

    public List<SqliteTableDto> listTables() {
        return repository.listTableNames().stream()
                .map(name -> new SqliteTableDto(name, repository.countRows(name)))
                .collect(Collectors.toList());
    }

    @Transactional
    public SqliteTableResetResponse resetTables(List<String> requestedTables) {
        Set<String> existingTables = Set.copyOf(repository.listTableNames());

        // Validation : on ne traite que les tables qui existent réellement (protection injection SQL)
        List<String> validTables = requestedTables.stream()
                .filter(existingTables::contains)
                .collect(Collectors.toList());

        List<String> resetTables = new ArrayList<>();
        long totalDeleted = 0;

        for (String table : validTables) {
            int deleted = repository.deleteAllRows(table);
            totalDeleted += deleted;
            resetTables.add(table);
        }

        String message = resetTables.isEmpty()
                ? "Aucune table valide trouvée parmi les tables demandées."
                : resetTables.size() + " table(s) réinitialisée(s), " + totalDeleted + " ligne(s) supprimée(s).";

        return new SqliteTableResetResponse(true, message, totalDeleted, resetTables);
    }
}
