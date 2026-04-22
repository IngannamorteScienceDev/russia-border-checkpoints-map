function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const elements = new Map();

function createElement() {
  return {
    innerHTML: "",
    style: {}
  };
}

globalThis.document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  }
};

globalThis.window = {
  location: {
    href: "https://example.test/russia-border-checkpoints-map/versions.html"
  }
};

globalThis.fetch = async (url) => {
  const href = String(url);

  if (href.includes("dataset_changelog.json")) {
    return {
      ok: true,
      async json() {
        return {
          entries: [
            {
              version: "2026-01-19-2-test",
              date: "2026-04-14",
              summary: "Test dataset snapshot.",
              changes: { totalDelta: 2, added: 2, removed: 0 },
              snapshot: { total: 2 }
            }
          ]
        };
      }
    };
  }

  if (href.includes("data_quality_report.json")) {
    return {
      ok: true,
      async json() {
        return {
          datasetVersion: "2026-01-19-2-test",
          generatedFrom: "data/checkpoints.geojson",
          summary: { checked: 2, errorCount: 0, warningCount: 1 },
          warnings: [
            "101: coordinates have low precision",
            "Duplicate coordinate pair detected: (55.0, 55.0): 100, 101"
          ],
          errors: []
        };
      }
    };
  }

  if (href.includes("research_coverage_report.json")) {
    return {
      ok: true,
      async json() {
        return {
          schemaVersion: 1,
          summary: {
            totalCheckpoints: 2,
            describedCheckpoints: 1,
            missingDescriptionCount: 1,
            descriptionCoveragePercent: 50,
            withEventCoverage: 1,
            missingEventCoverage: 1,
            eventCoveragePercent: 50,
            officialVerificationCoverage: 0,
            qualityIssueCount: 1
          },
          coverage: {
            description: { covered: 1, missing: 1, percent: 50 },
            eventsOrVerification: { covered: 1, missing: 1, percent: 50 },
            officialVerification: { covered: 0, missing: 2, percent: 0 },
            workingTime: { covered: 1, missing: 1, percent: 50 },
            source: { covered: 2, missing: 0, percent: 100 },
            lastUpdated: { covered: 2, missing: 0, percent: 100 },
            address: { covered: 1, missing: 1, percent: 50 },
            neighborCheckpoint: { covered: 0, missing: 2, percent: 0 },
            transportCorridor: { covered: 1, missing: 1, percent: 50 },
            branchContact: { covered: 1, missing: 1, percent: 50 }
          },
          byCountry: [
            {
              label: "Не указано",
              total: 1,
              described: 0,
              missingDescriptions: 1,
              descriptionPercent: 0
            }
          ],
          bySubject: [
            {
              label: "Кемеровская область",
              total: 1,
              described: 0,
              missingDescriptions: 1,
              descriptionPercent: 0
            }
          ],
          byType: [
            {
              label: "Воздушный пункт пропуска",
              total: 1,
              described: 0,
              missingDescriptions: 1,
              descriptionPercent: 0
            }
          ],
          queues: {
            missingDescriptions: [
              {
                id: "101",
                name: "Воздушный тест",
                subject: "Кемеровская область",
                country: "Не указано"
              }
            ],
            missingEvents: [
              {
                id: "101",
                name: "Воздушный тест",
                subject: "Кемеровская область",
                country: "Не указано"
              }
            ],
            missingWorkingTime: [
              {
                id: "101",
                name: "Воздушный тест",
                subject: "Кемеровская область",
                country: "Не указано"
              }
            ],
            qualityIssues: [
              {
                id: "101",
                name: "Воздушный тест",
                subject: "Кемеровская область",
                country: "Не указано",
                issues: ["missing_operational_status"]
              }
            ]
          }
        };
      }
    };
  }

  return {
    ok: true,
    async json() {
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [131.9, 43.1] },
            properties: {
              checkpoint_id: "100",
              checkpoint_name: "Тестовый КПП",
              checkpoint_type: "Автомобильный пункт пропуска",
              status: "Многосторонний",
              is_functional: "True",
              subject_name: "Приморский край",
              foreign_country: "Китай",
              source: "https://example.test/source",
              confidence_level: "high",
              last_updated: "2026-01-19T09:56:39.000000Z"
            }
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [86.95, 53.75] },
            properties: {
              checkpoint_id: "101",
              checkpoint_name: "Воздушный тест",
              checkpoint_type: "Воздушный пункт пропуска",
              status: "Двусторонний",
              is_functional: "False",
              subject_name: "Кемеровская область",
              foreign_country: "Не указано",
              source: "https://example.test/source",
              confidence_level: "high",
              last_updated: "2026-01-19T09:56:39.000000Z"
            }
          }
        ]
      };
    }
  };
};

await import(new URL("../js/versions.js", import.meta.url));
await new Promise((resolve) => setTimeout(resolve, 10));

const summaryHtml = elements.get("versionsSummary")?.innerHTML || "";

assert(summaryHtml.includes("versions-quality--warning"), "Quality warning card was not rendered.");
assert(summaryHtml.includes("Качество данных"), "Quality report heading was not rendered.");
assert(
  summaryHtml.includes("Исследовательское покрытие"),
  "Research coverage report heading was not rendered."
);
assert(summaryHtml.includes("1/2 описано"), "Research coverage summary was not rendered.");
assert(
  summaryHtml.includes("Без описания") &&
    summaryHtml.includes("Без событий / сверки") &&
    summaryHtml.includes("Без режима работы") &&
    summaryHtml.includes("Вопросы к данным"),
  "Research coverage queues were not rendered."
);
assert(
  summaryHtml.includes("index.html?research=missing-description") &&
    summaryHtml.includes("index.html?checkpoint=101&amp;q=101"),
  "Research coverage map links were not rendered."
);
assert(
  summaryHtml.includes("101: coordinates have low precision"),
  "Quality warning preview was not rendered."
);
assert(
  summaryHtml.includes("Низкая точность координат") && summaryHtml.includes("Дубли координат"),
  "Quality warnings were not grouped by type."
);
assert(
  summaryHtml.includes("index.html?checkpoint=101&amp;q=101") &&
    summaryHtml.includes("index.html?checkpoint=100&amp;q=100"),
  "Quality warning checkpoint links were not rendered."
);
assert(summaryHtml.includes("История версий"), "Dataset changelog was not rendered.");
assert(summaryHtml.includes("2026-01-19-2-test"), "Dataset version was not rendered.");
assert(
  summaryHtml.includes("Полнота карточек") &&
    summaryHtml.includes("Источник") &&
    summaryHtml.includes("Контакты филиала"),
  "Research field completeness section was not rendered."
);
assert(
  summaryHtml.includes("По странам") &&
    summaryHtml.includes("По субъектам РФ") &&
    summaryHtml.includes("По типам КПП"),
  "Research coverage hotspots were not rendered."
);
assert(
  summaryHtml.includes("index.html?research=missing-description&amp;country=") &&
    summaryHtml.includes("index.html?research=missing-description&amp;subject=") &&
    summaryHtml.includes("index.html?research=missing-description&amp;type=") &&
    summaryHtml.includes("index.html?research=missing-working-time"),
  "Research coverage hotspot links were not rendered."
);

console.log("versions page smoke test passed");
