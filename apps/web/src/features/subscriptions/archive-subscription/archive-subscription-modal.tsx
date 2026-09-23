import {
  ApiError,
  type SubscriptionResponseDto,
  useArchiveSubscription,
} from '@subscription-manager/api-client';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconArchive } from '@tabler/icons-react';
import { useState } from 'react';

import { useTelegramBackButton } from '@/app/telegram/use-telegram-back-button';

import classes from './archive-subscription-modal.module.css';

interface ArchiveSubscriptionModalProps {
  opened: boolean;
  onArchived: (subscription: SubscriptionResponseDto) => void;
  onClose: () => void;
  subscription: SubscriptionResponseDto | null;
}

export function ArchiveSubscriptionModal({
  opened,
  onArchived,
  onClose,
  subscription,
}: ArchiveSubscriptionModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', undefined, {
    getInitialValueInEffect: false,
  });
  const [error, setError] = useState<string | null>(null);
  const { trigger, isMutating } = useArchiveSubscription(subscription?.id ?? '');

  const close = () => {
    if (isMutating) return;
    setError(null);
    onClose();
  };

  useTelegramBackButton(opened, close);

  const archive = async () => {
    if (!subscription) return;

    setError(null);

    try {
      const archivedSubscription = await trigger();

      onArchived(archivedSubscription);
      notifications.show({
        color: 'signal',
        message: `${archivedSubscription.name} убрана из активных подписок`,
        title: 'Подписка архивирована',
      });
      onClose();
    } catch (archiveError) {
      setError(
        archiveError instanceof ApiError
          ? archiveError.message
          : 'Не удалось архивировать подписку. Попробуй ещё раз.',
      );
    }
  };

  return (
    <Modal
      centered
      classNames={{
        body: classes.body,
        content: classes.content,
        header: classes.header,
        title: classes.title,
      }}
      closeOnClickOutside={!isMutating}
      closeOnEscape={!isMutating}
      onClose={close}
      opened={opened}
      overlayProps={{ backgroundOpacity: isMobile ? 0.92 : 0.78, color: '#07090d' }}
      radius="xl"
      size="sm"
      title="Архивировать подписку?"
      transitionProps={{ transition: isMobile ? 'slide-up' : 'pop' }}
    >
      <Stack gap="lg">
        <Text className={classes.description}>
          <Text component="span">{subscription?.name}</Text> исчезнет из активного списка, но
          останется в разделе «Архив». Оттуда подписку можно восстановить в любой момент.
        </Text>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Group className={classes.actions} justify="flex-end">
          <Button disabled={isMutating} onClick={close} radius="xl" variant="subtle">
            Отмена
          </Button>
          <Button
            color="red"
            leftSection={<IconArchive size={17} />}
            loading={isMutating}
            onClick={() => void archive()}
            radius="xl"
          >
            В архив
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
