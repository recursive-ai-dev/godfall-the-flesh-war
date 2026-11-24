"""Reproduce all raster assets with the user's local Shed Dev Sprites generator."""
import json
import os
import sys
from pathlib import Path

source = Path(os.environ.get('SHED_SPRITES', '/home/woez/Projects/shed-dev-sprites'))
sys.path.insert(0, str(source))

from generator import get_generator
from generator.math.wang import BLOB_47_MASKS
from generator.sheet import make_sheet
from generator.sprites.base import CLIP_ACTIONS
import generator.sprites.cover  # noqa: F401
import generator.sprites.scene  # noqa: F401

out = Path(__file__).resolve().parents[1] / 'public' / 'sprites'
out.mkdir(parents=True, exist_ok=True)

MASTER_PALETTE = 'endesga32'
DIRS = ['front', 'right', 'back', 'left']
manifest = []


def save(name, generator_type, seed, size=None, **options):
    gen = get_generator(generator_type, size=size) if size is not None else get_generator(generator_type)
    opts = dict(options)
    if 'master_palette' not in opts:
        opts['master_palette'] = MASTER_PALETTE
    sprite = gen.generate(seed, **opts)
    sprite.image.save(out / (name + '.png'))
    manifest.append(dict(
        file=name + '.png',
        generator=generator_type,
        seed=seed,
        size=list(sprite.size),
        options=opts,
        pixel_hash=sprite.pixel_hash,
    ))


def atlas_frames(unit, f, palette, role, seed, weapon_style=None):
    """Return the list of generator sprites for one unit atlas (8 columns)."""
    human48 = get_generator('human', size=48)
    frames = []

    def rider(direction, action, frame):
        opts = dict(
            palette=palette,
            role=role,
            direction=direction,
            action=action,
            frame=frame,
            frames=8,
            align=False,
            master_palette=MASTER_PALETTE,
        )
        if weapon_style is not None:
            opts['weapon_style'] = weapon_style
        return human48.generate(seed, **opts)

    def rows(actions):
        for action in actions:
            for direction in DIRS:
                for frame in range(8):
                    yield action, direction, frame

    if unit == 'cavalry':
        acts = ['walk', 'attack']
        mount64 = get_generator('mount', size=64)
        for action, direction, frame in rows(acts):
            r = rider(direction, 'walk', frame).image
            frames.append(mount64.generate(
                seed,
                faction=f,
                direction=direction,
                action=action,
                frame=frame,
                frames=8,
                rider=r,
                cell=64,
                master_palette=MASTER_PALETTE,
            ))
    elif unit == 'siege':
        acts = ['walk', 'attack']
        machine64 = get_generator('machine', size=64)
        for action, direction, frame in rows(acts):
            frames.append(machine64.generate(
                seed,
                faction=f,
                direction=direction,
                action=action,
                frame=frame,
                frames=8,
                cell=64,
                master_palette=MASTER_PALETTE,
            ))
    else:
        acts = list(CLIP_ACTIONS) + (['chop', 'mine', 'build', 'harvest'] if unit == 'worker' else [])
        for action, direction, frame in rows(acts):
            frames.append(rider(direction, action, frame))
    return frames, acts


FACTIONS = [
    ('human', 'grim_steel', 'coastal', 100),
    ('darkelf', 'spire_anima', 'moor', 200),
    ('corrupted', 'cult_blood', 'cinder', 300),
]

ROLES = {
    'human': ['refugee', 'player', 'guard', 'orithel-the-last-watcher', 'scribe-althea'],
    'darkelf': ['mistress-morveth', 'reeve-toran', 'elodie-outrunner', 'mistress-morveth', 'hermit-cassian'],
    'corrupted': ['refugee', 'adept', 'kieran-blind-oar', 'adept', 'hermit-cassian'],
}

WEAPONS = {
    'human': {'worker': 'none', 'melee': 'sword', 'ranged': 'halberd'},
    'darkelf': {'worker': 'none', 'melee': 'sword', 'ranged': 'halberd'},
    'corrupted': {'worker': 'none', 'melee': 'sword', 'ranged': 'staff'},
}

