package com.playbyplay.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

/**
 * Play-by-play event enriched with team metadata and derived fields.
 *
 * Produced by joining raw GameEvent with ScoreboardSnapshot (GlobalKTable).
 * Adds team display names, venue, and computed metrics like score differential.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class EnrichedEvent {

    // --- Fields carried over from GameEvent ---

    @JsonProperty("game_id")
    private String gameId;

    @JsonProperty("play_id")
    private String playId;

    @JsonProperty("sequence_number")
    private long sequenceNumber;

    @JsonProperty("quarter")
    private int quarter;

    @JsonProperty("clock")
    private String clock;

    @JsonProperty("event_type")
    private String eventType;

    @JsonProperty("event_text")
    private String eventText;

    @JsonProperty("description")
    private String description;

    @JsonProperty("team")
    private String team;

    @JsonProperty("player_name")
    private String playerName;

    @JsonProperty("home_score")
    private int homeScore;

    @JsonProperty("away_score")
    private int awayScore;

    @JsonProperty("scoring_play")
    private boolean scoringPlay;

    @JsonProperty("score_value")
    private int scoreValue;

    @JsonProperty("wallclock")
    private Instant wallclock;

    // --- Enrichment fields from ScoreboardSnapshot ---

    @JsonProperty("home_team")
    private String homeTeam;

    @JsonProperty("away_team")
    private String awayTeam;

    @JsonProperty("home_team_name")
    private String homeTeamName;

    @JsonProperty("away_team_name")
    private String awayTeamName;

    @JsonProperty("venue")
    private String venue;

    // --- Computed fields ---

    @JsonProperty("score_differential")
    private int scoreDifferential;

    @JsonProperty("enriched_at")
    private Instant enrichedAt;

    public EnrichedEvent() {}

    // --- Getters ---

    public String getGameId() { return gameId; }
    public String getPlayId() { return playId; }
    public long getSequenceNumber() { return sequenceNumber; }
    public int getQuarter() { return quarter; }
    public String getClock() { return clock; }
    public String getEventType() { return eventType; }
    public String getEventText() { return eventText; }
    public String getDescription() { return description; }
    public String getTeam() { return team; }
    public String getPlayerName() { return playerName; }
    public int getHomeScore() { return homeScore; }
    public int getAwayScore() { return awayScore; }
    public boolean isScoringPlay() { return scoringPlay; }
    public int getScoreValue() { return scoreValue; }
    public Instant getWallclock() { return wallclock; }
    public String getHomeTeam() { return homeTeam; }
    public String getAwayTeam() { return awayTeam; }
    public String getHomeTeamName() { return homeTeamName; }
    public String getAwayTeamName() { return awayTeamName; }
    public String getVenue() { return venue; }
    public int getScoreDifferential() { return scoreDifferential; }
    public Instant getEnrichedAt() { return enrichedAt; }

    // --- Setters ---

    public void setGameId(String gameId) { this.gameId = gameId; }
    public void setPlayId(String playId) { this.playId = playId; }
    public void setSequenceNumber(long sequenceNumber) { this.sequenceNumber = sequenceNumber; }
    public void setQuarter(int quarter) { this.quarter = quarter; }
    public void setClock(String clock) { this.clock = clock; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public void setEventText(String eventText) { this.eventText = eventText; }
    public void setDescription(String description) { this.description = description; }
    public void setTeam(String team) { this.team = team; }
    public void setPlayerName(String playerName) { this.playerName = playerName; }
    public void setHomeScore(int homeScore) { this.homeScore = homeScore; }
    public void setAwayScore(int awayScore) { this.awayScore = awayScore; }
    public void setScoringPlay(boolean scoringPlay) { this.scoringPlay = scoringPlay; }
    public void setScoreValue(int scoreValue) { this.scoreValue = scoreValue; }
    public void setWallclock(Instant wallclock) { this.wallclock = wallclock; }
    public void setHomeTeam(String homeTeam) { this.homeTeam = homeTeam; }
    public void setAwayTeam(String awayTeam) { this.awayTeam = awayTeam; }
    public void setHomeTeamName(String homeTeamName) { this.homeTeamName = homeTeamName; }
    public void setAwayTeamName(String awayTeamName) { this.awayTeamName = awayTeamName; }
    public void setVenue(String venue) { this.venue = venue; }
    public void setScoreDifferential(int scoreDifferential) { this.scoreDifferential = scoreDifferential; }
    public void setEnrichedAt(Instant enrichedAt) { this.enrichedAt = enrichedAt; }

    @Override
    public String toString() {
        return "EnrichedEvent{" +
                "gameId='" + gameId + '\'' +
                ", seq=" + sequenceNumber +
                ", Q" + quarter + " " + clock +
                ", type='" + eventType + '\'' +
                ", " + awayTeamName + " " + awayScore +
                " @ " + homeTeamName + " " + homeScore +
                ", diff=" + scoreDifferential +
                (scoringPlay ? " [+" + scoreValue + "]" : "") +
                '}';
    }
}
