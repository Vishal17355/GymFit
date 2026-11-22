package com.gymfit.api;

import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.userdetails.User;

public final class GymAccount extends User {
    enum Role { MEMBER, TRAINER, GYM_OWNER, PLATFORM_ADMIN }

    private final long id;
    private final Role role;

    GymAccount(long id, String email, String passwordHash, Role role, boolean enabled) {
        super(email, passwordHash, enabled, true, true, true,
                AuthorityUtils.createAuthorityList("ROLE_" + role.name()));
        this.id = id;
        this.role = role;
    }

    long id() {
        return id;
    }

    public String featureOwnerKey() {
        return "account:" + id;
    }

    Role role() {
        return role;
    }
}
