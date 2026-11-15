import { httpUrl } from '../../config/server';

export const loadCommandsList = async () => {
  const response = await fetch(httpUrl('/'));
  if (response.ok) return response.text();
  const { message = 'some error occured' } = await response.json().catch(() => ({}));
  throw new Error(message);
};

export const pingServer = async (timeout = 2500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(httpUrl('/'), { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};
