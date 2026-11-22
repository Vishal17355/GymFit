package com.gymfit.controller;

import com.gymfit.service.NutritionDiaryService;
import com.gymfit.service.NutritionDiaryService.*;
import jakarta.validation.Valid;
import com.gymfit.api.GymAccount;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/nutrition-diary")
public class NutritionDiaryController {
    private final NutritionDiaryService diary;

    public NutritionDiaryController(NutritionDiaryService diary) { this.diary = diary; }

    @GetMapping public Day day(@AuthenticationPrincipal GymAccount user, @RequestParam LocalDate date) {
        return diary.day(user.featureOwnerKey(), date);
    }
    @GetMapping("/recent") public List<Entry> recent(@AuthenticationPrincipal GymAccount user, @RequestParam(defaultValue="false") boolean favorites) {
        return diary.recent(user.featureOwnerKey(), favorites);
    }
    @PostMapping("/entries") public Day add(@AuthenticationPrincipal GymAccount user, @Valid @RequestBody Add body) {
        return diary.add(user.featureOwnerKey(), body);
    }
    public record Batch(@jakarta.validation.constraints.NotEmpty @jakarta.validation.constraints.Size(max=8)
                        List<@jakarta.validation.constraints.NotNull @Valid Add> entries) {}
    @PostMapping("/entries/batch") public Day batch(@AuthenticationPrincipal GymAccount user, @Valid @RequestBody Batch body) {
        return diary.batch(user.featureOwnerKey(), body.entries);
    }
    @GetMapping("/recipes") public List<RecipeChoice> recipes() { return diary.recipes(); }
    @PostMapping("/entries/recipe") public Day addRecipe(@AuthenticationPrincipal GymAccount user, @Valid @RequestBody AddRecipe body) {
        return diary.addRecipe(user.featureOwnerKey(), body);
    }
    @PatchMapping("/entries/{id}") public Day edit(@AuthenticationPrincipal GymAccount user, @PathVariable long id, @Valid @RequestBody Update body) {
        return diary.edit(user.featureOwnerKey(), id, body);
    }
    @DeleteMapping("/entries/{id}") public Day remove(@AuthenticationPrincipal GymAccount user, @PathVariable long id) {
        return diary.remove(user.featureOwnerKey(), id);
    }
    @PostMapping("/entries/{id}/repeat") public Day repeat(@AuthenticationPrincipal GymAccount user, @PathVariable long id, @Valid @RequestBody Repeat body) {
        return diary.repeat(user.featureOwnerKey(), id, body);
    }
    @PutMapping("/water") public Day water(@AuthenticationPrincipal GymAccount user, @Valid @RequestBody Water body) {
        return diary.water(user.featureOwnerKey(), body);
    }
    @PutMapping("/settings") public Settings settings(@AuthenticationPrincipal GymAccount user, @Valid @RequestBody Settings body) {
        return diary.settings(user.featureOwnerKey(), body);
    }
}
