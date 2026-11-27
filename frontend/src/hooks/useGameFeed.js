import { useEffect, useRef, useCallback, useState } from "react";
import { fetchPlays, fetchBoxScore } from "@/services/api";
import { useTheme } from '@/context/ThemeContext';
import { mergePlays } from "@/lib/playOrder";
import { hasStarted } from "@/lib/gameMath";

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
  const [boxData, setBoxData] = useState(null);

  const isLive = status === "live" || status === "halftime";
  const started = hasStarted(status);

  // Always do an initial REST fetch for plays (any status with a gameId)
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    fetchPlays(gameId)
      .then((data) => {
        if (cancelled) return;
        setPlays(mergePlays([], Array.isArray(data) ? data : []));
      })
      .catch(() => {
        if (!cancelled) setPlays([]);
      });
    return () => { cancelled = true; };
  }, [gameId]);

  // One box score fetch once the game has tipped off (the API has none before; asking
  // earlier only earns a 404). A scheduled game that goes live fetches it then.
  useEffect(() => {
    if (!gameId || !started) return;
    let cancelled = false;
    fetchBoxScore(gameId)
      .then((data) => {
        if (!cancelled && data) setBoxData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [gameId, started]);

  // REST polling fallback - only when WS is DISCONNECTED and game is live
  useEffect(() => {
    if (!isLive || !gameId || connected) return;

    const poll = () => {
      fetchPlays(gameId)
        .then((data) => {
          if (!mountedRef.current) return;
          const sorted = mergePlays([], Array.isArray(data) ? data : []);
          setPlays((prev) => {
            if (sorted.length > prev.length || sorted[0]?.id !== prev[0]?.id) {
              return sorted;
            }
            return prev;
          });
        })
        .catch(() => {});
    };

    const intervalMs = (refreshInterval || 2) * 1000;
    pollRef.current = setInterval(poll, intervalMs);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [gameId, isLive, refreshInterval, connected]);

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
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "history" && Array.isArray(msg.data)) {
          setPlays((prev) => mergePlays(prev, msg.data));
        } else if (msg.type === "play" && msg.data && !Array.isArray(msg.data)) {
          setPlays((prev) => {
            const play = msg.data;
            if (prev.some((p) => p.id === play.id)) {
              return prev;
            }
            return mergePlays(prev, [play]);
          });
        } else if (msg.type === "game_update" && msg.data) {
          setGameUpdate(msg.data);
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

  return { plays, connected: isLive ? connected : status === "final", error, gameUpdate, boxData };
}
