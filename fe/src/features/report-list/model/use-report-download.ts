import { useState } from 'react';

import { getReportByIdRequest } from '@/services/report';

import { toast } from '@/shared/ui';

export function useReportDownload(reportId: string, containerId: string) {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = async () => {
    setIsDownloading(true);

    try {
      const fresh = await getReportByIdRequest(reportId);

      if (!fresh.downloadUrl) throw new Error('Report has no downloadUrl');

      const response = await fetch(fresh.downloadUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `report-${containerId}.pdf`;
      link.click();

      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.danger('Не удалось скачать отчёт');
    } finally {
      setIsDownloading(false);
    }
  };

  return { download, isDownloading };
}
