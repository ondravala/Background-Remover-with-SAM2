# Lego Background Remover

Webová aplikace poháněná umělou inteligencí pro odstranění pozadí z obrázků pomocí Meta SAM2 (Segment Anything Model 2). Ideální pro produktovou fotografii, LEGO stavby nebo jakýkoliv objekt, který potřebuje čisté bílé pozadí.

## Funkce

- **AI Segmentace** - Využívá SAM2 pro přesnou detekci objektů
- **Více velikostí modelů** - Vyberte ze 4 modelů (tiny až large) podle vašeho hardwaru
- **Interaktivní nástroje**:
  - Výběr ohraničujícího boxu
  - Bodové upřesnění (přidat/odebrat oblasti)
  - Náhled masky v reálném čase
- **Pokročilé ovládání**:
  - Zoom na kurzor
  - Posun navigace (Shift+tažení nebo prostřední tlačítko myši)
  - Úpravy jasu, kontrastu a sytosti
  - Rozmazání okrajů pro hladší výsledky
- **Export možnosti** - Uložení jako PNG nebo JPG v různých rozlišeních
- **CUDA podpora** - GPU akcelerace když je dostupná, fallback na CPU

## Požadavky

- Python 3.8 nebo vyšší
- Node.js (pro servírování frontendu) nebo jakýkoliv webový server
- CUDA-capable GPU (volitelné, ale doporučené pro lepší výkon)

## Instalace

### 1. Klonování Repozitáře

```bash
git clone https://github.com/yourusername/lego_background_remover.git
cd lego_background_remover
```

### 2. Instalace Python Závislostí

```bash
pip install -r requirements.txt
```

### 3. Nastavení SAM2

Musíte si nainstalovat SAM2 model od Meta. Postupujte podle oficiálního návodu na:
**https://github.com/facebookresearch/segment-anything-2**

Typické nastavení vypadá takto:
```bash
git clone https://github.com/facebookresearch/segment-anything-2.git sam2
cd sam2
pip install -e .
# Stáhněte model checkpointy podle instrukcí SAM2
cd ..
```

**Důležité**: Umístěte SAM2 složku do kořenové složky projektu a ujistěte se, že máte alespoň jeden model checkpoint v `sam2/checkpoints/`. Doporučený model: `sam2.1_hiera_small.pt`

### 4. Ověření Struktury Složek

```
lego_background_remover/
├── backend/
│   ├── app.py
│   ├── uploads/         (vytvoří se automaticky)
│   └── outputs/         (vytvoří se automaticky)
├── frontend/
│   ├── index.html
│   └── app.js
├── sam2/
│   ├── checkpoints/     (sem umístěte .pt soubory)
│   └── configs/
├── requirements.txt
└── README.md
```

## Použití

### 1. Spuštění Backend Serveru

```bash
cd backend
python app.py
```

Backend se spustí na `http://localhost:5001`

### 2. Otevření Frontendu

Jednoduše otevřete `frontend/index.html` ve vašem webovém prohlížeči, nebo ho servírujte lokálním webovým serverem:

```bash
cd frontend
python -m http.server 8000
```

Poté přejděte na `http://localhost:8000`

### 3. Používání Aplikace

1. **Nahrát obrázek** - Klikněte na "Nahrát obrázek" a vyberte váš obrázek
2. **Vybrat model** - Zvolte SAM2 model podle vašeho hardwaru
3. **Vytvořit ohraničující box** - Nakreslete box kolem vašeho objektu
4. **Upřesnit (Volitelné)** - Přidejte pozitivní body (zahrnout) nebo negativní body (vyloučit)
5. **Spustit segmentaci** - Klikněte na "Spustit segmentaci"
6. **Upravit** - Dolaďte jas, kontrast, sytost a rozmazání okrajů
7. **Exportovat** - Klikněte na "Exportovat" pro uložení výsledku

### Ovládání

- **Kolečko myši** - Zoom dovnitř/ven na pozici kurzoru
- **Shift + Tažení** - Posun po obrázku
- **Prostřední tlačítko myši** - Posun po obrázku
- **Pravé tlačítko** - Smazat bod
- **?** tlačítko - Zobrazit/skrýt nápovědu ovládání

## Průvodce Výběrem Modelu

| Model | VRAM | Rychlost | Kvalita | Nejlepší pro |
|-------|------|----------|---------|--------------|
| Tiny | 2GB | Velmi rychlý | Základní | Rychlé náhledy, slabší hardware |
| Small | 4GB | Rychlý | Dobrá | Obecné použití, vyvážený výkon |
| Base Plus | 6GB | Střední | Velmi dobrá | Vysoce kvalitní výsledky |
| Large | 8GB | Pomalý | Nejlepší | Maximální kvalita, profesionální práce |

## Řešení Problémů

### "SAM2 model není dostupný"
- Ujistěte se, že jste stáhli soubory checkpointů
- Ověřte, že soubory jsou umístěny v `sam2/checkpoints/`
- Zkontrolujte, že názvy souborů se přesně shodují (např. `sam2.1_hiera_small.pt`)

### Pomalý Výkon
- Zkuste menší model (tiny nebo small)
- Zkontrolujte, zda je CUDA dostupná: `python -c "import torch; print(torch.cuda.is_available())"`
- Zavřete ostatní GPU-náročné aplikace

### Out of Memory Chyby
- Použijte menší model
- Zmenšete rozlišení obrázku před nahráním
- Restartujte backend pro vyčištění GPU paměti

## Technologický Stack

- **Backend**: Flask, Python
- **AI Model**: Meta SAM2 (Segment Anything Model 2)
- **Zpracování obrázků**: NumPy, PIL, OpenCV
- **Frontend**: Vanilla JavaScript, HTML5 Canvas

## Poděkování

- SAM2 model od Meta AI: https://github.com/facebookresearch/segment-anything-2
- UI design inspirovaný moderními AI nástroji

## Licence

Tento projekt je poskytován tak, jak je, pro vzdělávací a osobní použití. SAM2 model má svou vlastní licenci - prosím nahlédněte do repozitáře Meta pro detaily.
