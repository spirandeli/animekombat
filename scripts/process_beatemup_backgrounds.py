#!/usr/bin/env python3
"""Import the 48 supplied backgrounds without cropping or stretching the artwork."""
import io
import zipfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {
    'backgrounds_brasil_beat_em_up.zip': {
        '01_brasilia_df': 'brasilia',
        '02_salvador_pelourinho_ba': 'pelourinho',
        '03_rio_de_janeiro_rj': 'rio-de-janeiro',
    },
    'Backgrounds_Belo_Horizonte_e_Sao_Paulo.zip': {
        'Mapa_04_Belo_Horizonte': 'belo-horizonte',
        'Mapa_05_Sao_Paulo': 'sao-paulo',
    },
    'Curitiba_Backgrounds.zip': {'Curitiba': 'curitiba'},
}


def main():
    for archive, cities in SOURCES.items():
        with zipfile.ZipFile(ROOT / 'spritesPersonagens/backgrounds' / archive) as z:
            for folder, city in cities.items():
                names = sorted(n for n in z.namelist()
                               if n.startswith(folder + '/') and n.lower().endswith(('.webp', '.png')))
                if len(names) != 8:
                    raise ValueError(f'{city}: expected 8 backgrounds, found {len(names)}')
                target = ROOT / 'public/assets/backgrounds/beatemup' / city
                target.mkdir(parents=True, exist_ok=True)
                for i, name in enumerate(names, 1):
                    data = z.read(name)
                    destination = target / f'segment_{i:02}.webp'
                    if name.endswith('.webp'):
                        destination.write_bytes(data)
                    else:
                        with Image.open(io.BytesIO(data)) as im:
                            im.convert('RGB').save(destination, 'WEBP', quality=92, method=6)
                print(f'{city}: 8 backgrounds imported', flush=True)


if __name__ == '__main__':
    main()
