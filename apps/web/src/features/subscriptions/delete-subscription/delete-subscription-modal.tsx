import {
  ApiError,
  type SubscriptionResponseDto,
  useDeleteSubscription,
} from '@subscription-manager/api-client';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

import classes from '../archive-subscription/archive-subscription-modal.module.css';

interface DeleteSubscriptionModalProps {
  opened: boolean;
  onClose: () => void;
  onDeleted: (subscription: SubscriptionResponseDto) => void;
  subscription: SubscriptionResponseDto | null;
}

export function DeleteSubscriptionModal({
  opened,
  onClose,
  onDeleted,
  subscription,
}: DeleteSubscriptionModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', undefined, {
    getInitialValueInEffect: false,
  });
  const [error, setError] = useState<string | null>(null);
  const { trigger, isMutating } = useDeleteSubscription(subscription?.id ?? '');

  const close = () => {
    if (isMutating) return;
    setError(null);
    onClose();
  };

  const remove = async () => {
    if (!subscription) return;

    setError(null);

    try {
      const deletedSubscription = await trigger();

      onDeleted(deletedSubscription);
      notifications.show({
        color: 'red',
        message: `${deletedSubscription.name} удалена без возможности восстановления`,
        title: 'Подписка удалена',
      });
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof ApiError
          ? deleteError.message
          : 'Не удалось удалить подписку. Попробуй ещё раз.',
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
      title="Удалить навсегда?"
      transitionProps={{ transition: isMobile ? 'slide-up' : 'pop' }}
    >
      <Stack gap="lg">
        <Text className={classes.description}>
          <Text component="span">{subscription?.name}</Text> и связанные с ней данные будут удалены
          без возможности восстановления.
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
            leftSection={<IconTrash size={17} />}
            loading={isMutating}
            onClick={() => void remove()}
            radius="xl"
          >
            Удалить навсегда
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
