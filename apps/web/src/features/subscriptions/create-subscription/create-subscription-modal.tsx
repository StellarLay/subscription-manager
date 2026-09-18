import {
  ApiError,
  type CategoryResponseDto,
  CreateSubscriptionBody,
  CreateSubscriptionDtoBillingPeriod,
  CreateSubscriptionDtoCurrency,
  type CreateSubscriptionDto,
  type PaymentMethodResponseDto,
  type SubscriptionResponseDto,
  useCreateSubscription,
  useGetCategories,
  useGetPaymentMethods,
  useUpdateSubscription,
} from '@subscription-manager/api-client';
import {
  Alert,
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCalendar, IconDeviceFloppy, IconPlus } from '@tabler/icons-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, type DefaultValues, useForm } from 'react-hook-form';

import { CreatePaymentMethodModal } from '@/features/payment-methods/create-payment-method/create-payment-method-modal';
import { CreateCategoryModal } from '@/features/categories/create-category/create-category-modal';

import classes from './create-subscription-modal.module.css';

interface CreateSubscriptionModalProps {
  opened: boolean;
  onClose: () => void;
  onSaved: (subscription: SubscriptionResponseDto) => void;
  subscription?: SubscriptionResponseDto | null;
}

const billingPeriods = [
  { label: 'Каждую неделю', value: CreateSubscriptionDtoBillingPeriod.WEEK },
  { label: 'Каждый месяц', value: CreateSubscriptionDtoBillingPeriod.MONTH },
  { label: 'Каждый квартал', value: CreateSubscriptionDtoBillingPeriod.QUARTER },
  { label: 'Каждый год', value: CreateSubscriptionDtoBillingPeriod.YEAR },
];

const currencies = [
  { label: '₽ RUB', value: CreateSubscriptionDtoCurrency.RUB },
  { label: '$ USD', value: CreateSubscriptionDtoCurrency.USD },
  { label: '€ EUR', value: CreateSubscriptionDtoCurrency.EUR },
];

function getTomorrow(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0'),
  ].join('-');
}

function getDefaultValues(
  subscription?: SubscriptionResponseDto | null,
): DefaultValues<CreateSubscriptionDto> {
  if (subscription) {
    return {
      name: subscription.name,
      amount: Number(subscription.amount),
      currency: subscription.currency,
      billingPeriod: subscription.billingPeriod,
      nextChargeDate: subscription.nextChargeDate,
      categoryId: subscription.category?.id ?? null,
      paymentMethodId: subscription.paymentMethod?.id ?? null,
    };
  }

  return {
    name: '',
    amount: undefined,
    currency: CreateSubscriptionDtoCurrency.RUB,
    billingPeriod: CreateSubscriptionDtoBillingPeriod.MONTH,
    nextChargeDate: getTomorrow(),
    categoryId: null,
    paymentMethodId: null,
  };
}