for f, palette, theme, base in FACTIONS:
    for i, unit in enumerate(['worker', 'melee', 'ranged', 'cavalry', 'siege']):
        role = ROLES[f][i]
        ws = WEAPONS[f].get(unit)
        frames, actions = atlas_frames(unit, f, palette, role, base + i, weapon_style=ws)
        cell = frames[0].image.width
        # Save portrait/crest frame (idle front for human, walk front for mount/siege)
        frames[0].image.save(out / f'{f}-{unit}-0.png')
        atlas, metadata = make_sheet(frames, cols=8, margin=0, transparent=True)
        metadata['actions'] = actions
        metadata['directions'] = DIRS
        metadata['cell'] = cell
        name = f'{f}-{unit}-atlas'
        atlas.save(out / (name + '.png'))
        (out / (name + '.json')).write_text(json.dumps(metadata, indent=2))
        manifest.append(dict(
            file=name + '.png',
            generator={'cavalry': 'mount64 + human48 rider', 'siege': 'machine64'}.get(unit, 'human48 + generator.sheet.make_sheet'),
            seed=base + i,
            options=dict(palette=palette, role=role, weapon_style=ws, frames=8, align=False, master_palette=MASTER_PALETTE),
            actions=actions,
            directions=DIRS,
            cell=cell,
            hashes=[frame.pixel_hash for frame in frames],
        ))
    for i, building in enumerate(['hall', 'farm', 'barracks', 'mill', 'blacksmith', 'stables', 'tower']):
        save(f'{f}-{building}', 'structure', base + i, faction=f, kind=building)

# Base 32x32 terrain tiles + 4 grass variants
for i, kind in enumerate(['grass', 'dirt', 'water', 'moss', 'sand', 'stone', 'wood']):
    extra = {'palette': 'wraith_ash'} if kind in ('grass', 'moss') else {}
    save(kind, 'tile', 50 + i, size=32, kind=kind, **extra)

for v in range(4):
    save(f'grass-{v}', 'tile', 50 + v * 17, size=32, kind='grass', palette='wraith_ash')

# 47-tile Blob Wang autotile atlases (32x32 per tile, 8 columns)
tile_gen32 = get_generator('tile', size=32)
for i, (kind, extra) in enumerate([
    ('water', {}),
    ('dirt', {}),
    ('stone', {}),
    ('moss', {'palette': 'wraith_ash'}),
]):
    tseed = 50 + i
    blob_frames = [
        tile_gen32.generate(tseed, kind=kind, mask=m, blob=True, master_palette=MASTER_PALETTE, **extra)
        for m in BLOB_47_MASKS
    ]
    atlas, metadata = make_sheet(blob_frames, cols=8, margin=0, transparent=False)
    metadata['masks'] = list(BLOB_47_MASKS)
    metadata['mask_to_index'] = {str(m): idx for idx, m in enumerate(BLOB_47_MASKS)}
    bname = f'{kind}-blob47'
    atlas.save(out / (bname + '.png'))
    (out / (bname + '.json')).write_text(json.dumps(metadata, indent=2))
    manifest.append(dict(
        file=bname + '.png',
        generator='tile32-blob47',
        seed=tseed,
        cell=32,
        count=len(BLOB_47_MASKS),
        master_palette=MASTER_PALETTE,
    ))

# Animated world props (4 frames, 32x32)
prop_gen32 = get_generator('prop', size=32)
for i, ptype in enumerate(['campfire', 'brazier', 'lantern', 'sign']):
    pframes = [
        prop_gen32.generate(700 + i, prop_type=ptype, frame=fr, frames=4, master_palette=MASTER_PALETTE)
        for fr in range(4)
    ]
    atlas, metadata = make_sheet(pframes, cols=4, margin=0, transparent=True)
    pname = f'prop-{ptype}'
    atlas.save(out / (pname + '.png'))
    (out / (pname + '.json')).write_text(json.dumps(metadata, indent=2))
    manifest.append(dict(file=pname + '.png', generator='prop32', seed=700 + i, prop_type=ptype, cell=32))

# Wide 16:9 illustrated scenes for Title, Victory, Defeat + square cover
save('scene-title', 'scene', 42, mood='dark', title='')
save('scene-victory', 'scene', 43, mood='warm', title='')
save('scene-defeat', 'scene', 44, mood='eerie', title='')
save('cover', 'cover', 42, mood='dark', title='')

# High-res Relic, Ruin, Corpse, Gold Gem, and Role icons
save('relic', 'item', 800, size=64, category='shard', palette='corrupted_flesh')
save('gold-gem', 'item', 802, size=32, category='gem', palette='sacred_gold')
save('ruin', 'settlement', 801, size=48, theme='oldstone', part='wall_mid')
save('corpse', 'human', 803, size=32, palette='wraith_ash', role='refugee', direction='right', action='death', frame=7, frames=8, align=False)

for i, kind in enumerate(['hammer', 'sword', 'bow', 'shield', 'staff']):
    save('role-' + kind, 'item', 810 + i, size=32, category=kind, palette='bone_relic')

(out / 'manifest.json').write_text(json.dumps(dict(source=str(source), master_palette=MASTER_PALETTE, assets=manifest), indent=2))
print(f'Generated {len(manifest)} assets from {source} (palette={MASTER_PALETTE})')
