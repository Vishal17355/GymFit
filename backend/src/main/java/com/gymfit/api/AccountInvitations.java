package com.gymfit.api;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static java.nio.charset.StandardCharsets.US_ASCII;

@Service
class AccountInvitations {
    private final SecureRandom random = new SecureRandom();
    private final JdbcTemplate jdbc;
    private final AccountDirectory accounts;
    private final PasswordEncoder passwords;

    AccountInvitations(JdbcTemplate jdbc, AccountDirectory accounts, PasswordEncoder passwords) {
        this.jdbc = jdbc;
        this.accounts = accounts;
        this.passwords = passwords;
    }

    String issue(String email, GymAccount.Role role) {
        byte[] secret = new byte[32];
        random.nextBytes(secret);
        String code = HexFormat.of().formatHex(secret);
        jdbc.update("""
                INSERT INTO gymfit_account_invitations (token_hash, email, role, expires_at)
                VALUES (?, ?, ?, UTC_TIMESTAMP() + INTERVAL 7 DAY)
                """, hash(code), AccountDirectory.normalize(email), role.name());
        return code;
    }

    @Transactional
    public boolean register(String email, String code, String password) {
        byte[] tokenHash = hash(code);
        String normalizedEmail = AccountDirectory.normalize(email);
        var invitedRole = jdbc.query("""
                SELECT role FROM gymfit_account_invitations
                WHERE token_hash = ? AND email = ? AND expires_at > UTC_TIMESTAMP()
                FOR UPDATE
                """, (row, index) -> GymAccount.Role.valueOf(row.getString("role")), tokenHash, normalizedEmail)
                .stream().findFirst();

        if (invitedRole.isEmpty()) return false;

        accounts.create(normalizedEmail, passwords.encode(password), invitedRole.get());
        jdbc.update("""
                INSERT INTO gymfit_affiliations (account_id, gym_id, branch_id)
                SELECT a.id, i.gym_id, i.branch_id
                FROM gymfit_accounts a CROSS JOIN gymfit_workspace_invitations i
                WHERE a.email = ? AND i.token_hash = ?
                """, normalizedEmail, tokenHash);
        jdbc.update("DELETE FROM gymfit_account_invitations WHERE token_hash = ?", tokenHash);
        return true;
    }

    static byte[] hash(String code) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(code.getBytes(US_ASCII));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable.", unavailable);
        }
    }
}
