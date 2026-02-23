import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getTeamColor, TEAM_COLORS } from '@/utils/teamColors';
import { useSoundEffects } from '@/hooks/useSoundEffects';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [favoriteTeam, setFavoriteTeam] = useState(localStorage.getItem('favTeam') || null);
  const [accentColors, setAccentColors] = useState({ primary: '#6366f1', secondary: '#1e293b' });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionImage, setTransitionImage] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false');
  const [arenaIntensity, setArenaIntensity] = useState(parseFloat(localStorage.getItem('arenaIntensity')) || 0.4);
  const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || 'md');
  const [reducedMotion, setReducedMotion] = useState(localStorage.getItem('reducedMotion') === 'true');
  const [refreshInterval, setRefreshInterval] = useState(parseInt(localStorage.getItem('refreshInterval')) || 10);
  const [timezone, setTimezone] = useState(localStorage.getItem('timezone') || 'local');
  const { playGlassClick, playThud } = useSoundEffects();

  const setArenaTheme = useCallback((abbrev) => {
    const targetAbbrev = abbrev || favoriteTeam;

    if (!targetAbbrev) {
      setAccentColors({ primary: '#6366f1', secondary: '#1e293b' });
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
    if (soundEnabled) playThud();
  };

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('soundEnabled', newState);
    if (newState) playGlassClick();
  };

  const updateIntensity = (val) => {
    setArenaIntensity(val);
    localStorage.setItem('arenaIntensity', val);
  };

  const triggerArenaEntry = (callback, image = null) => {
    if (reducedMotion) {
      if (callback) callback();
      return;
    }
    setTransitionImage(image);
    setIsTransitioning(true);
    if (soundEnabled) playThud();
    setTimeout(() => {
      setIsTransitioning(false);
      setTransitionImage(null);
      if (callback) callback();
    }, 1200);
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
      playGlassClick: soundEnabled ? playGlassClick : () => {},
      playThud: soundEnabled ? playThud : () => {},
      isTransitioning,
      transitionImage,
      triggerArenaEntry,
      soundEnabled,
      toggleSound,
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
