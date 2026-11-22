package com.gymfit.controller;

import com.gymfit.service.*;
import com.gymfit.service.NutritionExtrasService.*;
import com.gymfit.service.NutritionCircleService.*;
import com.gymfit.service.NutritionDiaryService.Repeat;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import com.gymfit.api.GymAccount;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/v1/nutrition-tools")
public class NutritionExtrasController {
    private final NutritionExtrasService tools;
    private final NutritionCircleService circles;
    public NutritionExtrasController(NutritionExtrasService tools,NutritionCircleService circles) {this.tools=tools;this.circles=circles;}
    @GetMapping("/templates") public List<Template> templates(@AuthenticationPrincipal GymAccount p) {return tools.templates(p.featureOwnerKey());}
    @PostMapping("/templates") public Template template(@AuthenticationPrincipal GymAccount p,@Valid @RequestBody SaveMeal body) {return tools.saveMeal(p.featureOwnerKey(),body);}
    @PostMapping("/templates/{id}/log") public Object log(@AuthenticationPrincipal GymAccount p,@PathVariable long id,@Valid @RequestBody Repeat body) {return tools.repeat(p.featureOwnerKey(),id,body);}
    @DeleteMapping("/templates/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deleteTemplate(@AuthenticationPrincipal GymAccount p,@PathVariable long id) {tools.removeTemplate(p.featureOwnerKey(),id);}
    @PostMapping("/describe") public List<Match> describe(@Valid @RequestBody Description body) {return tools.describe(body);}
    @GetMapping("/insights") public Insights insights(@AuthenticationPrincipal GymAccount p,@RequestParam LocalDate date) {return tools.insights(p.featureOwnerKey(),date);}
    @GetMapping("/reminders") public List<Reminder> reminders(@AuthenticationPrincipal GymAccount p) {return tools.reminders(p.featureOwnerKey());}
    @PutMapping("/reminders") public List<Reminder> reminders(@AuthenticationPrincipal GymAccount p,@Valid @RequestBody Reminder body) {return tools.reminder(p.featureOwnerKey(),body);}
    @DeleteMapping("/reminders/{kind}") public List<Reminder> removeReminder(@AuthenticationPrincipal GymAccount p,@PathVariable String kind) {return tools.removeReminder(p.featureOwnerKey(),kind);}
    @GetMapping("/photos") public List<Photo> photos(@AuthenticationPrincipal GymAccount p) {return tools.photos(p.featureOwnerKey());}
    @PostMapping(value="/photos",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Photo photo(@AuthenticationPrincipal GymAccount p,@RequestParam LocalDate date,@RequestParam(defaultValue="") String caption,@RequestParam MultipartFile file)throws java.io.IOException {
        return tools.photo(p.featureOwnerKey(),date,caption,file.getBytes());
    }
    @GetMapping("/photos/{id}") public ResponseEntity<byte[]> image(@AuthenticationPrincipal GymAccount p,@PathVariable long id) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).cacheControl(CacheControl.noStore()).body(tools.image(p.featureOwnerKey(),id));
    }
    @DeleteMapping("/photos/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deletePhoto(@AuthenticationPrincipal GymAccount p,@PathVariable long id) {tools.removePhoto(p.featureOwnerKey(),id);}
    public record ActivityImport(@NotEmpty @Size(max=90) List<@Valid ActivityRow> rows) {}
    @GetMapping("/activity") public List<ActivityRow> activity(@AuthenticationPrincipal GymAccount p) {return tools.activity(p.featureOwnerKey());}
    @PutMapping("/activity") public List<ActivityRow> activity(@AuthenticationPrincipal GymAccount p,@Valid @RequestBody ActivityImport body) {return tools.importActivity(p.featureOwnerKey(),body.rows);}
    @GetMapping("/circles") public List<Circle> circles(@AuthenticationPrincipal GymAccount p) {return circles.mine(p.featureOwnerKey());}
    @GetMapping("/circles/discover") public List<Circle> discover() {return circles.discover();}
    @PostMapping("/circles") public Detail create(@AuthenticationPrincipal GymAccount p,@Valid @RequestBody Create body) {return circles.create(p.featureOwnerKey(),body);}
    @PostMapping("/circles/join") public Detail join(@AuthenticationPrincipal GymAccount p,@Valid @RequestBody Join body) {return circles.join(p.featureOwnerKey(),body);}
    @GetMapping("/circles/{id}") public Detail circle(@AuthenticationPrincipal GymAccount p,@PathVariable long id) {return circles.detail(p.featureOwnerKey(),id);}
    @PostMapping("/circles/{id}/posts") public Detail post(@AuthenticationPrincipal GymAccount p,@PathVariable long id,@Valid @RequestBody PostRequest body) {return circles.post(p.featureOwnerKey(),id,body);}
    @PutMapping("/circles/{id}/posts/{post}/reaction") public Detail reaction(@AuthenticationPrincipal GymAccount p,@PathVariable long id,@PathVariable long post,@RequestBody Reaction body) {return circles.react(p.featureOwnerKey(),id,post,body.active());}
}
