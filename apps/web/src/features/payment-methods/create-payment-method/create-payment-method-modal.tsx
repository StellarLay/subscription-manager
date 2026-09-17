import {
  ApiError,
  CreatePaymentMethodBody,
  CreatePaymentMethodDtoType,
  type CreatePaymentMethodDto,
  type PaymentMethodResponseDto,
  useCreatePaymentMethod,
} from '@subscription-manager/api-client';
import {
  Alert,
  Button,
  ColorInput,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCreditCard, IconPlus } from '@tabler/icons-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import classes from './create-payment-method-modal.module.css';

interface CreatePaymentMethodModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (paymentMethod: PaymentMethodResponseDto) => void;
}

const paymentMethodTypes = [
  { label: 'Банковская карта', value: CreatePaymentMethodDtoType.CARD },
  { label: 'Банковский счёт', value: CreatePaymentMethodDtoType.BANK_ACCOUNT },
  { label: 'Электронный кошелёк', value: CreatePaymentMethodDtoType.WALLET },
  { label: 'Другое', value: CreatePaymentMethodDtoType.OTHER },
];

const paymentMethodColors = ['#73ff5b', '#5bd8ff', '#6559e8', '#ff9b66', '#ff6b8a', '#e8eaf0'];

export function CreatePaymentMethodModal({
  opened,
  onClose,
  onCreated,
}: CreatePaymentMethodModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', undefined, {
    getInitialValueInEffect: false,
  });
  const { trigger, isMutating } = useCreatePaymentMethod();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreatePaymentMethodDto>({
    resolver: zodResolver(CreatePaymentMethodBody),
    defaultValues: {
      name: '',
      type: CreatePaymentMethodDtoType.CARD,
      color: paymentMethodColors[0],
    },
  });

  const close = () => {
    if (isMutating) return;
    reset();
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    try {
      const paymentMethod = await trigger(values);

      onCreated(paymentMethod);
      notifications.show({
        color: 'signal',
        message: `${paymentMethod.name} добавлен`,
        title: 'Способ оплаты сохранён',
      });
      reset();
      onClose();
    } catch (error) {
      setError('root', {
        message: error instanceof ApiError ? error.message : 'Не удалось сохранить способ оплаты.',
      });
    }
  });

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
      fullScreen={isMobile}
      onClose={close}
      opened={opened}
      overlayProps={{ backgroundOpacity: isMobile ? 1 : 0.86, color: '#07090d' }}
      radius="xl"
      size="md"
      title={
        <div>
          <Text className={classes.kicker}>Новый способ оплаты</Text>
          <Text className={classes.heading}>Добавить карту или кошелёк</Text>
        </div>
      }
      transitionProps={{ transition: isMobile ? 'slide-up' : 'pop' }}
      zIndex={400}
    >
      <form onSubmit={(event) => void submit(event)}>
        <Stack gap="md">
          <TextInput
            autoFocus
            error={errors.name ? 'Укажи понятное название' : undefined}
            label="Название"
            leftSection={<IconCreditCard size={17} />}
            placeholder="Например, Тинькофф Black"
            size="md"
            withAsterisk
            {...register('name')}
          />

          <Controller
            control={control}
            name="type"
            render={({ field, fieldState }) => (
              <Select
                allowDeselect={false}
                comboboxProps={{ transitionProps: { duration: 0 }, withinPortal: false }}
                data={paymentMethodTypes}
                error={fieldState.error ? 'Выбери тип' : undefined}
                label="Тип"
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
            name="lastFour"
            render={({ field, fieldState }) => (
              <TextInput
                error={fieldState.error ? 'Нужны ровно 4 цифры' : undefined}
                inputMode="numeric"
                label="Последние 4 цифры"
                maxLength={4}
                onBlur={field.onBlur}
                onChange={(event) => {
                  const value = event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
                  field.onChange(value || undefined);
                }}
                placeholder="4242"
                size="md"
                value={field.value ?? ''}
              />
            )}
          />

          <Controller
            control={control}
            name="color"
            render={({ field, fieldState }) => (
              <ColorInput
                closeOnColorSwatchClick
                disallowInput
                error={fieldState.error ? 'Выбери цвет' : undefined}
                format="hex"
                label="Цвет"
                onBlur={field.onBlur}
                onChange={field.onChange}
                popoverProps={{ transitionProps: { duration: 0 }, withinPortal: false }}
                size="md"
                swatches={paymentMethodColors}
                value={field.value}
                withEyeDropper={false}
              />
            )}
          />

          <Text className={classes.securityNote}>
            Полный номер карты и CVV не нужны. Сохраняем только безопасное описание.
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
              leftSection={<IconPlus size={17} />}
              loading={isMutating}
              radius="xl"
              type="submit"
            >
              Добавить
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
