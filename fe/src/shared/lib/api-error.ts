export function isStatusCode(err: unknown, code: number): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'statusCode' in err &&
    (err as { statusCode?: number }).statusCode === code
  );
}
