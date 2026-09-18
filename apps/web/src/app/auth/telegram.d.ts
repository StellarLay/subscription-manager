interface TelegramWebApp {
  initData: string;
  expand: () => void;
  ready: () => void;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
