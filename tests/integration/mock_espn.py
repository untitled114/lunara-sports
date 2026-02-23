"""Canned ESPN API responses for integration tests."""

SCOREBOARD_RESPONSE = {
    "events": [
        {
            "id": "401584701",
            "date": "2025-01-15T00:00Z",
            "competitions": [
                {
                    "competitors": [
                        {
                            "homeAway": "home",
                            "score": "55",
                            "team": {
                                "id": "2",
                                "abbreviation": "BOS",
                                "displayName": "Boston Celtics",
                            },
                        },
                        {
                            "homeAway": "away",
                            "score": "48",
                            "team": {
                                "id": "17",
                                "abbreviation": "LAL",
                                "displayName": "Los Angeles Lakers",
                            },
                        },
                    ],
                    "status": {
                        "period": 2,
                        "displayClock": "3:45",
                        "type": {
                            "name": "STATUS_IN_PROGRESS",
                            "shortDetail": "2nd 3:45",
                        },
                    },
                    "venue": {"fullName": "TD Garden"},
                }
            ],
        }
    ]
}

SUMMARY_RESPONSE = {
    "header": {
        "competitions": [
            {
                "competitors": [
                    {"team": {"id": "2", "abbreviation": "BOS"}},
                    {"team": {"id": "17", "abbreviation": "LAL"}},
                ]
            }
        ]
    },
    "plays": [
        {
            "id": "play-1",
            "sequenceNumber": "1",
            "period": {"number": 1},
            "clock": {"displayValue": "12:00"},
            "type": {"text": "Jump Ball"},
            "text": "Jump Ball: Kristaps Porzingis vs. Anthony Davis",
            "team": {"id": "2"},
            "homeScore": 0,
            "awayScore": 0,
            "scoringPlay": False,
            "scoreValue": 0,
            "wallclock": "2025-01-15T00:10:00Z",
        },
        {
            "id": "play-2",
            "sequenceNumber": "5",
            "period": {"number": 1},
            "clock": {"displayValue": "11:30"},
            "type": {"text": "Jump Shot"},
            "text": "Jayson Tatum makes 18-foot pullup jump shot",
            "team": {"id": "2"},
            "homeScore": 2,
            "awayScore": 0,
            "scoringPlay": True,
            "scoreValue": 2,
            "wallclock": "2025-01-15T00:10:30Z",
        },
        {
            "id": "play-3",
            "sequenceNumber": "8",
            "period": {"number": 1},
            "clock": {"displayValue": "11:15"},
            "type": {"text": "Defensive Rebound"},
            "text": "Anthony Davis defensive rebound",
            "team": {"id": "17"},
            "homeScore": 2,
            "awayScore": 0,
            "scoringPlay": False,
            "scoreValue": 0,
            "wallclock": "2025-01-15T00:10:45Z",
        },
    ],
}
