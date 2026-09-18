import type { SubscriptionResponseDto } from '@subscription-manager/api-client';
import { Alert, Badge, Box, Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconChevronRight,
  IconRefresh,
} from '@tabler/icons-react';

import { CategoryIcon } from '@/features/categories/category-icon';

import classes from './upcoming-payments-panel.module.css';
import { getDaysUntilCharge, groupUpcomingPayments } from './upcoming-payments';

interface UpcomingPaymentsPanelProps {
  subscriptions: SubscriptionResponseDto[];
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  onSelect: (subscription: SubscriptionResponseDto) => void;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  weekday: 'short',
});

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('ru-RU', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(amount));
}

function formatChargeDate(dateKey: string, today: Date): string {
  const daysUntilCharge = getDaysUntilCharge(dateKey, today);

  if (daysUntilCharge < 0) return `${Math.abs(daysUntilCharge)} дн. назад`;
  if (daysUntilCharge === 0) return 'Сегодня';
  if (daysUntilCharge === 1) return 'Завтра';

  return dateFormatter.format(new Date(`${dateKey}T00:00:00`));
}

function getCategoryTextColor(color: string): string {
  const hex = color.replace('#', '');
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? '#071006' : '#f5f7f4';
}

export function UpcomingPaymentsPanel({
  subscriptions,
  isLoading,
  hasError,
  onRetry,
  onSelect,
}: UpcomingPaymentsPanelProps) {
  const today = new Date();
  const groups = groupUpcomingPayments(subscriptions, today);
  const populatedGroups = groups.filter((group) => group.subscriptions.length > 0);
  const upcomingCount = populatedGroups.reduce(
    (count, group) => count + group.subscriptions.length,
    0,
  );

  return (
    <Box className={classes.panel}>
      <Group className={classes.header} justify="space-between">
        <Box>
          <Group gap={10}>
            <Title order={2}>Ближайшие списания</Title>
            {!isLoading && !hasError && (
              <Badge className={classes.counter} radius="xl" variant="transparent">
                {upcomingCount}
              </Badge>
            )}
          </Group>
          <Text>Собрали платежи по срочности, чтобы ничего не потерялось.</Text>
        </Box>
        <Box className={classes.calendarIcon}>
          <IconCalendarEvent size={21} stroke={1.8} />
        </Box>
      </Group>

      {isLoading && (
        <Box className={classes.groupsGrid}>
          {[0, 1].map((item) => (
            <Skeleton className={classes.groupSkeleton} key={item} radius="lg" />
          ))}
        </Box>
      )}

      {!isLoading && hasError && (
        <Alert
          className={classes.error}
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Не удалось загрузить ближайшие списания"
          variant="light"
        >
          <Group align="center" justify="space-between">
            <Text>Проверь соединение с API и попробуй ещё раз.</Text>
            <Button
              leftSection={<IconRefresh size={15} />}
              onClick={onRetry}
              radius="xl"
              size="compact-sm"
              variant="subtle"
            >
              Повторить
            </Button>
          </Group>
        </Alert>
      )}

      {!isLoading && !hasError && populatedGroups.length === 0 && (
        <Box className={classes.emptyState}>
          <IconCalendarEvent size={25} stroke={1.6} />
          <Box>
            <Text>Ближайших списаний пока нет</Text>
            <Text>Добавь активную подписку — она сразу появится здесь.</Text>
          </Box>
        </Box>
      )}

      {!isLoading && !hasError && populatedGroups.length > 0 && (
        <Box className={classes.groupsGrid}>
          {populatedGroups.map((group) => (
            <Box className={classes.groupCard} data-tone={group.id} key={group.id}>
              <Group className={classes.groupHeading} justify="space-between">
                <Box>
                  <Text className={classes.groupTitle}>{group.title}</Text>
                  <Text className={classes.groupDescription}>{group.description}</Text>
                </Box>
                <Badge className={classes.groupCount} radius="xl" variant="transparent">
                  {group.subscriptions.length}
                </Badge>
              </Group>

              <Stack gap={7}>
                {group.subscriptions.map((subscription) => (
                  <button
                    className={classes.paymentRow}
                    key={subscription.id}
                    onClick={() => onSelect(subscription)}
                    type="button"
                  >
                    <Box
                      className={classes.paymentMark}
                      style={
                        subscription.category
                          ? {
                              background: subscription.category.color,
                              color: getCategoryTextColor(subscription.category.color),
                            }
                          : undefined
                      }
                    >
                      {subscription.category ? (
                        <CategoryIcon icon={subscription.category.icon} size={17} />
                      ) : (
                        subscription.name.slice(0, 1).toLocaleUpperCase('ru-RU')
                      )}
                    </Box>
                    <Box className={classes.paymentInfo}>
                      <Text>{subscription.name}</Text>
                      <Text>
                        {subscription.paymentMethod?.name ??
                          subscription.category?.name ??
                          'Без способа оплаты'}
                      </Text>
                    </Box>
                    <Text className={classes.paymentDate}>
                      {formatChargeDate(subscription.nextChargeDate, today)}
                    </Text>
                    <Text className={classes.paymentAmount}>
                      {formatMoney(subscription.amount, subscription.currency)}
                    </Text>
                    <IconChevronRight className={classes.chevron} size={16} />
                  </button>
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
