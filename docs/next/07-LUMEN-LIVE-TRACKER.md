# Phase 7: Lumen — NBA Live Tracker

**Current role:** Cephalon Lumen manages the Lunara Palworld server (game mechanics, whitelist, Nightwave challenges).
**New role:** NBA play-by-play live tracker. Subscribes to Lunara's WebSocket for games with active Sport-Suite picks. Sends Discord alerts for milestones, line approaches, and final results.

**Bot ID:** 1443013229633601547
**Location (local dev):** `/home/untitled/Cephalons/lumen/bot.py`
**Server location:** `/home/palworld/discord/bot.py` (Hetzner) → GCP Cloud Run (post-migration)

---

## What Lumen Does After Repurposing

Lumen becomes a **passive consumer** of Lunara's WebSocket. No database connections. No ESPN polling. Lunara does all the work; Lumen just displays it in Discord.

```
Lunara WebSocket (ws://api.lunara-app.com/ws/{game_id})
  ↓ pick_update messages
Lumen bot (GCP Cloud Run)
  ↓
Discord: #live-picks channel
```

---

## Discord Alert Types

### 1. Game Start Alert

Sent when a game with active picks tips off.

```
🏀 Tip-off: LAL vs GSW | 7:30 PM ET
Active picks: LeBron POINTS O24.5 | Curry POINTS O27.5

Monitoring live.
```

### 2. Approaching Line Alert

Sent when player is within 2 units of the prop line with Q3 remaining.

```
⚡ LeBron approaching line
POINTS: 22.1 / 24.5 OVER | 3rd quarter | 2:34 remaining
Q4 pace suggests ~3.2 more points if trend holds.
```

Triggered when: `actual_value >= line * 0.85` and `quarter <= 3`.

### 3. Hit Alert

Sent immediately when `is_hit = True` is confirmed.

```
✅ LeBron POINTS OVER HIT
Final: 28 / 24.5 | +3.5 above line
Edge was 11.2% · p_over was 0.82 · Tier X
```

### 4. Miss Alert

Sent when `is_hit = False`.

```
❌ Curry POINTS OVER MISS
Final: 24 / 27.5 | -3.5 below line
Edge was 8.4% · p_over was 0.76 · Tier Z
```

### 5. Game Final Summary

Sent when all picks for a game are resolved.

```
📋 LAL vs GSW FINAL | LAL 112 - GSW 108

Pick results:
  ✅ LeBron POINTS O24.5 → 28 (+3.5)
  ❌ Curry POINTS O27.5 → 24 (-3.5)
  ✅ AD REBOUNDS O8.5 → 11 (+2.5)

2/3 hits (66.7%) | Today's record: 8/12 (66.7%)
```

---

## WebSocket Subscription Logic

