import type { components } from '@/kernel/api/schema';

type ContainerKind = components['schemas']['ContainerResponseDto']['kind'];
type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

// та же фильтрация, что backend делает в assertPlacementAllowed — только для UX,
// backend всё равно валидирует на create
export function getAllowedKinds(
  parentKind: ContainerKind,
  rule: ContainerRuleResponseDto | null,
): NonNullable<ContainerKind>[] {
  if (!rule) return ['room', 'cabinet', 'drawer', 'box', 'bag'];

  return rule.kindRules
    .filter(kindRule =>
      parentKind
        ? kindRule.allowedParents.includes(parentKind)
        : kindRule.canBeInsideRoot,
    )
    .map(kindRule => kindRule.kind);
}
