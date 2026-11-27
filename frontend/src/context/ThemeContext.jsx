import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getTeamColor, TEAM_COLORS } from '@/utils/teamColors';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [favoriteTeam, setFavoriteTeam] = useState(localStorage.getItem('favTeam') || null);
  // accentColors.primary tints the backdrop's top-left glow wash: --glow-1
  // by default, the favorite team's primary, or the home team's on a game page.
  const [accentColors, setAccentColors] = useState({ primary: 'var(--glow-1)', secondary: 'var(--surface-2)' });
  const [arenaIntensity, setArenaIntensity] = useState(parseFloat(localStorage.getItem('arenaIntensity')) || 0.4);
  const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || 'md');
  const [reducedMotion, setReducedMotion] = useState(localStorage.getItem('reducedMotion') === 'true');
  const [refreshInterval, setRefreshInterval] = useState(parseInt(localStorage.getItem('refreshInterval')) || 10);
  // Times show in Eastern unless the visitor chooses another zone in Settings.
  const [timezone, setTimezone] = useState(localStorage.getItem('timezone') || 'ET');

  const setArenaTheme = useCallback((abbrev) => {
    const targetAbbrev = abbrev || favoriteTeam;

    if (!targetAbbrev || !TEAM_COLORS[targetAbbrev]) {
      setAccentColors({ primary: 'var(--glow-1)', secondary: 'var(--surface-2)' });
      return;
    }
    const colors = getTeamColor(targetAbbrev);
    setAccentColors(colors);
  }, [favoriteTeam]);

  const selectFavoriteTeam = (abbrev) => {
    setFavoriteTeam(abbrev);
    if (abbrev) {
      localStorage.setItem('favTeam', abbrev);
    } else {
      localStorage.removeItem('favTeam');
    }
  };

  const updateIntensity = (val) => {
    setArenaIntensity(val);
    localStorage.setItem('arenaIntensity', val);
  };

  const updateFontSize = (size) => {
    setFontSize(size);
    localStorage.setItem('fontSize', size);
  };

  const toggleReducedMotion = () => {
    const newState = !reducedMotion;
    setReducedMotion(newState);
    localStorage.setItem('reducedMotion', newState);
  };

  const updateRefreshInterval = (val) => {
    setRefreshInterval(val);
    localStorage.setItem('refreshInterval', val);
  };

  const updateTimezone = (tz) => {
    setTimezone(tz);
    localStorage.setItem('timezone', tz);
  };

  // Sync theme when favorite team changes
  useEffect(() => {
    setArenaTheme(null);
  }, [favoriteTeam, setArenaTheme]);

  // Sync font size CSS class on <html>
  useEffect(() => {
    document.documentElement.classList.remove('font-sm', 'font-md', 'font-lg');
    document.documentElement.classList.add(`font-${fontSize}`);
  }, [fontSize]);

  // Sync reduced motion CSS class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  }, [reducedMotion]);

  return (
    <ThemeContext.Provider value={{
      accentColors,
      favoriteTeam,
      selectFavoriteTeam,
      setArenaTheme,
      arenaIntensity,
      updateIntensity,
      fontSize,
      updateFontSize,
      reducedMotion,
      toggleReducedMotion,
      refreshInterval,
      updateRefreshInterval,
      timezone,
      updateTimezone
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
