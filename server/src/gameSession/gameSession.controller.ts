import { BadRequestException, Body, Controller, DefaultValuePipe, Get, HttpCode, HttpStatus, InternalServerErrorException, ParseIntPipe, Post, Query } from '@nestjs/common';
import GameSessionGateway from './gameSession.gateway.js';
import GameSessionError from './wsTools/GameSessionError.js';

@Controller('domino-session')
export default class GameSessionController {
  constructor(private readonly gateway: GameSessionGateway) {}

  @Get()
  @HttpCode(HttpStatus.CREATED)
  public makeSessionUsingQuery(
    @Query('players', ParseIntPipe) players: number,
    @Query('score', ParseIntPipe) score: number,
    @Query('bots', new DefaultValuePipe(0), ParseIntPipe) bots: number
  ): Promise<string> {
    return this.makeSession(players, score, bots);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public makeSessionUsingBody(
    @Body('players', ParseIntPipe) players,
    @Body('score', ParseIntPipe) score,
    @Body('bots', new DefaultValuePipe(0), ParseIntPipe) bots
  ): Promise<string> {
    return this.makeSession(players, score, bots);
  }

  private async makeSession(players: number, score: number, bots: number = 0): Promise<string> {
    try {
      const sessionId: string = await this.gateway.newSession(players, score, bots);
      return sessionId;
    } catch(e) {
      throw e instanceof GameSessionError ?
        new BadRequestException(e.message) :
        new InternalServerErrorException(e.message);
    }
  }
}
