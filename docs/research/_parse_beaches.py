# -*- coding: utf-8 -*-
"""Decode Kyiv municipal beaches GeoJSON (Windows-1251 payload) into UTF-8 catalog."""
import json
from pathlib import Path

# Stable IDs keyed by ArcGIS objectid (authoritative in kyivcity GIS).
BY_OBJECTID = {
    26: ("beach-chortoryi", "Чорторий", "Деснянський", "р. Дніпро"),
    27: ("beach-raiduha", "Райдуга", "Дніпровський", "озеро Райдуга"),
    22: ("beach-ostriv-obolonskyi", "Острів Оболонський", "Оболонський", "затока Наталка та р. Дніпро"),
    24: ("beach-peredmistna-slobidka", "Передмістна Слобідка", "Дніпровський", "р. Дніпро, острів Венеціанський"),
    23: ("beach-pushcha-vodytsia", "Пуща-Водиця", "Оболонський", "ставок Горащиха на р. Котурка у Пущі-Водиці (8 лінія)"),
    25: ("beach-zolotyi", "Золотий", "Дніпровський", "р. Дніпро, острів Венеціанський"),
    29: ("beach-veselka", "Веселка", "Дніпровський", "Русанівська протока"),
    28: ("beach-tsentralnyi", "Центральний", "Дніпровський", "річка Дніпро"),
    30: ("beach-verbnyi", "Вербний", "Оболонський", "озеро Вербне"),
    430: ("beach-telbin", "Тельбін", "Дніпровський", "озеро Тельбін"),
    830: ("beach-halernyi", "Галерний", "Голосіївський", "затока Галерна"),
    16: ("beach-venetsiia", "Венеція", "Дніпровський", "Венеціанська протока, острів Долобецький"),
    18: ("beach-dytiachyi", "Дитячий", "Дніпровський", "Венеціанська протока, острів Венеціанський"),
    20: ("beach-troieshchyna", "Троєщина", "Деснянський", "затока р. Десенка"),
    19: ("beach-molodizhnyi", "Молодіжний", "Дніпровський", "р. Десенка, острів Долобецький"),
}

# Map municipal beach IDs -> existing spots.json ids (when overlapping).
SPOT_LINKS = {
    "beach-telbin": ["telbin"],
    "beach-halernyi": ["koncha-zaspa"],
    "beach-venetsiia": ["hydropark"],
    "beach-dytiachyi": ["hydropark"],
    "beach-zolotyi": ["hydropark"],
    "beach-veselka": ["hydropark"],
    "beach-tsentralnyi": ["trukhaniv", "dnipro-kyiv-reach"],
    "beach-peredmistna-slobidka": ["dnipro-kyiv-reach"],
    "beach-troieshchyna": ["sonyachne"],
    "beach-pushcha-vodytsia": ["blakytne", "redkyne"],
    "beach-verbnyi": ["sobachne"],
    "beach-ostriv-obolonskyi": ["dnipro-kyiv-reach"],
    "beach-chortoryi": ["desna-mouth"],
    "beach-raiduha": ["radunka"],
    "beach-molodizhnyi": ["hydropark"],
}

raw_path = Path(__file__).with_name("_tmp-beaches-raw.geojson")
b = raw_path.read_bytes()
# ArcGIS endpoint returns Windows-1251 bytes labeled as geojson.
data = json.loads(b.decode("cp1251"))

out = []
for f in data["features"]:
    p = f["properties"]
    oid = p.get("objectid")
    meta = BY_OBJECTID.get(oid)
    if meta:
        bid, name_uk, district_uk, water_uk = meta
    else:
        bid = f"beach-kyiv-{oid}"
        name_uk = p.get("name")
        district_uk = p.get("district")
        water_uk = p.get("waterobject")
    out.append(
        {
            "id": bid,
            "objectid": oid,
            "globalid": (p.get("globalid") or "").strip("{}"),
            "nameUk": name_uk,
            "districtUk": district_uk,
            "waterBodyUk": water_uk,
            "nameFromApi": p.get("name"),
            "beachstatus": p.get("beachstatus"),
            "lat": p.get("point_y"),
            "lng": p.get("point_x"),
            "web": p.get("web"),
            "lastEditedMs": p.get("last_editeddate"),
            "linkedSpotIds": SPOT_LINKS.get(bid, []),
            "sourceDataset": "perelik-munitsypalnykh-pliazhiv-kyieva-dep-ecology",
            "sourceUrl": "https://data.kyivcity.gov.ua/dashboard/munitsypalni-pliazhi-kyieva",
            "geojsonQueryUrl": (
                "https://gis.kyivcity.gov.ua/api/rest/services/"
                "%D0%9F%D0%BB%D1%8F%D0%B6%D1%96_%D1%82%D0%B0_%D0%B7%D0%BE%D0%BD%D0%B8_"
                "%D0%B2%D1%96%D0%B4%D0%BF%D0%BE%D1%87%D0%B8%D0%BD%D0%BA%D1%83/MapServer/0/query"
                "?where=1%3D1&outFields=*&returnGeometry=true&f=geojson"
            ),
            "noteUk": "GIS beachstatus is infrastructure/status flag, not water-lab pass/fail.",
        }
    )

out.sort(key=lambda x: x["nameUk"] or "")
clean = Path(__file__).with_name("kyiv-municipal-beaches-catalog.json")
clean.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("ok", len(out), clean)
for o in out:
    print(o["id"], o["nameUk"], o["lat"], o["lng"])
