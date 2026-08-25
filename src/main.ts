import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common/services/logger.service';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { envs } from './config';

async function bootstrap() {
  // Creating a logger instance to log messages related to the auth microservice
  const logger = new Logger('Auth-Microservice-Main');

  // Creates a microservice instance using NATS transport and the provided options
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: envs.natsServers,
      },
    },
  );

  // Setting up global validation pipes to automatically validate incoming requests based on DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen();

  logger.log('Auth microservice running with NATS transport');
}
void bootstrap();
