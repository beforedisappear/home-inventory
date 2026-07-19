export const buildItemsByContainerKey = (containerId: string) =>
  ['items', 'by-container', containerId] as const;
