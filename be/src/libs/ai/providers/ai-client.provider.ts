import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MockAiAdapter } from '../adapters/mock-ai.adapter';
import { AI_CLIENT } from '../constants/di';
import { openRouterFactory } from '../factories/openrouter.factory';
import { type AiClient } from '../interfaces/ai-client.interface';

// Фабрика порта AiClient: по AI_PROVIDER подбирает адаптер.
// Дефолт — mock (без ключей, для локалки/тестов).
export const AiClientProvider: Provider = {
  provide: AI_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): AiClient => {
    const provider = config.get<string>('AI_PROVIDER') ?? 'mock';
    const logger = new Logger('AiClientProvider');

    switch (provider) {
      case 'openrouter':
        logger.log('ai provider: openrouter');
        return openRouterFactory(config);

      case 'mock':
        logger.log('ai provider: mock');
        return new MockAiAdapter();

      default:
        logger.warn(`unknown AI_PROVIDER "${provider}", falling back to mock`);
        return new MockAiAdapter();
    }
  },
};
