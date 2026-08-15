import { createSseConnection } from '@/shared/lib/sse';

export interface ReportSseEvent {
  reportId: string;
  status: 'ready' | 'failed';
}

type Listener = (event: ReportSseEvent) => void;

const connection = createSseConnection<ReportSseEvent>({
  name: 'report-events',
  endpoint: '/api/v1/reports/events',
  eventName: 'report',
});

export function onReportEvent(listener: Listener): () => void {
  return connection.subscribe(listener);
}
