import 'reflect-metadata';

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from '../src/app.module';
import { configureApplication, createOpenApiDocument } from '../src/bootstrap';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });

  configureApplication(app);

  const document = createOpenApiDocument(app);
  const outputPath = resolve(process.cwd(), '../../packages/api-client/openapi.json');

  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log('OpenAPI document generated.');
  process.exit(0);
}

generateOpenApi().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
