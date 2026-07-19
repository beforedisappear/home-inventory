export const buildItemsByContainerKey = (containerId: string) =>
  ['items', 'by-container', containerId] as const;

export const buildItemByIdKey = (id: string) => ['items', 'by-id', id] as const;
