export const CONTAINER_QR_QUEUE = 'container-qr';

export const CONTAINER_QR_GENERATE_JOB = 'generate';

export interface ContainerQrGenerateJobData {
  containerId: string;
  ownerId: string;
}
