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

console.log("versions page smoke test passed");
