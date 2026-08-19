import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController, AppController, PublicController } from './app.controller';
import { AppService } from './app.service';
import { AuthService, JwtGuard } from './auth/auth';
import { validateEnv } from './config';
import { entities } from './domain/entities';
import { PIPELINE_QUEUE, PipelineProcessor, TaskService } from './pipeline/pipeline';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        url: process.env.DATABASE_URL,
        entities,
        synchronize: process.env.DATABASE_SYNC === 'true',
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature(entities),
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL } }),
    BullModule.registerQueue({ name: PIPELINE_QUEUE }),
    JwtModule.register({ global: true }),
  ],
  controllers: [AuthController, AppController, PublicController],
  providers: [AppService, AuthService, JwtGuard, TaskService, PipelineProcessor],
})
export class AppModule {}
