import type { SingleTabConnection, SingleTabConnectionOptions } from './types';

export function createSingleTabConnection<T>(
  options: SingleTabConnectionOptions<T>,
): SingleTabConnection<T> {
  const { name, connect } = options;

  // канал для обмена между вкладками одного origin: вкладка-лидер шлёт сюда
  // события, остальные вкладки их отсюда читают
  const channel = new BroadcastChannel(name);
  const listeners = new Set<(event: T) => void>();

  // событие в канал прилетает только в ЧУЖИХ вкладках — своя вкладка-отправитель
  // получает его напрямую в emit() ниже, поэтому здесь только раздача не-лидерам
  channel.onmessage = (event: MessageEvent<T>) => {
    listeners.forEach(listener => listener(event.data));
  };

  let abortController: AbortController | null = null;

  function acquireLeadership(): void {
    // signal нужен, чтобы позже (в releaseLeadership) можно было прервать
    // как ожидание в очереди на лок, так и уже выполняющийся connect()
    abortController = new AbortController();
    const { signal } = abortController;

    void navigator.locks
      // 1. просимся на лок с именем name — если он уже занят другой вкладкой,
      //    браузер сам ставит нас в очередь и ничего не выполняет, пока не подойдёт черёд
      .request(name, { signal }, () =>
        // 2. лок достался нам → мы стали лидером → запускаем connect(),
        //    передавая ему emit — то, как он будет отдавать нам события
        connect(event => {
          // 3a. рассылаем событие всем ОСТАЛЬНЫМ вкладкам через канал
          channel.postMessage(event);
          // 3b. и отдельно — своим собственным локальным слушателям,
          // т.к. свою же отправку BroadcastChannel вкладке не возвращает
          listeners.forEach(listener => listener(event));
        }, signal),
      )
      .catch(() => {
        // сюда попадаем, если запрос на лок или сам connect() был прерван через
        // signal.abort() из releaseLeadership() — ожидаемо, не логируем как ошибку
      });
  }

  function releaseLeadership(): void {
    // если лок ещё не пришёл (мы в очереди) — abort() просто снимает нашу заявку;
    // если лок уже наш — abort() сигналит connect() остановиться, и как только
    // он это сделает, лок освобождается и достаётся следующему в очереди
    abortController?.abort();
    abortController = null;
  }

  return {
    subscribe(listener: (event: T) => void): () => void {
      // 1. запоминаем слушателя локально — ему в любом случае будем
      // отдавать события, независимо от того, лидер эта вкладка или нет
      listeners.add(listener);

      // 2. первый локальный слушатель в этой вкладке → вкладка ещё не
      // в очереди на лок → входим в очередь; если слушатель не первый,
      // вкладка уже либо лидер, либо ждёт своей очереди — ничего не делаем
      if (listeners.size === 1) acquireLeadership();

      return () => {
        // 3. отписка: убираем слушателя из локального набора
        listeners.delete(listener);

        // 4. если это был последний локальный слушатель — эта вкладка
        // больше никому не нужна как получатель событий, выходим из
        // очереди/отдаём лидерство дальше
        if (listeners.size === 0) releaseLeadership();
      };
    },
  };
}
