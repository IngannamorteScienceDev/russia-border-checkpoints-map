# Russia Border Checkpoints Globe

[![Frontend](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-orange)](#)
[![Globe](https://img.shields.io/badge/globe-CesiumJS-blueviolet)](https://cesium.com/platform/cesiumjs/)
[![Data](https://img.shields.io/badge/data-GeoJSON-yellow)](#)
[![Pipeline](https://img.shields.io/badge/data%20pipeline-Python-informational)](#)

CesiumJS-приложение для просмотра пунктов пропуска через государственную границу РФ на глобусе.

Проект намеренно пересобирается заново вокруг Cesium. Старые функции вроде избранного, QR, экспорта, шаринга, PWA-оболочки, страниц версий и исследовательских панелей удалены из фронтенда. Возвращать функции стоит только тогда, когда они дают понятный сценарий работы на глобусе.

## Текущее ядро

- локальный CesiumJS runtime;
- загрузка `data/checkpoints.geojson`;
- восстановление русских строк, если в данных встречается mojibake;
- нормализация названия, типа, статуса, страны, региона, адреса и координат КПП;
- отрисовка точек через Cesium `CustomDataSource` и `Entity`;
- кластеризация точек средствами Cesium;
- поиск по названию, ID, стране, региону, типу и адресу;
- фильтры по типу и статусу;
- пресеты камеры: обзор, запад, юг, Сибирь, Дальний Восток;
- инспектор выбранного КПП с фокусом камеры на точке;
- адаптивный интерфейс для мобильных экранов.

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

Полезные Cesium-native функции, которые стоит добавлять дальше:

- измерение расстояний от выбранного КПП;
- геодезические линии к сопредельным пунктам;
- режим анализа плотности по участкам границы;
- аккуратные слои данных вместо старой панели слоев;
- экспорт только после того, как будет понятен рабочий сценарий;
- визуальная проверка качества координат прямо на глобусе.

## Лицензия

Проект распространяется по лицензии **Personal Use License**. Полные условия см. в `LICENSE`.
