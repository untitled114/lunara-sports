package com.playbyplay.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Snapshot of a single game's state from the ESPN scoreboard.
 *
 * Read from the {@code raw.scoreboard} topic and stored in a GlobalKTable
 * for team metadata lookups during play enrichment.
 * Field names match the Python ScoreboardEvent schema.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScoreboardSnapshot {

    @JsonProperty("game_id")
    private String gameId;

    @JsonProperty("home_team")
    private String homeTeam;

    @JsonProperty("away_team")
    private String awayTeam;

    @JsonProperty("home_team_name")
    private String homeTeamName;

    @JsonProperty("away_team_name")
    private String awayTeamName;

    @JsonProperty("home_score")
    private int homeScore;

    @JsonProperty("away_score")
    private int awayScore;

    @JsonProperty("status")
    private String status;

    @JsonProperty("status_detail")
    private String statusDetail;

    @JsonProperty("quarter")
    private Integer quarter;

    @JsonProperty("clock")
    private String clock;

    @JsonProperty("start_time")
    private Instant startTime;

    @JsonProperty("venue")
    private String venue;

    @JsonProperty("polled_at")
    private Instant polledAt;

    public ScoreboardSnapshot() {}

    // --- Getters ---

    public String getGameId() { return gameId; }
    public String getHomeTeam() { return homeTeam; }
    public String getAwayTeam() { return awayTeam; }
    public String getHomeTeamName() { return homeTeamName; }
    public String getAwayTeamName() { return awayTeamName; }
    public int getHomeScore() { return homeScore; }
    public int getAwayScore() { return awayScore; }
    public String getStatus() { return status; }
    public String getStatusDetail() { return statusDetail; }
    public Integer getQuarter() { return quarter; }
    public String getClock() { return clock; }
    public Instant getStartTime() { return startTime; }
    public String getVenue() { return venue; }
    public Instant getPolledAt() { return polledAt; }

    // --- Setters ---

    public void setGameId(String gameId) { this.gameId = gameId; }
    public void setHomeTeam(String homeTeam) { this.homeTeam = homeTeam; }
    public void setAwayTeam(String awayTeam) { this.awayTeam = awayTeam; }
    public void setHomeTeamName(String homeTeamName) { this.homeTeamName = homeTeamName; }
    public void setAwayTeamName(String awayTeamName) { this.awayTeamName = awayTeamName; }
    public void setHomeScore(int homeScore) { this.homeScore = homeScore; }
    public void setAwayScore(int awayScore) { this.awayScore = awayScore; }
    public void setStatus(String status) { this.status = status; }
    public void setStatusDetail(String statusDetail) { this.statusDetail = statusDetail; }
    public void setQuarter(Integer quarter) { this.quarter = quarter; }
    public void setClock(String clock) { this.clock = clock; }
    public void setStartTime(Instant startTime) { this.startTime = startTime; }
    public void setVenue(String venue) { this.venue = venue; }
    public void setPolledAt(Instant polledAt) { this.polledAt = polledAt; }

    @Override
    public String toString() {
        return "ScoreboardSnapshot{" +
                "gameId='" + gameId + '\'' +
                ", " + awayTeamName + " " + awayScore +
                " @ " + homeTeamName + " " + homeScore +
                ", status='" + status + '\'' +
                '}';
    }
}
