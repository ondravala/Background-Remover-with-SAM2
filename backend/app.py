"""
Lego Background Remover - Flask Backend
Používá SAM2 pro segmentaci a odstranění pozadí.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import sys
import uuid
import numpy as np
from PIL import Image, ImageEnhance
import io
import base64

# Přidat cestu k lokálnímu SAM2
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

app = Flask(__name__)
CORS(app)

# Konfigurace složek
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

# Vytvoření složek
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# SAM2 model (bude načten lazy)
sam2_model = None
sam2_predictor = None
current_model_size = None

# Dostupné modely (od nejmenšího po největší)
AVAILABLE_MODELS = {
    'tiny': {
        'checkpoint': 'sam2/checkpoints/sam2.1_hiera_tiny.pt',
        'config': 'configs/sam2.1/sam2.1_hiera_t.yaml',
        'vram_gb': 2,
        'speed': 'Velmi rychlý',
        'quality': 'Základní'
    },
    'small': {
        'checkpoint': 'sam2/checkpoints/sam2.1_hiera_small.pt',
        'config': 'configs/sam2.1/sam2.1_hiera_s.yaml',
        'vram_gb': 4,
        'speed': 'Rychlý',
        'quality': 'Dobrá'
    },
    'base_plus': {
        'checkpoint': 'sam2/checkpoints/sam2.1_hiera_base_plus.pt',
        'config': 'configs/sam2.1/sam2.1_hiera_b+.yaml',
        'vram_gb': 6,
        'speed': 'Střední',
        'quality': 'Velmi dobrá'
    },
    'large': {
        'checkpoint': 'sam2/checkpoints/sam2.1_hiera_large.pt',
        'config': 'configs/sam2.1/sam2.1_hiera_l.yaml',
        'vram_gb': 8,
        'speed': 'Pomalý',
        'quality': 'Nejlepší'
    }
}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def load_sam2_model(model_size='small'):
    """Načte SAM2 model podle velikosti."""
    global sam2_model, sam2_predictor, current_model_size

    # Pokud je už načten stejný model, vrátit
    if sam2_model is not None and current_model_size == model_size:
        return sam2_predictor

    # Pokud je načten jiný model, uvolnit ho
    if sam2_model is not None:
        del sam2_model
        del sam2_predictor
        sam2_model = None
        sam2_predictor = None
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    if model_size not in AVAILABLE_MODELS:
        model_size = 'small'  # Výchozí model

    model_info = AVAILABLE_MODELS[model_size]
    print(f"[INFO] Načítám SAM2 model: {model_size}")
    print(f"[INFO] Checkpoint: {model_info['checkpoint']}")
    print(f"[INFO] Config: {model_info['config']}")

    try:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor

        # Absolutní cesty k souborům
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        checkpoint = os.path.join(base_dir, model_info['checkpoint'])
        model_cfg = model_info['config']

        # Zkontrolovat, zda checkpoint existuje
        if not os.path.exists(checkpoint):
            print(f"[ERROR] Checkpoint neexistuje: {checkpoint}")
            return None

        print(f"[INFO] Absolutní cesta k checkpointu: {checkpoint}")

        # Zkusit CUDA, pokud není dostupná, použít CPU
        device = "cuda" if is_cuda_available() else "cpu"
        print(f"[INFO] Používám zařízení: {device}")

        sam2_model = build_sam2(model_cfg, checkpoint, device=device)
        sam2_predictor = SAM2ImagePredictor(sam2_model)
        current_model_size = model_size

        print(f"[INFO] SAM2 model '{model_size}' úspěšně načten!")
        return sam2_predictor

    except Exception as e:
        print(f"[ERROR] Chyba při načítání SAM2: {e}")
        import traceback
        traceback.print_exc()
        return None


def is_cuda_available():
    """Zkontroluje dostupnost CUDA."""
    try:
        import torch
        return torch.cuda.is_available()
    except:
        return False


def apply_image_adjustments(image, brightness=1.0, contrast=1.0, saturation=1.0):
    """Aplikuje úpravy barev, jasu a kontrastu."""
    if brightness != 1.0:
        enhancer = ImageEnhance.Brightness(image)
        image = enhancer.enhance(brightness)

    if contrast != 1.0:
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(contrast)

    if saturation != 1.0:
        enhancer = ImageEnhance.Color(image)
        image = enhancer.enhance(saturation)

    return image


def remove_background(image, mask, background_color=(255, 255, 255), erode_size=0, blur_size=0):
    """Odstraní pozadí pomocí masky."""
    print(f"[DEBUG] remove_background called with blur_size={blur_size}, erode_size={erode_size}")

    image_np = np.array(image)
    mask_np = np.array(mask)

    # Ujistíme se, že maska je 2D
    if len(mask_np.shape) == 3:
        mask_np = mask_np[:, :, 0]

    print(f"[DEBUG] Original mask shape: {mask_np.shape}, min: {mask_np.min()}, max: {mask_np.max()}")

    # Erodování masky (zmenšení o N pixelů pro odstranění okrajových artefaktů)
    if erode_size > 0:
        try:
            import cv2
            kernel = np.ones((erode_size, erode_size), np.uint8)
            mask_np = cv2.erode(mask_np, kernel, iterations=1)
            print(f"[DEBUG] Applied erosion with size {erode_size}")
        except ImportError:
            print("[WARNING] OpenCV není nainstalováno, přeskakuji erodování")

    # Vyhlazení okrajů masky
    if blur_size > 0:
        try:
            import cv2
            kernel_size = blur_size * 2 + 1
            print(f"[DEBUG] Applying GaussianBlur with kernel size {kernel_size}x{kernel_size}")
            mask_np = cv2.GaussianBlur(mask_np, (kernel_size, kernel_size), 0)
            print(f"[DEBUG] After blur - min: {mask_np.min()}, max: {mask_np.max()}")
        except ImportError:
            print("[WARNING] OpenCV není nainstalováno, přeskakuji blur")

    # Normalize mask to 0-1
    mask_np = mask_np.astype(float) / 255.0
    print(f"[DEBUG] Normalized mask - min: {mask_np.min()}, max: {mask_np.max()}")

    # Vytvoření pozadí
    background = np.ones_like(image_np) * background_color

    # Aplikace masky
    mask_3d = np.stack([mask_np] * 3, axis=2)
    result = (image_np * mask_3d + background * (1 - mask_3d)).astype(np.uint8)

    return Image.fromarray(result)


@app.route('/')
def index():
    return jsonify({'status': 'Lego Background Remover API is running'})


@app.route('/api/models', methods=['GET'])
def get_models():
    """Vrátí seznam dostupných modelů."""
    models = []
    for key, info in AVAILABLE_MODELS.items():
        models.append({
            'id': key,
            'name': key.replace('_', ' ').title(),
            'vram_gb': info['vram_gb'],
            'speed': info['speed'],
            'quality': info['quality']
        })

    # Detekce CUDA
    cuda_available = is_cuda_available()

    return jsonify({
        'success': True,
        'models': models,
        'cuda_available': cuda_available,
        'current_model': current_model_size
    })


@app.route('/api/upload', methods=['POST'])
def upload_image():
    """Nahrání obrázku."""
    if 'file' not in request.files:
        return jsonify({'error': 'Žádný soubor nebyl nahrán'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'Prázdný název souboru'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Nepodporovaný formát souboru'}), 400

    # Generování unikátního ID
    session_id = str(uuid.uuid4())

    # Uložení s původní příponou
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{session_id}.{ext}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    # Načtení obrázku pro získání rozměrů
    image = Image.open(filepath)
    width, height = image.size

    return jsonify({
        'success': True,
        'session_id': session_id,
        'filename': filename,
        'width': width,
        'height': height,
        'image_url': f'/uploads/{filename}'
    })


@app.route('/api/segment', methods=['POST'])
def segment_image():
    """Segmentace pomocí SAM2 (bounding box, body)."""
    data = request.json

    session_id = data.get('session_id')
    points = data.get('points', [])  # [[x, y, label], ...]
    bbox = data.get('bbox', None)  # [x1, y1, x2, y2]
    model_size = data.get('model_size', 'small')  # Výchozí model

    if not session_id:
        return jsonify({'error': 'Chybí session_id'}), 400

    # Najít obrázek
    image_path = None
    for ext in ALLOWED_EXTENSIONS:
        test_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{session_id}.{ext}")
        if os.path.exists(test_path):
            image_path = test_path
            break

    if not image_path:
        return jsonify({'error': 'Obrázek nebyl nalezen'}), 404

    try:
        # Načtení SAM2 s vybraným modelem
        predictor = load_sam2_model(model_size)

        if predictor is None:
            return jsonify({'error': 'SAM2 model není dostupný'}), 500

        # Načtení obrázku
        image = Image.open(image_path).convert('RGB')
        image_np = np.array(image)

        # Nastavení obrázku do predictoru
        predictor.set_image(image_np)

        # Příprava vstupů pro SAM2
        input_points = None
        input_labels = None
        input_box = None

        if points:
            input_points = np.array([[p[0], p[1]] for p in points])
            input_labels = np.array([p[2] for p in points])  # 1 = foreground, 0 = background

        if bbox:
            input_box = np.array(bbox)

        # Použít multimask_output když máme jen bbox bez bodů pro lepší výsledky
        use_multimask = (bbox is not None) and (not points or len(points) == 0)

        # Predikce masky
        masks, scores, logits = predictor.predict(
            point_coords=input_points,
            point_labels=input_labels,
            box=input_box,
            multimask_output=use_multimask
        )

        # Použití nejlepší masky (podle nejvyššího skóre)
        if use_multimask and len(masks) > 1:
            best_idx = np.argmax(scores)
            mask = masks[best_idx]
            print(f"[INFO] Vybraná maska {best_idx} ze {len(masks)} s skóre {scores[best_idx]:.3f}")
        else:
            mask = masks[0]

        # Uložení masky
        mask_filename = f"{session_id}_mask.png"
        mask_path = os.path.join(app.config['OUTPUT_FOLDER'], mask_filename)
        mask_image = Image.fromarray((mask * 255).astype(np.uint8))
        mask_image.save(mask_path)

        return jsonify({
            'success': True,
            'mask_url': f'/outputs/{mask_filename}',
            'score': float(scores[0])
        })

    except Exception as e:
        print(f"[ERROR] Chyba při segmentaci: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/apply-adjustments', methods=['POST'])
def apply_adjustments():
    """Aplikuje úpravy a odstraní pozadí."""
    data = request.json

    session_id = data.get('session_id')
    brightness = data.get('brightness', 1.0)
    contrast = data.get('contrast', 1.0)
    saturation = data.get('saturation', 1.0)
    background_color = data.get('background_color', [255, 255, 255])
    edge_blur = data.get('edge_blur', 0)  # Nový parametr pro vyhlazení okrajů

    if not session_id:
        return jsonify({'error': 'Chybí session_id'}), 400

    # Najít obrázek
    image_path = None
    for ext in ALLOWED_EXTENSIONS:
        test_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{session_id}.{ext}")
        if os.path.exists(test_path):
            image_path = test_path
            break

    if not image_path:
        return jsonify({'error': 'Obrázek nebyl nalezen'}), 404

    # Najít masku
    mask_path = os.path.join(app.config['OUTPUT_FOLDER'], f"{session_id}_mask.png")

    if not os.path.exists(mask_path):
        return jsonify({'error': 'Maska nebyla nalezena. Nejprve proveďte segmentaci.'}), 404

    try:
        # Načtení obrázku a masky
        image = Image.open(image_path).convert('RGB')
        mask = Image.open(mask_path).convert('L')

        # Aplikace úprav
        adjusted_image = apply_image_adjustments(image, brightness, contrast, saturation)

        # Odstranění pozadí s vyhlazeným okrajem
        result = remove_background(adjusted_image, mask, tuple(background_color), erode_size=0, blur_size=edge_blur)

        # Uložení výsledku
        result_filename = f"{session_id}_result.png"
        result_path = os.path.join(app.config['OUTPUT_FOLDER'], result_filename)
        result.save(result_path)

        return jsonify({
            'success': True,
            'result_url': f'/outputs/{result_filename}'
        })

    except Exception as e:
        print(f"[ERROR] Chyba při aplikaci úprav: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/manual-mask', methods=['POST'])
def manual_mask():
    """Ruční úprava masky (dokreslit/vymazat)."""
    data = request.json

    session_id = data.get('session_id')
    mask_data = data.get('mask_data')  # Base64 PNG

    if not session_id or not mask_data:
        return jsonify({'error': 'Chybí data'}), 400

    try:
        # Dekódování base64
        mask_bytes = base64.b64decode(mask_data.split(',')[1])
        mask = Image.open(io.BytesIO(mask_bytes)).convert('L')

        # Uložení masky
        mask_filename = f"{session_id}_mask.png"
        mask_path = os.path.join(app.config['OUTPUT_FOLDER'], mask_filename)
        mask.save(mask_path)

        return jsonify({
            'success': True,
            'mask_url': f'/outputs/{mask_filename}'
        })

    except Exception as e:
        print(f"[ERROR] Chyba při ukládání masky: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.route('/outputs/<filename>')
def serve_output(filename):
    return send_from_directory(app.config['OUTPUT_FOLDER'], filename)


if __name__ == '__main__':
    print("Starting Lego Background Remover Backend...")
    app.run(debug=True, host='0.0.0.0', port=5001)
