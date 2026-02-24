import { useEffect, useRef, useCallback, useState } from "react";
import { fetchGames } from "@/services/api";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

const MAX_RETRIES = 10;
const BASE_DELAY = 1000;
const MAX_DELAY = 15000;
const REST_FALLBACK_MS = 30000;

/**
 * Subscribes to /ws/scoreboard for real-time game list updates.
 * Falls back to REST polling (30s) only when WS is disconnected.
 *
 * @param {string} dateStr - YYYY-MM-DD date for REST fallback
 * @returns {{ games: Array, connected: boolean }}
 */
export function useScoreboard(dateStr) {
  const wsRef = useRef(null);
  const retryCount = useRef(0);
  const retryTimer = useRef(null);
  const mountedRef = useRef(true);
  const fallbackTimer = useRef(null);

  const [games, setGames] = useState([]);
  const [connected, setConnected] = useState(false);

  // One-shot initial REST fetch for immediate data
  useEffect(() => {
    let cancelled = false;
    fetchGames(dateStr)
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setGames(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dateStr]);

  // REST fallback: poll every 30s only when WS is disconnected
  useEffect(() => {
    if (connected) {
      if (fallbackTimer.current) clearInterval(fallbackTimer.current);
      fallbackTimer.current = null;
      return;
    }

    fallbackTimer.current = setInterval(() => {
      if (!mountedRef.current) return;
      fetchGames(dateStr)
        .then((data) => {
          if (mountedRef.current && Array.isArray(data)) setGames(data);
        })
        .catch(() => {});
    }, REST_FALLBACK_MS);

    return () => {
      if (fallbackTimer.current) clearInterval(fallbackTimer.current);
    };
  }, [connected, dateStr]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`${WS_URL}/ws/scoreboard`);

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
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
        if (msg.type === "scoreboard_update" && Array.isArray(msg.data)) {
          setGames(msg.data);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    wsRef.current = ws;
  }, []);

  // Ping keep-alive every 20s
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
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
  }, [connect]);

  return { games, connected };
}
