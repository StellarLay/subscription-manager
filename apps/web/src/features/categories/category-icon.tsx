import {
  IconBriefcase,
  IconCloud,
  IconDeviceGamepad2,
  IconHeartbeat,
  IconPigMoney,
  IconSchool,
  IconTag,
  type IconProps,
} from '@tabler/icons-react';

interface CategoryIconProps extends IconProps {
  icon: string;
}

const categoryIcons = {
  CLOUD: IconCloud,
  EDUCATION: IconSchool,
  ENTERTAINMENT: IconDeviceGamepad2,
  FINANCE: IconPigMoney,
  HEALTH: IconHeartbeat,
  OTHER: IconTag,
  WORK: IconBriefcase,
};

export function CategoryIcon({ icon, ...props }: CategoryIconProps) {
  const Icon = categoryIcons[icon as keyof typeof categoryIcons] ?? IconTag;

  return <Icon {...props} />;
}
