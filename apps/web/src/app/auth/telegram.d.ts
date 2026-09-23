interface TelegramWebApp {
  initData: string;
  colorScheme?: 'light' | 'dark';
  expand: () => void;
  ready: () => void;
  safeAreaInset?: TelegramSafeAreaInset;
  contentSafeAreaInset?: TelegramSafeAreaInset;
  BackButton?: {
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  onEvent?: (
    event: 'safeAreaChanged' | 'contentSafeAreaChanged' | 'themeChanged',
    callback: () => void,
  ) => void;
  offEvent?: (
    event: 'safeAreaChanged' | 'contentSafeAreaChanged' | 'themeChanged',
    callback: () => void,
  ) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  isVersionAtLeast?: (version: string) => boolean;
}

interface TelegramSafeAreaInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
