import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

const DEMO_USER_EMAIL = 'demo@subscription-manager.local';

@Injectable()
export class CurrentUserService {
  constructor(private readonly prisma: PrismaService) {}

  async getId(): Promise<string> {
    const user = await this.prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: {},
      create: {
        email: DEMO_USER_EMAIL,
        displayName: 'Demo User',
      },
      select: { id: true },
    });

    return user.id;
  }
}
