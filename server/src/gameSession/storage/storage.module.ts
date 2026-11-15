import { DynamicModule, Module, Provider } from '@nestjs/common';
import { REDIS_CLIENT, STORAGE_CLIENT } from './storage.options.js';
import StorageService from './storage.service.js';

type RedisOptions = {
  useFactory: (...args: unknown[]) => unknown;
  inject: any[];
};

@Module({})
export default class StorageModule {
  public static register(options?: RedisOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        Object.assign({ provide: REDIS_CLIENT }, options ? {
          inject: options.inject,
          useFactory: async (...args: unknown[]) => {
            const clientOptions = options.useFactory(...args);
            const client = StorageService.client(clientOptions);
            await client.connect();
            return client;
          }
        } : {
          useValue: StorageService.client(),
        }) as Provider,
        { provide: STORAGE_CLIENT, useClass: StorageService },
      ],
      exports: [{ provide: STORAGE_CLIENT, useClass: StorageService }],
    };
  }

  public static forRoot(options?: RedisOptions): DynamicModule {
    return { ...StorageModule.register(options), global: true };
  } 
}
