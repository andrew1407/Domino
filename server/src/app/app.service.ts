import { Injectable } from '@nestjs/common';
import commands from './commands.json' with { type: 'json' };

@Injectable()
export default class AppService {
  private readonly commandsStringified: string = JSON.stringify(commands);

  public async getCommands(): Promise<string> {
    return this.commandsStringified;
  }
}
