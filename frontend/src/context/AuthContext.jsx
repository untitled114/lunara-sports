import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authLogin, authRegister, authMe } from "@/services/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "pbp_auth_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(!!token);

  const isPremium = user?.membership_tier === "premium";

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    authMe(token)
      .then((profile) => {
        if (cancelled) return;
        if (profile) {
          setUser(profile);
        } else {
          // Token invalid
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const data = await authLogin(email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser({
      id: data.user_id,
      username: data.username,
      membership_tier: data.membership_tier,
    });
    return data;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const data = await authRegister(username, email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser({
      id: data.user_id,
      username: data.username,
      membership_tier: data.membership_tier,
    });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isPremium, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
