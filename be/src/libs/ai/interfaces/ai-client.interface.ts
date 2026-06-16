// Изображение для мультимодального запроса (опционально — может не быть ни одного)
export interface AiImage {
  data: Buffer;
  mimeType: string;
}

// Generic запрос к LLM. Domain-agnostic: ничего не знает про предметную область.
export interface AiCompleteInput {
  // системная инструкция (опционально)
  system?: string;
  // пользовательский промпт
  prompt: string;
  // картинки — опциональны: без них это обычный текстовый запрос, можно несколько
  images?: AiImage[];
  // запросить ответ строго JSON-объектом (response_format), если провайдер умеет
  json?: boolean;
  // 0..1, дефолт на стороне адаптера
  temperature?: number;
  // переопределить дефолтную модель на этот конкретный вызов
  model?: string;
}

// Порт: домен зависит от этой абстракции, конкретный адаптер встаёт по AI_PROVIDER.
export interface AiClient {
  // возвращает сырой текст ответа модели (вызывающий парсит сам)
  complete(input: AiCompleteInput): Promise<string>;
}
