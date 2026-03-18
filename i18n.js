(() => {
  const STORAGE_KEY = 'airtabUiLanguage';
  const STORAGE_TS_KEY = 'airtabUiLanguageUpdatedAt';
  const SUPPORTED = ['auto', 'ru', 'en', 'es', 'pt-BR', 'zh-CN', 'hi', 'ar'];

  const LANGUAGE_LABELS = {
    ru: 'Русский',
    en: 'English',
    es: 'Español',
    'pt-BR': 'Português (Brasil)',
    'zh-CN': '中文 (简体)',
    hi: 'हिन्दी',
    ar: 'العربية'
  };

  const I18N = {
    ru: {
      autoBrowser: 'Авто (язык браузера)',
      settings: 'Настройки',
      search: 'Поиск',
      spaces: 'Пространства',
      theme: 'Тема',
      backup: 'Резерв',
      apply: 'Применить',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      edit: 'Редактировать',
      addShortcut: 'Добавить ярлык',
      addFolder: 'Добавить папку',
      selectedCount: '{count} выбрано',
      openTabs: 'Открыть вкладки',
      clear: 'Снять',
      interfaceLanguage: 'Язык интерфейса',
      interfaceLanguageHint: 'Выберите язык UI. Авто использует язык браузера.',
      openAirTab: 'Открыть AirTab',
      searchEngines: 'Поисковые системы',
      addSearchEngine: 'Добавить поисковик',
      backupCopy: 'Резервная копия',
      downloadJson: 'Скачать (.json)',
      uploadFile: 'Загрузить файл',
      performanceMode: 'Режим производительности',
      balancedMode: 'Сбалансированный',
      ecoMode: 'Эко (меньше эффектов)',
      dynamicDebugPanel: 'Показ DND debug-панели',
      importBookmarks: 'Импорт закладок',
      chooseFile: 'Выбрать файл',
      targetSpace: 'Целевое пространство',
      importMode: 'Режим импорта',
      smartRecommended: 'Умный (рекомендуется)',
      spacesAsNew: 'Как новые пространства',
      linksInSpace: 'Как ярлыки в выбранном пространстве',
      noFileSelected: 'Файл не выбран (.html, .htm, .json)',
      importBookmarksAction: 'Импортировать закладки',
      fileNotLinked: 'Файл не привязан.',
      googleNotConnected: 'Google Drive не подключен.',
      add: 'Добавить',
      shortcut: 'Ярлык',
      folder: 'Папка',
      name: 'Название',
      addToStart: 'Добавить на стартовую',
      airtabOptions: 'Параметры AirTab',
      siteUrl: 'URL сайта',
      customIconUrl: 'URL своей иконки (необязательно)',
      leaveEmptyAuto: 'Оставьте пустым для авто',
      moveOutFolder: 'Вынести из папки',
      gridView: 'Сетка',
      listView: 'Список',
      previousSpace: 'Предыдущее пространство',
      nextSpace: 'Следующее пространство',
      addSpace: 'Добавить пространство',
      editSpace: 'Редактировать пространство',
      newSpace: 'Новое пространство',
      newSpaceFromFolder: 'Новое пространство из папки',
      removeSpace: 'Удалить пространство',
      close: 'Закрыть',
      editFolder: 'Редактировать папку',
      nameEmoji: 'Название и эмодзи',
      gradient: 'Градиент',
      color1: 'Цвет 1',
      color2: 'Цвет 2',
      angle: 'Угол',
      resetGradient: 'Сбросить градиент',
      removeEmoji: 'Убрать эмодзи',
      emojiNotFound: 'Ничего не найдено',
      searchEmoji: 'Поиск эмодзи',
      leftSidebar: 'Левая',
      rightSidebar: 'Правая',
      openTabsConfirm: 'Открыть {count} вкладок?',
      folderWithName: 'Папка: {name}',
      itemFallbackName: 'Элемент',
      deleteSelectedConfirm: 'Удалить выбранные элементы ({count})?',
      deleteSpaceWithItems: 'Удалить пространство {title} и {count} элементов?',
      deleteSpaceOnly: 'Удалить пространство {title}?',
      deleteFolderWithItems: 'Удалить папку {title} и {count} элементов?',
      deleteFolderOnly: 'Удалить папку {title}?',
      thisSpace: 'это пространство',
      thisFolder: 'эту папку',
      atLeastOneSpace: 'Должно остаться хотя бы одно пространство.',
      atLeastOneEngine: 'Должен остаться хотя бы один поисковик!',
      dataUrlDisabled: 'Data URL для фона отключён. Используйте URL/цвет или привязку локального файла.',
      bgApplyFailed: 'Ошибка: не удалось применить выбранный фон.',
      localFilePickerUnsupported: 'Браузер не поддерживает выбор локального файла по ссылке.',
      localFileAccessDenied: 'Нет доступа к выбранному файлу.',
      localFileAttachFailed: 'Не удалось привязать локальный файл.',
      localFileLinkedSaved: 'Локальный файл привязан и сохранён (файл: {fileName}).',
      localBgFileMissing: 'Файл для локального фона не найден. Выберите его снова.',
      localBgSavedFallback: 'Локальный фон сохранён в fallback-режиме.',
      reloadSuccess: 'Успешно! Страница будет перезагружена.',
      importErrorBadFile: 'Ошибка! Неверный файл.',
      backupDownloaded: 'Резервная копия скачана.',
      backupRestored: 'Резерв восстановлен.',
      backupRestoredAndDropboxSynced: 'Резерв восстановлен и отправлен в Dropbox.',
      backupRestoredDropboxSyncFailed: 'Резерв восстановлен, но отправка в Dropbox не удалась: {error}',
      backupRestoredAndDropboxSyncedReload: 'Резерв восстановлен и отправлен в Dropbox. Страница будет перезагружена.',
      backupRestoredDropboxSyncFailedReload: 'Резерв восстановлен, но отправка в Dropbox не удалась: {error}. Страница будет перезагружена.',
      backupImportBadFile: 'Ошибка импорта: неверный файл.',
      bookmarkParseError: 'Не удалось распознать файл закладок. Поддерживаются HTML/JSON.',
      addedSuccess: '✓ Успешно добавлено!',
      manageSearchThemeBackup: 'Управление поиском, темой и резервной копией в отдельной вкладке.',
      searchUrlWithQueryTail: 'Поисковый URL (с хвостом запроса)',
      iconUrl: 'URL иконки',
      lightThemeBg: 'Фон светлой темы (URL или цвет)',
      darkThemeBg: 'Фон тёмной темы (URL или цвет)',
      bindLocalFile: 'Привязать локальный файл',
      localBindHint: 'Кнопка выбора файла привязывает файл по ссылке без загрузки картинки в localStorage.',
      spaceBgPriorityHint: 'Важно: если у пространства задан свой фон, он перекрывает глобальный фон темы.',
      dndDebugHint: 'Отключайте в обычной работе. Включайте только для диагностики drag-and-drop.',
      exportAllHint: 'Экспортируются все данные AirTab: пространства, папки, ярлыки, панели, поисковики, фоны, режим производительности и DND debug.',
      syncSection: 'Синхронизация',
      syncModePrompt: 'Выберите режим синхронизации:',
      syncModeDropbox: 'Dropbox',
      syncModeLocal: 'Локальный файл',
      syncAutoHint: 'Автосинхронизация включена: изменения отправляются сразу, получение — при открытии/обновлении вкладки AirTab.',
      syncFileCardTitle: 'Файл (iCloud/Dropbox/папка)',
      syncFileCardHint: 'Привяжите один `AirTab.sync.json` в синхронизируемой папке. Это самый легковесный вариант.',
      attachFile: 'Привязать файл',
      send: 'Отправить',
      fetch: 'Забрать',
      syncFileName: 'Имя sync-файла',
      authViaDropbox: 'Авторизоваться через Dropbox',
      disconnect: 'Отключить',
      dropboxNotConnected: 'Dropbox не подключен.',
      dropboxAuthHint: 'Авторизация через Dropbox-аккаунт в браузере. Токен вручную вводить не нужно.',
      importHelp: 'Поддерживаются экспортированные файлы из Firefox/Chromium/Raindrop (HTML) и JSON-экспорты.',
      importAddAs: 'Добавить как',
      importAsFolder: 'Папка',
      importAsLinks: 'Ярлыки',
      importTarget: 'Куда добавить',
      importToSelectedSpace: 'В выбранное пространство',
      importToNewSpace: 'Создать новое пространство',
      importNewSpaceName: 'Название нового пространства',
      importNewSpaceEmoji: 'Эмодзи пространства',
      importPreviewChooseFile: 'Выберите файл для предпросмотра импорта.',
      removeDuplicatesByUrl: 'Удалять дубли по URL',
      keepFolderPathInNames: 'Добавлять путь папок к названию при разворачивании',
      bookmarksFileLoaded: 'Файл загружен: {count} ссылок готово к импорту.',
      chooseBookmarksFileFirst: 'Сначала выберите файл закладок.',
      importNothingToDo: 'Нечего импортировать: проверьте файл и параметры.',
      importSummary: 'Импорт завершён: пространств {spaces}, папок {folders}, ярлыков {links}.',
      importPreviewSummary: 'Найдено: {totalLinks} ссылок, {totalFolders} папок (верхний уровень: {topLevel}). После фильтра дублей: {deduped}. {action}{pathHint}',
      importActionNewSpaceFolder: 'Будет создано новое пространство: {spaceName}, и 1 папка внутри.',
      importActionNewSpaceLinks: 'Будет создано новое пространство: {spaceName}, ярлыки добавятся напрямую.',
      importActionSelectedFolder: 'Будет создана 1 папка в пространстве: {spaceName}.',
      importActionSelectedLinks: 'Ярлыки будут добавлены напрямую в пространство: {spaceName}.',
      importTargetMissing: 'не выбрано',
      importPathHint: 'Путь папок будет добавлен к названиям при необходимости.',
      syncFileBound: 'Sync-файл привязан.',
      syncFilePickerUnsupported: 'Браузер не поддерживает выбор sync-файла.',
      syncFileNoAccess: 'Нет доступа к sync-файлу.',
      syncFileNoWriteAccess: 'Нет права на запись sync-файла.',
      syncFileNoReadAccess: 'Нет права на чтение sync-файла.',
      syncToFileDone: 'Синхронизация в файл выполнена.',
      syncFromFileDone: 'Синхронизация из файла выполнена.',
      syncFileBindFailed: 'Не удалось привязать sync-файл: {error}',
      syncToFileError: 'Ошибка отправки в файл: {error}',
      syncFromFileError: 'Ошибка загрузки из файла: {error}',
      dropboxConnected: 'Dropbox подключен.',
      dropboxConnectedSeeded: 'Dropbox подключен. Облачный sync-файл не найден, создан новый из текущих данных.',
      dropboxDisconnected: 'Dropbox отключен.',
      dropboxConnectFailed: 'Dropbox не подключен: {error}',
      syncToDropboxDone: 'Синхронизация в Dropbox выполнена.',
      syncFromDropboxDone: 'Синхронизация из Dropbox выполнена.',
      syncToDropboxError: 'Ошибка отправки в Dropbox: {error}',
      syncFromDropboxError: 'Ошибка загрузки из Dropbox: {error}',
      genericError: 'ошибка',
      searchEngineOrderUpdated: 'Порядок поисковиков обновлён.',
      fillEngineFields: 'Заполните название, URL и иконку.',
      searchEngineSaved: 'Поисковик сохранён.',
      searchEngineDeleted: 'Поисковик удалён.',
      dataUrlDisabledShort: 'Data URL для фона отключён. Используйте URL, цвет или локальный файл.',
      themeSavedWithOverrides: 'Фон сохранён. В пространствах с собственным фоном приоритет остаётся за фоном пространства.',
      themeSaved: 'Фон и режим производительности сохранены.',
      themeSaveFailed: 'Не удалось сохранить фон. Проверьте формат URL/цвета и попробуйте снова.',
      syncFileMetaSummary: 'Файл: {fileName}. Последняя отправка: {lastPush}. Последнее получение: {lastPull}.',
      statusConnected: 'подключен',
      statusDisconnected: 'не подключен',
      dropboxMetaSummary: 'Dropbox {state}. Файл: {fileName}. Последняя отправка: {lastPush}. Последнее получение: {lastPull}.',
      dropboxMetaSummaryWithError: '{base} Ошибка: {error}.',
      browserNoOAuthApi: 'Этот браузер не поддерживает безопасную OAuth-авторизацию (ни API расширения, ни popup flow).',
      dropboxOauthUnsupported: 'Браузер не поддерживает Dropbox OAuth (ни API расширения, ни popup flow).',
      dropboxAppKeyNotSet: 'Dropbox App Key не задан.',
      dropboxKeyMissingShort: 'В AirTab не настроен Dropbox App Key.',
      dropboxNotAuthorized: 'Dropbox не авторизован.',
      dropboxAccessTokenMissing: 'Не удалось получить Dropbox access token.',
      dropboxKeyMissingHint: 'Требуется внутренняя настройка AirTab: Dropbox App Key не найден. Пользователю ничего вводить не нужно.',
      dropboxAuthHintConfigured: 'Авторизация через Dropbox-аккаунт в браузере. Ключ и токен вручную вводить не нужно.',
      dropboxRedirectUriHint: 'Redirect URI для Dropbox: {uri}',
      siteNamePlaceholder: 'Название сайта',
      urlShort: 'URL',
      chooseSearchEngine: 'Выбрать поисковую систему',
      searchPlaceholder: 'Поиск...',
      searchQuery: 'Поисковый запрос',
      applyPresetWithName: 'Применить пресет {name}',
      multiSelectHint: '⌘/Ctrl + клик — выбрать несколько',
      createFolderFromSelected: 'Создать папку из выбранного',
      deleteSelected: 'Удалить выбранное',
      dndWaiting: 'Ожидание drag-and-drop событий...',
      addItem: 'Добавить элемент',
      addShortcutToFolder: 'Добавить ярлык в папку',
      editShortcut: 'Редактировать ярлык',
      itemActions: 'Действия элемента',
      folderActions: 'Действия папки',
      expandFolder: 'Развернуть папку',
      collapseFolder: 'Свернуть папку',
      moveUp: 'Сдвинуть вверх',
      moveDown: 'Сдвинуть вниз',
      switchSpace: 'Переключить пространство',
      searchUrlBase: 'Поисковый URL (без самого запроса)',
      upload: 'Загрузить',
      space: 'Пространство',
      personal: 'Личное',
      spaceSidebars: 'Боковые панели пространства',
      vkPlaceholder: 'AirTabs',
      chooseFolderEmoji: 'Выбрать эмодзи папки',
      chooseSpaceEmoji: 'Выбрать эмодзи пространства',
      addFolderToNewSpace: 'Добавить папку в новое пространство',
      addFolderLeft: 'Добавить папку слева',
      addFolderRight: 'Добавить папку справа',
      addShortcutLeft: 'Добавить ярлык слева',
      addShortcutRight: 'Добавить ярлык справа',
      applyAfterSpaceSave: 'Изменение будет применено после сохранения нового пространства.',
      changeFolderEmoji: 'Изменить эмодзи папки',
      localBindHintLegacy: 'Кнопка выбора файла привязывает локальный файл без загрузки картинки в localStorage.',
      convertFolderToSpace: 'Конвертировать папку в пространство',
      adaptiveThemeSettings: 'Настройки темы (адаптивные)',
      newFolder: 'Новая папка',
      folderHandling: 'Обработка папки',
      cancelFolderNameEdit: 'Отменить редактирование имени папки',
      showFolderAsGrid: 'Показать папку сеткой',
      showFolderAsList: 'Показать папку списком',
      swapGradientColors: 'Поменять цвета местами',
      spacesReorgHint: 'Реорганизация, редактирование и удаление пространств доступны внизу экрана через перетаскивание.',
      saveFolderName: 'Сохранить имя папки',
      themePerformanceHeader: 'Тема и производительность',
      spaceBackground: 'Фон пространства (URL или цвет)',
      lightThemeBgTitle: 'Фон Светлой темы (URL или цвет)',
      darkThemeBgTitle: 'Фон Темной темы (URL или цвет)',
      ecoHintLowPower: 'Эко-режим снижает визуальные эффекты и нагрузку на слабых устройствах.',
      ecoHintResource: 'Эко-режим уменьшает визуальные эффекты и расход ресурсов на слабых устройствах.',
      spaceBgReading: 'Чтение файла...',
      spaceBgReadyOptimized: 'Файл готов (оптимизирован для меньшего расхода памяти).',
      spaceBgReady: 'Файл готов к применению!',
      spaceBgReadFailed: 'Не удалось прочитать файл.'
    },
    en: {
      autoBrowser: 'Auto (browser)',
      settings: 'Settings',
      search: 'Search',
      spaces: 'Spaces',
      theme: 'Theme',
      backup: 'Backup',
      apply: 'Apply',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      addShortcut: 'Add shortcut',
      addFolder: 'Add folder',
      selectedCount: '{count} selected',
      openTabs: 'Open tabs',
      clear: 'Clear',
      interfaceLanguage: 'Interface language',
      interfaceLanguageHint: 'Choose UI language. Auto uses browser language.',
      openAirTab: 'Open AirTab',
      searchEngines: 'Search engines',
      addSearchEngine: 'Add search engine',
      backupCopy: 'Backup copy',
      downloadJson: 'Download (.json)',
      uploadFile: 'Upload file',
      performanceMode: 'Performance mode',
      balancedMode: 'Balanced',
      ecoMode: 'Eco (fewer effects)',
      dynamicDebugPanel: 'Show DND debug panel',
      importBookmarks: 'Bookmarks import',
      chooseFile: 'Choose file',
      targetSpace: 'Target space',
      importMode: 'Import mode',
      smartRecommended: 'Smart (recommended)',
      spacesAsNew: 'As new spaces',
      linksInSpace: 'As links in selected space',
      noFileSelected: 'No file selected (.html, .htm, .json)',
      importBookmarksAction: 'Import bookmarks',
      fileNotLinked: 'File not linked.',
      googleNotConnected: 'Google Drive is not connected.',
      add: 'Add',
      shortcut: 'Shortcut',
      folder: 'Folder',
      name: 'Name',
      addToStart: 'Add to start page',
      airtabOptions: 'AirTab options',
      siteUrl: 'Site URL',
      customIconUrl: 'Custom icon URL (optional)',
      leaveEmptyAuto: 'Leave empty for auto',
      moveOutFolder: 'Move out of folder',
      gridView: 'Grid',
      listView: 'List',
      previousSpace: 'Previous space',
      nextSpace: 'Next space',
      addSpace: 'Add space',
      editSpace: 'Edit space',
      newSpace: 'New space',
      newSpaceFromFolder: 'New space from folder',
      removeSpace: 'Delete space',
      close: 'Close',
      editFolder: 'Edit folder',
      nameEmoji: 'Name and emoji',
      gradient: 'Gradient',
      color1: 'Color 1',
      color2: 'Color 2',
      angle: 'Angle',
      resetGradient: 'Reset gradient',
      removeEmoji: 'Remove emoji',
      emojiNotFound: 'Nothing found',
      searchEmoji: 'Search emoji',
      leftSidebar: 'Left',
      rightSidebar: 'Right',
      openTabsConfirm: 'Open {count} tabs?',
      folderWithName: 'Folder: {name}',
      itemFallbackName: 'Item',
      deleteSelectedConfirm: 'Delete selected items ({count})?',
      deleteSpaceWithItems: 'Delete space {title} and {count} items?',
      deleteSpaceOnly: 'Delete space {title}?',
      deleteFolderWithItems: 'Delete folder {title} and {count} items?',
      deleteFolderOnly: 'Delete folder {title}?',
      thisSpace: 'this space',
      thisFolder: 'this folder',
      atLeastOneSpace: 'At least one space must remain.',
      atLeastOneEngine: 'At least one search engine must remain!',
      dataUrlDisabled: 'Data URL background is disabled. Use URL/color or local file binding.',
      bgApplyFailed: 'Error: failed to apply selected background.',
      localFilePickerUnsupported: 'This browser does not support local file link picker.',
      localFileAccessDenied: 'No access to the selected file.',
      localFileAttachFailed: 'Failed to link local file.',
      localFileLinkedSaved: 'Local file linked and saved (file: {fileName}).',
      localBgFileMissing: 'Local background file was not found. Pick it again.',
      localBgSavedFallback: 'Local background saved in fallback mode.',
      reloadSuccess: 'Success! The page will reload.',
      importErrorBadFile: 'Error! Invalid file.',
      backupDownloaded: 'Backup downloaded.',
      backupRestored: 'Backup restored.',
      backupRestoredAndDropboxSynced: 'Backup restored and uploaded to Dropbox.',
      backupRestoredDropboxSyncFailed: 'Backup restored, but Dropbox upload failed: {error}',
      backupRestoredAndDropboxSyncedReload: 'Backup restored and uploaded to Dropbox. The page will reload.',
      backupRestoredDropboxSyncFailedReload: 'Backup restored, but Dropbox upload failed: {error}. The page will reload.',
      backupImportBadFile: 'Import error: invalid file.',
      bookmarkParseError: 'Could not parse bookmarks file. Supported: HTML/JSON.',
      addedSuccess: '✓ Added successfully!',
      manageSearchThemeBackup: 'Manage search, theme, and backups in a separate tab.',
      searchUrlWithQueryTail: 'Search URL (with query tail)',
      iconUrl: 'Icon URL',
      lightThemeBg: 'Light theme background (URL or color)',
      darkThemeBg: 'Dark theme background (URL or color)',
      bindLocalFile: 'Bind local file',
      localBindHint: 'The file-picker button binds a local file by reference without storing image data in localStorage.',
      spaceBgPriorityHint: 'Important: if a space has its own background, it overrides the global theme background.',
      dndDebugHint: 'Keep off in daily use. Enable only when diagnosing drag-and-drop.',
      exportAllHint: 'All AirTab data is exported: spaces, folders, shortcuts, sidebars, search engines, backgrounds, performance mode, and DND debug.',
      syncSection: 'Sync',
      syncModePrompt: 'Choose sync mode:',
      syncModeDropbox: 'Dropbox',
      syncModeLocal: 'Local file',
      syncAutoHint: 'Auto sync is enabled: changes are uploaded immediately, and updates are fetched when AirTab is opened/refreshed.',
      syncFileCardTitle: 'File (iCloud/Dropbox/folder)',
      syncFileCardHint: 'Bind one `AirTab.sync.json` in a synced folder. This is the lightest option.',
      attachFile: 'Bind file',
      send: 'Send',
      fetch: 'Fetch',
      syncFileName: 'Sync file name',
      authViaDropbox: 'Authorize via Dropbox',
      disconnect: 'Disconnect',
      dropboxNotConnected: 'Dropbox is not connected.',
      dropboxAuthHint: 'Authorization uses Dropbox account in browser. No manual token input needed.',
      importHelp: 'Supports exported files from Firefox/Chromium/Raindrop (HTML) and JSON exports.',
      importAddAs: 'Add as',
      importAsFolder: 'Folder',
      importAsLinks: 'Shortcuts',
      importTarget: 'Add to',
      importToSelectedSpace: 'Selected space',
      importToNewSpace: 'Create new space',
      importNewSpaceName: 'New space name',
      importNewSpaceEmoji: 'Space emoji',
      importPreviewChooseFile: 'Choose a file to preview import.',
      removeDuplicatesByUrl: 'Remove URL duplicates',
      keepFolderPathInNames: 'Append folder path to names when flattening',
      bookmarksFileLoaded: 'File loaded: {count} links ready to import.',
      chooseBookmarksFileFirst: 'Choose a bookmarks file first.',
      importNothingToDo: 'Nothing to import: check the file and parameters.',
      importSummary: 'Import complete: spaces {spaces}, folders {folders}, shortcuts {links}.',
      importPreviewSummary: 'Found: {totalLinks} links, {totalFolders} folders (top level: {topLevel}). After dedupe: {deduped}. {action}{pathHint}',
      importActionNewSpaceFolder: 'A new space will be created: {spaceName}, with one folder inside.',
      importActionNewSpaceLinks: 'A new space will be created: {spaceName}, shortcuts added directly.',
      importActionSelectedFolder: 'One folder will be created in space: {spaceName}.',
      importActionSelectedLinks: 'Shortcuts will be added directly to space: {spaceName}.',
      importTargetMissing: 'not selected',
      importPathHint: 'Folder path will be added to names when needed.',
      syncFileBound: 'Sync file is bound.',
      syncFilePickerUnsupported: 'This browser does not support sync file picker.',
      syncFileNoAccess: 'No access to sync file.',
      syncFileNoWriteAccess: 'No permission to write sync file.',
      syncFileNoReadAccess: 'No permission to read sync file.',
      syncToFileDone: 'Sync to file completed.',
      syncFromFileDone: 'Sync from file completed.',
      syncFileBindFailed: 'Failed to bind sync file: {error}',
      syncToFileError: 'Sync upload to file failed: {error}',
      syncFromFileError: 'Sync download from file failed: {error}',
      dropboxConnected: 'Dropbox connected.',
      dropboxConnectedSeeded: 'Dropbox connected. Cloud sync file was not found, so a new one was created from current data.',
      dropboxDisconnected: 'Dropbox disconnected.',
      dropboxConnectFailed: 'Dropbox not connected: {error}',
      syncToDropboxDone: 'Sync to Dropbox completed.',
      syncFromDropboxDone: 'Sync from Dropbox completed.',
      syncToDropboxError: 'Sync upload to Dropbox failed: {error}',
      syncFromDropboxError: 'Sync download from Dropbox failed: {error}',
      genericError: 'error',
      searchEngineOrderUpdated: 'Search engine order updated.',
      fillEngineFields: 'Fill in name, URL, and icon.',
      searchEngineSaved: 'Search engine saved.',
      searchEngineDeleted: 'Search engine deleted.',
      dataUrlDisabledShort: 'Data URL background is disabled. Use URL, color, or a local file.',
      themeSavedWithOverrides: 'Background saved. Spaces with custom background keep their own background priority.',
      themeSaved: 'Background and performance mode saved.',
      themeSaveFailed: 'Failed to save background. Check URL/color format and try again.',
      syncFileMetaSummary: 'File: {fileName}. Last upload: {lastPush}. Last download: {lastPull}.',
      statusConnected: 'connected',
      statusDisconnected: 'not connected',
      dropboxMetaSummary: 'Dropbox {state}. File: {fileName}. Last upload: {lastPush}. Last download: {lastPull}.',
      dropboxMetaSummaryWithError: '{base} Error: {error}.',
      browserNoOAuthApi: 'This browser does not support secure OAuth authorization (neither extension API nor popup flow).',
      dropboxOauthUnsupported: 'This browser does not support Dropbox OAuth (neither extension API nor popup flow).',
      dropboxAppKeyNotSet: 'Dropbox App Key is not set.',
      dropboxKeyMissingShort: 'Dropbox App Key is not configured in AirTab.',
      dropboxNotAuthorized: 'Dropbox is not authorized.',
      dropboxAccessTokenMissing: 'Failed to receive Dropbox access token.',
      dropboxKeyMissingHint: 'AirTab internal setup is required: Dropbox App Key not found. User input is not required.',
      dropboxAuthHintConfigured: 'Authorization uses Dropbox account in browser. No manual key or token input needed.',
      dropboxRedirectUriHint: 'Dropbox Redirect URI: {uri}',
      siteNamePlaceholder: 'Site name',
      urlShort: 'URL',
      chooseSearchEngine: 'Choose search engine',
      searchPlaceholder: 'Search...',
      searchQuery: 'Search query',
      applyPresetWithName: 'Apply preset {name}',
      multiSelectHint: '⌘/Ctrl + click to multi-select',
      createFolderFromSelected: 'Create folder from selected',
      deleteSelected: 'Delete selected',
      dndWaiting: 'Waiting for drag-and-drop events...',
      addItem: 'Add item',
      addShortcutToFolder: 'Add shortcut to folder',
      editShortcut: 'Edit shortcut',
      itemActions: 'Item actions',
      folderActions: 'Folder actions',
      expandFolder: 'Expand folder',
      collapseFolder: 'Collapse folder',
      moveUp: 'Move up',
      moveDown: 'Move down',
      switchSpace: 'Switch space',
      searchUrlBase: 'Search URL (without query itself)',
      upload: 'Upload',
      space: 'Space',
      personal: 'Personal',
      spaceSidebars: 'Space sidebars',
      vkPlaceholder: 'AirTabs',
      chooseFolderEmoji: 'Choose folder emoji',
      chooseSpaceEmoji: 'Choose space emoji',
      addFolderToNewSpace: 'Add folder to new space',
      addFolderLeft: 'Add folder on the left',
      addFolderRight: 'Add folder on the right',
      addShortcutLeft: 'Add shortcut on the left',
      addShortcutRight: 'Add shortcut on the right',
      applyAfterSpaceSave: 'Changes will be applied after saving the new space.',
      changeFolderEmoji: 'Change folder emoji',
      localBindHintLegacy: 'The file-picker button links a local file without saving image data to localStorage.',
      convertFolderToSpace: 'Convert folder into space',
      adaptiveThemeSettings: 'Theme settings (adaptive)',
      newFolder: 'New folder',
      folderHandling: 'Folder handling',
      cancelFolderNameEdit: 'Cancel folder name editing',
      showFolderAsGrid: 'Show folder as grid',
      showFolderAsList: 'Show folder as list',
      swapGradientColors: 'Swap colors',
      spacesReorgHint: 'Reorganizing, editing, and deleting spaces is available at the bottom via drag-and-drop.',
      saveFolderName: 'Save folder name',
      themePerformanceHeader: 'Theme and performance',
      spaceBackground: 'Space background (URL or color)',
      lightThemeBgTitle: 'Light Theme background (URL or color)',
      darkThemeBgTitle: 'Dark Theme background (URL or color)',
      ecoHintLowPower: 'Eco mode reduces visual effects and load on low-end devices.',
      ecoHintResource: 'Eco mode reduces visual effects and resource usage on weaker devices.',
      spaceBgReading: 'Reading file...',
      spaceBgReadyOptimized: 'File is ready (optimized for lower memory usage).',
      spaceBgReady: 'File is ready to apply!',
      spaceBgReadFailed: 'Failed to read file.'
    },
    es: {
      autoBrowser: 'Auto (navegador)',
      settings: 'Configuración',
      search: 'Búsqueda',
      spaces: 'Espacios',
      theme: 'Tema',
      backup: 'Copia',
      apply: 'Aplicar',
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      addShortcut: 'Agregar acceso directo',
      addFolder: 'Agregar carpeta',
      selectedCount: '{count} seleccionados',
      openTabs: 'Abrir pestañas',
      clear: 'Limpiar',
      interfaceLanguage: 'Idioma de la interfaz',
      interfaceLanguageHint: 'Elige idioma UI. Auto usa el idioma del navegador.'
    },
    'pt-BR': {
      autoBrowser: 'Auto (navegador)',
      settings: 'Configurações',
      search: 'Busca',
      spaces: 'Espaços',
      theme: 'Tema',
      backup: 'Backup',
      apply: 'Aplicar',
      save: 'Salvar',
      cancel: 'Cancelar',
      delete: 'Excluir',
      edit: 'Editar',
      addShortcut: 'Adicionar atalho',
      addFolder: 'Adicionar pasta',
      selectedCount: '{count} selecionados',
      openTabs: 'Abrir abas',
      clear: 'Limpar',
      interfaceLanguage: 'Idioma da interface',
      interfaceLanguageHint: 'Escolha o idioma da UI. Auto usa o idioma do navegador.'
    },
    'zh-CN': {
      autoBrowser: '自动（浏览器）',
      settings: '设置',
      search: '搜索',
      spaces: '空间',
      theme: '主题',
      backup: '备份',
      apply: '应用',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      addShortcut: '添加快捷方式',
      addFolder: '添加文件夹',
      selectedCount: '已选择 {count}',
      openTabs: '打开标签页',
      clear: '清除',
      interfaceLanguage: '界面语言',
      interfaceLanguageHint: '选择 UI 语言。自动使用浏览器语言。'
    },
    hi: {
      autoBrowser: 'Auto (ब्राउज़र)',
      settings: 'सेटिंग्स',
      search: 'खोज',
      spaces: 'स्पेसेस',
      theme: 'थीम',
      backup: 'बैकअप',
      apply: 'लागू करें',
      save: 'सेव करें',
      cancel: 'रद्द करें',
      delete: 'हटाएं',
      edit: 'संपादित करें',
      addShortcut: 'शॉर्टकट जोड़ें',
      addFolder: 'फ़ोल्डर जोड़ें',
      selectedCount: '{count} चयनित',
      openTabs: 'टैब खोलें',
      clear: 'साफ करें',
      interfaceLanguage: 'इंटरफ़ेस भाषा',
      interfaceLanguageHint: 'UI भाषा चुनें। Auto ब्राउज़र भाषा का उपयोग करता है।'
    },
    ar: {
      autoBrowser: 'تلقائي (المتصفح)',
      settings: 'الإعدادات',
      search: 'بحث',
      spaces: 'المساحات',
      theme: 'المظهر',
      backup: 'نسخة احتياطية',
      apply: 'تطبيق',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تحرير',
      addShortcut: 'إضافة اختصار',
      addFolder: 'إضافة مجلد',
      selectedCount: '{count} محدد',
      openTabs: 'فتح التبويبات',
      clear: 'مسح',
      interfaceLanguage: 'لغة الواجهة',
      interfaceLanguageHint: 'اختر لغة الواجهة. التلقائي يستخدم لغة المتصفح.'
    }
  };

  const RU_TO_KEY = {
    'Параметры AirTab': 'airtabOptions',
    'Параметры': 'settings',
    'Настройки': 'settings',
    'Открыть AirTab': 'openAirTab',
    'Поиск': 'search',
    'Пространства': 'spaces',
    'Тема': 'theme',
    'Резерв': 'backup',
    'Поисковые системы': 'searchEngines',
    '+ Добавить поисковик': 'addSearchEngine',
    'Резервная копия': 'backupCopy',
    'Скачать (.json)': 'downloadJson',
    'Загрузить файл': 'uploadFile',
    'Режим производительности': 'performanceMode',
    'Сбалансированный': 'balancedMode',
    'Эко (меньше эффектов)': 'ecoMode',
    'Показ DND debug-панели': 'dynamicDebugPanel',
    'Импорт закладок': 'importBookmarks',
    'Выбрать файл': 'chooseFile',
    'Целевое пространство': 'targetSpace',
    'Режим импорта': 'importMode',
    'Умный (рекомендуется)': 'smartRecommended',
    'Как новые пространства': 'spacesAsNew',
    'Как ярлыки в выбранном пространстве': 'linksInSpace',
    'Файл не выбран (.html, .htm, .json)': 'noFileSelected',
    'Импортировать закладки': 'importBookmarksAction',
    'Файл не привязан.': 'fileNotLinked',
    'Google Drive не подключен.': 'googleNotConnected',
    'Добавить': 'add',
    'Ярлык': 'shortcut',
    'Папка': 'folder',
    'Название': 'name',
    'Добавить на стартовую': 'addToStart',
    'URL сайта': 'siteUrl',
    'URL своей иконки (необязательно)': 'customIconUrl',
    'Оставьте пустым для авто': 'leaveEmptyAuto',
    'Вынести из папки': 'moveOutFolder',
    'Сетка': 'gridView',
    'Список': 'listView',
    'Предыдущее пространство': 'previousSpace',
    'Следующее пространство': 'nextSpace',
    'Добавить пространство': 'addSpace',
    'Редактировать пространство': 'editSpace',
    'Удалить пространство': 'removeSpace',
    'Закрыть': 'close',
    'Редактировать папку': 'editFolder',
    'Название и эмодзи': 'nameEmoji',
    'Градиент': 'gradient',
    'Цвет 1': 'color1',
    'Цвет 2': 'color2',
    'Угол': 'angle',
    'Сбросить градиент': 'resetGradient',
    'Убрать эмодзи': 'removeEmoji',
    'Ничего не найдено': 'emojiNotFound',
    'Поиск эмодзи': 'searchEmoji',
    'Левая': 'leftSidebar',
    'Правая': 'rightSidebar',
    'Сохранить': 'save',
    'Отмена': 'cancel',
    'Удалить': 'delete',
    'Редактировать': 'edit',
    'Добавить ярлык': 'addShortcut',
    '+ Добавить ярлык': 'addShortcut',
    'Добавить папку': 'addFolder',
    'Открыть вкладки': 'openTabs',
    'Снять': 'clear',
    'Применить': 'apply',
    'Язык интерфейса': 'interfaceLanguage',
    'Авто (язык браузера)': 'autoBrowser',
    'Должно остаться хотя бы одно пространство.': 'atLeastOneSpace',
    'Должен остаться хотя бы один поисковик!': 'atLeastOneEngine',
    'Data URL для фона отключён. Используйте URL/цвет или привязку локального файла (🗂).': 'dataUrlDisabled',
    'Data URL для фона отключён. Используйте URL/цвет или привязку локального файла.': 'dataUrlDisabled',
    'Ошибка: не удалось применить выбранный фон.': 'bgApplyFailed',
    'Браузер не поддерживает выбор локального файла по ссылке.': 'localFilePickerUnsupported',
    'Не удалось привязать локальный файл.': 'localFileAttachFailed',
    'Успешно! Страница будет перезагружена.': 'reloadSuccess',
    'Ошибка! Неверный файл.': 'importErrorBadFile',
    'Не удалось распознать файл закладок. Поддерживаются HTML/JSON.': 'bookmarkParseError',
    '✓ Успешно добавлено!': 'addedSuccess',
    'Управление поиском, темой и резервной копией в отдельной вкладке.': 'manageSearchThemeBackup',
    'Поисковый URL (с хвостом запроса)': 'searchUrlWithQueryTail',
    'URL иконки': 'iconUrl',
    'Фон светлой темы (URL или цвет)': 'lightThemeBg',
    'Фон тёмной темы (URL или цвет)': 'darkThemeBg',
    'Привязать локальный файл': 'bindLocalFile',
    'Кнопка 🗂 привязывает файл по ссылке без загрузки картинки в localStorage.': 'localBindHint',
    'Кнопка выбора файла привязывает файл по ссылке без загрузки картинки в localStorage.': 'localBindHint',
    'Важно: если у пространства задан свой фон, он перекрывает глобальный фон темы.': 'spaceBgPriorityHint',
    'Отключайте в обычной работе. Включайте только для диагностики drag-and-drop.': 'dndDebugHint',
    'Экспортируются все данные AirTab: пространства, папки, ярлыки, панели, поисковики, фоны, режим производительности и DND debug.': 'exportAllHint',
    'Синхронизация': 'syncSection',
    'Выберите режим синхронизации:': 'syncModePrompt',
    'Dropbox': 'syncModeDropbox',
    'Локальный файл': 'syncModeLocal',
    'Автосинхронизация включена: изменения отправляются сразу, получение — при открытии/обновлении вкладки AirTab.': 'syncAutoHint',
    'Файл (iCloud/Dropbox/папка)': 'syncFileCardTitle',
    'Привяжите один `AirTab.sync.json` в синхронизируемой папке. Это самый легковесный вариант.': 'syncFileCardHint',
    'Привязать файл': 'attachFile',
    'Отправить': 'send',
    'Забрать': 'fetch',
    'Имя sync-файла': 'syncFileName',
    'Авторизоваться через Dropbox': 'authViaDropbox',
    'Отключить': 'disconnect',
    'Dropbox не подключен.': 'dropboxNotConnected',
    'Авторизация через Dropbox-аккаунт в браузере. Токен вручную вводить не нужно.': 'dropboxAuthHint',
    'Добавить как': 'importAddAs',
    'Ярлыки': 'importAsLinks',
    'Куда добавить': 'importTarget',
    'В выбранное пространство': 'importToSelectedSpace',
    'Создать новое пространство': 'importToNewSpace',
    'Название нового пространства': 'importNewSpaceName',
    'Эмодзи пространства': 'importNewSpaceEmoji',
    'Импорт закладок': 'importBookmarks',
    'Поддерживаются экспортированные файлы из Firefox/Chromium/Raindrop (HTML) и JSON-экспорты.': 'importHelp',
    'Удалять дубли по URL': 'removeDuplicatesByUrl',
    'Добавлять путь папок к названию при разворачивании': 'keepFolderPathInNames',
    'Выберите файл для предпросмотра импорта.': 'importPreviewChooseFile',
    'Порядок поисковиков обновлён.': 'searchEngineOrderUpdated',
    'Заполните название, URL и иконку.': 'fillEngineFields',
    'Поисковик сохранён.': 'searchEngineSaved',
    'Поисковик удалён.': 'searchEngineDeleted',
    'Data URL для фона отключён. Используйте URL, цвет или 🗂.': 'dataUrlDisabledShort',
    'Data URL для фона отключён. Используйте URL, цвет или локальный файл.': 'dataUrlDisabledShort',
    'Фон сохранён. В пространствах с собственным фоном приоритет остаётся за фоном пространства.': 'themeSavedWithOverrides',
    'Фон и режим производительности сохранены.': 'themeSaved',
    'Не удалось сохранить фон. Проверьте формат URL/цвета и попробуйте снова.': 'themeSaveFailed',
    'Sync-файл привязан.': 'syncFileBound',
    'Синхронизация в файл выполнена.': 'syncToFileDone',
    'Синхронизация из файла выполнена.': 'syncFromFileDone',
    'Dropbox подключен.': 'dropboxConnected',
    'Dropbox отключен.': 'dropboxDisconnected',
    'Синхронизация в Dropbox выполнена.': 'syncToDropboxDone',
    'Синхронизация из Dropbox выполнена.': 'syncFromDropboxDone',
    'Сначала выберите файл закладок.': 'chooseBookmarksFileFirst',
    'Нечего импортировать: проверьте файл и параметры.': 'importNothingToDo',
    'не выбрано': 'importTargetMissing',
    'Путь папок будет добавлен к названиям при необходимости.': 'importPathHint',
    'Название сайта': 'siteNamePlaceholder',
    'URL': 'urlShort',
    'Выбрать поисковую систему': 'chooseSearchEngine',
    'Поиск...': 'searchPlaceholder',
    'Поисковый запрос': 'searchQuery',
    '⌘/Ctrl + клик — выбрать несколько': 'multiSelectHint',
    'Создать папку из выбранного': 'createFolderFromSelected',
    'Удалить выбранное': 'deleteSelected',
    'Ожидание drag-and-drop событий...': 'dndWaiting',
    'Добавить элемент': 'addItem',
    'Добавить ярлык в папку': 'addShortcutToFolder',
    'Редактировать ярлык': 'editShortcut',
    'Действия элемента': 'itemActions',
    'Действия папки': 'folderActions',
    'Развернуть папку': 'expandFolder',
    'Свернуть папку': 'collapseFolder',
    'Сдвинуть вверх': 'moveUp',
    'Сдвинуть вниз': 'moveDown',
    'Переключить пространство': 'switchSpace',
    'Поисковый URL (без самого запроса)': 'searchUrlBase',
    'Загрузить': 'upload',
    'Пространство': 'space',
    'Личное': 'personal',
    'Выберите язык UI. Авто использует язык браузера.': 'interfaceLanguageHint',
    'Боковые панели пространства': 'spaceSidebars',
    'ВКонтакте': 'vkPlaceholder',
    'Выбрать эмодзи папки': 'chooseFolderEmoji',
    'Выбрать эмодзи пространства': 'chooseSpaceEmoji',
    'Добавить папку в новое пространство': 'addFolderToNewSpace',
    'Добавить папку слева': 'addFolderLeft',
    'Добавить папку справа': 'addFolderRight',
    'Добавить ярлык слева': 'addShortcutLeft',
    'Добавить ярлык справа': 'addShortcutRight',
    'Изменение будет применено после сохранения нового пространства.': 'applyAfterSpaceSave',
    'Изменить эмодзи папки': 'changeFolderEmoji',
    'Кнопка 🗂 привязывает локальный файл без загрузки картинки в localStorage.': 'localBindHintLegacy',
    'Кнопка выбора файла привязывает локальный файл без загрузки картинки в localStorage.': 'localBindHintLegacy',
    'Конвертировать папку в пространство': 'convertFolderToSpace',
    'Настройки темы (адаптивные)': 'adaptiveThemeSettings',
    'Новая папка': 'newFolder',
    'Обработка папки': 'folderHandling',
    'Отменить редактирование имени папки': 'cancelFolderNameEdit',
    'Первый цвет градиента': 'color1',
    'Второй цвет градиента': 'color2',
    'Показать папку сеткой': 'showFolderAsGrid',
    'Показать папку списком': 'showFolderAsList',
    'Поменять цвета местами': 'swapGradientColors',
    'Реорганизация, редактирование и удаление пространств доступны внизу экрана через перетаскивание.': 'spacesReorgHint',
    'Сохранить имя папки': 'saveFolderName',
    'Тема и производительность': 'themePerformanceHeader',
    'Угол градиента': 'angle',
    'Фон пространства (URL или цвет)': 'spaceBackground',
    'Фон Светлой темы (URL или цвет)': 'lightThemeBgTitle',
    'Фон Темной темы (URL или цвет)': 'darkThemeBgTitle',
    'Эко-режим снижает визуальные эффекты и нагрузку на слабых устройствах.': 'ecoHintLowPower',
    'Эко-режим уменьшает визуальные эффекты и расход ресурсов на слабых устройствах.': 'ecoHintResource',
    'Добавить поисковик': 'addSearchEngine'
  };

  const PATTERNS = [
    {
      re: /^(\d+) выбрано$/,
      render: (m) => t('selectedCount', { count: m[1] })
    },
    {
      re: /^Открыть (\d+) вкладок\?$/,
      render: (m) => t('openTabsConfirm', { count: m[1] })
    },
    {
      re: /^Удалить выбранные элементы \((\d+)\)\?$/,
      render: (m) => t('deleteSelectedConfirm', { count: m[1] })
    },
    {
      re: /^Удалить пространство (.+) и (\d+) элементов\?$/,
      render: (m) => t('deleteSpaceWithItems', { title: m[1], count: m[2] })
    },
    {
      re: /^Удалить пространство (.+)\?$/,
      render: (m) => t('deleteSpaceOnly', { title: m[1] })
    },
    {
      re: /^Удалить папку (.+) и (\d+) элементов\?$/,
      render: (m) => t('deleteFolderWithItems', { title: m[1], count: m[2] })
    },
    {
      re: /^Удалить папку (.+)\?$/,
      render: (m) => t('deleteFolderOnly', { title: m[1] })
    }
  ];

  function normalizeLanguage(raw) {
    const value = String(raw || '').trim();
    if (!value || value === 'auto' || value === 'default') return 'auto';
    if (value === 'ru' || value.startsWith('ru-')) return 'ru';
    if (value === 'en' || value.startsWith('en-')) return 'en';
    if (value === 'es' || value.startsWith('es-')) return 'es';
    if (value === 'pt-BR' || value === 'pt_br' || value.toLowerCase().startsWith('pt')) return 'pt-BR';
    if (value === 'zh-CN' || value === 'zh_cn' || value.toLowerCase().startsWith('zh')) return 'zh-CN';
    if (value === 'hi' || value.toLowerCase().startsWith('hi')) return 'hi';
    if (value === 'ar' || value.toLowerCase().startsWith('ar')) return 'ar';
    return 'en';
  }

  function resolveLanguage(userSetting) {
    const pref = normalizeLanguage(userSetting);
    if (pref !== 'auto') return pref;
    return normalizeLanguage(navigator.language || (navigator.languages && navigator.languages[0]) || 'en');
  }

  function getStoredLanguage() {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY) || 'auto');
  }

  function setStoredLanguage(language) {
    const normalized = normalizeLanguage(language);
    localStorage.setItem(STORAGE_KEY, normalized);
    localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
    return normalized;
  }

  function getActiveLanguage() {
    return resolveLanguage(getStoredLanguage());
  }

  function t(key, vars = {}) {
    const active = getActiveLanguage();
    const dict = I18N[active] || {};
    const fallback = I18N.en;
    const ru = I18N.ru;
    let text = dict[key] || fallback[key] || ru[key] || key;
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replaceAll(`{${k}}`, String(v));
    });
    return text;
  }

  function translateText(text) {
    if (typeof text !== 'string') return text;
    const active = getActiveLanguage();
    if (active === 'ru') return text;
    const exactKey = RU_TO_KEY[text];
    if (exactKey) return t(exactKey);
    for (const pattern of PATTERNS) {
      const match = text.match(pattern.re);
      if (match) return pattern.render(match);
    }
    return text;
  }

  function translateAttributes(root) {
    if (!root || !root.querySelectorAll) return;
    const selectors = '[title],[aria-label],[placeholder],[data-i18n-raw]';
    root.querySelectorAll(selectors).forEach((el) => {
      ['title', 'aria-label', 'placeholder', 'data-i18n-raw'].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (!value) return;
        const translated = translateText(value);
        if (!translated || translated === value) return;
        if (attr === 'data-i18n-raw') {
          el.textContent = translated;
          return;
        }
        el.setAttribute(attr, translated);
      });
    });
  }

  function translateTextNodes(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
        const tag = node.parentElement.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let current = walker.nextNode();
    while (current) {
      const original = current.nodeValue;
      const match = original.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const leading = match ? match[1] : '';
      const core = match ? match[2] : original;
      const trailing = match ? match[3] : '';
      const translated = translateText(core);
      if (translated && translated !== core) {
        current.nodeValue = `${leading}${translated}${trailing}`;
      }
      current = walker.nextNode();
    }
  }

  let observeTimer = null;
  let observer = null;

  function disconnectObserver() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  function applyDocumentMeta() {
    const active = getActiveLanguage();
    document.documentElement.lang = active;
    document.documentElement.dir = active === 'ar' ? 'rtl' : 'ltr';
  }

  function translateDocument(root = document.body) {
    applyDocumentMeta();
    if (!root) return;
    translateAttributes(root);
    translateTextNodes(root);
  }

  function scheduleTranslate(target) {
    if (observeTimer) window.clearTimeout(observeTimer);
    observeTimer = window.setTimeout(() => translateDocument(target || document.body), 16);
  }

  function ensureObserver() {
    if (getActiveLanguage() === 'ru') {
      disconnectObserver();
      return;
    }
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          scheduleTranslate(mutation.target?.parentElement || document.body);
          return;
        }
        if (mutation.type === 'childList' && (mutation.addedNodes?.length || mutation.removedNodes?.length)) {
          scheduleTranslate(mutation.target || document.body);
          return;
        }
        if (mutation.type === 'attributes') {
          scheduleTranslate(mutation.target || document.body);
          return;
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label', 'placeholder', 'data-i18n-raw']
    });
  }

  function getLanguageOptions(displayLang) {
    const locale = normalizeLanguage(displayLang || getStoredLanguage());
    const active = resolveLanguage(locale);
    const autoLabel = (I18N[active] && I18N[active].autoBrowser) || I18N.en.autoBrowser;
    return [
      { value: 'auto', label: autoLabel },
      ...Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({ value, label }))
    ];
  }

  function init(options = {}) {
    const shouldObserve = options.observe !== false;
    translateDocument(document.body);
    if (shouldObserve) ensureObserver();
    else disconnectObserver();
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== STORAGE_TS_KEY) return;
    ensureObserver();
    scheduleTranslate(document.body);
  });

  const api = {
    supportedLanguages: SUPPORTED.slice(),
    normalizeLanguage,
    resolveLanguage,
    getStoredLanguage,
    getActiveLanguage,
    setStoredLanguage,
    getLanguageOptions,
    t,
    translateText,
    translateDocument,
    init
  };

  window.AirTabI18n = api;
})();
