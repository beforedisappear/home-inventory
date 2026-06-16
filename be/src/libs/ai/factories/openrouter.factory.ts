import { ConfigService } from '@nestjs/config';

import { OpenRouterAiAdapter } from '../adapters/openrouter-ai.adapter';
import type { AiClient } from '../interfaces/ai-client.interface';

export function openRouterFactory(config: ConfigService): AiClient {
  return new OpenRouterAiAdapter({
    apiKey: config.getOrThrow<string>('OPENROUTER_API_KEY'),
    baseURL: config.getOrThrow<string>('OPENROUTER_BASE_URL'),
    model: config.getOrThrow<string>('OPENROUTER_MODEL'),
  });
}
