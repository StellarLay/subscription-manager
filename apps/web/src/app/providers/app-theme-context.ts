import { createContext, useContext } from 'react';

export type AppColorScheme = 'light' | 'dark';

export const AppThemeContext = createContext<{
  colorScheme: AppColorScheme;
  toggleTheme: () => void;
} | null>(null);

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside AppProviders');
  return context;
}
