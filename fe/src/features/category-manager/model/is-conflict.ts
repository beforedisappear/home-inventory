export function isConflict(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'statusCode' in err &&
    (err as { statusCode?: number }).statusCode === 409
  );
}
