package com.gymfit.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(path = "/api/workout-drafts", produces = MediaType.APPLICATION_JSON_VALUE)
class WorkoutDraftController {
    private static final int MAX_DRAFT_BYTES = 64 * 1024;
    private static final Pattern DRAFT_KEY =
            Pattern.compile("gymfit_draft_(MEMBER|TRAINER|GYM_OWNER)_(new|plan-[0-9]+)");
    private static final List<String> EXERCISE_TEXT_FIELDS =
            List.of("id", "name", "muscle", "reps", "load", "rest", "rpe");

    private final WorkoutDraftRepository drafts;
    private final ObjectMapper json;

    WorkoutDraftController(WorkoutDraftRepository drafts, ObjectMapper json) {
        this.drafts = drafts;
        this.json = json;
    }

    @GetMapping("/{key}")
    ResponseEntity<DraftResponse> load(@PathVariable String key,
            @AuthenticationPrincipal GymAccount account)
            throws JsonProcessingException {
        validateKey(key, account);
        String payload = drafts.find(account.id(), key).orElse(null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new DraftResponse(payload == null ? null : json.readTree(payload)));
    }

    @PutMapping(path = "/{key}", consumes = MediaType.APPLICATION_JSON_VALUE)
    ResponseEntity<SaveResponse> save(@PathVariable String key,
            @AuthenticationPrincipal GymAccount account,
            HttpServletRequest request) throws IOException {
        validateKey(key, account);
        if (request.getContentLengthLong() > MAX_DRAFT_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "The workout draft is too large.");
        }
        byte[] body = request.getInputStream().readNBytes(MAX_DRAFT_BYTES + 1);
        if (body.length > MAX_DRAFT_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "The workout draft is too large.");
        }

        JsonNode draft;
        try {
            draft = json.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(body);
        } catch (JsonProcessingException ignored) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Send a valid JSON workout draft.");
        }
        if (!validDraft(draft)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The workout draft has invalid fields.");
        }

        drafts.save(account.id(), key, draft.toString());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new SaveResponse(true));
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> storageUnavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).cacheControl(CacheControl.noStore())
                .body(new ApiError("Workout draft storage is unavailable."));
    }

    private static void validateKey(String key, GymAccount account) {
        var draftKey = DRAFT_KEY.matcher(key);
        if (key.length() > 64 || !draftKey.matches()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workout draft location not found.");
        }
        if (!draftKey.group(1).equals(account.role().name())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this workout workspace.");
        }
    }

    private static boolean validDraft(JsonNode draft) {
        if (draft == null || !draft.isObject() || !draft.path("title").isTextual() ||
                !draft.path("goal").isTextual() || !draft.path("durationWeeks").isNumber() ||
                !draft.path("selectedClientId").isIntegralNumber() ||
                !List.of("CLIENT", "TEMPLATE").contains(draft.path("targetType").asText()) ||
                !draft.path("routineExercises").isArray()) {
            return false;
        }
        for (JsonNode exercise : draft.path("routineExercises")) {
            JsonNode sets = exercise.path("sets");
            if (!exercise.path("exerciseId").isIntegralNumber() || !(sets.isNumber() || sets.isTextual()) ||
                    EXERCISE_TEXT_FIELDS.stream().anyMatch(field -> !exercise.path(field).isTextual())) {
                return false;
            }
        }
        return true;
    }

    record DraftResponse(JsonNode draft) {}
    record SaveResponse(boolean saved) {}
    record ApiError(String error) {}
}
