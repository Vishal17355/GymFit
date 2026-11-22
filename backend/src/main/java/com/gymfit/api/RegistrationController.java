package com.gymfit.api;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
class RegistrationController {
    private final AccountInvitations invitations;

    RegistrationController(AccountInvitations invitations) {
        this.invitations = invitations;
    }

    @PostMapping(path = "/api/auth/register", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    void register(@RequestParam String email, @RequestParam String invitation, @RequestParam String password) {
        if (!AccountDirectory.validEmail(email) || !AccountDirectory.validPassword(password) ||
                !invitation.matches("[a-f0-9]{64}")) {
            throw invalidInvitation();
        }
        try {
            if (!invitations.register(email, invitation, password)) throw invalidInvitation();
        } catch (DuplicateKeyException accountExists) {
            throw invalidInvitation();
        }
    }

    private static ResponseStatusException invalidInvitation() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check the invitation and account details.");
    }
}
