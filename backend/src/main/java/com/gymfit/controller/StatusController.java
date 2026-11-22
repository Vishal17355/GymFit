package com.gymfit.controller;

import org.springframework.web.bind.annotation.*;
import com.gymfit.api.GymAccount;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.util.Map;
import javax.sql.DataSource;
import java.time.Clock;
import java.time.LocalDate;
import java.sql.SQLException;

@RestController
public class StatusController {
    private final DataSource database;
    private final Clock clock;
    public StatusController(DataSource database, Clock clock)
    {
        this.database=database;
        this.clock=clock;
    }
    @GetMapping("/api/v1/status")
    public Map<String,Object> status()
    {
        return Map.of("service","GymFit member API","demoMode",false,"spoonacularEnabled",false);
    }
    @GetMapping("/api/v1/diet/context")
    public Map<String,Object> context(@AuthenticationPrincipal GymAccount user) throws SQLException
    {
        try (var connection=database.getConnection()) {
            return Map.of("userId",user.featureOwnerKey(),"demoMode",false,
                "storage",connection.getMetaData().getDatabaseProductName(),
                "reportingDate",LocalDate.now(clock).toString());
        }
    }
}