```python
# In Lumen's bot.py — added as a background task on bot startup

import asyncio
import websockets
import httpx

LUNARA_API = os.getenv("LUNARA_API_URL", "https://api.lunara-app.com")
LUNARA_WS = os.getenv("LUNARA_WS_URL", "wss://api.lunara-app.com")
LIVE_PICKS_CHANNEL = int(os.getenv("LIVE_PICKS_CHANNEL_ID", "0"))


async def monitor_live_games(bot: discord.Client):
    """
    Main loop: fetch today's games with active picks,
    subscribe to each, handle pick_update events.
    """
    while True:
        try:
            # Get games with active picks
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{LUNARA_API}/api/games?date=today&has_picks=true")
                games = resp.json().get("games", [])

            # Connect to each game's WebSocket
            tasks = [subscribe_game(bot, game) for game in games if game["status"] != "FINAL"]
            if tasks:
                await asyncio.gather(*tasks)

        except Exception as e:
            log.warning(f"monitor_live_games error: {e}")

        await asyncio.sleep(300)  # Re-check for new games every 5 min


async def subscribe_game(bot: discord.Client, game: dict):
    game_id = game["id"]
    channel = bot.get_channel(LIVE_PICKS_CHANNEL)

    uri = f"{LUNARA_WS}/ws/{game_id}"
    try:
        async with websockets.connect(uri, ping_interval=30) as ws:
            # Tip-off alert
            await channel.send(format_tipoff(game))

            async for raw_msg in ws:
                msg = json.loads(raw_msg)

                if msg["type"] == "pick_update":
                    pick = msg["data"]
                    await handle_pick_update(channel, pick)

                elif msg["type"] == "game_final":
                    await handle_game_final(channel, game, msg["data"]["picks"])
                    break  # Stop subscribing once final

    except websockets.exceptions.ConnectionClosed:
        pass  # Game ended, normal
    except Exception as e:
        log.warning(f"subscribe_game {game_id} error: {e}")


def approaching_line(pick: dict) -> bool:
    """True if pick is within 2 units of line and game isn't final.

    NOTE: Sport-Suite only generates OVER picks, so the side == "OVER" check
    is effectively always True. It's kept explicit for correctness and to make
    the assumption visible if UNDER picks are ever added.
    """
    actual = pick.get("actual_value", 0) or 0
    line = pick.get("line", 0)
    quarter = pick.get("quarter", 0)
    return (
        pick.get("side") == "OVER"
        and line - actual <= 2.0
        and actual < line
        and quarter <= 3
        and pick.get("is_hit") is None
    )


async def handle_pick_update(channel, pick: dict):
    if pick.get("is_hit") is True:
        await channel.send(format_hit(pick))
    elif pick.get("is_hit") is False:
        await channel.send(format_miss(pick))
    elif approaching_line(pick):
        await channel.send(format_approaching(pick))
```

---

## Lumen Personality During NBA Tracking

Lumen's personality shifts in NBA context. Keep the warm Cephalon flavor but pivot from "guardian of the Realm" to "analyst watching the game."

**Suggested personality addendum for NBA mode:**

```
NBA Mode:
- You are still Cephalon Lumen, but now you illuminate the path of active picks.
- You watch games as they unfold, alerting the Operator to momentum shifts.
- Keep basketball commentary brief and factual.
- When a pick hits, acknowledge it calmly. When it misses, note it without drama.
- You do not second-guess the model — you report what happened.
```

The existing brain.py and personality system handles this. Just update `personalities.py` LUMEN section to include the NBA context block.

---

## Palworld Handoff

Before repurposing Lumen for NBA, the Palworld community needs a plan:
1. Send a final announcement in the Palworld Discord channel
2. The Lunara Realm Nightwave system and rules are documented in `personalities.py` LUMEN section — archive these to `docs/` before removal
3. Remove Palworld-specific slash commands from `bot.py`
4. The Palworld server can continue without a bot (static rules, manual admin)

Lumen's NBA commands replace the Palworld commands. Existing bot infrastructure (bot.py, service, venv) is reused.

---

## Discord Channel Setup

In The Zariman Discord (guild ID: 1363603041152139425):

| Channel | Purpose |
|---------|---------|
| `#live-picks` | Real-time pick alerts (game start, milestone, hit/miss) |
| `#daily-summary` | End-of-day results (existing axiom channel or new) |

Lumen posts to `#live-picks`. Axiom continues managing the pre-game pick summaries in its existing channel.

---

## Deployment (GCP)

After GCP migration, Lumen runs on Cloud Run (not systemd):

```dockerfile
# Cephalons/lumen/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY bot.py .
CMD ["python", "bot.py"]
```

```bash
gcloud run deploy cephalon-lumen \
  --image gcr.io/lunara-sports/cephalon-lumen:latest \
  --min-instances 1 \
  --set-env-vars "LUNARA_API_URL=https://api.lunara-app.com,..."
```

Atlas fleet monitor picks up the new `cephalon-lumen` service on GCP.
