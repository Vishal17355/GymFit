package com.gymfit.api;

import java.nio.CharBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
class AccountDirectory implements UserDetailsService {
    private final JdbcTemplate jdbc;

    AccountDirectory(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public GymAccount loadUserByUsername(String email) {
        return jdbc.query("""
                SELECT id, email, password_hash, role, enabled
                FROM gymfit_accounts
                WHERE email = ?
                """,
                (row, index) -> new GymAccount(row.getLong("id"), row.getString("email"),
                        row.getString("password_hash"), GymAccount.Role.valueOf(row.getString("role")),
                        row.getBoolean("enabled")),
                normalize(email)
        ).stream().findFirst().orElseThrow(() -> new UsernameNotFoundException("Account unavailable."));
    }

    void create(String email, String passwordHash, GymAccount.Role role) {
        jdbc.update("INSERT INTO gymfit_accounts (email, password_hash, role) VALUES (?, ?, ?)",
                normalize(email), passwordHash, role.name());
    }

    static boolean validEmail(String email) {
        return email != null && email.trim().length() <= 254 && email.trim().matches("[^@\\s]+@[^@\\s]+");
    }

    static boolean validPassword(CharSequence password) {
        return password != null && password.length() >= 12 &&
                StandardCharsets.UTF_8.encode(CharBuffer.wrap(password)).remaining() <= 72;
    }

    static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
