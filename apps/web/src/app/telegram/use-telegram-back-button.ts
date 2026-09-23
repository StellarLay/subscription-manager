import { useEffect, useRef } from 'react';

const closeHandlers = new Map<symbol, () => void>();
let activeButton: TelegramWebApp['BackButton'];

const handleBack = () => {
  const topmost = Array.from(closeHandlers.values()).at(-1);
  topmost?.();
};

function syncBackButton() {
  const button = window.Telegram?.WebApp.BackButton;
  if (activeButton && activeButton !== button) {
    activeButton.offClick(handleBack);
    activeButton.hide();
    activeButton = undefined;
  }

  if (closeHandlers.size === 0 || !button) {
    activeButton?.offClick(handleBack);
    activeButton?.hide();
    activeButton = undefined;
    return;
  }

  if (!activeButton) {
    button.onClick(handleBack);
    activeButton = button;
  }
  button.show();
}

export function useTelegramBackButton(opened: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!opened) return;

    const id = Symbol('telegram-back-button');
    closeHandlers.set(id, () => closeRef.current());
    syncBackButton();

    return () => {
      closeHandlers.delete(id);
      syncBackButton();
    };
  }, [opened]);
}
