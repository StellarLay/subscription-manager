import {
  ApiError,
  type CategoryResponseDto,
  CreateCategoryBody,
  CreateCategoryDtoIcon,
  type CreateCategoryDto,
  useCreateCategory,
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
import { IconAlertCircle, IconPlus, IconTag } from '@tabler/icons-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import classes from './create-category-modal.module.css';

interface CreateCategoryModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (category: CategoryResponseDto) => void;
}

const categoryIconOptions = [
  { label: 'Облака и сервисы', value: CreateCategoryDtoIcon.CLOUD },
  { label: 'Развлечения', value: CreateCategoryDtoIcon.ENTERTAINMENT },
  { label: 'Работа', value: CreateCategoryDtoIcon.WORK },
  { label: 'Образование', value: CreateCategoryDtoIcon.EDUCATION },
  { label: 'Финансы', value: CreateCategoryDtoIcon.FINANCE },
  { label: 'Здоровье', value: CreateCategoryDtoIcon.HEALTH },
  { label: 'Другое', value: CreateCategoryDtoIcon.OTHER },
];

const categoryColors = [
  '#73ff5b',
  '#5bd8ff',
  '#6559e8',
  '#ff9b66',
  '#ff6b8a',
  '#f3c969',
  '#e8eaf0',
];

export function CreateCategoryModal({ opened, onClose, onCreated }: CreateCategoryModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', undefined, {
    getInitialValueInEffect: false,
  });
  const { trigger, isMutating } = useCreateCategory();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateCategoryDto>({
    resolver: zodResolver(CreateCategoryBody),
    defaultValues: {
      name: '',
      color: categoryColors[1],
      icon: CreateCategoryDtoIcon.OTHER,
    },
  });

  const close = () => {
    if (isMutating) return;
    reset();
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    try {
      const category = await trigger(values);

      onCreated(category);
      notifications.show({
        color: 'signal',
        message: `${category.name} добавлена`,
        title: 'Категория создана',
      });
      reset();
      onClose();
    } catch (error) {
      setError('root', {
        message: error instanceof ApiError ? error.message : 'Не удалось создать категорию.',
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
          <Text className={classes.kicker}>Новая категория</Text>
          <Text className={classes.heading}>Организовать подписки</Text>
        </div>
      }
      transitionProps={{ transition: isMobile ? 'slide-up' : 'pop' }}
      zIndex={400}
    >
      <form onSubmit={(event) => void submit(event)}>
        <Stack gap="md">
          <TextInput
            autoFocus
            error={errors.name ? 'Укажи название категории' : undefined}
            label="Название"
            leftSection={<IconTag size={17} />}
            placeholder="Например, Развлечения"
            size="md"
            withAsterisk
            {...register('name')}
          />

          <Controller
            control={control}
            name="icon"
            render={({ field, fieldState }) => (
              <Select
                allowDeselect={false}
                comboboxProps={{ transitionProps: { duration: 0 }, withinPortal: false }}
                data={categoryIconOptions}
                error={fieldState.error ? 'Выбери иконку' : undefined}
                label="Иконка"
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
                swatches={categoryColors}
                value={field.value}
                withEyeDropper={false}
              />
            )}
          />

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
