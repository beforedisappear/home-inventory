import { Logger } from '@nestjs/common';

import OpenAI from 'openai';

import type {
  AiClient,
  AiCompleteInput,
} from '../interfaces/ai-client.interface';

interface OpenRouterConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export class OpenRouterAiAdapter implements AiClient {
  private readonly logger = new Logger(OpenRouterAiAdapter.name);
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(config: OpenRouterConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.defaultModel = config.model;
  }

  async complete(input: AiCompleteInput): Promise<string> {
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: 'text', text: input.prompt },
    ];

    // картинок может не быть вовсе (текстовый запрос) либо несколько
    for (const img of input.images ?? []) {
      const dataUri = `data:${img.mimeType};base64,${img.data.toString('base64')}`;

      userContent.push({ type: 'image_url', image_url: { url: dataUri } });
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (input.system) messages.push({ role: 'system', content: input.system });

    messages.push({ role: 'user', content: userContent });

    const model = input.model ?? this.defaultModel;

    const completion = await this.client.chat.completions.create({
      model,
      temperature: input.temperature ?? 0.2,
      ...(input.json ? { response_format: { type: 'json_object' } } : {}),
      messages,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) throw new Error('ai model returned empty response');

    this.logger.log(`completed via ${model}`);

    return content;
  }
}
