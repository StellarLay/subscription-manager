import {
  ColorSchemeScript,
  createTheme,
  MantineProvider,
  type MantineColorsTuple,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { SWRConfig } from 'swr';

import { AppThemeContext, type AppColorScheme } from './app-theme-context';

const THEME_STORAGE_KEY = 'subsio-theme';

const signal: MantineColorsTuple = [
  '#efffeb',
  '#ddffd6',
  '#baffad',
  '#94ff80',
  '#73ff5b',
  '#5ee940',
  '#45c82d',
  '#32a51f',
  '#278219',
  '#1c6410',
];

const theme = createTheme({
  primaryColor: 'signal',
  primaryShade: 4,
  autoContrast: true,
  colors: { signal },
  defaultRadius: 'lg',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
});

function getColorScheme(): AppColorScheme {
  if (typeof window === 'undefined') return 'dark';
  const telegramScheme = window.Telegram?.WebApp.colorScheme;
  if (telegramScheme === 'light' || telegramScheme === 'dark') return telegramScheme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getSavedTheme(): AppColorScheme | null {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

export function AppProviders({ children }: PropsWithChildren) {
  const [systemTheme, setSystemTheme] = useState<AppColorScheme>(getColorScheme);
  const [savedTheme, setSavedTheme] = useState<AppColorScheme | null>(getSavedTheme);
  const colorScheme = savedTheme ?? systemTheme;
  const toggleTheme = useCallback(() => {
    const nextTheme = colorScheme === 'light' ? 'dark' : 'light';
    setSavedTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Private browsing may block storage; keep the choice for this session.
    }
  }, [colorScheme]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const background = colorScheme === 'light' ? '#f5f7f3' : '#07090d';
    root.dataset.appTheme = colorScheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);

    const webApp = window.Telegram?.WebApp;
    if (webApp?.isVersionAtLeast?.('6.1')) {
      webApp.setHeaderColor?.(background);
      webApp.setBackgroundColor?.(background);
    }
    if (webApp?.isVersionAtLeast?.('7.10')) webApp.setBottomBarColor?.(background);
  }, [colorScheme]);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const preference = window.matchMedia('(prefers-color-scheme: light)');
    const update = () => setSystemTheme(getColorScheme());
    webApp?.onEvent?.('themeChanged', update);
    preference.addEventListener('change', update);
    return () => {
      webApp?.offEvent?.('themeChanged', update);
      preference.removeEventListener('change', update);
    };
  }, []);

  return (
    <>
      <ColorSchemeScript defaultColorScheme="auto" />
      <AppThemeContext.Provider value={{ colorScheme, toggleTheme }}>
        <MantineProvider forceColorScheme={colorScheme} theme={theme}>
          <SWRConfig
            value={{
              errorRetryCount: 2,
              revalidateOnFocus: false,
              shouldRetryOnError: true,
            }}
          >
            <Notifications position="top-right" />
            {children}
          </SWRConfig>
        </MantineProvider>
      </AppThemeContext.Provider>
    </>
  );
}
