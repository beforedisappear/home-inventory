import type { paths } from './schema';

// мерджим инстанс openapi-fetch с бизнесовыми типами
declare module '@/shared/api/registry' {
  interface ApiRegistry {
    paths: paths;
  }
}
