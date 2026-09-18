import {
  ApiError,
  markSubscriptionPaid,
  restoreSubscription,
  type SubscriptionResponseDto,
  useGetCategories,
  useGetArchivedSubscriptions,
  useGetHealth,
  useGetPaymentMethods,
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
  Menu,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArchive,
  IconArrowsSort,
  IconBell,
  IconCalendarDue,
  IconCreditCard,
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTag,
  IconTrash,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';

import { useSubscriptionWebMcp } from '@/features/subscriptions/use-subscription-webmcp';
import {
  formatSubscriptionPeriod,
  getMonthlyBillingFactor,
} from '@/features/subscriptions/subscription-schedule';
import { CategoryIcon } from '@/features/categories/category-icon';
import { UpcomingPaymentsPanel } from '@/widgets/upcoming-payments/upcoming-payments-panel';
import { getDaysUntilCharge } from '@/widgets/upcoming-payments/upcoming-payments';

import classes from './dashboard-page.module.css';
import { filterAndSortSubscriptions, type SubscriptionSort } from './subscription-list';

const CreateSubscriptionModal = lazy(async () => {
  const module =
    await import('@/features/subscriptions/create-subscription/create-subscription-modal');

  return { default: module.CreateSubscriptionModal };
});

const ArchiveSubscriptionModal = lazy(async () => {
  const module =
    await import('@/features/subscriptions/archive-subscription/archive-subscription-modal');

  return { default: module.ArchiveSubscriptionModal };
});

const DeleteSubscriptionModal = lazy(async () => {
  const module =
    await import('@/features/subscriptions/delete-subscription/delete-subscription-modal');

  return { default: module.DeleteSubscriptionModal };
});

const currentPeriod = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
}).format(new Date());

const sortOptions = [
  { label: 'Сначала ближайшие', value: 'date-asc' },
  { label: 'Сначала поздние', value: 'date-desc' },
  { label: 'Название: А — Я', value: 'name-asc' },
  { label: 'Название: Я — А', value: 'name-desc' },
  { label: 'Недавно добавленные', value: 'created-desc' },
];

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

function getCategoryTextColor(color: string): string {
  const hex = color.replace('#', '');
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

  return luminance > 150 ? '#071006' : '#f5f7f4';
}

