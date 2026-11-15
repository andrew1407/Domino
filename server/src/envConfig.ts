let envLoaded: boolean = false;

export function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  try {
    process.loadEnvFile();
  } catch {
    // .env file is optional
  }
}

loadEnv();

export default function config(): object {
  return {
    port: parseInt(process.env.PORT, 10) || 8080,
    host: process.env.HOST || 'localhost',
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
  };
}
