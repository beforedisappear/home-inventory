import { tokenStorage } from '@/shared/api/token-storage';
import { env } from '@/shared/config/env';

export interface RecognitionSseEvent {
  recognitionId: string;
  status: 'ready' | 'failed';
}

type Listener = (event: RecognitionSseEvent) => void;

// один shared SSE-коннект на всё приложение, а не по одному на компонент
const listeners = new Set<Listener>();

let abortController: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

// разбирает один SSE-фрейм (event: + data:), интересует только event: recognition
function parseFrame(frame: string): RecognitionSseEvent | null {
  const lines = frame.split('\n');
  const eventLine = lines.find(line => line.startsWith('event:'));
  const dataLine = lines.find(line => line.startsWith('data:'));

  if (!eventLine || !dataLine) return null;
  if (eventLine.slice(6).trim() !== 'recognition') return null;

  try {
    return JSON.parse(dataLine.slice(5).trim()) as RecognitionSseEvent;
  } catch {
    return null;
  }
}

// экспоненциальный backoff: 1с, 2с, 4с... до потолка 30с
function scheduleReconnect(): void {
  if (listeners.size === 0) return;

  const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => void connect(), delay);
}

async function connect(): Promise<void> {
  if (listeners.size === 0) return;

  abortController = new AbortController();

  try {
    const access = tokenStorage.getAccess();

    // ручной fetch вместо EventSource — только так можно послать Bearer-заголовок
    const response = await fetch(`${env.apiUrl}/api/v1/recognitions/events`, {
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      signal: abortController.signal,
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
      // сервер закрыл поток — выходим из цикла, ниже (после catch) сработает reconnect
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // фреймы разделены пустой строкой; последний кусок может быть неполным — оставляем в buffer
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      // разбираем каждый целый фрейм и рассылаем всем подписчикам onRecognitionEvent
      for (const frame of frames) {
        const event = parseFrame(frame);

        if (!event) continue;

        listeners.forEach(listener => listener(event));
      }
    }
  } catch {
    // сеть/abort — игнорируем, reconnect общий для этого и для чистого закрытия потока ниже
  } finally {
    scheduleReconnect();
  }
}

export function onRecognitionEvent(listener: Listener): () => void {
  listeners.add(listener);

  // коннект открываем только на первого подписчика
  if (listeners.size === 1) {
    reconnectAttempt = 0;
    void connect();
  }

  return () => {
    listeners.delete(listener);

    // последний отписался — обрываем fetch и таймер реконнекта, коннект вхолостую не держим
    if (listeners.size === 0) {
      abortController?.abort();
      abortController = null;

      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };
}
