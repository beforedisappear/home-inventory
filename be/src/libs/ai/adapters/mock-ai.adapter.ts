import { Logger } from '@nestjs/common';

import type {
  AiClient,
  AiCompleteInput,
} from '../interfaces/ai-client.interface';

export class MockAiAdapter implements AiClient {
  private readonly logger = new Logger(MockAiAdapter.name);

  complete(input: AiCompleteInput): Promise<string> {
    const msg = `mock complete: prompt=${input.prompt.length} chars, images=${input.images?.length ?? 0}`;

    this.logger.log(msg);

    return Promise.resolve(input.json ? '{}' : '');
  }
}
