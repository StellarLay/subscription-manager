import { useGetHealth } from '@subscription-manager/api-client';
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconBell,
  IconCalendarDue,
  IconChevronRight,
  IconPlus,
  IconReceipt,
  IconWallet,
} from '@tabler/icons-react';
import classes from './dashboard-page.module.css';

const currentPeriod = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
}).format(new Date());

export function DashboardPage() {
  const { data, error, isLoading } = useGetHealth();

  return (
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
                data-state={error ? 'error' : data ? 'online' : 'loading'}
              >
                {isLoading ? (
                  <Loader color="gray" size={10} />
                ) : (
                  <span className={classes.statusDot} />
                )}
                <Text component="span">
                  {error ? 'API offline' : data ? 'Все системы в норме' : 'Подключение'}
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
                    <Text className={classes.primaryValue}>0 ₽</Text>
                  </Box>
                  <Box className={classes.metricIcon}>
                    <IconWallet size={20} stroke={1.8} />
                  </Box>
                </Group>
                <Group className={classes.metricFooter} gap={8}>
                  <span />
                  <Text>Нет запланированных списаний</Text>
                </Group>
              </Box>

              <Box className={classes.metricCard}>
                <Box className={classes.metricIcon}>
                  <IconCalendarDue size={20} stroke={1.8} />
                </Box>
                <Text className={classes.metricLabel}>Следующее</Text>
                <Text className={classes.metricValue}>—</Text>
                <Text className={classes.metricHint}>пока ничего</Text>
              </Box>

              <Box className={classes.metricCard}>
                <Box className={classes.metricIcon}>
                  <IconReceipt size={20} stroke={1.8} />
                </Box>
                <Text className={classes.metricLabel}>Активные</Text>
                <Text className={classes.metricValue}>0</Text>
                <Text className={classes.metricHint}>подписок</Text>
              </Box>
            </Box>

            <Box className={classes.subscriptionsPanel}>
              <Group className={classes.panelHeader} justify="space-between">
                <Group gap={10}>
                  <Title order={2}>Мои подписки</Title>
                  <Badge className={classes.counter} radius="xl" variant="transparent">
                    0
                  </Badge>
                </Group>
                <Button
                  className={classes.textButton}
                  rightSection={<IconChevronRight size={16} />}
                  variant="subtle"
                >
                  Все платежи
                </Button>
              </Group>

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
                  radius="xl"
                  variant="default"
                >
                  Добавить первую
                </Button>
              </Box>
            </Box>
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
