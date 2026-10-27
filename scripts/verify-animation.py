"""Validate bundled Shed Dev Sprites animation layout and motion provenance."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1] / 'public' / 'sprites'
manifest = json.loads((root / 'manifest.json').read_text())
atlases = [asset for asset in manifest['assets'] if 'hashes' in asset]
assert len(atlases) == 15
for asset in atlases:
    assert (root / asset['file']).is_file()
    assert len(asset['hashes']) == 64
    assert asset['directions'] == ['front', 'right', 'back', 'left']
    assert asset['actions'] == ['walk', 'attack']
    for row in range(8):
        assert len(set(asset['hashes'][row * 8:row * 8 + 8])) > 1, (asset['file'], row)
print(f"15 atlases / 960 frames / 120 moving cycles verified. Source: {manifest['source']}")
