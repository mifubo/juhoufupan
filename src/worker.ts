import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  console.log(JSON.stringify({ level: 'info', service: 'worker', message: 'worker started' }));
}
void bootstrap();
