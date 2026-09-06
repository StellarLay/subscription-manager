import { useGetHealth } from '@subscription-manager/api-client';
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBell,
  IconCalendarDue,
  IconCreditCard,
  IconPlus,
  IconReceipt,
  IconWallet,
} from '@tabler/icons-react';
import classes from './dashboard-page.module.css';

const summary = [
  { label: 'В этом месяце', value: '—', icon: IconWallet },
  { label: 'Ближайшее списание', value: '—', icon: IconCalendarDue },
  { label: 'Активные подписки', value: '0', icon: IconReceipt },
];

export function DashboardPage() {
  const { data, error, isLoading } = useGetHealth();

  return (
    <AppShell header={{ height: 72 }} padding="md">
      <AppShell.Header className={classes.header}>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Group gap="sm">
              <ThemeIcon size={38} radius="md" variant="gradient">
                <IconCreditCard size={22} />
              </ThemeIcon>
              <Box>
                <Text fw={700} lh={1.1}>
                  Subscription Manager
                </Text>
                <Text size="xs" c="dimmed">
                  Контроль регулярных расходов
                </Text>
              </Box>
            </Group>

            <Group gap="sm">
              <Badge
                color={error ? 'red' : data ? 'teal' : 'gray'}
                leftSection={isLoading ? <Loader size={8} /> : undefined}
                variant="light"
              >
                {error ? 'API недоступен' : data ? 'Система работает' : 'Проверка API'}
              </Badge>
              <ActionIcon aria-label="Уведомления" size="lg" variant="subtle">
                <IconBell size={20} />
              </ActionIcon>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main className={classes.main}>
        <Container size="lg" py={{ base: 'md', sm: 'xl' }}>
          <Stack gap="xl">
            <Group align="end" justify="space-between">
              <Box>
                <Text c="dimmed" fw={600} size="sm">
                  ОБЗОР
                </Text>
                <Title order={1}>Регулярные платежи</Title>
              </Box>
              <Button leftSection={<IconPlus size={18} />}>Добавить подписку</Button>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              {summary.map(({ icon: Icon, label, value }) => (
                <Card className={classes.summaryCard} key={label} padding="lg" radius="lg">
                  <Group justify="space-between" wrap="nowrap">
                    <Box>
                      <Text c="dimmed" size="sm">
                        {label}
                      </Text>
                      <Text fw={700} mt={6} size="xl">
                        {value}
                      </Text>
                    </Box>
                    <ThemeIcon color="accent" radius="xl" size={42} variant="light">
                      <Icon size={21} />
                    </ThemeIcon>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>

            <Card className={classes.emptyCard} padding="xl" radius="lg">
              <Stack align="center" gap="sm" py="xl" ta="center">
                <ThemeIcon color="gray" radius="xl" size={56} variant="light">
                  <IconReceipt size={28} />
                </ThemeIcon>
                <Title order={3}>Подписок пока нет</Title>
                <Text c="dimmed" maw={430}>
                  Добавьте первый регулярный платёж — здесь появятся ближайшие списания и общая
                  сумма расходов.
                </Text>
                <Button leftSection={<IconPlus size={18} />} mt="sm" variant="light">
                  Добавить первую подписку
                </Button>
              </Stack>
            </Card>
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
