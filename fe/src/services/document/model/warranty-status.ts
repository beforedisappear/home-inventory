const DAY_MS = 24 * 60 * 60 * 1000;

// null — гарантии нет, ничего не подсвечиваем. ≤7 дней (включая просроченную)
// — красный, ≤30 — жёлтый, дальше — обычный цвет текста (undefined class)
export function getWarrantyColorClass(
  warrantyEndsAt: string | null,
): string | undefined {
  if (!warrantyEndsAt) return undefined;

  const daysLeft = (new Date(warrantyEndsAt).getTime() - Date.now()) / DAY_MS;

  if (daysLeft <= 7) return 'text-danger';
  if (daysLeft <= 30) return 'text-warning';

  return undefined;
}
