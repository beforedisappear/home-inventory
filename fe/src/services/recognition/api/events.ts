import { createSseConnection } from '@/shared/lib/sse';

export interface RecognitionSseEvent {
  recognitionId: string;
  status: 'ready' | 'failed';
}

type Listener = (event: RecognitionSseEvent) => void;

const connection = createSseConnection<RecognitionSseEvent>({
  name: 'recognition-events',
  endpoint: '/api/v1/recognitions/events',
  eventName: 'recognition',
});

export function onRecognitionEvent(listener: Listener): () => void {
  return connection.subscribe(listener);
}
