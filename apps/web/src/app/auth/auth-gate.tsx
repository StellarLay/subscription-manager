import {
  ApiError,
  authenticateWithTelegram,
  getCurrentUser,
} from '@subscription-manager/api-client';
import { Box, Button, Center, Loader, Stack, Text } from '@mantine/core';
import { IconReceipt } from '@tabler/icons-react';
import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';

import classes from './auth-gate.module.css';

type AuthState = 'checking' | 'ready' | 'error';

async function ensureAuthenticated(): Promise<void> {
  try {
    await getCurrentUser();
    return;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }

  await authenticateWithTelegram({ initData: window.Telegram?.WebApp.initData ?? '' });
}

export function AuthGate({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>('checking');
  const started = useRef(false);

  const authenticate = useCallback(async () => {
    setState('checking');

    try {
      await ensureAuthenticated();
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const updateSafeArea = () => {
      if (!webApp) return;
      const root = document.documentElement;
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const inset = Math.max(
          webApp?.safeAreaInset?.[side] ?? 0,
          webApp?.contentSafeAreaInset?.[side] ?? 0,
        );
        root.style.setProperty(
          `--app-safe-${side}`,
          `max(env(safe-area-inset-${side}, 0px), ${inset}px)`,
        );
      }
    };
    const updateViewport = () => {
      document.documentElement.style.setProperty(
        '--app-viewport-height',
        `${window.visualViewport?.height ?? window.innerHeight}px`,
      );
    };

    updateSafeArea();
    updateViewport();
    webApp?.onEvent?.('safeAreaChanged', updateSafeArea);
    webApp?.onEvent?.('contentSafeAreaChanged', updateSafeArea);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.addEventListener('resize', updateViewport);
    if (!started.current) {
      started.current = true;
      webApp?.ready();
      webApp?.expand();
      void authenticate();
    }

    return () => {
      webApp?.offEvent?.('safeAreaChanged', updateSafeArea);
      webApp?.offEvent?.('contentSafeAreaChanged', updateSafeArea);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [authenticate]);

  if (state === 'ready') return children;

  return (
    <Center className={classes.screen}>
      <Stack align="center" className={classes.card} gap="lg">
        <Box className={classes.mark}>
          <IconReceipt size={25} stroke={2.2} />
        </Box>
        <Stack align="center" gap={8}>
          <Text className={classes.title}>
            {state === 'checking' ? 'Входим через Telegram' : 'Не удалось войти'}
          </Text>
          <Text className={classes.description}>
            {state === 'checking'
              ? 'Проверяем безопасные данные Mini App и открываем твои подписки.'
              : 'Открой Subsio из Telegram и попробуй ещё раз.'}
          </Text>
        </Stack>
        {state === 'checking' ? (
          <Loader color="signal" size="sm" />
        ) : (
          <Button className={classes.retry} onClick={() => void authenticate()} radius="xl">
            Повторить
          </Button>
        )}
      </Stack>
    </Center>
  );
}
