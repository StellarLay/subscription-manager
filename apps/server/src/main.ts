import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { configureApplication, configureSwagger } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  configureApplication(app);
  app.enableShutdownHooks();
  configureSwagger(app);
  app.enableCors({
    credentials: true,
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  });

  const host = process.env.API_HOST ?? '0.0.0.0';
  const port = Number(process.env.API_PORT ?? 3000);

  await app.listen(port, host);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
