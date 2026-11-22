package com.gymfit.api;

import java.io.Console;
import java.nio.CharBuffer;
import java.util.Arrays;
import java.util.Locale;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("provision-account")
class AccountProvisioning implements ApplicationRunner {
    private final AccountDirectory accounts;
    private final PasswordEncoder encoder;
    private final AccountInvitations invitations;

    AccountProvisioning(AccountDirectory accounts, PasswordEncoder encoder, AccountInvitations invitations) {
        this.accounts = accounts;
        this.encoder = encoder;
        this.invitations = invitations;
    }

    @Override
    public void run(ApplicationArguments args) {
        Console console = System.console();
        if (console == null) throw new IllegalStateException("Run account provisioning in an interactive terminal.");

        String input = console.readLine("Account email: ");
        if (!AccountDirectory.validEmail(input)) {
            throw new IllegalArgumentException("Enter a valid account email.");
        }

        String roleName = console.readLine("Role (MEMBER, TRAINER, GYM_OWNER, PLATFORM_ADMIN): ");
        GymAccount.Role role = GymAccount.Role.valueOf(roleName == null ? "" : roleName.trim().toUpperCase(Locale.ROOT));
        if (args.containsOption("invite")) {
            console.printf("Invitation code (valid for 7 days): %s%n", invitations.issue(input, role));
            return;
        }

        char[] password = console.readPassword("Password: ");
        char[] confirmation = null;
        try {
            confirmation = console.readPassword("Confirm password: ");
            if (password == null || !AccountDirectory.validPassword(CharBuffer.wrap(password)) ||
                    !Arrays.equals(password, confirmation)) {
                throw new IllegalArgumentException("Use a matching password of at least 12 characters and at most 72 UTF-8 bytes.");
            }
            accounts.create(input, encoder.encode(CharBuffer.wrap(password)), role);
            console.printf("Account created.%n");
        } finally {
            if (password != null) Arrays.fill(password, '\0');
            if (confirmation != null) Arrays.fill(confirmation, '\0');
        }
    }
}
