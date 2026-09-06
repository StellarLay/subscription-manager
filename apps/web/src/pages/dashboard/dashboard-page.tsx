import {
  type SubscriptionResponseDto,
  useGetHealth,
  useGetSubscriptions,
} from '@subscription-manager/api-client';
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconBell,
  IconCalendarDue,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconWallet,
} from '@tabler/icons-react';
import { lazy, Suspense, useCallback } from 'react';

import { useSubscriptionWebMcp } from '@/features/subscriptions/use-subscription-webmcp';

import classes from './dashboard-page.module.css';

const CreateSubscriptionModal = lazy(async () => {
  const module =
    await import('@/features/subscriptions/create-subscription/create-subscription-modal');

  return { default: module.CreateSubscriptionModal };
});

const currentPeriod = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
}).format(new Date());

const periodLabels: Record<string, string> = {
  WEEK: 'в неделю',
  MONTH: 'в месяц',
  QUARTER: 'в квартал',
  YEAR: 'в год',
  CUSTOM: 'регулярно',
};

const monthlyFactors: Record<string, number> = {
  WEEK: 52 / 12,
  MONTH: 1,
  QUARTER: 1 / 3,
  YEAR: 1 / 12,
  CUSTOM: 1,
};

function formatMoney(amount: number | string, currency: string): string {
  return new Intl.NumberFormat('ru-RU', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(amount));
}

function formatChargeDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T00:00:00`));
}

function sortByChargeDate(subscriptions: SubscriptionResponseDto[]) {
  return [...subscriptions].sort((left, right) =>
    left.nextChargeDate.localeCompare(right.nextChargeDate),
  );
}

export function DashboardPage() {
  const [createOpened, createModal] = useDisclosure(false);
  const { data: health, error: healthError, isLoading: healthLoading } = useGetHealth();
  const {
    data: subscriptions = [],
    error: subscriptionsError,
    isLoading: subscriptionsLoading,
    mutate: refreshSubscriptions,
  } = useGetSubscriptions();

  const handleSubscriptionCreated = useCallback(
    () => refreshSubscriptions(),
    [refreshSubscriptions],
  );
  useSubscriptionWebMcp(handleSubscriptionCreated);

  const hasSubscriptionsError = Boolean(subscriptionsError);
  const activeSubscriptions = subscriptions.filter(({ status }) => status === 'ACTIVE');
  const upcomingSubscription = sortByChargeDate(activeSubscriptions)[0];
  const monthlyRub = activeSubscriptions
    .filter(({ currency }) => currency === 'RUB')
    .reduce(
      (total, subscription) =>
        total + Number(subscription.amount) * (monthlyFactors[subscription.billingPeriod] ?? 1),
      0,
    );

  return (
    <>
      <AppShell header={{ height: { base: 68, sm: 76 } }} padding={0}>
        <AppShell.Header className={classes.header}>
          <Container size="lg" h="100%">
            <Group h="100%" justify="space-between">
              <Group gap={12} wrap="nowrap">
                <Box className={classes.brandMark}>
                  <IconReceipt size={20} stroke={2.2} />
                </Box>
                <Box>
                  <Text className={classes.brandName}>Subtrack</Text>
                  <Text className={classes.brandCaption}>регулярные платежи</Text>
                </Box>
              </Group>

              <Group gap={10} wrap="nowrap">
                <Box
                  className={classes.systemStatus}
                  data-state={healthError ? 'error' : health ? 'online' : 'loading'}
                >
                  {healthLoading ? (
                    <Loader color="gray" size={10} />
                  ) : (
                    <span className={classes.statusDot} />
                  )}
                  <Text component="span">
                    {healthError ? 'API offline' : health ? 'Все системы в норме' : 'Подключение'}
                  </Text>
                </Box>
                <ActionIcon
                  aria-label="Уведомления"
                  className={classes.iconButton}
                  radius="xl"
                  size={42}
                  variant="transparent"
                >
                  <IconBell size={19} stroke={1.8} />
                </ActionIcon>
              </Group>
            </Group>
          </Container>
        </AppShell.Header>

        <AppShell.Main className={classes.main}>
          <Box aria-hidden className={classes.ambient} />
          <Container className={classes.content} size="lg">
            <Stack gap={0}>
              <Group className={classes.pageHeading} justify="space-between">
                <Box>
                  <Text className={classes.eyebrow}>
                    <span /> Обзор · {currentPeriod}
                  </Text>
                  <Title className={classes.title} order={1}>
                    Твои подписки
                  </Title>
                  <Text className={classes.subtitle}>
                    Всё, что списывается регулярно — в одном месте.
                  </Text>
                </Box>
                <Button
                  className={classes.addButton}
                  leftSection={<IconPlus size={18} stroke={2.4} />}
                  onClick={createModal.open}
                  radius="xl"
                  size="md"
                >
                  Добавить подписку
                </Button>
              </Group>

              <Box className={classes.metrics}>
                <Box className={classes.primaryMetric}>
                  <Group align="flex-start" justify="space-between" wrap="nowrap">
                    <Box>
                      <Text className={classes.metricLabel}>Расходы в этом месяце</Text>
                      <Text className={classes.primaryValue}>
                        {subscriptionsLoading ? '···' : formatMoney(monthlyRub, 'RUB')}
                      </Text>
                    </Box>
                    <Box className={classes.metricIcon}>
                      <IconWallet size={20} stroke={1.8} />
                    </Box>
                  </Group>
                  <Group className={classes.metricFooter} gap={8}>
                    <span />
                    <Text>
                      {activeSubscriptions.length
                        ? `Прогноз по ${activeSubscriptions.length} активным подпискам`
                        : 'Нет запланированных списаний'}
                    </Text>
                  </Group>
                </Box>

                <Box className={classes.metricCard}>
                  <Box className={classes.metricIcon}>
                    <IconCalendarDue size={20} stroke={1.8} />
                  </Box>
                  <Text className={classes.metricLabel}>Следующее</Text>
                  <Text className={classes.metricValue}>
                    {upcomingSubscription
                      ? formatChargeDate(upcomingSubscription.nextChargeDate)
                      : '—'}
                  </Text>
                  <Text className={classes.metricHint} lineClamp={1}>
                    {upcomingSubscription?.name ?? 'пока ничего'}
                  </Text>
                </Box>

                <Box className={classes.metricCard}>
                  <Box className={classes.metricIcon}>
                    <IconReceipt size={20} stroke={1.8} />
                  </Box>
                  <Text className={classes.metricLabel}>Активные</Text>
                  <Text className={classes.metricValue}>
                    {subscriptionsLoading ? '·' : activeSubscriptions.length}
                  </Text>
                  <Text className={classes.metricHint}>подписок</Text>
                </Box>
              </Box>

              <Box className={classes.subscriptionsPanel}>
                <Group className={classes.panelHeader} justify="space-between">
                  <Group gap={10}>
                    <Title order={2}>Мои подписки</Title>
                    <Badge className={classes.counter} radius="xl" variant="transparent">
                      {subscriptions.length}
                    </Badge>
                  </Group>
                </Group>

                {subscriptionsLoading && (
                  <Stack className={classes.list} gap={10}>
                    {[0, 1].map((item) => (
                      <Skeleton className={classes.listSkeleton} key={item} radius="lg" />
                    ))}
                  </Stack>
                )}

                {!subscriptionsLoading && hasSubscriptionsError && (
                  <Box className={classes.errorState}>
                    <Box className={classes.errorIcon}>
                      <IconAlertTriangle size={24} />
                    </Box>
                    <Title order={3}>Не удалось загрузить подписки</Title>
                    <Text>Проверь соединение с API и попробуй ещё раз.</Text>
                    <Button
                      leftSection={<IconRefresh size={17} />}
                      onClick={() => void refreshSubscriptions()}
                      radius="xl"
                      variant="default"
                    >
                      Повторить
                    </Button>
                  </Box>
                )}

                {!subscriptionsLoading && !hasSubscriptionsError && subscriptions.length === 0 && (
                  <Box className={classes.emptyState}>
                    <Box className={classes.emptyIcon}>
                      <IconReceipt size={27} stroke={1.6} />
                    </Box>
                    <Title order={3}>Здесь появится твоя первая подписка</Title>
                    <Text>
                      Добавь сервис, дату и сумму. Мы соберём календарь списаний и напомним заранее.
                    </Text>
                    <Button
                      className={classes.emptyButton}
                      leftSection={<IconPlus size={17} />}
                      onClick={createModal.open}
                      radius="xl"
                      variant="default"
                    >
                      Добавить первую
                    </Button>
                  </Box>
                )}

                {!subscriptionsLoading && !hasSubscriptionsError && subscriptions.length > 0 && (
                  <Stack className={classes.list} gap={10}>
                    {subscriptions.map((subscription, index) => (
                      <Box className={classes.subscriptionRow} key={subscription.id}>
                        <Box className={classes.subscriptionMark} data-tone={index % 4}>
                          {subscription.name.slice(0, 1).toLocaleUpperCase('ru-RU')}
                        </Box>
                        <Box className={classes.subscriptionInfo}>
                          <Text className={classes.subscriptionName}>{subscription.name}</Text>
                          <Text className={classes.subscriptionMeta}>
                            {subscription.category || 'Без категории'} ·{' '}
                            {periodLabels[subscription.billingPeriod]}
                          </Text>
                        </Box>
                        <Box className={classes.chargeDate}>
                          <Text>Следующее списание</Text>
                          <Text>{formatChargeDate(subscription.nextChargeDate)}</Text>
                        </Box>
                        <Box className={classes.subscriptionPrice}>
                          <Text>{formatMoney(subscription.amount, subscription.currency)}</Text>
                          <Text>{periodLabels[subscription.billingPeriod]}</Text>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          </Container>
        </AppShell.Main>
      </AppShell>

      <Suspense fallback={null}>
        <CreateSubscriptionModal
          onClose={createModal.close}
          onCreated={() => void handleSubscriptionCreated()}
          opened={createOpened}
        />
      </Suspense>
    </>
  );
}
