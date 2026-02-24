import { useEffect, useRef, useCallback, useState } from "react";
import { fetchPlays } from "@/services/api";
import { useTheme } from '@/context/ThemeContext';

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

const MAX_RETRIES = 10;
const BASE_DELAY = 500;
const MAX_DELAY = 10000;

/**
 * @param {string} gameId
 * @param {string} status - "live" | "halftime" | "final" | "scheduled"
 */
export function useGameFeed(gameId, status = "scheduled") {
  const { refreshInterval } = useTheme();
  const wsRef = useRef(null);
  const retryCount = useRef(0);
  const retryTimer = useRef(null);
  const mountedRef = useRef(true);
  const pollRef = useRef(null);

  const [plays, setPlays] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [gameUpdate, setGameUpdate] = useState(null);
  const [pickUpdates, setPickUpdates] = useState(null);

  const isLive = status === "live" || status === "halftime";

  // Always do an initial REST fetch for plays (any status with a gameId)
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    fetchPlays(gameId)
      .then((data) => {
        if (cancelled) return;
        const sorted = (Array.isArray(data) ? data : []).sort(
          (a, b) => b.sequence_number - a.sequence_number,
        );
        setPlays(sorted);
      })
      .catch(() => {
        if (!cancelled) setPlays([]);
      });
    return () => { cancelled = true; };
  }, [gameId]);

  // REST polling fallback for live/halftime games
  // Runs every refreshInterval seconds to ensure plays update even if WS is down
  useEffect(() => {
    if (!isLive || !gameId) return;

    const poll = () => {
      fetchPlays(gameId)
        .then((data) => {
          if (!mountedRef.current) return;
          const sorted = (Array.isArray(data) ? data : []).sort(
            (a, b) => b.sequence_number - a.sequence_number,
          );
          setPlays((prev) => {
            // Only update if we have new plays
            if (sorted.length > prev.length || (sorted[0]?.sequence_number !== prev[0]?.sequence_number)) {
              return sorted;
            }
            return prev;
          });
        })
        .catch(() => {});
    };

    // Poll at the user's configured refresh interval (fallback if WS is down)
    const intervalMs = (refreshInterval || 2) * 1000;
    pollRef.current = setInterval(poll, intervalMs);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [gameId, isLive, refreshInterval]);

  // WebSocket for live games (provides instant updates when available)
  const connect = useCallback(() => {
    if (!mountedRef.current || !isLive) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`${WS_URL}/ws/${gameId}`);

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setError(null);
      retryCount.current = 0;
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);

      if (retryCount.current < MAX_RETRIES) {
        const delay = Math.min(
          BASE_DELAY * Math.pow(2, retryCount.current),
          MAX_DELAY,
        );
        retryCount.current++;
        retryTimer.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      }
      // Don't show error - REST polling is the fallback
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "history" && Array.isArray(msg.data)) {
          // Merge WS history with existing plays (don't overwrite REST data)
          setPlays((prev) => {
            const existing = new Map(prev.map((p) => [p.sequence_number, p]));
            for (const p of msg.data) {
              existing.set(p.sequence_number, p);
            }
            return [...existing.values()].sort(
              (a, b) => b.sequence_number - a.sequence_number,
            );
          });
        } else if (msg.type === "play" && msg.data && !Array.isArray(msg.data)) {
          setPlays((prev) => {
            const play = msg.data;
            if (prev.some((p) => p.sequence_number === play.sequence_number)) {
              return prev;
            }
            return [play, ...prev];
          });
        } else if (msg.type === "game_update" && msg.data) {
          setGameUpdate(msg.data);
        } else if (msg.type === "pick_update" && msg.data) {
          setPickUpdates(msg.data);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    wsRef.current = ws;
  }, [gameId, isLive]);

  // Ping to keep WS alive (every 15s)
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, isLive]);

  return { plays, connected: isLive ? connected : status === "final", error, gameUpdate, pickUpdates };
}
