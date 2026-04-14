# Russia Border Checkpoints Map

[![Version](https://img.shields.io/badge/version-v1.0.1-blue)](https://github.com/IngannamorteScienceDev/russia-border-checkpoints-map/releases)
[![Status](https://img.shields.io/badge/status-stable-success)](https://github.com/IngannamorteScienceDev/russia-border-checkpoints-map)
[![License](https://img.shields.io/badge/license-Personal%20Use-lightgrey)](./LICENSE)
[![Frontend](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-orange)](#)
[![Map](https://img.shields.io/badge/map-MapLibre%20GL-blueviolet)](https://maplibre.org/)
[![Data](https://img.shields.io/badge/data-GeoJSON-yellow)](#)
[![Pipeline](https://img.shields.io/badge/data%20pipeline-Python-informational)](#)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-black?logo=github)](https://ingannamortesciencedev.github.io/russia-border-checkpoints-map/)

Интерактивная карта пунктов пропуска через государственную границу Российской Федерации. Проект работает на чистом фронтенде и отображает данные из одного итогового GeoJSON-файла.

## Демо

- Карта на GitHub Pages: [ingannamortesciencedev.github.io/russia-border-checkpoints-map](https://ingannamortesciencedev.github.io/russia-border-checkpoints-map/)

## Возможности

- интерактивная карта КПП на базе MapLibre GL;
- кластеризация точек и масштабирование по клику;
- поиск по названию, региону, стране и типу;
- фильтрация по типу и статусу;
- карточка пункта пропуска с подробной информацией;
- избранные КПП в `localStorage`, фильтр по избранному и отдельная подсветка на карте;
- сравнение двух КПП, быстрые действия, копирование координат и построение маршрута;
- ссылка на текущее состояние карты с фильтрами, ракурсом, выбранным КПП и локальным QR-кодом;
- экспорт текущей выборки в CSV и GeoJSON;
- страница версий датасета, changelog и отчет качества данных;
- PWA manifest, service worker, app-shell cache и индикатор офлайн-режима;
- геолокация пользователя и расчёт расстояния до выбранного пункта;
- спутниковый слой поверх базовой карты.

## Структура проекта

```text
russia-border-checkpoints-map/
|-- index.html
|-- style.css
|-- app.js
|-- manifest.webmanifest
|-- sw.js
|-- icons/
|-- data/
|   |-- checkpoints.geojson
|   |-- checkpoints_v1.csv
|   |-- dataset_changelog.json
|   `-- data_quality_report.json
|-- raw_data/
|   `-- rosgranstroy_map_data.json
`-- scripts/
    |-- 00_fetch_rosgranstroy.py
    |-- 01_parse_rosgranstroy.py
    |-- 02_build_geojson.py
    |-- 03_update_changelog.py
    |-- 04_write_quality_report.py
    `-- run_pipeline.py
```

## Источник данных

Канонический итоговый файл проекта:

- `data/checkpoints.geojson`

Промежуточные артефакты пайплайна:

- `raw_data/rosgranstroy_map_data.json` — сырой ответ API;
- `data/checkpoints_v1.csv` — нормализованный табличный слой перед сборкой GeoJSON.
- `data/dataset_changelog.json` — история версий датасета;
- `data/data_quality_report.json` — отчет расширенной проверки качества данных.

Фронтенд читает `data/checkpoints.geojson`, а страница версий дополнительно использует `data/dataset_changelog.json`. Quality report пока нужен для CI и обслуживания данных.

## Локальный запуск

Важно: проект нужно открывать через локальный сервер, иначе браузер заблокирует `fetch()` для GeoJSON.

Вариант 1:

```bash
python -m http.server 8000
```

Вариант 2:

```bash
npx serve .
```

После запуска открой `http://localhost:8000`.

## Обновление данных

Полный пайплайн запускается так:

```bash
python scripts/run_pipeline.py
```

Что делает пайплайн:

1. Загружает свежий снимок данных из API Росгранстроя.
2. Нормализует записи в CSV.
3. Собирает финальный `data/checkpoints.geojson`.
4. Обновляет `data/dataset_changelog.json`, если версия датасета изменилась.
5. Записывает `data/data_quality_report.json` с ошибками и предупреждениями качества.

Scheduled workflow `Refresh Data` запускает этот pipeline еженедельно и открывает pull request только при изменениях. В тело PR добавляется краткая сводка quality report: количество проверенных записей, блокирующих ошибок, предупреждений и первые предупреждения.

## Пользовательские сценарии

- Найти КПП: используйте поиск, фильтры по типу, статусу, стране и субъекту РФ, быстрые пресеты и сортировку.
- Сохранить нужные КПП: нажмите звездочку у карточки, затем включите фильтр `Избранные`.
- Поделиться ракурсом: кнопка `Поделиться ссылкой` копирует URL с фильтрами, выбранным КПП, координатами карты, zoom и спутниковым режимом; QR генерируется локально.
- Сравнить два пункта: кнопка `Сравнить` держит две последние выбранные карточки и показывает различия рядом.
- Работать офлайн: после первого успешного открытия service worker кэширует оболочку приложения и данные; при потере сети появляется offline-индикатор.
- Проверить данные: страница `Версии данных` показывает текущую версию, сводку по статусам/типам и changelog.
- Сообщить о проблеме: карточка КПП содержит ссылку на GitHub issue с предзаполненным контекстом.

## Проверки

Перед коммитом полезно запускать:

```bash
npm run format:check
npm run lint
npm run test:frontend
python -m unittest discover -s tests -v
git diff --check
```

Что покрыто тестами:

- smoke-тест основного фронтенда и URL-state;
- модульные проверки `favorites`, `recent`, `share`, `quality`, `report`, PWA manifest и service worker registration;
- service-worker smoke check для app-shell precache;
- визуальные HTML-снапшоты ключевых UI-блоков;
- Python-валидация raw payload, CSV rows, GeoJSON, changelog и расширенного data quality layer.

## Формат данных

Финальный файл содержит `FeatureCollection`, где каждая запись — это `Point`. Исходные поля приходят из датасета, а на клиенте дополнительно нормализуются в служебные поля вроде `__name`, `__type`, `__status`, `__country`, `__subject` и `__search`.

## Ограничения

- проект носит информационный характер и не является официальным источником;
- статусы КПП могут меняться, поэтому данные требуют периодического обновления;
- точность координат зависит от исходного датасета.

## Лицензия

Проект распространяется по лицензии **Personal Use License**. Полные условия см. в [`LICENSE`](./LICENSE).

## Автор

@IngannamorteScienceDev
