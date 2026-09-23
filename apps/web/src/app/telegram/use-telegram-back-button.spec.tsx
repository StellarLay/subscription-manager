import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTelegramBackButton } from './use-telegram-back-button';

interface FixtureProps {
  parentOpen: boolean;
  childOpen: boolean;
  onParentClose: () => void;
  onChildClose: () => void;
}

function Fixture({ parentOpen, childOpen, onParentClose, onChildClose }: FixtureProps) {
  useTelegramBackButton(parentOpen, onParentClose);
  useTelegramBackButton(childOpen, onChildClose);
  return null;
}

afterEach(() => {
  delete window.Telegram;
});

describe('Telegram BackButton', () => {
  it('closes the topmost dialog first and hides after the last dialog closes', () => {
    let pressBack: (() => void) | undefined;
    const show = vi.fn();
    const hide = vi.fn();
    const offClick = vi.fn();
    window.Telegram = {
      WebApp: {
        initData: '',
        ready: vi.fn(),
        expand: vi.fn(),
        BackButton: {
          onClick: (callback) => {
            pressBack = callback;
          },
          offClick,
          show,
          hide,
        },
      },
    };

    const parentClose = vi.fn();
    const childClose = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        createElement(Fixture, {
          parentOpen: true,
          childOpen: false,
          onParentClose: parentClose,
          onChildClose: childClose,
        }),
      );
    });
    expect(show).toHaveBeenCalled();

    act(() => {
      root.render(
        createElement(Fixture, {
          parentOpen: true,
          childOpen: true,
          onParentClose: parentClose,
          onChildClose: childClose,
        }),
      );
    });
    pressBack?.();
    expect(childClose).toHaveBeenCalledOnce();
    expect(parentClose).not.toHaveBeenCalled();

    act(() => {
      root.render(
        createElement(Fixture, {
          parentOpen: true,
          childOpen: false,
          onParentClose: parentClose,
          onChildClose: childClose,
        }),
      );
    });
    pressBack?.();
    expect(parentClose).toHaveBeenCalledOnce();

    act(() => root.unmount());
    expect(offClick).toHaveBeenCalledOnce();
    expect(hide).toHaveBeenCalledOnce();
  });
});
