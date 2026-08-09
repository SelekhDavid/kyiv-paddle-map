import fs from "fs";
import path from "path";

const outDir = path.resolve("docs/research");
const geo = JSON.parse(
  fs.readFileSync(path.join(outDir, "municipal-beaches.geojson"), "utf8"),
);
const meta = JSON.parse(
  fs.readFileSync(path.join(outDir, "municipal-beaches-layer-meta.json"), "utf8"),
);

const beaches = geo.features.map((f) => {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  return {
    objectid: p.objectid,
    globalid: p.globalid,
    name: p.name,
    district: p.district,
    waterobject: p.waterobject,
    worktime: p.worktime,
    beachstatus: p.beachstatus,
    beachstatusLabel: p.beachstatus === 1 ? "Так (купатися можна за даними ІАС)" : "Ні",
    lat,
    lng,
    point_x: p.point_x,
    point_y: p.point_y,
    amenities: {
      shower: p.shower,
      safeguard: p.safeguard,
      drinkingfountain: p.drinkingfountain,
      flatenter: p.flatenter,
      busstop: p.busstop,
      sport: p.sport,
      child: p.child,
      dresing: p.dresing,
      shadowcanopies: p.shadowcanopies,
      wc: p.wc,
      wifi: p.wifi,
      availability: p.availability,
      rampant: p.rampant,
      notresholdenter: p.notresholdenter,
    },
    tel: p.tel,
    web: p.web,
    last_editeddate: p.last_editeddate
      ? new Date(p.last_editeddate).toISOString()
      : null,
  };
});

beaches.sort((a, b) => a.name.localeCompare(b.name, "uk"));

const summary = {
  scrapedAt: new Date().toISOString(),
  sourceUrl:
    "https://gis.kyivcity.gov.ua/api/rest/services/Пляжі_та_зони_відпочинку/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson",
  openDataDataset:
    "https://data.kyivcity.gov.ua/dataset/perelik-munitsypalnykh-pliazhiv-kyieva-dep-ecology",
  dashboard: "https://data.kyivcity.gov.ua/dashboard/munitsypalni-pliazhi-kyieva",
  featureCount: beaches.length,
  beachstatusValues: [...new Set(beaches.map((b) => b.beachstatus))],
  noteUk:
    "Поле beachstatus у GeoJSON = «Чи можна купатись» (0/1). На момент зрізу всі 15 = 1. Це адмін/інфраструктурний статус з ІАС «Майно», НЕ еквівалент свіжих лабораторних проб ЦКПХ/Плесо.",
  fieldsFromLayer: (meta.fields || []).map((f) => ({
    name: f.name,
    type: f.type,
    alias: f.alias,
  })),
  beaches,
};

fs.writeFileSync(
  path.join(outDir, "municipal-beaches-snapshot.json"),
  JSON.stringify(summary, null, 2),
  "utf8",
);

console.log("count", beaches.length);
for (const b of beaches) {
  console.log(
    `${b.name} | ${b.district} | ${b.waterobject} | status=${b.beachstatus} | ${b.lat.toFixed(5)},${b.lng.toFixed(5)} | edited=${b.last_editeddate}`,
  );
}
