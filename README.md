# AirTab Web

Веб-версия AirTab для деплоя на GitHub Pages.

## Что внутри
- `index.html` — основное приложение AirTab
- `options/index.html` — настройки/синхронизация/импорт
- `options.html` — обратная совместимость (редирект на `/options/`)
- `oauth/dropbox-callback.html` — callback для Dropbox OAuth (web flow)
- `sw.js` + `manifest.webmanifest` — PWA-кэш и офлайн-оболочка

## Локальный запуск
Нужен HTTP-сервер (не `file://`):

```bash
cd AirTab_web
python3 -m http.server 8080
```

Открыть:
- `http://localhost:8080/`
- `http://localhost:8080/options/`

## Деплой на GitHub Pages
1. Создай репозиторий (например `airtab-web`).
2. Залей содержимое папки `AirTab_web` в корень репозитория.
3. В GitHub: `Settings → Pages`.
4. Source: `Deploy from a branch`, branch: `main`, folder: `/ (root)`.
5. После публикации сайт будет вида:
   - `https://<username>.github.io/airtab-web/`

## Dropbox OAuth настройка
В Dropbox App Console добавь Redirect URI:
- `https://<username>.github.io/airtab-web/oauth/dropbox-callback.html`

Важно:
- URI должен совпадать **буква в букву**.
- Если имя репозитория или username изменятся, обнови Redirect URI.

## Примечание по синхронизации
- Отправка: автоматически при изменениях.
- Получение: при открытии/обновлении вкладки AirTab и при возврате фокуса/online.
