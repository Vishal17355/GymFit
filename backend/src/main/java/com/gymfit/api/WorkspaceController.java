package com.gymfit.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workspace")
class WorkspaceController {
    private final JdbcTemplate jdbc;
    private final AccountInvitations invitations;
    private final WorkoutDraftRepository drafts;
    private final ObjectMapper json;

    WorkspaceController(JdbcTemplate jdbc, AccountInvitations invitations, WorkoutDraftRepository drafts, ObjectMapper json) {
        this.jdbc = jdbc;
        this.invitations = invitations;
        this.drafts = drafts;
        this.json = json;
    }

    @GetMapping
    ResponseEntity<Map<String, Object>> overview(@AuthenticationPrincipal GymAccount account) {
        Map<String, Object> data = switch (account.role()) {
            case PLATFORM_ADMIN -> platformOverview();
            case GYM_OWNER -> ownerOverview(account, affiliation(account, false));
            case TRAINER -> trainerOverview(account, affiliation(account, false));
            case MEMBER -> memberOverview(account, affiliation(account, false));
        };
        return privateResponse(data);
    }

    @GetMapping("/client")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ResponseEntity<Map<String, Object>> clientOverview(@AuthenticationPrincipal GymAccount account,
            @RequestParam long memberId) {
        requireRole(account, GymAccount.Role.TRAINER);
        long gym = requireGym(affiliation(account, false));
        member(account, gym, memberId);
        return privateResponse(Map.of(
                "log", trainingLog(memberId),
                "plans", plans(memberId)));
    }

