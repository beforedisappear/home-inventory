import { createSingleTabConnection } from '@/shared/lib/single-tab-connection';

import { tokenStorage } from '@/shared/api/token-storage';
import { env } from '@/shared/config/env';

// разбирает один SSE-фрейм (event: + data:), интересует только фрейм с
// заданным именем события — остальные (напр. heartbeat event: ping) отсекаем
function parseFrame<T>(frame: string, eventName: string): T | null {
  const lines = frame.split('\n');
  const eventLine = lines.find(line => line.startsWith('event:'));
  const dataLine = lines.find(line => line.startsWith('data:'));

  if (!eventLine || !dataLine) return null;
  if (eventLine.slice(6).trim() !== eventName) return null;

  try {
    return JSON.parse(dataLine.slice(5).trim()) as T;
  } catch {
    return null;
  }
}

// ждёт delay мс, но выходит раньше, если signal прервали — иначе вкладка,
// у которой только что отписался последний слушатель, держала бы лок ещё
// до 30с (потолок backoff) вместо немедленного освобождения
function sleep(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delay);

    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

interface CreateSseConnectionOptions {
  name: string;
  endpoint: string;
  eventName: string;
}

export function createSseConnection<T>(options: CreateSseConnectionOptions) {
  const { name, endpoint, eventName } = options;

  async function connect(
    emit: (event: T) => void,
    signal: AbortSignal,
  ): Promise<void> {
    let reconnectAttempt = 0;

    while (!signal.aborted) {
      try {
        const access = tokenStorage.getAccess();

        // ручной fetch вместо EventSource — только так можно послать Bearer-заголовок
        const response = await fetch(`${env.apiUrl}${endpoint}`, {
          headers: access ? { Authorization: `Bearer ${access}` } : {},
          signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        reconnectAttempt = 0;

        // ридер сырых байт тела ответа (chunked, соединение держится открытым)
        const reader = response.body.getReader();
        // байты → текст; stream:true — на случай если UTF-8-символ разрезан между чанками
        const decoder = new TextDecoder();
        // текст, накопленный с прошлой итерации, но ещё не сложившийся в целый фрейм
        let buffer = '';

        // цикл живёт, пока сервер не закроет соединение (done:true) или не прилетит abort
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // фреймы разделены пустой строкой; последний кусок может быть неполным — оставляем в buffer
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const event = parseFrame<T>(frame, eventName);

            if (event) emit(event);
          }
        }
      } catch {
        // сеть/abort — игнорируем, ниже либо выходим (abort), либо уходим в backoff
      }

      if (signal.aborted) return;

      // экспоненциальный backoff: 1с, 2с, 4с... до потолка 30с
      const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
      reconnectAttempt += 1;

      try {
        await sleep(delay, signal);
      } catch {
        return; // abort прилетел во время ожидания — выходим сразу, без реконнекта
      }
    }
  }

  return createSingleTabConnection<T>({ name, connect });
}
