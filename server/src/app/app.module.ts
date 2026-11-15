import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import config from '../envConfig.js';
import GameSessionModule from '../gameSession/gameSession.module.js';
import AppController from './app.controller.js';
import AppService from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config]
    }),
    GameSessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export default class AppModule {}
