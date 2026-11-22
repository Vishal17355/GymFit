package com.gymfit.home;

import com.gymfit.home.HomeDtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import com.gymfit.api.GymAccount;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.util.*;

@RestController @RequestMapping("/api/v1/home-workouts")
public class HomeWorkoutController {
 private final HomeWorkoutService workouts;private final ExerciseCatalogService catalog;private final WorkoutSessionService sessions;private final WorkoutProgressService progress;
 public HomeWorkoutController(HomeWorkoutService workouts,ExerciseCatalogService catalog,WorkoutSessionService sessions,WorkoutProgressService progress){this.workouts=workouts;this.catalog=catalog;this.sessions=sessions;this.progress=progress;}
 @GetMapping("/exercises") public Page<Exercise> exercises(@RequestParam(defaultValue="")String q,@RequestParam(defaultValue="")String muscle,@RequestParam(defaultValue="")String equipment,@RequestParam(defaultValue="")String difficulty,@RequestParam(defaultValue="")String category,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="24")int size){return catalog.search(q,muscle,equipment,difficulty,category,page,size);}
 @GetMapping("/exercises/{id}") public Exercise exercise(@PathVariable String id){return catalog.get(id);}
 @GetMapping("/muscles") public List<String> muscles(){return HomeWorkoutService.MUSCLES.stream().sorted().toList();}
 @GetMapping("/profile") public Profile profile(@AuthenticationPrincipal GymAccount p){return workouts.profile(p.featureOwnerKey());}
 @PutMapping("/profile") public Profile profile(@AuthenticationPrincipal GymAccount p,@Valid @RequestBody Profile body){return workouts.saveProfile(p.featureOwnerKey(),body);}
 @PostMapping("/plans/generate") @ResponseStatus(HttpStatus.CREATED) public PlanView generate(@AuthenticationPrincipal GymAccount p,@Valid @RequestBody Generate body){return workouts.generate(p.featureOwnerKey(),body);}
 @GetMapping("/plans/current") public PlanView current(@AuthenticationPrincipal GymAccount p){return workouts.current(p.featureOwnerKey());}
 @GetMapping("/plans/{id}") public PlanView plan(@AuthenticationPrincipal GymAccount p,@PathVariable long id){return workouts.get(p.featureOwnerKey(),id);}
 @PatchMapping("/plans/{id}") public PlanView edit(@AuthenticationPrincipal GymAccount p,@PathVariable long id,@Valid @RequestBody PlanEdit body){return workouts.edit(p.featureOwnerKey(),id,body);}
 @PostMapping("/sessions") @ResponseStatus(HttpStatus.CREATED) public SessionView start(@AuthenticationPrincipal GymAccount p,@Valid @RequestBody Start body){return sessions.start(p.featureOwnerKey(),body);}
 @GetMapping("/sessions/active") public SessionView active(@AuthenticationPrincipal GymAccount p){return sessions.active(p.featureOwnerKey());}
 @GetMapping("/sessions/{id}") public SessionView session(@AuthenticationPrincipal GymAccount p,@PathVariable long id){return sessions.get(p.featureOwnerKey(),id);}
 @PatchMapping("/sessions/{id}") public SessionView session(@AuthenticationPrincipal GymAccount p,@PathVariable long id,@Valid @RequestBody SessionEdit body){return sessions.edit(p.featureOwnerKey(),id,body);}
 @PostMapping("/sessions/{id}/complete") public SessionView complete(@AuthenticationPrincipal GymAccount p,@PathVariable long id,@Valid @RequestBody SessionEdit body){return sessions.edit(p.featureOwnerKey(),id,new SessionEdit(body.version(),"COMPLETE",null,null,null,null,null,null,body.notes(),body.pain()));}
 @GetMapping("/history") public Page<SessionView> history(@AuthenticationPrincipal GymAccount p,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return sessions.history(p.featureOwnerKey(),page,size);}
 @GetMapping("/progress") public Progress progress(@AuthenticationPrincipal GymAccount p){return progress.progress(p.featureOwnerKey());}
 @GetMapping("/challenges") public List<ChallengeView> challenges(@AuthenticationPrincipal GymAccount p){return progress.challenges(p.featureOwnerKey());}
 @PostMapping("/challenges/{id}/join") public ChallengeView join(@AuthenticationPrincipal GymAccount p,@PathVariable String id){return progress.join(p.featureOwnerKey(),id);}
}
