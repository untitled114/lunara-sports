package com.playbyplay.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Aggregated state for a single game.
 *
 * Built incrementally from enriched play-by-play events. Represents the latest
 * known state of a game: current score, quarter, clock, play count, and recent
 * play info. Keyed by gameId in the state store and output topic.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class GameState {

    @JsonProperty("game_id")
    private String gameId;

    @JsonProperty("status")
    private String status;

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

    @JsonProperty("quarter")
    private int quarter;

    @JsonProperty("clock")
    private String clock;

    @JsonProperty("venue")
    private String venue;

    @JsonProperty("last_play_sequence")
    private long lastPlaySequence;

    @JsonProperty("last_play_description")
    private String lastPlayDescription;

    @JsonProperty("last_play_type")
    private String lastPlayType;

    @JsonProperty("play_count")
    private long playCount;

    @JsonProperty("scoring_play_count")
    private long scoringPlayCount;

    @JsonProperty("updated_at")
    private Instant updatedAt;

    public GameState() {
        this.status = "UNKNOWN";
        this.playCount = 0;
        this.scoringPlayCount = 0;
        this.lastPlaySequence = -1;
    }

    // --- Getters ---

    public String getGameId() { return gameId; }
    public String getStatus() { return status; }
    public String getHomeTeam() { return homeTeam; }
    public String getAwayTeam() { return awayTeam; }
    public String getHomeTeamName() { return homeTeamName; }
    public String getAwayTeamName() { return awayTeamName; }
    public int getHomeScore() { return homeScore; }
    public int getAwayScore() { return awayScore; }
    public int getQuarter() { return quarter; }
    public String getClock() { return clock; }
    public String getVenue() { return venue; }
    public long getLastPlaySequence() { return lastPlaySequence; }
    public String getLastPlayDescription() { return lastPlayDescription; }
    public String getLastPlayType() { return lastPlayType; }
    public long getPlayCount() { return playCount; }
    public long getScoringPlayCount() { return scoringPlayCount; }
    public Instant getUpdatedAt() { return updatedAt; }

    // --- Setters ---

    public void setGameId(String gameId) { this.gameId = gameId; }
    public void setStatus(String status) { this.status = status; }
    public void setHomeTeam(String homeTeam) { this.homeTeam = homeTeam; }
    public void setAwayTeam(String awayTeam) { this.awayTeam = awayTeam; }
    public void setHomeTeamName(String homeTeamName) { this.homeTeamName = homeTeamName; }
    public void setAwayTeamName(String awayTeamName) { this.awayTeamName = awayTeamName; }
    public void setHomeScore(int homeScore) { this.homeScore = homeScore; }
    public void setAwayScore(int awayScore) { this.awayScore = awayScore; }
    public void setQuarter(int quarter) { this.quarter = quarter; }
    public void setClock(String clock) { this.clock = clock; }
    public void setVenue(String venue) { this.venue = venue; }
    public void setLastPlaySequence(long lastPlaySequence) { this.lastPlaySequence = lastPlaySequence; }
    public void setLastPlayDescription(String lastPlayDescription) { this.lastPlayDescription = lastPlayDescription; }
    public void setLastPlayType(String lastPlayType) { this.lastPlayType = lastPlayType; }
    public void setPlayCount(long playCount) { this.playCount = playCount; }
    public void setScoringPlayCount(long scoringPlayCount) { this.scoringPlayCount = scoringPlayCount; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public String toString() {
        return "GameState{" +
                "gameId='" + gameId + '\'' +
                ", status='" + status + '\'' +
                ", " + awayTeamName + " " + awayScore +
                " @ " + homeTeamName + " " + homeScore +
                ", Q" + quarter + " " + clock +
                ", plays=" + playCount +
                ", scoring=" + scoringPlayCount +
                '}';
    }
}
