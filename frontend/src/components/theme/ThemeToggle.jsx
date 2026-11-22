import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button type="button" className="icon-control" onClick={toggleTheme} aria-label={label} title={label}>
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};
