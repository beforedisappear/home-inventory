export const buildContainerChildrenKey = (parentId: string | null) =>
  ['container', 'children', parentId] as const;

export const buildContainerByIdKey = (id: string) => ['container', id] as const;

export const buildContainerRuleByIdKey = (id: string) =>
  ['container-rule', id] as const;

export const buildContainerRuleListKey = () =>
  ['container-rule', 'list'] as const;
