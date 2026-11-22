package com.gymfit.api;

import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class WorkoutDraftRepository {
    private final JdbcTemplate jdbc;

    WorkoutDraftRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Optional<String> find(long accountId, String key) {
        return jdbc.query("""
                SELECT payload
                FROM gymfit_account_workout_drafts
                WHERE account_id = ? AND draft_key = ?
                """,
                (row, index) -> row.getString("payload"), accountId, key
        ).stream().findFirst();
    }

    void save(long accountId, String key, String payload) {
        jdbc.update("""
                INSERT INTO gymfit_account_workout_drafts (account_id, draft_key, payload)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE payload = ?
                """, accountId, key, payload, payload);
    }
}
