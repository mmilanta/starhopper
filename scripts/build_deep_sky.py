#!/usr/bin/env python3
"""Rebuild the curated deep-sky snapshot from a pinned OpenNGC release.

Usage: python3 scripts/build_deep_sky.py [local-NGC.csv] [local-surfaces_catgen.dat] [local-addendum.csv]
The optional local CSV avoids a network request.
"""
import csv
import io
import json
import re
from pathlib import Path
import sys
from urllib.request import urlopen

REVISION = "be3cd6c5498806a2fbb2f7e0452ef802dbb02be0"
SOURCE = f"https://raw.githubusercontent.com/mattiaverga/OpenNGC/{REVISION}/database_files/NGC.csv"
SELECTION = {'NGC0224': 'Andromeda Galaxy', 'NGC0598': 'Triangulum Galaxy', 'NGC0292': 'Small Magellanic Cloud', 'NGC3031': 'Bode’s Galaxy', 'NGC3034': 'Cigar Galaxy', 'NGC4594': 'Sombrero Galaxy', 'NGC4826': 'Black Eye Galaxy', 'NGC5055': 'Sunflower Galaxy', 'NGC5128': 'Centaurus A', 'NGC5194': 'Whirlpool Galaxy', 'NGC5236': 'Southern Pinwheel Galaxy', 'NGC5457': 'Pinwheel Galaxy', 'NGC4565': 'Needle Galaxy', 'NGC4631': 'Whale Galaxy', 'NGC6946': 'Fireworks Galaxy', 'NGC1976': 'Orion Nebula', 'NGC1952': 'Crab Nebula', 'NGC6514': 'Trifid Nebula', 'NGC6523': 'Lagoon Nebula', 'NGC6611': 'Eagle Nebula', 'NGC6618': 'Omega Nebula', 'NGC6720': 'Ring Nebula', 'NGC6853': 'Dumbbell Nebula', 'NGC7293': 'Helix Nebula', 'NGC6543': 'Cat’s Eye Nebula', 'NGC7009': 'Saturn Nebula', 'NGC6302': 'Butterfly Nebula', 'NGC1499': 'California Nebula', 'NGC2024': 'Flame Nebula', 'NGC2070': 'Tarantula Nebula', 'NGC2238': 'Rosette Nebula', 'NGC6888': 'Crescent Nebula', 'NGC6960': 'Veil Nebula', 'NGC7000': 'North America Nebula', 'NGC7023': 'Iris Nebula', 'NGC7635': 'Bubble Nebula', 'IC0405': 'Flaming Star Nebula', 'IC5070': 'Pelican Nebula', 'IC5146': 'Cocoon Nebula'}


CLUSTERS = {
    'NGC6205': 'Hercules Globular Cluster',
    'NGC7089': 'M2 Globular Cluster',
    'NGC5272': 'M3 Globular Cluster',
    'NGC6121': 'M4 Globular Cluster',
    'NGC5904': 'M5 Globular Cluster',
    'NGC7078': 'M15 Globular Cluster',
    'NGC6656': 'M22 Globular Cluster',
    'NGC6341': 'M92 Globular Cluster',
    'NGC0104': '47 Tucanae',
    'NGC5139': 'Omega Centauri',
    'Mel022': 'Pleiades',
    'C041': 'Hyades',
    'NGC2632': 'Beehive Cluster',
    'NGC6705': 'Wild Duck Cluster',
    'NGC6405': 'Butterfly Cluster',
    'NGC6475': 'Ptolemy’s Cluster',
    'NGC2168': 'M35 Open Cluster',
    'NGC1960': 'M36 Open Cluster',
    'NGC2099': 'M37 Open Cluster',
    'NGC1912': 'M38 Open Cluster',
    'NGC2682': 'M67 Open Cluster',
    'NGC0869': 'h Persei Cluster',
    'NGC0884': 'Chi Persei Cluster',
    'NGC4755': 'Jewel Box Cluster',
    'IC2602': 'Southern Pleiades',
    'NGC3532': 'Wishing Well Cluster',
}
EXTRA_ALIASES = {
    'NGC6205': ['Hercules Cluster', 'Great Globular Cluster in Hercules'],
    'Mel022': ['Seven Sisters', 'Mel 22'],
    'C041': ['C41', 'Mel 25', 'Melotte 25'],
    'NGC0104': ['47 Tuc'],
    'NGC0869': ['Double Cluster h Persei'],
    'NGC0884': ['χ Persei', 'Double Cluster Chi Persei'],
}
SELECTION.update(CLUSTERS)
SELECTION['ESO056-115'] = 'Large Magellanic Cloud'
EXTRA_ALIASES['ESO056-115'] = ['LMC', 'Big Magellanic Cloud']
EXTRA_ALIASES['NGC0292'] = ['SMC']