export function CreateSubscriptionModal({
  opened,
  onClose,
  onSaved,
  subscription,
}: CreateSubscriptionModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', undefined, {
    getInitialValueInEffect: false,
  });
  const [paymentMethodOpened, paymentMethodModal] = useDisclosure(false);
  const [categoryOpened, categoryModal] = useDisclosure(false);
  const isEditing = Boolean(subscription);
  const { trigger: createSubscription, isMutating: isCreating } = useCreateSubscription();
  const { trigger: updateSubscription, isMutating: isUpdating } = useUpdateSubscription(
    subscription?.id ?? '',
  );
  const isMutating = isCreating || isUpdating;
  const {
    data: categories = [],
    error: categoriesError,
    isLoading: categoriesLoading,
    mutate: refreshCategories,
  } = useGetCategories();
  const {
    data: paymentMethods = [],
    error: paymentMethodsError,
    isLoading: paymentMethodsLoading,
    mutate: refreshPaymentMethods,
  } = useGetPaymentMethods();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CreateSubscriptionDto>({
    resolver: zodResolver(CreateSubscriptionBody),
    defaultValues: getDefaultValues(subscription),
  });

  useEffect(() => {
    if (!opened) return;

    reset(getDefaultValues(subscription));
  }, [opened, reset, subscription]);

  const close = () => {
    if (isMutating) return;
    reset(getDefaultValues(subscription));
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    try {
      const valuesToSave = {
        ...values,
        categoryId: values.categoryId ?? null,
        paymentMethodId: values.paymentMethodId ?? null,
      };
      const savedSubscription = subscription
        ? await updateSubscription(valuesToSave)
        : await createSubscription(valuesToSave);

      onSaved(savedSubscription);
      notifications.show({
        color: 'signal',
        message: isEditing
          ? `${savedSubscription.name} обновлена`
          : `${savedSubscription.name} добавлена`,
        title: isEditing ? 'Изменения сохранены' : 'Готово',
      });
      reset(getDefaultValues());
      onClose();
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError ? error.message : 'Не удалось сохранить. Попробуй ещё раз.',
      });
    }
  });

  const handlePaymentMethodCreated = (paymentMethod: PaymentMethodResponseDto) => {
    void refreshPaymentMethods(
      (currentPaymentMethods) => [
        ...(currentPaymentMethods ?? []).filter(({ id }) => id !== paymentMethod.id),
        paymentMethod,
      ],
      { revalidate: false },
    );
    setValue('paymentMethodId', paymentMethod.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleCategoryCreated = (category: CategoryResponseDto) => {
    void refreshCategories(
      (currentCategories) => [
        ...(currentCategories ?? []).filter(({ id }) => id !== category.id),
        category,
      ],
      { revalidate: false },
    );
    setValue('categoryId', category.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <>
      <Modal
        centered
        classNames={{
          body: classes.body,
          content: classes.content,
          header: classes.header,
          overlay: classes.overlay,
          title: classes.title,
        }}
        closeOnClickOutside={!isMutating && !paymentMethodOpened && !categoryOpened}
        closeOnEscape={!isMutating && !paymentMethodOpened && !categoryOpened}
        fullScreen={isMobile}
        onClose={close}
        opened={opened}
        overlayProps={{ backgroundOpacity: isMobile ? 1 : 0.78, color: '#07090d' }}
        radius="xl"
        size="lg"
        title={
          <div>
            <Text className={classes.kicker}>
              {isEditing ? 'Редактирование' : 'Новая подписка'}
            </Text>
            <Text className={classes.heading}>
              {isEditing ? 'Изменить регулярный платёж' : 'Добавить регулярный платёж'}
            </Text>
          </div>
        }
        transitionProps={{ transition: isMobile ? 'slide-up' : 'pop' }}
      >
        <form onSubmit={(event) => void submit(event)}>
          <Stack gap="md">
            <TextInput
              autoFocus
              error={errors.name ? 'Укажи название подписки' : undefined}
              label="Название"
              placeholder="Например, YouTube Premium"
              size="md"
              withAsterisk
              {...register('name')}
            />

            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
              <Controller
                control={control}
                name="amount"
                render={({ field, fieldState }) => (
                  <NumberInput
                    allowNegative={false}
                    decimalScale={2}
                    decimalSeparator=","
                    error={fieldState.error ? 'Укажи сумму больше нуля' : undefined}
                    hideControls
                    label="Сумма"
                    min={0.01}
                    onBlur={field.onBlur}
                    onChange={(value) => field.onChange(value === '' ? undefined : value)}
                    placeholder="799"
                    size="md"
                    thousandSeparator=" "
                    value={field.value ?? ''}
                    withAsterisk
                  />
                )}
              />

              <Controller
                control={control}
                name="currency"
                render={({ field, fieldState }) => (
                  <Select
                    allowDeselect={false}
                    comboboxProps={{
                      transitionProps: { duration: 0 },
                      withinPortal: false,
                    }}
                    data={currencies}
                    error={fieldState.error ? 'Выбери валюту' : undefined}
                    label="Валюта"
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    size="md"
                    value={field.value}
                    withAsterisk
                  />
                )}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
              <Controller
                control={control}
                name="billingPeriod"
                render={({ field, fieldState }) => (
                  <Select
                    allowDeselect={false}
                    comboboxProps={{
                      transitionProps: { duration: 0 },
                      withinPortal: false,
                    }}
                    data={billingPeriods}
                    error={fieldState.error ? 'Выбери периодичность' : undefined}
                    label="Периодичность"
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    size="md"
                    value={field.value}
                    withAsterisk
                  />
                )}
              />

              <Controller
                control={control}
                name="nextChargeDate"
                render={({ field, fieldState }) => (
                  <DateInput
                    error={fieldState.error ? 'Выбери дату списания' : undefined}
                    label="Следующее списание"
                    leftSection={<IconCalendar size={17} />}
                    minDate={new Date()}
                    onBlur={field.onBlur}
                    onChange={(value) => field.onChange(value ?? '')}
                    popoverProps={{
                      transitionProps: { duration: 0 },
                      withinPortal: false,
                    }}
                    placeholder="Выбери дату"
                    size="md"
                    value={field.value}
                    valueFormat="DD MMMM YYYY"
                    withAsterisk
                  />
                )}
              />
            </SimpleGrid>

            <Box>
              <Group className={classes.fieldHeader} justify="space-between">
                <Text className={classes.fieldLabel}>Категория</Text>
                <Button
                  className={classes.fieldAction}
                  leftSection={<IconPlus size={14} />}
                  onClick={categoryModal.open}
                  size="compact-xs"
                  type="button"
                  variant="transparent"
                >
                  Новая категория
                </Button>
              </Group>
              <Controller
                control={control}
                name="categoryId"
                render={({ field, fieldState }) => (
                  <Select
                    allowDeselect
                    clearable
                    comboboxProps={{
                      transitionProps: { duration: 0 },
                      withinPortal: false,
                    }}
                    data={categories.map((category) => ({
                      label: category.name,
                      value: category.id,
                    }))}
                    disabled={categoriesLoading}
                    error={
                      categoriesError ? 'Не удалось загрузить категории' : fieldState.error?.message
                    }
                    nothingFoundMessage="Категорий пока нет"
                    onBlur={field.onBlur}
                    onChange={(value) => field.onChange(value ?? null)}
                    placeholder={categoriesLoading ? 'Загрузка...' : 'Без категории'}
                    searchable
                    size="md"
                    value={field.value ?? null}
                  />
                )}
              />
            </Box>

            <Box>
              <Group className={classes.fieldHeader} justify="space-between">
                <Text className={classes.fieldLabel}>Способ оплаты</Text>
                <Button
                  className={classes.fieldAction}
                  leftSection={<IconPlus size={14} />}
                  onClick={paymentMethodModal.open}
                  size="compact-xs"
                  type="button"
                  variant="transparent"
                >
                  Новый способ
                </Button>
              </Group>
              <Controller
                control={control}
                name="paymentMethodId"
                render={({ field, fieldState }) => (
                  <Select
                    allowDeselect
                    clearable
                    comboboxProps={{
                      transitionProps: { duration: 0 },
                      withinPortal: false,
                    }}
                    data={paymentMethods.map((paymentMethod) => ({
                      label: paymentMethod.lastFour
                        ? `${paymentMethod.name} • ${paymentMethod.lastFour}`
                        : paymentMethod.name,
                      value: paymentMethod.id,
                    }))}
                    disabled={paymentMethodsLoading}
                    error={
                      paymentMethodsError
                        ? 'Не удалось загрузить способы оплаты'
                        : fieldState.error?.message
                    }
                    nothingFoundMessage="Способов оплаты пока нет"
                    onBlur={field.onBlur}
                    onChange={(value) => field.onChange(value ?? undefined)}
                    placeholder={paymentMethodsLoading ? 'Загрузка...' : 'Без способа оплаты'}
                    searchable
                    size="md"
                    value={field.value ?? null}
                  />
                )}
              />
            </Box>

            <Text className={classes.reminderHint}>
              Напомним о списании за день. Правила уведомлений можно будет изменить позже.
            </Text>

            {errors.root?.message && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {errors.root.message}
              </Alert>
            )}

            <Group className={classes.actions} justify="flex-end">
              <Button disabled={isMutating} onClick={close} radius="xl" variant="subtle">
                Отмена
              </Button>
              <Button
                className={classes.submitButton}
                leftSection={isEditing ? <IconDeviceFloppy size={17} /> : <IconPlus size={17} />}
                loading={isMutating}
                radius="xl"
                type="submit"
              >
                {isEditing ? 'Сохранить' : 'Добавить'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <CreatePaymentMethodModal
        onClose={paymentMethodModal.close}
        onCreated={handlePaymentMethodCreated}
        opened={paymentMethodOpened}
      />
      <CreateCategoryModal
        onClose={categoryModal.close}
        onCreated={handleCategoryCreated}
        opened={categoryOpened}
      />
    </>
  );
}
