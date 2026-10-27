"""Reproduce all raster assets with the user's local Shed Dev Sprites generator."""
import sys, json, os
from pathlib import Path
source = Path(os.environ.get('SHED_SPRITES', '/home/woez/Projects/shed-dev-sprites'))
sys.path.insert(0, str(source))
from generator import get_generator
from generator.sheet import make_sheet
import generator.sprites.cover
out = Path(__file__).resolve().parents[1] / 'public' / 'sprites'
out.mkdir(parents=True, exist_ok=True)
manifest = []
def save(name, generator_type, seed, **options):
    sprite = get_generator(generator_type).generate(seed, **options)
    sprite.image.save(out / (name + '.png'))
    manifest.append(dict(file=name+'.png', generator=generator_type, seed=seed, options=options, pixel_hash=sprite.pixel_hash))
DIRS = ['front', 'right', 'back', 'left']
def atlas_frames(unit, f, palette, role, seed):
    """Return the list of generator sprites for one unit atlas (8 columns)."""
    human = get_generator('human')
    frames = []
    def rider(direction, action, frame):
        return human.generate(seed, palette=palette, role=role, direction=direction, action=action, frame=frame, frames=8, align=False)
    def rows(actions):
        for action in actions:
            for direction in DIRS:
                for frame in range(8):
                    yield action, direction, frame
    if unit == 'cavalry':
        for action, direction, frame in rows(['walk', 'attack']):
            r = rider(direction, 'walk', frame).image
            frames.append(get_generator('mount').generate(seed, faction=f, direction=direction, action=action, frame=frame, frames=8, rider=r, cell=48))
    elif unit == 'siege':
        for action, direction, frame in rows(['walk', 'attack']):
            frames.append(get_generator('machine').generate(seed, faction=f, direction=direction, action=action, frame=frame, frames=8, cell=48))
    else:
        acts = ['walk', 'attack'] + (['chop', 'mine', 'build', 'harvest'] if unit == 'worker' else [])
        for action, direction, frame in rows(acts):
            frames.append(rider(direction, action, frame))
    return frames, ['walk', 'attack'] + (['chop', 'mine', 'build', 'harvest'] if unit == 'worker' else [])
for f, palette, theme, base in [('human','grim_steel','coastal',100),('darkelf','spire_anima','moor',200),('corrupted','cult_blood','cinder',300)]:
    for i, unit in enumerate(['worker','melee','ranged','cavalry','siege']):
        roles = {'human': ['refugee','player','guard','orithel-the-last-watcher','scribe-althea'], 'darkelf': ['mistress-morveth','reeve-toran','elodie-outrunner','mistress-morveth','hermit-cassian'], 'corrupted': ['refugee','adept','kieran-blind-oar','adept','hermit-cassian']}
        role = roles[f][i]
        frames, actions = atlas_frames(unit, f, palette, role, base+i)
        cell = frames[0].image.width
        for k in range(4):
            frames[k].image.save(out / f'{f}-{unit}-{k}.png')
        atlas, metadata = make_sheet(frames, cols=8, margin=0, transparent=True)
        name = f'{f}-{unit}-atlas'
        atlas.save(out / (name+'.png'))
        (out / (name+'.json')).write_text(json.dumps(metadata, indent=2))
        manifest.append(dict(file=name+'.png', generator={'cavalry':'mount + human rider','siege':'machine'}.get(unit,'human + generator.sheet.make_sheet'), seed=base+i,
            options=dict(palette=palette,role=role,frames=8,align=False),
            actions=actions, directions=DIRS, cell=cell,
            hashes=[frame.pixel_hash for frame in frames]))
    for i, building in enumerate(['hall','farm','barracks','mill','blacksmith','stables','tower']):
        save(f'{f}-{building}', 'structure', base+i, faction=f, kind=building)
for i, kind in enumerate(['grass','dirt','water','moss','sand','stone','wood']):
    save(kind, 'tile', 50+i, kind=kind, **({'palette': 'wraith_ash'} if kind in ('grass', 'moss') else {}))
save('cover','cover',42,mood='dark',title='')
save('relic','item',800,category='shard',palette='corrupted_flesh')
save('ruin','settlement',801,theme='oldstone',part='wall_mid')
for i,kind in enumerate(['hammer','sword','bow','shield','staff']):
    save('role-'+kind,'item',810+i,category=kind,palette='bone_relic')
(out/'manifest.json').write_text(json.dumps(dict(source=str(source),assets=manifest),indent=2))
print(f'Generated {len(manifest)} assets from {source}')
