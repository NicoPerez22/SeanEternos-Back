import { config } from 'dotenv';
import { resolveEnvFilePath } from './config/resolve-env-file';
config({ path: resolveEnvFilePath() });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true, // refleja el Origin que llega
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    credentials: false,
    optionsSuccessStatus: 204,
  });

  // const options = new DocumentBuilder()
  //   .setTitle('API - Sean Eternos')
  //   .setVersion('1.0')
  //   .build();
  // const document = SwaggerModule.createDocument(app, options);
  // SwaggerModule.setup('api', app, document);

  app.setGlobalPrefix('api/v1');
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