def angle(value):
    hours, minutes, seconds = map(float, value.lstrip("+-").split(":"))
    return (-1 if value.startswith("-") else 1) * (hours + minutes / 60 + seconds / 3600)


def read_outlines(text):
    # Catgen surfaces retain the source brightness level; the Stellarium export
    # merges the levels and cannot distinguish the faint envelope from the core.
    levels = {}
    polygon = None
    for line in text.splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        ra, dec, action = parts[:3]
        if action == '0':
            level, name = int(parts[3]), parts[4].split('_lv')[0]
            polygon = []
            levels.setdefault(name, {}).setdefault(level, []).append(polygon)
        if polygon is not None:
            # Catgen coordinates are already in degrees, unlike Stellarium RA.
            polygon.append([float(ra), float(dec)])
        if action == '1':
            polygon = None
    return {name: {'level': max(available), 'polygons': available[max(available)]}
            for name, available in levels.items()}


def build(text, outline_text, addendum_text):
    rows = {row["Name"]: row for row in csv.DictReader(io.StringIO(text), delimiter=";")}
    rows.update({row["Name"]: row for row in csv.DictReader(io.StringIO(addendum_text), delimiter=";")})
    outlines = read_outlines(outline_text)
    result = []
    for identifier, name in SELECTION.items():
        row = rows[identifier]
        match = re.fullmatch(r"([A-Za-z]+)([0-9]+)", identifier)
        if match:
            prefix, number = match.groups()
            prefix = {"Mel": "Melotte", "C": "Caldwell"}.get(prefix, prefix)
            designation = f"{prefix} {int(number)}"
        else:
            designation = re.sub(r"^([A-Za-z]+)", r"\1 ", identifier)
        aliases = [designation, *row["Common names"].split(","), *EXTRA_ALIASES.get(identifier, [])]
        if row["M"]:
            aliases.extend([f"M {int(row['M'])}", f"Messier {int(row['M'])}"])
        for alias in [name, *aliases.copy()]:
            for suffix in [" Galaxy", " Nebula", " Cluster"]:
                if alias.endswith(suffix):
                    aliases.append(alias[:-len(suffix)])
        result.append({
            "id": identifier, "name": name,
            "type": "galaxy" if row["Type"] == "G" else "cluster" if row["Type"] in ["OCl", "GCl"] else "nebula", "subtype": row["Type"],
            "ra": angle(row["RA"]) * 15, "dec": angle(row["Dec"]),
            "mag": float(row["V-Mag"]) if row["V-Mag"] else None,
            "constellation": row["Const"], "designation": designation,
            "aliases": sorted({a for a in aliases if a and a != name}),
            "majorArcmin": float(row["MajAx"]) if row["MajAx"] else None,
            "minorArcmin": float(row["MinAx"]) if row["MinAx"] else None,
            "positionAngle": float(row["PosAng"]) if row["PosAng"] else 0,
            "coordinateSource": "OpenNGC",
        })
        # Rosette's NGC2237 contour covers the common nebula complex containing
        # the selected NGC2238 entry. Preserve that provenance explicitly.
        # OpenNGC's file named LMC traces a small off-centre emission region,
        # so the galaxy uses its catalogue centre and angular axes instead.
        outline_id = {'NGC2238': 'NGC2237'}.get(identifier, identifier)
        if outline_id in outlines:
            result[-1]['outlines'] = outlines[outline_id]['polygons']
            result[-1]['outlineLevel'] = outlines[outline_id]['level']
            result[-1]['outlineSource'] = f'OpenNGC / {outline_id}'
    return result


if __name__ == "__main__":
    text = Path(sys.argv[1]).read_text() if len(sys.argv) > 1 else urlopen(SOURCE, timeout=30).read().decode()
    outline_source = f'https://raw.githubusercontent.com/mattiaverga/OpenNGC/{REVISION}/outlines/surfaces_catgen.dat'
    outline_text = Path(sys.argv[2]).read_text() if len(sys.argv) > 2 else urlopen(outline_source, timeout=30).read().decode()
    addendum_source = f'https://raw.githubusercontent.com/mattiaverga/OpenNGC/{REVISION}/database_files/addendum.csv'
    addendum_text = Path(sys.argv[3]).read_text() if len(sys.argv) > 3 else urlopen(addendum_source, timeout=30).read().decode()
    destination = Path(__file__).resolve().parents[1] / "public/data/deep-sky.json"
    destination.write_text(json.dumps(build(text, outline_text, addendum_text), ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(SELECTION)} objects to {destination}")
