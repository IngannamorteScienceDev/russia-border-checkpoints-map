# Russia Border Checkpoints Map — Interactive Map of RF Border Crossings

[![Version](https://img.shields.io/badge/version-v1.0.1-blue)](https://github.com/IngannamorteScienceDev/russia-border-checkpoints-map/releases)
[![Status](https://img.shields.io/badge/status-stable-success)](https://github.com/IngannamorteScienceDev/russia-border-checkpoints-map)
[![License](https://img.shields.io/badge/license-Personal%20Use-lightgrey)](./LICENSE)
[![Frontend](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-orange)](#)
[![Map](https://img.shields.io/badge/map-MapLibre%20GL-blueviolet)](https://maplibre.org/)
[![Data](https://img.shields.io/badge/data-GeoJSON-yellow)](#)
[![Pipeline](https://img.shields.io/badge/data%20pipeline-Python-informational)](#)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-black?logo=github)](https://ingannamortesciencedev.github.io/russia-border-checkpoints-map/)

Интерактивная карта пунктов пропуска через государственную границу Российской Федерации.  
Проект работает полностью на **чистом фронтенде** (HTML/CSS/JS) и отображает КПП из единого GeoJSON-файла.

---

## Демо

- Открыть карту: [ [**GitHub Pages**](https://ingannamortesciencedev.github.io/russia-border-checkpoints-map/) ]

---

## Возможности

- интерактивная карта с отображением всех КПП на территории РФ и на границе
- кластеризация точек и корректное масштабирование (клик по кластеру → приближение)
- фильтрация КПП по типу и статусу
- поиск по названию, региону, стране и типу
- попап с подробной информацией о КПП (тип, статус, субъект РФ, координаты и доп. поля)
- геолокация пользователя и расчёт расстояния до выбранных КПП
- спутниковый режим как **raster-overlay**, без потери отображения КПП

---

## Интерфейс (управление)

- **Поиск** — фильтрует КПП по названию, региону, стране, типу и статусу
- **Фильтры** — тип КПП и статус КПП
- **Гео** — включает геолокацию и показывает дистанцию до КПП
- **Спутник** — включает/выключает спутниковый слой (raster overlay)
- **Список КПП** — сгруппирован по странам (соседним государствам), кликабелен

---

## Структура проекта

```

russia-border-checkpoints-map/
│
├─ index.html
├─ style.css
├─ app.js
│
├─ data/
│  └─ checkpoints.geojson
│
└─ scripts/
└─ (python-пайплайн подготовки данных)

````

---

## Данные

Данные карты хранятся в файле:

- `data/checkpoints.geojson`

Формат данных:

- `FeatureCollection`
- каждая точка — `Point`
- поля (`properties`) могут отличаться по названиям, поэтому в `app.js` используются
  нормализаторы и резервные ключи (fallback логика)

Проект автоматически приводит данные к внутренним полям:

- `__id` — уникальный идентификатор
- `__name` — название КПП
- `__type` — тип КПП (авто/жд/морской/пеший и т.д.)
- `__status` — статус (действует/закрыт/ограничен/неизвестно)
- `__country` — сопредельная страна
- `__subject` — субъект РФ
- `__coords` — координаты в удобном виде
- `__search` — строка для поиска

---

## Запуск локально

⚠️ Важно: запускать проект нужно через локальный сервер, потому что браузер блокирует `fetch()` GeoJSON при открытии файла напрямую.

### Вариант 1 — Python

```bash
python -m http.server 8000
````

Открыть:

* `http://localhost:8000`

### Вариант 2 — Node (serve)

```bash
npx serve .
```

---

## Обновление данных (Python pipeline)

В репозитории предусмотрен пайплайн подготовки и нормализации данных (папка `scripts/`).
По результату работы пайплайна формируется финальный файл:

* `data/checkpoints.geojson`

---

## Ограничения и дисклеймер

* проект носит информационный характер и не является официальным источником
* статусы КПП могут меняться — данные требуют периодического обновления
* точность координат зависит от исходного датасета

---

## Лицензия

Проект распространяется по лицензии **Personal Use License**.

Разрешено:

* использовать проект в личных целях
* запускать локально и изучать код

Запрещено:

* коммерческое использование
* перепубликация, форки и использование кода в других проектах без разрешения автора

Полный текст находится в файле `LICENSE`.

---

## Roadmap

* улучшение данных и валидация координат
* расширенные фильтры (по субъекту РФ / по стране)
* экспорт/скачивание отфильтрованных КПП
* улучшение мобильного UX (анимации, состояния панели, быстрые кнопки)

---

## Автор

@IngannamorteScienceDev
