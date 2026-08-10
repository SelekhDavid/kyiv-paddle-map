"""Pack a z/x/y.mvt directory into a PMTiles v3 archive."""
from __future__ import annotations

import sys
from pathlib import Path

from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: _pack_pmtiles.py <tile_dir> <out.pmtiles>", file=sys.stderr)
        return 2

    tile_dir = Path(sys.argv[1])
    out = Path(sys.argv[2])
    out.parent.mkdir(parents=True, exist_ok=True)

    entries: list[tuple[int, bytes]] = []
    min_z, max_z = 99, 0
    for path in tile_dir.rglob("*.mvt"):
        y = int(path.stem)
        x = int(path.parent.name)
        z = int(path.parent.parent.name)
        min_z = min(min_z, z)
        max_z = max(max_z, z)
        entries.append((zxy_to_tileid(z, x, y), path.read_bytes()))

    if not entries:
        print("No tiles to pack", file=sys.stderr)
        return 1

    entries.sort(key=lambda t: t[0])

    with out.open("wb") as f:
        w = Writer(f)
        for tid, data in entries:
            w.write_tile(tid, data)
        # API: finalize(header, metadata) — header first
        w.finalize(
            {
                "tile_type": TileType.MVT,
                "tile_compression": Compression.NONE,
                "min_zoom": min_z,
                "max_zoom": max_z,
            },
            {
                "name": "kyiv-paddle-water",
                "description": "OSM water shapes for Kyiv oblast paddle map",
                "type": "overlay",
                "format": "pbf",
                "generator": "build-water-pmtiles.mjs",
                "vector_layers": [
                    {
                        "id": "water",
                        "fields": {
                            "osmId": "String",
                            "name": "String",
                            "nameUk": "String",
                            "kind": "String",
                        },
                    }
                ],
            },
        )

    print(f"Packed {len(entries)} tiles -> {out} (z{min_z}-{max_z})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
