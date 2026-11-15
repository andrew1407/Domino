import AppController from '../app.controller.js';
import AppService from '../app.service.js';
import commands from '../commands.json' with { type: 'json' };

describe('getCommandsList', (): void => {
  const controller: AppController = new AppController(new AppService());
  it('sould resolve commands in JSON format', async (): Promise<void> => {
    const expected: string = JSON.stringify(commands);
    await expect(controller.getCommandsList()).resolves
      .toEqual(expected);
  });
});
