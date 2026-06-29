/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface ApiRegistry {}

export type ApiPaths = ApiRegistry extends { paths: infer P extends {} }
  ? P
  : {};
