// Isolated architecture fixtures. These names/counts are not Pokémon facts.
export function catalogueFixture(dataVersion = "fixture-1") {
  const release = (id, language, name) => ({
    id,
    game: "pokemon",
    displayName: name,
    officialName: `${name} (development fixture)`,
    language,
    region: language === "en" ? "international" : "CN",
    series: "Development fixture",
    releaseDate: "2026-01-01",
    setCode: null,
    printedDenominator: 88,
    numberedCardCount: 100,
    checklistStatus: "verified",
    readyForApp: true,
    cardsFile: `sets/${language}/${id}.json`,
    aliases: name.includes("Perfect") ? ["Perfect Order", "PO"] : [name],
    source: {
      primary: "https://example.invalid/development-fixture",
      secondary: [],
    },
  });
  const releases = [
    release("perfect-order-en", "en", "Perfect Order"),
    release("fixture-second-en", "en", "Second Fixture"),
    release("fixture-cn", "zh-Hans", "中文测试"),
  ];
  const manifest = {
    schemaVersion: 1,
    dataVersion,
    generatedAt: "2026-10-07",
    testFixture: true,
    releases,
  };
  const packs = Object.fromEntries(
    releases.map((r) => [
      r.id,
      {
        schemaVersion: 1,
        releaseId: r.id,
        language: r.language,
        cards: Array.from({ length: 100 }, (_, index) => {
          const number = String(index + 1);
          return {
            id: `fixture:${r.id}:${number}`,
            releaseId: r.id,
            language: r.language,
            collectorNumber: number,
            displayNumber: number.padStart(3, "0"),
            printedNumber: `${number.padStart(3, "0")}/088`,
            sortNumber: index + 1,
            name:
              r.language === "en"
                ? `Fixture card ${number}`
                : `测试卡 ${number}`,
            rarity: null,
            illustrator: null,
            variants: [{ id: "regular", label: "Regular fixture finish" }],
            images: { small: null, large: null, source: null },
            providerRefs: { fixture: "external-" + number },
            source: { fixture: true },
          };
        }),
      },
    ]),
  );
  return { manifest, packs };
}
