package com.gymfit.controller;

import com.gymfit.dto.DietDtos.*;
import com.gymfit.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import com.gymfit.api.GymAccount;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.util.*;

@RestController @RequestMapping("/api/v1/diet")
public class DietController {
    private final ProfileService profiles;
    private final NutritionService nutrition;
    private final DietPlanService plans;
    private final LegacyImportService imports;
    private final DietProgressReportService reports;
    public DietController(ProfileService profiles,NutritionService nutrition,DietPlanService plans,LegacyImportService imports,DietProgressReportService reports)
    {
        this.profiles=profiles;
        this.nutrition=nutrition;
        this.plans=plans;
        this.imports=imports;
        this.reports=reports;
    }
    @PostMapping("/profile")
    @ResponseStatus(HttpStatus.CREATED)
    public ProfileRequest create(@AuthenticationPrincipal GymAccount user,@Valid @RequestBody ProfileRequest body)
    {
        return profiles.save(user.featureOwnerKey(),body,true);
    }
    @PutMapping("/profile")
    public ProfileRequest update(@AuthenticationPrincipal GymAccount user,@Valid @RequestBody ProfileRequest body)
    {
        return profiles.save(user.featureOwnerKey(),body,false);
    }
    @GetMapping("/profile")
    public ProfileRequest profile(@AuthenticationPrincipal GymAccount user)
    {
        return profiles.get(user.featureOwnerKey());
    }
    @PostMapping("/calculate")
    public Nutrition calculate(@Valid @RequestBody ProfileRequest body)
    {
        return nutrition.calculate(body);
    }
    @PostMapping("/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public PlanView generate(@AuthenticationPrincipal GymAccount user,@Valid @RequestBody GenerateRequest body)
    {
        return plans.generate(user.featureOwnerKey(),body);
    }
    @GetMapping("/plans")
    public List<PlanView> plans(@AuthenticationPrincipal GymAccount user)
    {
        return plans.list(user.featureOwnerKey());
    }
    @GetMapping("/plans/{id}")
    public PlanView plan(@AuthenticationPrincipal GymAccount user,@PathVariable @Positive long id)
    {
        return plans.get(user.featureOwnerKey(),id);
    }
    @GetMapping("/plans/{id}/report")
    public ProgressReportView report(@AuthenticationPrincipal GymAccount user,@PathVariable @Positive long id)
    {
        return reports.get(user.featureOwnerKey(),id);
    }
    @GetMapping("/plans/{id}/meals/{mealId}/alternatives")
    public List<AlternativeView> alternatives(@AuthenticationPrincipal GymAccount user,@PathVariable @Positive long id,@PathVariable @Positive long mealId)
    {
        return plans.alternatives(user.featureOwnerKey(),id,mealId);
    }
    @PostMapping("/replace-meal")
    public PlanView replace(@AuthenticationPrincipal GymAccount user,@Valid @RequestBody ReplaceRequest body)
    {
        return plans.replace(user.featureOwnerKey(),body);
    }
    @PutMapping("/plans/{id}/meals/{mealId}/intake")
    public PlanView intake(@AuthenticationPrincipal GymAccount user,@PathVariable @Positive long id,@PathVariable @Positive long mealId,@Valid @RequestBody IntakeRequest body)
    {
        return plans.intake(user.featureOwnerKey(),id,mealId,body);
    }
    @PostMapping("/progress")
    public WeightView progress(@AuthenticationPrincipal GymAccount user,@Valid @RequestBody WeightRequest body)
    {
        return plans.recordWeight(user.featureOwnerKey(),body);
    }
    @PostMapping("/plans/{id}/meals/{mealId}/foods")
    public PlanView food(@AuthenticationPrincipal GymAccount user,@PathVariable @Positive long id,@PathVariable @Positive long mealId,@Valid @RequestBody MealFoodRequest body)
    {
        return plans.editFood(user.featureOwnerKey(),id,mealId,body);
    }
    @GetMapping("/progress") public List<WeightView> progress(@AuthenticationPrincipal GymAccount user)
    {
        return plans.weights(user.featureOwnerKey());
    }
    @PostMapping("/import")
    @ResponseStatus(HttpStatus.CREATED) public ImportReceipt archive(@AuthenticationPrincipal GymAccount user,@Valid @RequestBody ImportRequest body)
    {
        return imports.archive(user.featureOwnerKey(),body);
    }
    @GetMapping("/imports")
    public List<ImportReceipt> archives(@AuthenticationPrincipal GymAccount user)
    {
        return imports.list(user.featureOwnerKey());
    }
    @GetMapping("/imports/{id}")
    public com.fasterxml.jackson.databind.JsonNode archive(@AuthenticationPrincipal GymAccount user,@PathVariable @Positive long id)
    {
        return imports.get(user.featureOwnerKey(),id);
    }
}