export function DashboardPage() {
  const [listMode, setListMode] = useState<'active' | 'archive'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SubscriptionSort>('date-asc');
  const [createOpened, createModal] = useDisclosure(false);
  const [editOpened, editModal] = useDisclosure(false);
  const [archiveOpened, archiveModal] = useDisclosure(false);
  const [deleteOpened, deleteModal] = useDisclosure(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionResponseDto | null>(
    null,
  );
  const [archivingSubscription, setArchivingSubscription] =
    useState<SubscriptionResponseDto | null>(null);
  const [deletingSubscription, setDeletingSubscription] = useState<SubscriptionResponseDto | null>(
    null,
  );
  const { data: health, error: healthError, isLoading: healthLoading } = useGetHealth();
  const { data: categories = [], isLoading: categoriesLoading } = useGetCategories();
  const { data: paymentMethods = [], isLoading: paymentMethodsLoading } = useGetPaymentMethods();
  const {
    data: subscriptions = [],
    error: subscriptionsError,
    isLoading: subscriptionsLoading,
    mutate: refreshSubscriptions,
  } = useGetSubscriptions();
  const {
    data: archivedSubscriptions = [],
    error: archivedSubscriptionsError,
    isLoading: archivedSubscriptionsLoading,
    mutate: refreshArchivedSubscriptions,
  } = useGetArchivedSubscriptions({ swr: { enabled: listMode === 'archive' } });

  const handleSubscriptionCreated = useCallback(
    () => refreshSubscriptions(),
    [refreshSubscriptions],
  );
  const handleSubscriptionArchived = useCallback(
    (archivedSubscription: SubscriptionResponseDto) => {
      void refreshSubscriptions(
        (currentSubscriptions) =>
          currentSubscriptions?.filter(({ id }) => id !== archivedSubscription.id),
        { revalidate: true },
      );
      void refreshArchivedSubscriptions(
        (currentSubscriptions) => [
          archivedSubscription,
          ...(currentSubscriptions ?? []).filter(({ id }) => id !== archivedSubscription.id),
        ],
        { revalidate: false },
      );
    },
    [refreshArchivedSubscriptions, refreshSubscriptions],
  );
  const handleSubscriptionDeleted = useCallback(
    (deletedSubscription: SubscriptionResponseDto) =>
      refreshArchivedSubscriptions(
        (currentSubscriptions) =>
          currentSubscriptions?.filter(({ id }) => id !== deletedSubscription.id),
        { revalidate: true },
      ),
    [refreshArchivedSubscriptions],
  );
  const openCreateModal = () => {
    setEditingSubscription(null);
    createModal.open();
  };
  const openEditModal = (subscription: SubscriptionResponseDto) => {
    setEditingSubscription(subscription);
    editModal.open();
  };
  const openArchiveModal = (subscription: SubscriptionResponseDto) => {
    setArchivingSubscription(subscription);
    archiveModal.open();
  };
  const openDeleteModal = (subscription: SubscriptionResponseDto) => {
    setDeletingSubscription(subscription);
    deleteModal.open();
  };
  const restoreArchivedSubscription = async (subscription: SubscriptionResponseDto) => {
    setRestoringId(subscription.id);

    try {
      const restoredSubscription = await restoreSubscription(subscription.id);

      void refreshArchivedSubscriptions(
        (currentSubscriptions) =>
          currentSubscriptions?.filter(({ id }) => id !== restoredSubscription.id),
        { revalidate: true },
      );
      void refreshSubscriptions(
        (currentSubscriptions) => [
          ...(currentSubscriptions ?? []).filter(({ id }) => id !== restoredSubscription.id),
          restoredSubscription,
        ],
        { revalidate: true },
      );
      notifications.show({
        color: 'signal',
        message: `${restoredSubscription.name} снова в активном списке`,
        title: 'Подписка восстановлена',
      });
    } catch (restoreError) {
      notifications.show({
        color: 'red',
        message:
          restoreError instanceof ApiError
            ? restoreError.message
            : 'Не удалось восстановить подписку.',
        title: 'Ошибка',
      });
    } finally {
      setRestoringId(null);
    }
  };
  const markAsPaid = async (subscription: SubscriptionResponseDto) => {
    setMarkingPaidId(subscription.id);

    try {
      const updatedSubscription = await markSubscriptionPaid(subscription.id, {
        scheduledFor: subscription.nextChargeDate,
      });

      void refreshSubscriptions(
        (currentSubscriptions) =>
          currentSubscriptions?.map((currentSubscription) =>
            currentSubscription.id === updatedSubscription.id
              ? updatedSubscription
              : currentSubscription,
          ),
        { revalidate: true },
      );
      notifications.show({
        color: 'signal',
        message: `Следующая дата — ${formatChargeDate(updatedSubscription.nextChargeDate)}`,
        title: `${updatedSubscription.name} оплачена`,
      });
    } catch (markPaidError) {
      notifications.show({
        color: 'red',
        message:
          markPaidError instanceof ApiError
            ? markPaidError.message
            : 'Не удалось отметить подписку оплаченной.',
        title: 'Ошибка',
      });
    } finally {
      setMarkingPaidId(null);
    }
  };
  useSubscriptionWebMcp(handleSubscriptionCreated);

  const isArchiveMode = listMode === 'archive';
  const unfilteredDisplayedSubscriptions = isArchiveMode ? archivedSubscriptions : subscriptions;
  const displayedSubscriptions = useMemo(
    () =>
      filterAndSortSubscriptions(unfilteredDisplayedSubscriptions, {
        categoryId: categoryFilter,
        paymentMethodId: paymentMethodFilter,
        query: searchQuery,
        sort: sortMode,
      }),
    [categoryFilter, paymentMethodFilter, searchQuery, sortMode, unfilteredDisplayedSubscriptions],
  );
  const hasListFilters = Boolean(searchQuery.trim() || categoryFilter || paymentMethodFilter);
  const resetListFilters = () => {
    setSearchQuery('');
    setCategoryFilter(null);
    setPaymentMethodFilter(null);
  };
  const displayedSubscriptionsLoading = isArchiveMode
    ? archivedSubscriptionsLoading
    : subscriptionsLoading;
  const displayedSubscriptionsError = isArchiveMode
    ? archivedSubscriptionsError
    : subscriptionsError;
  const hasDisplayedSubscriptionsError = Boolean(displayedSubscriptionsError);
  const activeSubscriptions = subscriptions.filter(({ status }) => status === 'ACTIVE');
  const upcomingSubscription = sortByChargeDate(activeSubscriptions)[0];
  const upcomingDays = upcomingSubscription
    ? getDaysUntilCharge(upcomingSubscription.nextChargeDate, new Date())
    : null;
  const monthlyRub = activeSubscriptions
    .filter(({ currency }) => currency === 'RUB')
    .reduce(
      (total, subscription) =>
        total +
        Number(subscription.amount) *
          getMonthlyBillingFactor(subscription.billingPeriod, subscription.interval),
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
                  onClick={openCreateModal}
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

                <Box
                  className={classes.metricCard}
                  data-overdue={upcomingDays !== null && upcomingDays < 0 ? true : undefined}
                >
                  <Box className={classes.metricIcon}>
                    <IconCalendarDue size={20} stroke={1.8} />
                  </Box>
                  <Text className={classes.metricLabel}>
                    {upcomingDays !== null && upcomingDays < 0 ? 'Просрочено' : 'Следующее'}
                  </Text>
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

              <UpcomingPaymentsPanel
                hasError={Boolean(subscriptionsError)}
                isLoading={subscriptionsLoading}
                markingId={markingPaidId}
                onMarkPaid={(subscription) => void markAsPaid(subscription)}
                onRetry={() => void refreshSubscriptions()}
                onSelect={openEditModal}
                subscriptions={activeSubscriptions}
              />

              <Box className={classes.subscriptionsPanel}>
                <Group className={classes.panelHeader} justify="space-between">
                  <Group gap={10}>
                    <Title order={2}>Мои подписки</Title>
                    <Badge className={classes.counter} radius="xl" variant="transparent">
                      {displayedSubscriptions.length}
                      {hasListFilters ? ` / ${unfilteredDisplayedSubscriptions.length}` : ''}
                    </Badge>
                  </Group>
                  <Group className={classes.listTabs} gap={4}>
                    <Button
                      className={classes.listTab}
                      data-active={!isArchiveMode || undefined}
                      onClick={() => setListMode('active')}
                      radius="xl"
                      size="compact-sm"
                      variant="transparent"
                    >
                      Активные
                    </Button>
                    <Button
                      className={classes.listTab}
                      data-active={isArchiveMode || undefined}
                      onClick={() => setListMode('archive')}
                      radius="xl"
                      size="compact-sm"
                      variant="transparent"
                    >
                      Архив
                    </Button>
                  </Group>
                </Group>

                <Box className={classes.filtersBar}>
                  <TextInput
                    aria-label="Поиск подписок"
                    className={classes.searchInput}
                    leftSection={<IconSearch size={16} />}
                    onChange={(event) => setSearchQuery(event.currentTarget.value)}
                    placeholder="Название, категория или карта"
                    rightSection={
                      searchQuery ? (
                        <ActionIcon
                          aria-label="Очистить поиск"
                          color="gray"
                          onClick={() => setSearchQuery('')}
                          size="sm"
                          variant="subtle"
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      ) : null
                    }
                    size="sm"
                    value={searchQuery}
                  />
                  <Select
                    allowDeselect
                    className={classes.filterSelect}
                    clearable
                    comboboxProps={{ transitionProps: { duration: 0 }, withinPortal: false }}
                    data={categories.map((category) => ({
                      label: category.name,
                      value: category.id,
                    }))}
                    disabled={categoriesLoading}
                    leftSection={<IconTag size={15} />}
                    onChange={setCategoryFilter}
                    placeholder="Все категории"
                    searchable
                    size="sm"
                    value={categoryFilter}
                  />
                  <Select
                    allowDeselect
                    className={classes.filterSelect}
                    clearable
                    comboboxProps={{ transitionProps: { duration: 0 }, withinPortal: false }}
                    data={paymentMethods.map((paymentMethod) => ({
                      label: paymentMethod.lastFour
                        ? `${paymentMethod.name} • ${paymentMethod.lastFour}`
                        : paymentMethod.name,
                      value: paymentMethod.id,
                    }))}
                    disabled={paymentMethodsLoading}
                    leftSection={<IconCreditCard size={15} />}
                    onChange={setPaymentMethodFilter}
                    placeholder="Все способы оплаты"
                    searchable
                    size="sm"
                    value={paymentMethodFilter}
                  />
                  <Select
                    allowDeselect={false}
                    className={classes.sortSelect}
                    comboboxProps={{ transitionProps: { duration: 0 }, withinPortal: false }}
                    data={sortOptions}
                    leftSection={<IconArrowsSort size={15} />}
                    onChange={(value) => setSortMode((value as SubscriptionSort) ?? 'date-asc')}
                    size="sm"
                    value={sortMode}
                  />
                  {hasListFilters && (
                    <Button
                      className={classes.resetFilters}
                      leftSection={<IconX size={14} />}
                      onClick={resetListFilters}
                      radius="xl"
                      size="compact-sm"
                      variant="subtle"
                    >
                      Сбросить
                    </Button>
                  )}
                </Box>

                {displayedSubscriptionsLoading && (
                  <Stack className={classes.list} gap={10}>
                    {[0, 1].map((item) => (
                      <Skeleton className={classes.listSkeleton} key={item} radius="lg" />
                    ))}
                  </Stack>
                )}

                {!displayedSubscriptionsLoading && hasDisplayedSubscriptionsError && (
                  <Box className={classes.errorState}>
                    <Box className={classes.errorIcon}>
                      <IconAlertTriangle size={24} />
                    </Box>
                    <Title order={3}>Не удалось загрузить подписки</Title>
                    <Text>Проверь соединение с API и попробуй ещё раз.</Text>
                    <Button
                      leftSection={<IconRefresh size={17} />}
                      onClick={() =>
                        void (isArchiveMode
                          ? refreshArchivedSubscriptions()
                          : refreshSubscriptions())
                      }
                      radius="xl"
                      variant="default"
                    >
                      Повторить
                    </Button>
                  </Box>
                )}

                {!displayedSubscriptionsLoading &&
                  !hasDisplayedSubscriptionsError &&
                  displayedSubscriptions.length === 0 && (
                    <Box className={classes.emptyState}>
                      <Box className={classes.emptyIcon}>
                        {hasListFilters ? (
                          <IconSearch size={27} stroke={1.6} />
                        ) : isArchiveMode ? (
                          <IconArchive size={27} stroke={1.6} />
                        ) : (
                          <IconReceipt size={27} stroke={1.6} />
                        )}
                      </Box>
                      <Title order={3}>
                        {hasListFilters
                          ? 'Ничего не найдено'
                          : isArchiveMode
                            ? 'Архив пока пуст'
                            : 'Здесь появится твоя первая подписка'}
                      </Title>
                      <Text>
                        {hasListFilters
                          ? 'Измени поисковый запрос или сбрось фильтры, чтобы увидеть остальные подписки.'
                          : isArchiveMode
                            ? 'Здесь будут храниться отключённые подписки — их можно восстановить или удалить окончательно.'
                            : 'Добавь сервис, дату и сумму. Мы соберём календарь списаний и напомним заранее.'}
                      </Text>
                      {hasListFilters ? (
                        <Button
                          className={classes.emptyButton}
                          leftSection={<IconRefresh size={17} />}
                          onClick={resetListFilters}
                          radius="xl"
                          variant="default"
                        >
                          Сбросить фильтры
                        </Button>
                      ) : !isArchiveMode ? (
                        <Button
                          className={classes.emptyButton}
                          leftSection={<IconPlus size={17} />}
                          onClick={openCreateModal}
                          radius="xl"
                          variant="default"
                        >
                          Добавить первую
                        </Button>
                      ) : null}
                    </Box>
                  )}

                {!displayedSubscriptionsLoading &&
                  !hasDisplayedSubscriptionsError &&
                  displayedSubscriptions.length > 0 && (
                    <Stack className={classes.list} gap={10}>
                      {displayedSubscriptions.map((subscription, index) => (
                        <Box
                          className={classes.subscriptionRow}
                          data-archived={isArchiveMode || undefined}
                          key={subscription.id}
                        >
                          <Box
                            className={classes.subscriptionMark}
                            data-tone={subscription.category ? undefined : index % 4}
                            style={
                              !isArchiveMode && subscription.category
                                ? {
                                    background: subscription.category.color,
                                    color: getCategoryTextColor(subscription.category.color),
                                  }
                                : undefined
                            }
                          >
                            {subscription.category ? (
                              <CategoryIcon icon={subscription.category.icon} size={19} />
                            ) : (
                              subscription.name.slice(0, 1).toLocaleUpperCase('ru-RU')
                            )}
                          </Box>
                          <Box className={classes.subscriptionInfo}>
                            <Text className={classes.subscriptionName}>{subscription.name}</Text>
                            <Text className={classes.subscriptionMeta}>
                              {subscription.category?.name || 'Без категории'} ·{' '}
                              {subscription.paymentMethod
                                ? `${subscription.paymentMethod.name}${
                                    subscription.paymentMethod.lastFour
                                      ? ` • ${subscription.paymentMethod.lastFour}`
                                      : ''
                                  }`
                                : 'Без способа оплаты'}
                            </Text>
                          </Box>
                          <Box className={classes.chargeDate}>
                            <Text>
                              {isArchiveMode ? 'Было запланировано' : 'Следующее списание'}
                            </Text>
                            <Text>{formatChargeDate(subscription.nextChargeDate)}</Text>
                          </Box>
                          <Box className={classes.subscriptionPrice}>
                            <Text>{formatMoney(subscription.amount, subscription.currency)}</Text>
                            <Text>
                              {formatSubscriptionPeriod(
                                subscription.billingPeriod,
                                subscription.interval,
                              )}
                            </Text>
                          </Box>
                          <Menu
                            position="bottom-end"
                            shadow="xl"
                            transitionProps={{ duration: 0 }}
                            width={190}
                            withinPortal={false}
                          >
                            <Menu.Target>
                              <ActionIcon
                                aria-label={`Действия для ${subscription.name}`}
                                className={classes.subscriptionActions}
                                radius="xl"
                                size={36}
                                variant="transparent"
                              >
                                <IconDotsVertical size={18} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown className={classes.actionsMenu}>
                              {isArchiveMode ? (
                                <>
                                  <Menu.Item
                                    disabled={restoringId === subscription.id}
                                    leftSection={
                                      restoringId === subscription.id ? (
                                        <Loader color="signal" size={14} />
                                      ) : (
                                        <IconRestore size={16} />
                                      )
                                    }
                                    onClick={() => void restoreArchivedSubscription(subscription)}
                                  >
                                    Восстановить
                                  </Menu.Item>
                                  <Menu.Item
                                    color="red"
                                    leftSection={<IconTrash size={16} />}
                                    onClick={() => openDeleteModal(subscription)}
                                  >
                                    Удалить навсегда
                                  </Menu.Item>
                                </>
                              ) : (
                                <>
                                  <Menu.Item
                                    leftSection={<IconEdit size={16} />}
                                    onClick={() => openEditModal(subscription)}
                                  >
                                    Редактировать
                                  </Menu.Item>
                                  <Menu.Item
                                    color="red"
                                    leftSection={<IconArchive size={16} />}
                                    onClick={() => openArchiveModal(subscription)}
                                  >
                                    В архив
                                  </Menu.Item>
                                </>
                              )}
                            </Menu.Dropdown>
                          </Menu>
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
          onClose={() => {
            createModal.close();
            editModal.close();
          }}
          onSaved={() => void handleSubscriptionCreated()}
          opened={createOpened || editOpened}
          subscription={editingSubscription}
        />
        <ArchiveSubscriptionModal
          onArchived={(subscription) => void handleSubscriptionArchived(subscription)}
          onClose={archiveModal.close}
          opened={archiveOpened}
          subscription={archivingSubscription}
        />
        <DeleteSubscriptionModal
          onClose={deleteModal.close}
          onDeleted={(subscription) => void handleSubscriptionDeleted(subscription)}
          opened={deleteOpened}
          subscription={deletingSubscription}
        />
      </Suspense>
    </>
  );
}