    @PostMapping("/accept-invitation")
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ResponseEntity<Map<String, Object>> acceptInvitation(@AuthenticationPrincipal GymAccount account,
            @RequestBody JsonNode body) {
        String code = string(body, "code", 64);
        if (!code.matches("[a-f0-9]{64}")) throw invalid("Enter a valid invitation code.");
        byte[] tokenHash = AccountInvitations.hash(code);
        var invite = required("""
                SELECT w.gym_id, w.branch_id FROM gymfit_workspace_invitations w
                JOIN gymfit_account_invitations i ON i.token_hash = w.token_hash
                WHERE i.token_hash = ? AND i.email = ? AND i.role = ? AND i.expires_at > UTC_TIMESTAMP()
                FOR UPDATE
                """, tokenHash, account.getUsername(), account.role().name());
        long gym = number(invite.get("gym_id"));
        required("SELECT id FROM gymfit_gyms WHERE id = ? AND active = TRUE FOR UPDATE", gym);
        var existing = affiliation(account, true);
        if (!existing.isEmpty() && number(existing.get("id")) != gym) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Your account already belongs to another gym.");
        }
        if (existing.isEmpty()) {
            jdbc.update("INSERT INTO gymfit_affiliations (account_id, gym_id, branch_id) VALUES (?, ?, ?)",
                    account.id(), gym, invite.get("branch_id"));
        }
        jdbc.update("DELETE FROM gymfit_account_invitations WHERE token_hash = ?", tokenHash);
        audit(account, gym, "Invitation accepted", account.getUsername());
        return privateResponse(Map.of("message", "You joined the gym."));
    }

    @PostMapping("/{action}")
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ResponseEntity<Map<String, Object>> change(@AuthenticationPrincipal GymAccount account,
            @PathVariable String action, @RequestBody JsonNode body) {
        if (body == null || !body.isObject()) throw invalid("Send an object with the requested fields.");
        Map<String, Object> result = switch (account.role()) {
            case PLATFORM_ADMIN -> platformChange(account, action, body);
            case GYM_OWNER -> ownerChange(account, requireGym(affiliation(account, true)), action, body);
            case TRAINER -> trainerChange(account, requireGym(affiliation(account, true)), action, body);
            case MEMBER -> memberChange(account, affiliation(account, true), action, body);
        };
        return privateResponse(result);
    }

    private Map<String, Object> platformOverview() {
        return Map.of(
                "gyms", rows("""
                        SELECT g.id, g.name, t.name AS tier, g.active
                        FROM gymfit_gyms g JOIN gymfit_platform_tiers t ON t.id = g.tier_id
                        ORDER BY g.name
                        """),
                "tiers", rows("SELECT id, name, monthly_price AS price, currency, active FROM gymfit_platform_tiers ORDER BY name"),
                "openAlerts", jdbc.queryForObject("SELECT COUNT(*) FROM gymfit_audit WHERE acknowledged_at IS NULL", Long.class),
                "audit", rows("""
                        SELECT e.id, g.name AS gym, a.email AS actor, e.event, e.subject,
                               e.recorded_at, e.acknowledged_at, reviewer.email AS acknowledged_by
                        FROM gymfit_audit e JOIN gymfit_accounts a ON a.id = e.actor_id
                        LEFT JOIN gymfit_gyms g ON g.id = e.gym_id
                        LEFT JOIN gymfit_accounts reviewer ON reviewer.id = e.acknowledged_by
                        ORDER BY (e.acknowledged_at IS NULL) DESC, e.id DESC LIMIT 200
                        """));
    }

    private Map<String, Object> ownerOverview(GymAccount account, Map<String, Object> affiliation) {
        var data = workspace(account, affiliation);
        if (!data.containsKey("gym")) return data;
        long gym = requireGym(affiliation);
        data.put("members", members(gym, null));
        data.put("staff", rows("""
                SELECT a.id, a.email, a.role, b.name AS branch
                FROM gymfit_affiliations f JOIN gymfit_accounts a ON a.id = f.account_id
                LEFT JOIN gymfit_branches b ON b.id = f.branch_id
                WHERE f.gym_id = ? AND a.role IN ('TRAINER', 'GYM_OWNER') ORDER BY a.email
                """, gym));
        data.put("branches", rows("SELECT id, name, address FROM gymfit_branches WHERE gym_id = ? ORDER BY name", gym));
        data.put("tiers", rows("""
                SELECT id, name, term_days, price, currency, active FROM gymfit_membership_tiers WHERE gym_id = ? ORDER BY name
                """, gym));
        data.put("classes", classes(gym, null, null));
        data.put("payments", rows("""
                SELECT p.id, a.email, p.amount, p.currency, p.method, p.reference, p.paid_at
                FROM gymfit_payments p JOIN gymfit_affiliations f ON f.account_id = p.member_id
                JOIN gymfit_accounts a ON a.id = p.member_id
                WHERE f.gym_id = ? ORDER BY p.id DESC LIMIT 200
                """, gym));
        data.put("checkins", rows("""
                SELECT c.id, a.email, b.name AS branch, c.checked_in_at
                FROM gymfit_checkins c JOIN gymfit_branches b ON b.id = c.branch_id
                JOIN gymfit_accounts a ON a.id = c.member_id
                WHERE b.gym_id = ? ORDER BY c.id DESC LIMIT 200
                """, gym));
        return data;
    }

    private Map<String, Object> trainerOverview(GymAccount account, Map<String, Object> affiliation) {
        var data = workspace(account, affiliation);
        if (!data.containsKey("gym")) return data;
        long gym = requireGym(affiliation);
        data.put("members", members(gym, account.id()));
        data.put("classes", classes(gym, account.id(), null));
        data.put("roster", rows("""
                SELECT r.id, r.class_id, c.title, COALESCE(p.display_name, a.email) AS member,
                       r.status, c.starts_at, c.cancelled
                FROM gymfit_reservations r JOIN gymfit_classes c ON c.id = r.class_id
                JOIN gymfit_accounts a ON a.id = r.member_id
                LEFT JOIN gymfit_profiles p ON p.member_id = r.member_id
                WHERE c.gym_id = ? AND c.trainer_id = ?
                ORDER BY c.starts_at DESC, r.id LIMIT 300
                """, gym, account.id()));
        data.put("drafts", rows("""
                SELECT draft_key AS id, JSON_UNQUOTE(JSON_EXTRACT(payload, '$.title')) AS name
                FROM gymfit_account_workout_drafts WHERE account_id = ? ORDER BY draft_key
                """, account.id()));
        return data;
    }

    private Map<String, Object> memberOverview(GymAccount account, Map<String, Object> affiliation) {
        var data = workspace(account, affiliation);
        long id = account.id();
        data.put("profile", first("SELECT display_name, phone, goal FROM gymfit_profiles WHERE member_id = ?", id));
        data.put("log", trainingLog(id));
        data.put("payments", rows("""
                SELECT id, amount, currency, method, reference, paid_at
                FROM gymfit_payments WHERE member_id = ? ORDER BY id DESC LIMIT 200
                """, id));
        data.put("checkins", rows("""
                SELECT c.id, b.name AS branch, c.checked_in_at FROM gymfit_checkins c
                JOIN gymfit_branches b ON b.id = c.branch_id WHERE c.member_id = ? ORDER BY c.id DESC LIMIT 200
                """, id));
        data.put("plans", plans(id));
        if (data.containsKey("gym")) {
            data.put("classes", classes(requireGym(affiliation), null, id));
            data.put("membership", first("""
                    SELECT t.name, m.valid_until, CASE WHEN m.valid_until >= UTC_DATE() THEN m.pass_code END AS pass_code
                    FROM gymfit_memberships m JOIN gymfit_membership_tiers t ON t.id = m.tier_id WHERE m.member_id = ?
                    """, id));
        }
        return data;
    }

    private Map<String, Object> platformChange(GymAccount account, String action, JsonNode body) {
        switch (action) {
            case "platform-tier" -> {
                String name = string(body, "name", 120);
                jdbc.update("INSERT INTO gymfit_platform_tiers (name, monthly_price, currency) VALUES (?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE monthly_price = ?, currency = ?",
                        name, money(body, "price"), currency(body), money(body, "price"), currency(body));
                audit(account, null, "Subscription pricing saved", name);
            }
            case "platform-tier-status" -> {
                long tier = id(body, "tierId");
                boolean active = flag(body, "active");
                updated(jdbc.update("UPDATE gymfit_platform_tiers SET active = ? WHERE id = ?", active, tier));
                audit(account, null, active ? "Subscription tier enabled" : "Subscription tier disabled", Long.toString(tier));
            }
            case "gym-create" -> {
                long tier = id(body, "tierId");
                required("SELECT id FROM gymfit_platform_tiers WHERE id = ? AND active = TRUE FOR UPDATE", tier);
                String name = string(body, "name", 120);
                String ownerEmail = email(body);
                long gym = insert("INSERT INTO gymfit_gyms (name, tier_id) VALUES (?, ?)", name, tier);
                Map<String, Object> result = attachOrInvite(gym, null, ownerEmail, GymAccount.Role.GYM_OWNER);
                audit(account, gym, "Gym onboarded", name);
                return result;
            }
            case "gym-owner-invite" -> {
                long gym = id(body, "gymId");
                required("SELECT id FROM gymfit_gyms WHERE id = ? AND active = TRUE FOR UPDATE", gym);
                String ownerEmail = email(body);
                var result = attachOrInvite(gym, null, ownerEmail, GymAccount.Role.GYM_OWNER);
                audit(account, gym, "Owner invitation requested", ownerEmail);
                return result;
            }
            case "gym-status" -> {
                long gym = id(body, "gymId");
                boolean active = flag(body, "active");
                updated(jdbc.update("UPDATE gymfit_gyms SET active = ? WHERE id = ?", active, gym));
                audit(account, gym, active ? "Gym reactivated" : "Gym suspended", Long.toString(gym));
            }
            case "gym-tier" -> {
                long tier = id(body, "tierId");
                long gym = id(body, "gymId");
                required("SELECT id FROM gymfit_platform_tiers WHERE id = ? AND active = TRUE FOR UPDATE", tier);
                updated(jdbc.update("UPDATE gymfit_gyms SET tier_id = ? WHERE id = ?", tier, gym));
                audit(account, gym, "Gym subscription changed", Long.toString(tier));
            }
            case "audit-acknowledge" -> {
                long event = id(body, "eventId");
                required("SELECT id FROM gymfit_audit WHERE id = ?", event);
                jdbc.update("""
                        UPDATE gymfit_audit SET acknowledged_at = UTC_TIMESTAMP(), acknowledged_by = ?
                        WHERE id = ? AND acknowledged_at IS NULL
                        """, account.id(), event);
            }
            default -> throw missing();
        }
        return Map.of();
    }

    private Map<String, Object> ownerChange(GymAccount account, long gym, String action, JsonNode body) {
        switch (action) {
            case "branch" -> {
                String name = string(body, "name", 120);
                String address = string(body, "address", 250);
                Long branchId = optionalId(body, "branchId");
                if (branchId == null) {
                    jdbc.update("INSERT INTO gymfit_branches (gym_id, name, address) VALUES (?, ?, ?)", gym, name, address);
                } else {
                    branch(gym, branchId);
                    jdbc.update("UPDATE gymfit_branches SET name = ?, address = ? WHERE id = ? AND gym_id = ?",
                            name, address, branchId, gym);
                }
                audit(account, gym, "Branch saved", name);
            }
            case "invite" -> {
                String email = email(body);
                var role = GymAccount.Role.valueOf(option(body, "role", "MEMBER", "TRAINER"));
                Long branch = optionalId(body, "branchId");
                if (branch != null) branch(gym, branch);
                var result = attachOrInvite(gym, branch, email, role);
                audit(account, gym, role == GymAccount.Role.MEMBER ? "Member access set up" : "Staff access set up", email);
                return result;
            }
            case "staff-branch" -> {
                long trainer = id(body, "trainerId");
                long branch = id(body, "branchId");
                person(gym, trainer, "TRAINER");
                branch(gym, branch);
                jdbc.update("UPDATE gymfit_affiliations SET branch_id = ? WHERE account_id = ?", branch, trainer);
                audit(account, gym, "Staff branch changed", Long.toString(trainer));
            }
            case "client-trainer" -> {
                long member = id(body, "memberId");
                Long trainer = optionalId(body, "trainerId");
                person(gym, member, "MEMBER");
                if (trainer != null) person(gym, trainer, "TRAINER");
                jdbc.update("UPDATE gymfit_affiliations SET trainer_id = ? WHERE account_id = ?", trainer, member);
                audit(account, gym, "Client trainer changed", Long.toString(member));
            }
            case "membership-tier" -> {
                String name = string(body, "name", 120);
                int days = integer(body, "days", 1, 3650);
                BigDecimal price = money(body, "price");
                String currency = currency(body);
                jdbc.update("""
                        INSERT INTO gymfit_membership_tiers (gym_id, name, term_days, price, currency)
                        VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE term_days = ?, price = ?, currency = ?
                        """, gym, name, days, price, currency, days, price, currency);
                audit(account, gym, "Membership pricing saved", name);
            }
            case "membership-tier-status" -> {
                long tier = id(body, "tierId");
                boolean active = flag(body, "active");
                updated(jdbc.update("UPDATE gymfit_membership_tiers SET active = ? WHERE gym_id = ? AND id = ?",
                        active, gym, tier));
                audit(account, gym, active ? "Membership tier enabled" : "Membership tier disabled", Long.toString(tier));
            }
            case "membership" -> membership(account, gym, body);
            case "payment" -> {
                long member = id(body, "memberId");
                person(gym, member, "MEMBER");
                payment(account, member, money(body, "amount"), currency(body), body);
                audit(account, gym, "Payment recorded", Long.toString(member));
            }
            case "check-in" -> checkIn(account, gym, body);
            case "class" -> scheduleClass(account, gym, body);
            case "class-cancel" -> {
                long classId = id(body, "classId");
                updated(jdbc.update("""
                        UPDATE gymfit_classes SET cancelled = TRUE
                        WHERE gym_id = ? AND id = ? AND starts_at > UTC_TIMESTAMP() AND cancelled = FALSE
                        """, gym, classId));
                audit(account, gym, "Class cancelled", Long.toString(classId));
            }
            default -> throw missing();
        }
        return Map.of();
    }

    private Map<String, Object> trainerChange(GymAccount account, long gym, String action, JsonNode body) {
        switch (action) {
            case "assign-plan" -> {
                long member = id(body, "memberId");
                member(account, gym, member);
                String kind = option(body, "kind", "WORKOUT", "DIET");
                String title = string(body, "title", 120);
                String details = optionalString(body, "details", 15000);
                String draftKey = optionalString(body, "draftKey", 64);
                String workout = null;
                if (!draftKey.isEmpty()) {
                    if (!kind.equals("WORKOUT")) throw invalid("Workout drafts can only be attached to workout plans.");
                    workout = drafts.find(account.id(), draftKey).orElseThrow(WorkspaceController::missing);
                }
                if (workout == null && details.isBlank()) throw invalid("Enter plan instructions or attach a workout draft.");
                String nutrition = kind.equals("DIET") ? nutritionTargets(body) : null;
                jdbc.update("""
                        INSERT INTO gymfit_assigned_plans (member_id, assigned_by, kind, title, details, workout, nutrition, assigned_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
                        ON DUPLICATE KEY UPDATE assigned_by = ?, title = ?, details = ?, workout = ?,
                            nutrition = ?, assigned_at = UTC_TIMESTAMP()
                        """, member, account.id(), kind, title, details, workout, nutrition,
                        account.id(), title, details, workout, nutrition);
                audit(account, gym, kind.equals("WORKOUT") ? "Workout plan assigned" : "Diet plan assigned", Long.toString(member));
            }
            case "attendance" -> {
                long reservation = id(body, "reservationId");
                String status = option(body, "status", "ATTENDED", "ABSENT");
                updated(jdbc.update("""
                        UPDATE gymfit_reservations r JOIN gymfit_classes c ON c.id = r.class_id
                        SET r.status = ? WHERE r.id = ? AND c.gym_id = ? AND c.trainer_id = ?
                        AND c.cancelled = FALSE AND c.starts_at <= UTC_TIMESTAMP() AND r.status <> 'WAITLISTED'
                        """, status, reservation, gym, account.id()));
            }
            default -> throw missing();
        }
        return Map.of();
    }

    private Map<String, Object> memberChange(GymAccount account, Map<String, Object> affiliation, String action, JsonNode body) {
        long id = account.id();
        switch (action) {
            case "profile" -> {
                String name = string(body, "displayName", 120);
                String phone = optionalString(body, "phone", 40);
                String goal = optionalString(body, "goal", 250);
                jdbc.update("""
                        INSERT INTO gymfit_profiles (member_id, display_name, phone, goal) VALUES (?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE display_name = ?, phone = ?, goal = ?
                        """, id, name, phone, goal, name, phone, goal);
            }
            case "book" -> reserve(requireGym(affiliation), id, id(body, "classId"));
            case "release" -> release(requireGym(affiliation), id, id(body, "classId"));
            case "measurement" -> {
                var details = json.createObjectNode();
                details.put("weightKg", decimal(body, "weightKg", "1", "1000"));
                if (!optionalString(body, "bodyFatPct", 12).isEmpty()) {
                    details.put("bodyFatPct", decimal(body, "bodyFatPct", "0", "100"));
                }
                log(id, "MEASUREMENT", "Body measurement", details);
            }
            case "set" -> {
                var details = json.createObjectNode();
                details.put("reps", integer(body, "reps", 1, 999));
                details.put("loadKg", decimal(body, "loadKg", "0", "2000"));
                log(id, "SET", string(body, "label", 120), details);
            }
            case "meal" -> log(id, "MEAL", string(body, "label", 120),
                    json.createObjectNode().put("notes", optionalString(body, "notes", 1000)));
            case "home" -> log(id, "HOME", string(body, "label", 120),
                    json.createObjectNode().put("minutes", integer(body, "minutes", 1, 300)));
            default -> throw missing();
        }
        return Map.of();
    }

    private String nutritionTargets(JsonNode body) {
        var targets = json.createObjectNode();
        for (String field : List.of("calories", "protein", "carbs", "fat")) {
            if (!optionalString(body, field, 12).isEmpty()) {
                targets.put(field, decimal(body, field, field.equals("calories") ? "1" : "0",
                        field.equals("calories") ? "10000" : "2000"));
            }
        }
        return targets.isEmpty() ? null : targets.toString();
    }

    private void membership(GymAccount account, long gym, JsonNode body) {
        long member = id(body, "memberId");
        long tier = id(body, "tierId");
        person(gym, member, "MEMBER");
        String operationId = string(body, "operationId", 36);
        if (!operationId.matches("[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}")) {
            throw invalid("Reload the membership form and try again.");
        }
        if (!first("""
                SELECT operation_id FROM gymfit_membership_operations
                WHERE operation_id = ? AND member_id = ? AND recorded_by = ? AND tier_id = ?
                """, operationId, member, account.id(), tier).isEmpty()) return;
        var pricing = required("""
                SELECT term_days, price, currency FROM gymfit_membership_tiers
                WHERE id = ? AND gym_id = ? AND active = TRUE
                """, tier, gym);
        BigDecimal price = (BigDecimal) pricing.get("price");
        if (price.signum() > 0) payment(account, member, price, (String) pricing.get("currency"), body);
        int days = ((Number) pricing.get("term_days")).intValue();
        jdbc.update("""
                INSERT INTO gymfit_memberships (member_id, tier_id, valid_until, pass_code)
                VALUES (?, ?, TIMESTAMPADD(DAY, ? - 1, UTC_DATE()), ?)
                ON DUPLICATE KEY UPDATE tier_id = ?,
                    valid_until = TIMESTAMPADD(DAY, ?, GREATEST(valid_until, UTC_DATE() - INTERVAL 1 DAY))
                """, member, tier, days, UUID.randomUUID().toString(), tier, days);
        jdbc.update("""
                INSERT INTO gymfit_membership_operations (operation_id, member_id, recorded_by, tier_id)
                VALUES (?, ?, ?, ?)
                """, operationId, member, account.id(), tier);
        audit(account, gym, "Membership activated or renewed", Long.toString(member));
    }

    private void payment(GymAccount account, long member, BigDecimal amount, String currency, JsonNode body) {
        if (amount.signum() <= 0) throw invalid("Enter a positive payment amount.");
        jdbc.update("""
                INSERT INTO gymfit_payments (member_id, recorded_by, amount, currency, method, reference, paid_at)
                VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
                """, member, account.id(), amount, currency,
                option(body, "method", "CASH", "CARD_TERMINAL", "BANK_TRANSFER", "OTHER"),
                string(body, "reference", 120));
    }

    private void checkIn(GymAccount account, long gym, JsonNode body) {
        long branch = id(body, "branchId");
        branch(gym, branch);
        var membership = required("""
                SELECT m.member_id FROM gymfit_memberships m
                JOIN gymfit_affiliations f ON f.account_id = m.member_id
                JOIN gymfit_accounts a ON a.id = m.member_id
                WHERE f.gym_id = ? AND a.enabled = TRUE AND m.pass_code = ? AND m.valid_until >= UTC_DATE()
                """, gym, string(body, "passCode", 36));
        long member = number(membership.get("member_id"));
        if (!first("""
                SELECT id FROM gymfit_checkins WHERE member_id = ? AND branch_id = ?
                AND checked_in_at >= UTC_TIMESTAMP() - INTERVAL 1 MINUTE
                """, member, branch).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This pass was just checked in at this branch.");
        }
        jdbc.update("INSERT INTO gymfit_checkins (member_id, branch_id, checked_in_at) VALUES (?, ?, UTC_TIMESTAMP())",
                member, branch);
        audit(account, gym, "Member checked in", Long.toString(member));
    }

    private void scheduleClass(GymAccount account, long gym, JsonNode body) {
        long branch = id(body, "branchId");
        long trainer = id(body, "trainerId");
        String title = string(body, "title", 120);
        branch(gym, branch);
        person(gym, trainer, "TRAINER");
        Instant startsAt;
        try {
            startsAt = Instant.parse(string(body, "startsAt", 32));
        } catch (DateTimeParseException malformed) {
            throw invalid("Choose a valid class date and time.");
        }
        if (!startsAt.isAfter(Instant.now()) || startsAt.isAfter(Instant.now().plusSeconds(5L * 366 * 86400))) {
            throw invalid("Choose a future class date within the next five years.");
        }
        jdbc.update("""
                INSERT INTO gymfit_classes (gym_id, branch_id, trainer_id, title, starts_at, capacity)
                VALUES (?, ?, ?, ?, ?, ?)
                """, gym, branch, trainer, title, LocalDateTime.ofInstant(startsAt, ZoneOffset.UTC),
                integer(body, "capacity", 1, 1000));
        audit(account, gym, "Class scheduled", title);
    }

    private void reserve(long gym, long member, long classId) {
        int capacity = ((Number) openClass(gym, classId).get("capacity")).intValue();
        if (!first("SELECT id FROM gymfit_reservations WHERE member_id = ? AND class_id = ?", member, classId).isEmpty()) return;
        if (first("""
                SELECT m.member_id FROM gymfit_memberships m CROSS JOIN gymfit_classes c
                WHERE m.member_id = ? AND c.id = ? AND m.valid_until >= DATE(c.starts_at)
                """, member, classId).isEmpty()) {
            throw invalid("Your membership must be valid on the day of the class.");
        }
        int booked = jdbc.queryForObject(
                "SELECT COUNT(*) FROM gymfit_reservations WHERE class_id = ? AND status = 'BOOKED'", Integer.class, classId);
        jdbc.update("INSERT INTO gymfit_reservations (class_id, member_id, status) VALUES (?, ?, ?)",
                classId, member, booked < capacity ? "BOOKED" : "WAITLISTED");
    }

    private void release(long gym, long member, long classId) {
        openClass(gym, classId);
        var booking = first("SELECT status FROM gymfit_reservations WHERE class_id = ? AND member_id = ?", classId, member);
        jdbc.update("DELETE FROM gymfit_reservations WHERE class_id = ? AND member_id = ?", classId, member);
        if ("BOOKED".equals(booking.get("status"))) {
            var next = first("""
                    SELECT r.id FROM gymfit_reservations r
                    JOIN gymfit_memberships m ON m.member_id = r.member_id
                    JOIN gymfit_classes c ON c.id = r.class_id
                    JOIN gymfit_accounts a ON a.id = r.member_id
                    WHERE r.class_id = ? AND r.status = 'WAITLISTED' AND m.valid_until >= DATE(c.starts_at) AND a.enabled = TRUE
                    ORDER BY r.id LIMIT 1
                    """, classId);
            if (!next.isEmpty()) jdbc.update("UPDATE gymfit_reservations SET status = 'BOOKED' WHERE id = ?", next.get("id"));
        }
    }

    private Map<String, Object> openClass(long gym, long classId) {
        return required("""
                SELECT capacity FROM gymfit_classes
                WHERE gym_id = ? AND id = ? AND cancelled = FALSE AND starts_at > UTC_TIMESTAMP()
                """, gym, classId);
    }

    private List<Map<String, Object>> classes(long gym, Long trainer, Long member) {
        return rows("""
                SELECT c.id, c.title, c.starts_at, c.capacity, c.cancelled, b.name AS branch,
                       t.email AS trainer, own.status,
                       (SELECT COUNT(*) FROM gymfit_reservations r WHERE r.class_id = c.id
                         AND r.status IN ('BOOKED', 'ATTENDED', 'ABSENT')) AS booked,
                       (SELECT COUNT(*) FROM gymfit_reservations r WHERE r.class_id = c.id
                         AND r.status = 'WAITLISTED') AS waiting
                FROM gymfit_classes c JOIN gymfit_branches b ON b.id = c.branch_id
                JOIN gymfit_accounts t ON t.id = c.trainer_id
                LEFT JOIN gymfit_reservations own ON own.class_id = c.id AND own.member_id = ?
                WHERE c.gym_id = ? AND (? IS NULL OR c.trainer_id = ?)
                  AND (? IS NULL OR (c.cancelled = FALSE AND c.starts_at > UTC_TIMESTAMP()) OR own.id IS NOT NULL)
                ORDER BY (c.starts_at > UTC_TIMESTAMP()) DESC,
                         CASE WHEN c.starts_at > UTC_TIMESTAMP() THEN c.starts_at END,
                         c.starts_at DESC LIMIT 200
                """, member, gym, trainer, trainer, member);
    }

    private List<Map<String, Object>> members(long gym, Long trainer) {
        return rows("""
                SELECT a.id, a.email, COALESCE(p.display_name, a.email) AS name, b.name AS branch,
                       t.email AS trainer, mt.name AS membership, m.valid_until
                FROM gymfit_affiliations f JOIN gymfit_accounts a ON a.id = f.account_id
                LEFT JOIN gymfit_profiles p ON p.member_id = a.id
                LEFT JOIN gymfit_branches b ON b.id = f.branch_id
                LEFT JOIN gymfit_accounts t ON t.id = f.trainer_id
                LEFT JOIN gymfit_memberships m ON m.member_id = a.id
                LEFT JOIN gymfit_membership_tiers mt ON mt.id = m.tier_id
                WHERE f.gym_id = ? AND a.role = 'MEMBER' AND a.enabled = TRUE
                    AND (? IS NULL OR f.trainer_id = ?) ORDER BY a.email
                """, gym, trainer, trainer);
    }

    private List<Map<String, Object>> trainingLog(long member) {
        // Limit each category independently so recent workout sets cannot hide progress measurements.
        return rows("""
                SELECT id, kind, label, details, recorded_at FROM (
                    SELECT l.*, ROW_NUMBER() OVER (PARTITION BY kind ORDER BY id DESC) AS position_in_log
                    FROM gymfit_training_log l WHERE member_id = ?
                ) recent WHERE position_in_log <= 100 ORDER BY id DESC
                """, member);
    }

    private List<Map<String, Object>> plans(long member) {
        return rows("""
                SELECT p.id, p.kind, p.title, p.details, p.workout, p.nutrition, p.assigned_at, a.email AS trainer
                FROM gymfit_assigned_plans p JOIN gymfit_accounts a ON a.id = p.assigned_by
                WHERE p.member_id = ? ORDER BY p.kind
                """, member);
    }

    private void log(long member, String kind, String label, JsonNode details) {
        jdbc.update("""
                INSERT INTO gymfit_training_log (member_id, kind, label, details, recorded_at)
                VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
                """, member, kind, label, details.toString());
    }

    private void audit(GymAccount account, Long gym, String event, String subject) {
        jdbc.update("""
                INSERT INTO gymfit_audit (actor_id, gym_id, event, subject, recorded_at)
                VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
                """, account.id(), gym, event, subject);
    }

    private Map<String, Object> attachOrInvite(long gym, Long branch, String email, GymAccount.Role role) {
        var existing = first("""
                SELECT a.role, a.enabled, f.gym_id FROM gymfit_accounts a
                LEFT JOIN gymfit_affiliations f ON f.account_id = a.id WHERE a.email = ?
                """, email);
        if (!existing.isEmpty()) {
            if (!role.name().equals(existing.get("role")) || !Boolean.TRUE.equals(existing.get("enabled"))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "That email belongs to an account with different access.");
            }
            Object currentGym = existing.get("gym_id");
            if (currentGym != null) {
                if (number(currentGym) != gym) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "That email already belongs to another gym.");
                }
                return Map.of("message", "This account is already linked to the gym.");
            }
        }

        String code = invitations.issue(email, role);
        jdbc.update("INSERT INTO gymfit_workspace_invitations (token_hash, gym_id, branch_id) VALUES (?, ?, ?)",
                AccountInvitations.hash(code), gym, branch);
        return Map.of("invitation", code, "email", email, "existingAccount", !existing.isEmpty());
    }

    private Map<String, Object> workspace(GymAccount account, Map<String, Object> affiliation) {
        var data = new LinkedHashMap<String, Object>();
        data.put("email", account.getUsername());
        if (Boolean.TRUE.equals(affiliation.get("active"))) data.put("gym", affiliation.get("name"));
        data.put("gymStatus", affiliation.isEmpty() ? "UNLINKED" : data.containsKey("gym") ? "ACTIVE" : "SUSPENDED");
        return data;
    }

    private Map<String, Object> affiliation(GymAccount account, boolean lock) {
        // Gym mutations lock the tenant row so booking, promotion and suspension stay consistent.
        return first("""
                SELECT g.id, g.name, g.active FROM gymfit_gyms g
                JOIN gymfit_affiliations f ON f.gym_id = g.id WHERE f.account_id = ?
                """ + (lock ? " FOR UPDATE" : ""), account.id());
    }

    private long requireGym(Map<String, Object> affiliation) {
        if (!Boolean.TRUE.equals(affiliation.get("active"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "An active gym is required for this action.");
        }
        return number(affiliation.get("id"));
    }

    private void branch(long gym, long branch) {
        required("SELECT id FROM gymfit_branches WHERE id = ? AND gym_id = ?", branch, gym);
    }

    private void person(long gym, long person, String role) {
        required("""
                SELECT a.id FROM gymfit_affiliations f JOIN gymfit_accounts a ON a.id = f.account_id
                WHERE f.gym_id = ? AND a.id = ? AND a.role = ? AND a.enabled = TRUE
                """, gym, person, role);
    }

    private void member(GymAccount trainer, long gym, long member) {
        required("""
                SELECT a.id FROM gymfit_affiliations f JOIN gymfit_accounts a ON a.id = f.account_id
                WHERE f.gym_id = ? AND a.id = ? AND f.trainer_id = ? AND a.role = 'MEMBER' AND a.enabled = TRUE
                """, gym, member, trainer.id());
    }

    private long insert(String sql, Object... values) {
        var key = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            return statement;
        }, key);
        return key.getKey().longValue();
    }

    private List<Map<String, Object>> rows(String sql, Object... values) {
        var results = jdbc.queryForList(sql, values);
        for (var row : results) {
            row.replaceAll((key, value) -> {
                if (value instanceof Timestamp timestamp) return DateTimeFormatter.ISO_INSTANT.format(timestamp.toLocalDateTime().toInstant(ZoneOffset.UTC));
                if (value instanceof LocalDateTime dateTime) return DateTimeFormatter.ISO_INSTANT.format(dateTime.toInstant(ZoneOffset.UTC));
                if (value instanceof java.sql.Date date) return date.toString();
                return value;
            });
        }
        return results;
    }

    private Map<String, Object> first(String sql, Object... values) {
        return rows(sql, values).stream().findFirst().orElseGet(Map::of);
    }

    private Map<String, Object> required(String sql, Object... values) {
        return rows(sql, values).stream().findFirst().orElseThrow(WorkspaceController::missing);
    }

    private static void updated(int count) {
        if (count == 0) throw missing();
    }

    private static void requireRole(GymAccount account, GymAccount.Role role) {
        if (account.role() != role) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }

    private static long number(Object value) {
        return ((Number) value).longValue();
    }

    private static String optionalString(JsonNode data, String key, int max) {
        if (data == null || !data.isObject()) throw invalid("Send an object with the requested fields.");
        var value = data.path(key);
        if (value.isMissingNode() || value.isNull()) return "";
        if (!value.isTextual() && !value.isNumber()) throw invalid("Invalid " + key + ".");
        String text = value.asText().strip();
        if (text.length() > max) throw invalid("The " + key + " field is too long.");
        return text;
    }

    private static String string(JsonNode data, String key, int max) {
        String text = optionalString(data, key, max);
        if (text.isEmpty()) throw invalid("Enter a value for " + key + ".");
        return text;
    }

    private static String email(JsonNode data) {
        String email = AccountDirectory.normalize(string(data, "email", 254));
        if (!AccountDirectory.validEmail(email)) throw invalid("Enter a valid email address.");
        return email;
    }

    private static String option(JsonNode data, String key, String... options) {
        String value = string(data, key, 64);
        if (!List.of(options).contains(value)) throw invalid("Choose a valid " + key + ".");
        return value;
    }

    private static boolean flag(JsonNode data, String key) {
        if (!data.path(key).isBoolean()) throw invalid("Choose a status.");
        return data.path(key).booleanValue();
    }

    private static String currency(JsonNode data) {
        String currency = string(data, "currency", 3).toUpperCase(java.util.Locale.ROOT);
        try {
            java.util.Currency.getInstance(currency);
            return currency;
        } catch (IllegalArgumentException unknown) {
            throw invalid("Enter a valid three-letter currency code.");
        }
    }

    private static BigDecimal money(JsonNode data, String key) {
        return decimal(data, key, "0", "9999999999.99");
    }

    private static BigDecimal decimal(JsonNode data, String key, String min, String max) {
        String value = string(data, key, 16);
        if (value.matches("[0-9]+(\\.[0-9]{1,2})?")) {
            BigDecimal amount = new BigDecimal(value);
            if (amount.compareTo(new BigDecimal(min)) >= 0 && amount.compareTo(new BigDecimal(max)) <= 0) return amount;
        }
        throw invalid("Enter a valid " + key + " between " + min + " and " + max + ".");
    }

    private static int integer(JsonNode data, String key, int min, int max) {
        long value = id(data, key);
        if (value < min || value > max) throw invalid("Enter " + key + " between " + min + " and " + max + ".");
        return (int) value;
    }

    private static Long optionalId(JsonNode data, String key) {
        return optionalString(data, key, 19).isEmpty() ? null : id(data, key);
    }

    private static long id(JsonNode data, String key) {
        try {
            long value = Long.parseLong(string(data, key, 19));
            if (value > 0) return value;
        } catch (NumberFormatException ignored) {
            // Report malformed inputs with the same message as out-of-range IDs.
        }
        throw invalid("Choose a valid " + key + ".");
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "That item is unavailable in this workspace.");
    }

    private static ResponseEntity<Map<String, Object>> privateResponse(Map<String, Object> body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> requestError(ResponseStatusException failure) {
        return ResponseEntity.status(failure.getStatusCode()).cacheControl(CacheControl.noStore())
                .body(Map.of("error", failure.getReason() == null ? "This action is unavailable." : failure.getReason()));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<Map<String, String>> duplicate() {
        return ResponseEntity.status(HttpStatus.CONFLICT).cacheControl(CacheControl.noStore())
                .body(Map.of("error", "An entry with the same account or reference already exists."));
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<Map<String, String>> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).cacheControl(CacheControl.noStore())
                .body(Map.of("error", "Workspace storage is temporarily unavailable."));
    }
}
