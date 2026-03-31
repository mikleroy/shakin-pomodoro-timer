# CLAUDE.md

Этот файл содержит инструкции для Claude Code (claude.ai/code) при работе с кодом в этом репозитории.

## Обзор проекта

Chrome Extension (Manifest V3) — таймер Помодоро с историей в виде тепловой карты и опциональной синхронизацией через GitHub Gist. Без системы сборки, без зависимостей — чистый vanilla JS/HTML/CSS, загружаемый напрямую Chrome.

## Установка / Запуск

Шаг сборки отсутствует. Загрузить как распакованное расширение:
1. Открыть `chrome://extensions/`
2. Включить "Режим разработчика"
3. "Загрузить распакованное" → выбрать эту папку

После редактирования файлов: нажать иконку обновления на карточке расширения в `chrome://extensions/`.

## Архитектура

**Три отдельных JS-контекста** — они не могут разделять переменные, общение только через передачу сообщений и Chrome Storage:

| Файл | Контекст | Роль |
|------|---------|------|
| `background.js` | Service Worker | Логика таймера, рендеринг иконки, alarms, синхронизация с Gist |
| `popup.js` | Страница popup | Контроллер UI, опрос состояния, тепловая карта, настройки |
| `notify.js` | Окно уведомлений | Запрос по окончании цикла (кнопки отдыха/продолжения) |

### Коммуникация между контекстами

- `popup.js` → `background.js`: `chrome.runtime.sendMessage({ cmd: 'START' | 'PAUSE' | 'RESUME' | 'RESET' | 'GET_STATE' | ... })`
- `background.js` → `popup.js`: ответ на `GET_STATE` + `chrome.runtime.sendMessage` для оверлея по окончании цикла
- `notify.js` ↔ `background.js`: через `chrome.storage.local` (ключ `pendingCmd`) + слушатель `chrome.storage.onChanged`

### Поток состояния таймера

```
popup.js отправляет START
  → background.js записывает timerState { phase, startedAt, paused } в chrome.storage.session
  → chrome.alarms.create('tick', { periodInMinutes: 1 })
  → updateIcon() вызывается каждую секунду через chrome.alarms (приблизительно) + по сообщению
  → popup.js опрашивает GET_STATE каждую секунду, вычисляет remaining = workMinutes*60 - elapsed
  → когда remaining ≤ 0: handleCycleEnd() → recordPomodoro() → syncToGist() → уведомление
```

### Схема хранилища

```
chrome.storage.session:  timerState { phase, startedAt, pausedAt, paused }
chrome.storage.local:
  history:      { "YYYY-MM-DD": count, ... }   // даты UTC
  timestamps:   [unix_ms, ...]                  // для аналитики по дням недели
  workMinutes, breakMinutes                     // по умолчанию 25, 5
  appLang, appTheme, colorScheme, invertScheme  // настройки UI
  githubToken, gistId                           // опциональная синхронизация с Gist
```

### Рендеринг иконки

`background.js` использует `OffscreenCanvas` для динамической отрисовки иконки на панели инструментов:
- Изображение помидора с радиальным градиентом и бликом (`drawTomato()`)
- Дуга прогресса (по часовой стрелке от 12 часов) на основе `getRemainingSeconds()`
- Наложение текста MM:SS
- Наложение паузы (затемнение + полосы) при паузе
- Fallback на badge-only, если OffscreenCanvas недоступен

### Уровни нагрева тепловой карты (popup.js)

```
0 = 0 помодоро     3 = 4–5 помодоро
1 = 1 помодоро     4 = 6–8 помодоро
2 = 2–3 помодоро   5 = 9+ помодоро
```

CSS custom properties `--heat-0` до `--heat-5` управляют цветами по схеме (green/orange/red/ocean) с опциональной инверсией.

## Ключевые особенности реализации

- **Точность таймера**: и background, и popup независимо вычисляют `remaining` из метки `startedAt` через `Date.now()` — без накопления погрешности
- **Alarms срабатывают каждую минуту**, а не каждую секунду — alarm только определяет окончание цикла; посекундные обновления приходят от опроса в popup
- **Даты UTC**: ключи истории — `new Date().toISOString().split('T')[0]` — всегда UTC
- **GitHub Gist sync**: перечисляет gists → находит `pomodoro-history.json` → POST (создание) или PATCH (обновление); автоматически создаёт приватный gist при первой синхронизации
- **`fillTestHistory()`** в popup.js генерирует 4 месяца реалистичных тестовых данных — полезно для разработки UI
- **Поток уведомлений**: системное уведомление (всегда) + оверлей в popup через `sendMessage` (только если popup открыт); окно notify.html открывается для расширенного взаимодействия
