import { useEffect, useState } from "react";
import { fetchGames } from "@/services/api";
import { todayET } from "@/lib/et";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

const MAX_RETRIES = 10;
const BASE_DELAY = 1000;
const MAX_DELAY = 15000;
const REST_FALLBACK_MS = 30000;
const PING_MS = 20000;

// ─── Shared state ────────────────────────────────────────────────────────────
// Every useScoreboard() consumer (the ticker, the scoreboard page, the landing
// page's live badge…) shares ONE /ws/scoreboard socket and, per date, ONE game
// list, ONE initial REST fetch and ONE 30s REST fallback poll. Both are ref-counted:
// the socket opens with the first consumer and closes when the last one unmounts;
// a date's store (and its poll) goes away with its last consumer.

const socket = {
  ws: null,
  connected: false,
  refs: 0,
  retryCount: 0,
  retryTimer: null,
  pingTimer: null,
};

/** date -> { games, loading, refs, listeners:Set, pollTimer } */
const stores = new Map();

function notify(store) {
  const snap = { games: store.games, loading: store.loading };
  for (const fn of store.listeners) fn(snap);
}

function setConnected(value) {
  socket.connected = value;
  for (const [date, store] of stores) {
    for (const fn of store.listeners) fn({ games: store.games, loading: store.loading, connected: value });
    syncPoll(date, store);
  }
}

// REST fallback: poll every 30s only for today's date and only while the socket
// is down (other dates never change fast enough to need it).
function syncPoll(date, store) {
  const shouldPoll = date === todayET() && !socket.connected && store.refs > 0;
  if (shouldPoll && !store.pollTimer) {
    store.pollTimer = setInterval(() => {
      fetchGames(date)
        .then((data) => {
          if (stores.get(date) === store && Array.isArray(data)) {
            store.games = data;
            notify(store);
          }
        })
        .catch(() => {});
    }, REST_FALLBACK_MS);
  } else if (!shouldPoll && store.pollTimer) {
    clearInterval(store.pollTimer);
    store.pollTimer = null;
  }
}

function openSocket() {
  if (socket.refs === 0) return;
  if (socket.ws) {
    socket.ws.close();
    socket.ws = null;
  }

  const ws = new WebSocket(`${WS_URL}/ws/scoreboard`);

  ws.onopen = () => {
    if (socket.ws !== ws) return;
    socket.retryCount = 0;
    setConnected(true);
  };

  ws.onclose = () => {
    if (socket.ws !== ws) return;
    setConnected(false);
    if (socket.refs > 0 && socket.retryCount < MAX_RETRIES) {
      const delay = Math.min(BASE_DELAY * Math.pow(2, socket.retryCount), MAX_DELAY);
      socket.retryCount++;
      socket.retryTimer = setTimeout(() => {
        socket.retryTimer = null;
        if (socket.refs > 0) openSocket();
      }, delay);
    }
  };

  ws.onerror = () => {};

  ws.onmessage = (event) => {
    if (socket.ws !== ws) return;
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "scoreboard_update" && Array.isArray(msg.data)) {
        // WS updates are today's (ET) games: they only apply to today's store.
        const store = stores.get(todayET());
        if (store) {
          store.games = msg.data;
          store.loading = false;
          notify(store);
        }
      }
    } catch {
      // Ignore malformed messages
    }
  };

  socket.ws = ws;
}

function acquireSocket() {
  socket.refs++;
  if (socket.refs === 1) {
    socket.retryCount = 0;
    openSocket();
    // Ping keep-alive every 20s
    socket.pingTimer = setInterval(() => {
      if (socket.ws?.readyState === WebSocket.OPEN) socket.ws.send("ping");
    }, PING_MS);
  }
}

function releaseSocket() {
  socket.refs--;
  if (socket.refs > 0) return;
  socket.refs = 0;
  if (socket.retryTimer) clearTimeout(socket.retryTimer);
  if (socket.pingTimer) clearInterval(socket.pingTimer);
  socket.retryTimer = null;
  socket.pingTimer = null;
  const ws = socket.ws;
  socket.ws = null;
  socket.connected = false;
  if (ws) ws.close();
}

function acquireStore(date) {
  let store = stores.get(date);
  if (!store) {
    store = { games: [], loading: true, refs: 0, listeners: new Set(), pollTimer: null };
    stores.set(date, store);
    // One-shot initial REST fetch for immediate data, shared by every consumer.
    fetchGames(date)
      .then((data) => {
        if (stores.get(date) === store && Array.isArray(data)) store.games = data;
      })
      .catch(() => {})
      .finally(() => {
        if (stores.get(date) !== store) return;
        store.loading = false;
        notify(store);
      });
  }
  store.refs++;
  syncPoll(date, store);
  return store;
}

function releaseStore(date, store) {
  store.refs--;
  if (store.refs > 0) return;
  if (store.pollTimer) clearInterval(store.pollTimer);
  store.pollTimer = null;
  if (stores.get(date) === store) stores.delete(date);
}

/**
 * Subscribes to /ws/scoreboard for real-time game list updates.
 * WS updates only apply when viewing today's date (ET).
 * Falls back to REST polling (30s) only when WS is disconnected.
 * All consumers share one socket and one REST fetch/poll per date.
 *
 * @param {string} dateStr - YYYY-MM-DD date for REST fallback
 * @returns {{ games: Array, connected: boolean, loading: boolean }}
 */
export function useScoreboard(dateStr) {
  const [state, setState] = useState(() => {
    const store = stores.get(dateStr);
    return {
      games: store ? store.games : [],
      loading: store ? store.loading : true,
      connected: socket.connected,
    };
  });

  // The shared socket lives as long as any consumer is mounted.
  useEffect(() => {
    acquireSocket();
    setState((s) => (s.connected === socket.connected ? s : { ...s, connected: socket.connected }));
    return releaseSocket;
  }, []);

  useEffect(() => {
    const store = acquireStore(dateStr);
    const listener = (snap) =>
      setState((s) => ({ ...s, ...snap, connected: snap.connected ?? socket.connected }));
    store.listeners.add(listener);
    setState({ games: store.games, loading: store.loading, connected: socket.connected });
    return () => {
      store.listeners.delete(listener);
      releaseStore(dateStr, store);
    };
  }, [dateStr]);

  return state;
}
