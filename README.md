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
- геолокация пользователя и расчёт расстояния до выбранного пункта;
- спутниковый слой поверх базовой карты.

## Структура проекта

```text
russia-border-checkpoints-map/
|-- index.html
|-- style.css
|-- app.js
|-- data/
|   |-- checkpoints.geojson
|   `-- checkpoints_v1.csv
|-- raw_data/
|   `-- rosgranstroy_map_data.json
`-- scripts/
    |-- 00_fetch_rosgranstroy.py
    |-- 01_parse_rosgranstroy.py
    |-- 02_build_geojson.py
    `-- run_pipeline.py
```

## Источник данных

Канонический итоговый файл проекта:

- `data/checkpoints.geojson`

Промежуточные артефакты пайплайна:

- `raw_data/rosgranstroy_map_data.json` — сырой ответ API;
- `data/checkpoints_v1.csv` — нормализованный табличный слой перед сборкой GeoJSON.

Фронтенд читает только `data/checkpoints.geojson`. Если обновляются данные, именно этот файл считается источником истины для карты.

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
