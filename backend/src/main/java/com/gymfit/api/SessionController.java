package com.gymfit.api;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SessionController {
    @GetMapping("/api/auth/session")
    ResponseEntity<SessionResponse> session(@AuthenticationPrincipal GymAccount account,
            @RequestAttribute("_csrf") CsrfToken csrf) {
        var user = account == null ? null : new SessionUser(account.id(), account.getUsername(), account.role());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new SessionResponse(user, csrf.getHeaderName(), csrf.getToken()));
    }

    record SessionUser(long id, String email, GymAccount.Role role) {}
    record SessionResponse(SessionUser user, String csrfHeader, String csrfToken) {}
}
