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
import { PlayerModule } from './player/player.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { resolveEnvFilePath } from './config/resolve-env-file';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePath(),
    }),
    UserModule,
    AuthModule,
    TournamentModule,
    TeamModule,
    UploadModule,
    PlayerModule,
    DashboardModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQLHOST,
      port: Number(process.env.MYSQLPORT || 3306),
      username: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
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
