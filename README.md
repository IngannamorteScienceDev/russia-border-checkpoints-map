# Russia Border Checkpoints Globe

[![Frontend](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-orange)](#)
[![Globe](https://img.shields.io/badge/globe-CesiumJS-blueviolet)](https://cesium.com/platform/cesiumjs/)
[![Data](https://img.shields.io/badge/data-GeoJSON-yellow)](#)
[![Pipeline](https://img.shields.io/badge/data%20pipeline-Python-informational)](#)

Минимальное CesiumJS-приложение для отображения пунктов пропуска через государственную границу РФ.

Проект намеренно сброшен до чистого ядра: глобус, точки КПП и минимальная карточка выбранной точки. Старые функции вроде фильтров, избранного, QR, экспорта, сравнения, PWA-оболочки и исследовательских панелей удалены из фронтенда. Их можно будет вернуть заново, уже как аккуратные Cesium-native сценарии.

## Текущее ядро

- локальный CesiumJS runtime;
- загрузка `data/checkpoints.geojson`;
- нормализация базовых полей КПП;
- отрисовка точек через Cesium `CustomDataSource` и `Entity`;
- клик по точке открывает минимальный инспектор КПП;
- цветовая легенда типов КПП;
- Python pipeline для обновления данных остается в проекте.

## Локальный запуск

Открывайте проект через локальный HTTP-сервер, иначе браузер может заблокировать `fetch()` GeoJSON.

```bash
python -m http.server 8000
```

После запуска откройте `http://localhost:8000`.

## Данные

Основной файл фронтенда:

- `data/checkpoints.geojson`

Pipeline и служебные отчеты данных сохранены:

- `raw_data/rosgranstroy_map_data.json`
- `data/checkpoints_v1.csv`
- `data/dataset_changelog.json`
- `data/data_quality_report.json`
- `data/research_coverage_report.json`
- `data/checkpoint_enrichment.json`

Полный pipeline:

```bash
python scripts/run_pipeline.py
```

## Проверки

```bash
npm run lint
npm run format:check
npm run test:frontend
python -m unittest discover -s tests -v
```

## Следующий этап

Новые функции стоит добавлять по одной:

- поиск;
- фильтр по типу;
- выбранная точка с Cesium-подсветкой;
- геодезическая линия и радиус;
- режимы камеры;
- слои;
- экспорт и share;
- аналитика данных.

## Лицензия

Проект распространяется по лицензии **Personal Use License**. Полные условия см. в `LICENSE`.
