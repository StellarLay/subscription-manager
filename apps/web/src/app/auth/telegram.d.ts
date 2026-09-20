interface TelegramWebApp {
  initData: string;
  expand: () => void;
  ready: () => void;
  safeAreaInset?: TelegramSafeAreaInset;
  contentSafeAreaInset?: TelegramSafeAreaInset;
  onEvent?: (event: 'safeAreaChanged' | 'contentSafeAreaChanged', callback: () => void) => void;
  offEvent?: (event: 'safeAreaChanged' | 'contentSafeAreaChanged', callback: () => void) => void;
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
