import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { TournamentModule } from './tournament/tournament.module';
import { TeamModule } from './team/team.module';
import { UploadModule } from './upload/upload.module';
import { PlayerController } from './player/player.controller';
import { PlayerModule } from './player/player.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    TournamentModule,
    TeamModule,
    UploadModule,
    PlayerModule,
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      autoLoadEntities: true,
      extra: {
        connectionLimit: 10, // máximo 10 conexiones vivas
        waitForConnections: true, // no lanzar error, poner en cola
        queueLimit: 0, // sin límite de cola
        connectTimeout: 10000, // 10 segundos
        acquireTimeout: 10000, // timeout para adquirir conexión
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
