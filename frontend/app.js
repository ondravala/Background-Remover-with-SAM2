// Konfigurace
const API_URL = 'http://localhost:5001';

// Globální proměnné
let sessionId = null;
let currentImage = null;
let currentMask = null;
let currentTool = 'point';
let points = [];  // [[x, y, label], ...]
let bbox = null;  // [x1, y1, x2, y2]
let isDrawing = false;
let bboxStart = null;
let selectedModel = 'small';  // Výchozí model

// Zoom a pan proměnné
let leftZoom = 1.0;
let rightZoom = 1.0;
let leftPanX = 0;
let leftPanY = 0;
let rightPanX = 0;
let rightPanY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panSide = null;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const ZOOM_STEP = 0.2;

// Canvas elementy
const leftCanvas = document.getElementById('leftCanvas');
const leftCtx = leftCanvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const rightCanvas = previewCanvas;  // Alias pro pravý canvas
const rightCtx = previewCtx;  // Alias pro pravý context

// UI elementy
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const statusMessage = document.getElementById('statusMessage');

// Nástroje
const bboxTool = document.getElementById('bboxTool');
const pointTool = document.getElementById('pointTool');
const negativeTool = document.getElementById('negativeTool');

// Tlačítka
const segmentBtn = document.getElementById('segmentBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Slidery
const brightnessSlider = document.getElementById('brightnessSlider');
const contrastSlider = document.getElementById('contrastSlider');
const saturationSlider = document.getElementById('saturationSlider');
const bgColorPicker = document.getElementById('bgColorPicker');
const edgeBlurSlider = document.getElementById('edgeBlurSlider');

// Model select
const modelSelect = document.getElementById('modelSelect');
const cudaStatus = document.getElementById('cudaStatus');

// Help
const helpBtn = document.getElementById('helpBtn');
const controlsHelp = document.getElementById('controlsHelp');

// ==================== Načtení modelů ====================

async function loadAvailableModels() {
    try {
        const response = await fetch(`${API_URL}/api/models`);
        const data = await response.json();

        if (data.success) {
            // Zobrazit CUDA status
            if (data.cuda_available) {
                cudaStatus.innerHTML = '<span style="color: var(--success);">✓ CUDA dostupná (GPU)</span>';
            } else {
                cudaStatus.innerHTML = '<span style="color: var(--warning);">⚠ Pouze CPU (pomalejší)</span>';
            }

            // Aktualizovat vybraný model
            if (data.current_model) {
                selectedModel = data.current_model;
                modelSelect.value = data.current_model;
            }
        }
    } catch (error) {
        console.error('Chyba při načítání modelů:', error);
        cudaStatus.innerHTML = '<span style="color: var(--error);">Nelze načíst info o modelech</span>';
    }
}

// Event listener pro změnu modelu
modelSelect.addEventListener('change', (e) => {
    selectedModel = e.target.value;
    showStatus(`Model změněn na: ${selectedModel}. Změna se projeví při další segmentaci.`, 'info');
});

// Načíst modely při startu
loadAvailableModels();

// ==================== Upload ====================

uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#667eea';
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#dee2e6';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#dee2e6';
    const file = e.dataTransfer.files[0];
    if (file) {
        uploadFile(file);
    }
});

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        uploadFile(file);
    }
}

async function uploadFile(file) {
    showStatus('Nahrávám obrázek...', 'info');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            sessionId = data.session_id;
            loadImage(`${API_URL}${data.image_url}`);
            showStatus('Obrázek nahrán! Označte objekt pomocí nástrojů.', 'success');
        } else {
            showStatus(`Chyba: ${data.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Chyba při nahrávání: ${error.message}`, 'error');
    }
}

function loadImage(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        currentImage = img;

        // Reset všech dat při nahrání nové fotky
        points = [];
        bbox = null;
        currentMask = null;
        leftZoom = 1.0;
        rightZoom = 1.0;
        leftPanX = 0;
        leftPanY = 0;
        rightPanX = 0;
        rightPanY = 0;

        // Nastavení rozměrů canvas
        leftCanvas.width = img.width;
        leftCanvas.height = img.height;
        previewCanvas.width = img.width;
        previewCanvas.height = img.height;

        // Zobrazení
        document.getElementById('leftPlaceholder').style.display = 'none';
        leftCanvas.style.display = 'block';

        // Reset zoom UI
        applyZoom('left');
        applyZoom('right');

        // Skrýt preview
        document.getElementById('rightPlaceholder').style.display = 'block';
        previewCanvas.style.display = 'none';

        redrawLeftCanvas();
    };
    img.src = url;
}

// ==================== Nástroje ====================

bboxTool.addEventListener('click', () => setTool('bbox'));
pointTool.addEventListener('click', () => setTool('point'));
negativeTool.addEventListener('click', () => setTool('negative'));

function setTool(tool) {
    currentTool = tool;

    // Aktualizace UI
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));

    if (tool === 'bbox') bboxTool.classList.add('active');
    else if (tool === 'point') pointTool.classList.add('active');
    else if (tool === 'negative') negativeTool.classList.add('active');

    leftCanvas.style.cursor = 'crosshair';
}

// ==================== Canvas interakce ====================

leftCanvas.addEventListener('mousedown', handleMouseDown);
leftCanvas.addEventListener('mousemove', handleMouseMove);
leftCanvas.addEventListener('mouseup', handleMouseUp);
leftCanvas.addEventListener('contextmenu', (e) => e.preventDefault()); // Zakázat výchozí kontextové menu

function handleMouseDown(e) {
    const rect = leftCanvas.getBoundingClientRect();
    const scaleX = leftCanvas.width / rect.width;
    const scaleY = leftCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Pravé tlačítko - mazání bodů
    if (e.button === 2) {
        removePointNear(x, y);
        redrawLeftCanvas();
        return;
    }

    // Levé tlačítko - kreslení
    if (currentTool === 'bbox') {
        isDrawing = true;
        bboxStart = {x, y};
        bbox = [x, y, x, y];
    } else if (currentTool === 'point') {
        points.push([x, y, 1]);  // 1 = foreground (kladný bod)
        redrawLeftCanvas();
    } else if (currentTool === 'negative') {
        points.push([x, y, 0]);  // 0 = background (záporný bod)
        redrawLeftCanvas();
    }
}

// Funkce pro odstranění bodu poblíž kliknutí
function removePointNear(x, y) {
    const threshold = 15; // Poloměr pro detekci bodu

    for (let i = points.length - 1; i >= 0; i--) {
        const [px, py] = points[i];
        const distance = Math.sqrt((px - x) ** 2 + (py - y) ** 2);

        if (distance <= threshold) {
            points.splice(i, 1);
            showStatus('Bod odstraněn', 'info');
            return;
        }
    }
}

function handleMouseMove(e) {
    if (!isDrawing) return;

    const rect = leftCanvas.getBoundingClientRect();
    const scaleX = leftCanvas.width / rect.width;
    const scaleY = leftCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (currentTool === 'bbox' && bboxStart) {
        bbox = [
            Math.min(bboxStart.x, x),
            Math.min(bboxStart.y, y),
            Math.max(bboxStart.x, x),
            Math.max(bboxStart.y, y)
        ];
        redrawLeftCanvas();
    }
}

function handleMouseUp() {
    isDrawing = false;
    bboxStart = null;
}

// ==================== Vykreslování ====================

function redrawLeftCanvas() {
    // Vymazat canvas
    leftCtx.clearRect(0, 0, leftCanvas.width, leftCanvas.height);

    // Nakreslit obrázek
    if (currentImage) {
        leftCtx.drawImage(currentImage, 0, 0);
    }

    // Nakreslit masku (zelená overlay)
    if (currentMask) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = leftCanvas.width;
        tempCanvas.height = leftCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(currentMask, 0, 0);

        leftCtx.globalAlpha = 0.4;
        leftCtx.fillStyle = '#00ff88';  // Zelená maska
        leftCtx.drawImage(tempCanvas, 0, 0);
        leftCtx.globalAlpha = 1.0;
    }

    // Nakreslit body s větší viditelností
    points.forEach(point => {
        const [x, y, label] = point;

        // Vnější kruh (světlý obrys)
        leftCtx.beginPath();
        leftCtx.arc(x, y, 14, 0, 2 * Math.PI);
        leftCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        leftCtx.fill();

        // Střední kruh (hlavní barva)
        leftCtx.beginPath();
        leftCtx.arc(x, y, 10, 0, 2 * Math.PI);
        leftCtx.fillStyle = label === 1 ? '#00ff88' : '#ff3366';
        leftCtx.fill();

        // Obrys
        leftCtx.strokeStyle = 'white';
        leftCtx.lineWidth = 3;
        leftCtx.stroke();

        // Vnitřní bod
        leftCtx.beginPath();
        leftCtx.arc(x, y, 3, 0, 2 * Math.PI);
        leftCtx.fillStyle = 'white';
        leftCtx.fill();
    });

    // Nakreslit bounding box s lepší viditelností
    if (bbox) {
        const x = bbox[0];
        const y = bbox[1];
        const w = bbox[2] - bbox[0];
        const h = bbox[3] - bbox[1];

        // Tmavší pozadí pro kontrast
        leftCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        leftCtx.lineWidth = 7;
        leftCtx.strokeRect(x, y, w, h);

        // Hlavní zelený rámeček
        leftCtx.strokeStyle = '#00ff88';
        leftCtx.lineWidth = 4;
        leftCtx.strokeRect(x, y, w, h);

        // Bílý vnitřní rámeček
        leftCtx.strokeStyle = 'white';
        leftCtx.lineWidth = 2;
        leftCtx.strokeRect(x, y, w, h);

        // Rohy
        const cornerSize = 20;
        leftCtx.strokeStyle = '#00ff88';
        leftCtx.lineWidth = 4;

        // Levý horní roh
        leftCtx.beginPath();
        leftCtx.moveTo(x, y + cornerSize);
        leftCtx.lineTo(x, y);
        leftCtx.lineTo(x + cornerSize, y);
        leftCtx.stroke();

        // Pravý horní roh
        leftCtx.beginPath();
        leftCtx.moveTo(x + w - cornerSize, y);
        leftCtx.lineTo(x + w, y);
        leftCtx.lineTo(x + w, y + cornerSize);
        leftCtx.stroke();

        // Levý dolní roh
        leftCtx.beginPath();
        leftCtx.moveTo(x, y + h - cornerSize);
        leftCtx.lineTo(x, y + h);
        leftCtx.lineTo(x + cornerSize, y + h);
        leftCtx.stroke();

        // Pravý dolní roh
        leftCtx.beginPath();
        leftCtx.moveTo(x + w - cornerSize, y + h);
        leftCtx.lineTo(x + w, y + h);
        leftCtx.lineTo(x + w, y + h - cornerSize);
        leftCtx.stroke();
    }
}

// ==================== Segmentace ====================

segmentBtn.addEventListener('click', async () => {
    if (!sessionId) {
        showStatus('Nejprve nahrajte obrázek!', 'error');
        return;
    }

    if (points.length === 0 && !bbox) {
        showStatus('Přidejte body nebo bounding box!', 'error');
        return;
    }

    showStatus('Spouštím SAM2 segmentaci...', 'info');
    segmentBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/api/segment`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                session_id: sessionId,
                points: points,
                bbox: bbox,
                model_size: selectedModel
            })
        });

        const data = await response.json();

        if (data.success) {
            // Načíst masku
            const maskImg = new Image();
            maskImg.crossOrigin = 'anonymous';
            maskImg.onload = () => {
                // Uložit masku jako ImageData
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = leftCanvas.width;
                tempCanvas.height = leftCanvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(maskImg, 0, 0);
                currentMask = tempCtx.getImageData(0, 0, leftCanvas.width, leftCanvas.height);

                redrawLeftCanvas();
                applyAdjustments();  // Automaticky aplikovat
                showStatus(`Segmentace úspěšná! Skóre: ${data.score.toFixed(3)}`, 'success');
            };
            maskImg.src = `${API_URL}${data.mask_url}?t=${Date.now()}`;
        } else {
            showStatus(`Chyba: ${data.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Chyba při segmentaci: ${error.message}`, 'error');
    } finally {
        segmentBtn.disabled = false;
    }
});

// ==================== Aplikace úprav ====================

// Debouncing pro všechny úpravy (čeká 300ms po poslední změně)
let adjustmentsTimeout = null;

function debouncedAdjustments() {
    // Zrušit předchozí timeout
    if (adjustmentsTimeout) {
        clearTimeout(adjustmentsTimeout);
    }

    // Nastavit nový timeout - zavolá se až po 300ms nečinnosti
    adjustmentsTimeout = setTimeout(() => {
        applyRealtimeAdjustments();
    }, 300);
}

brightnessSlider.addEventListener('input', (e) => {
    document.getElementById('brightnessValue').textContent = e.target.value;
    debouncedAdjustments();
});

contrastSlider.addEventListener('input', (e) => {
    document.getElementById('contrastValue').textContent = e.target.value;
    debouncedAdjustments();
});

saturationSlider.addEventListener('input', (e) => {
    document.getElementById('saturationValue').textContent = e.target.value;
    debouncedAdjustments();
});

bgColorPicker.addEventListener('input', debouncedAdjustments);

edgeBlurSlider.addEventListener('input', (e) => {
    document.getElementById('edgeBlurValue').textContent = e.target.value;
    debouncedAdjustments();
});

// Real-time náhled úprav (client-side)
function applyRealtimeAdjustments() {
    if (!currentImage) {
        return;
    }

    // Pokud existuje maska, použij finální zpracování
    if (currentMask) {
        applyAdjustments();
        return;
    }

    // Jinak ukázat náhled bez masky
    const brightness = parseFloat(brightnessSlider.value);
    const contrast = parseFloat(contrastSlider.value);
    const saturation = parseFloat(saturationSlider.value);

    // Parsování barvy pozadí
    const bgColor = bgColorPicker.value;

    // Překreslit canvas s úpravami
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = currentImage.width;
    tempCanvas.height = currentImage.height;

    // Aplikovat CSS filtry pro náhled
    tempCtx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    tempCtx.drawImage(currentImage, 0, 0);

    // Zobrazit na pravém canvasu
    rightCtx.fillStyle = bgColor;
    rightCtx.fillRect(0, 0, rightCanvas.width, rightCanvas.height);
    rightCtx.drawImage(tempCanvas, 0, 0);
}

async function applyAdjustments() {
    if (!sessionId || !currentMask) {
        return;
    }

    const brightness = parseFloat(brightnessSlider.value);
    const contrast = parseFloat(contrastSlider.value);
    const saturation = parseFloat(saturationSlider.value);
    const edgeBlur = parseInt(edgeBlurSlider.value);

    console.log('[DEBUG] Applying adjustments with edgeBlur:', edgeBlur);

    // Parsování barvy pozadí
    const bgColor = bgColorPicker.value;
    const r = parseInt(bgColor.substr(1, 2), 16);
    const g = parseInt(bgColor.substr(3, 2), 16);
    const b = parseInt(bgColor.substr(5, 2), 16);

    try {
        showStatus('Zpracovávám úpravy...', 'info');

        const response = await fetch(`${API_URL}/api/apply-adjustments`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                session_id: sessionId,
                brightness: brightness,
                contrast: contrast,
                saturation: saturation,
                background_color: [r, g, b],
                edge_blur: edgeBlur
            })
        });

        const data = await response.json();

        if (data.success) {
            // Načíst výsledek
            const resultImg = new Image();
            resultImg.crossOrigin = 'anonymous';
            resultImg.onload = () => {
                const placeholder = document.getElementById('rightPlaceholder');
                if (placeholder) placeholder.style.display = 'none';
                previewCanvas.style.display = 'block';

                // Nastavit správné rozměry canvasu podle obrázku
                previewCanvas.width = resultImg.width;
                previewCanvas.height = resultImg.height;

                // Vyčistit a nakreslit
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                previewCtx.drawImage(resultImg, 0, 0, resultImg.width, resultImg.height);

                showStatus('Úpravy aplikovány!', 'success');
            };
            resultImg.src = `${API_URL}${data.result_url}?t=${Date.now()}`;
        }
    } catch (error) {
        console.error('Chyba při aplikaci úprav:', error);
    }
}

// ==================== Reset ====================

clearBtn.addEventListener('click', () => {
    points = [];
    bbox = null;
    currentMask = null;
    redrawLeftCanvas();
    showStatus('Anotace resetovány', 'info');
});

// ==================== Download / Export ====================

const exportModal = document.getElementById('exportModal');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const confirmExportBtn = document.getElementById('confirmExportBtn');

let selectedResolution = 'original';
let selectedFormat = 'png';

downloadBtn.addEventListener('click', () => {
    if (previewCanvas.style.display === 'none') {
        showStatus('Nejprve vygenerujte výsledek!', 'error');
        return;
    }

    // Aktualizovat rozlišení v modálním okně
    document.getElementById('originalSize').textContent = `${previewCanvas.width} × ${previewCanvas.height}`;
    document.getElementById('halfSize').textContent = `${Math.round(previewCanvas.width / 2)} × ${Math.round(previewCanvas.height / 2)}`;
    document.getElementById('doubleSize').textContent = `${previewCanvas.width * 2} × ${previewCanvas.height * 2}`;

    // Zobrazit modal
    exportModal.classList.add('active');
});

// Zavřít modal
cancelExportBtn.addEventListener('click', () => {
    exportModal.classList.remove('active');
});

// Kliknutí na overlay zavře modal
exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) {
        exportModal.classList.remove('active');
    }
});

// Výběr rozlišení
document.querySelectorAll('.resolution-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.resolution-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedResolution = option.dataset.resolution;

        // Zobrazit/skrýt custom inputs
        const customResolution = document.getElementById('customResolution');
        if (selectedResolution === 'custom') {
            customResolution.style.display = 'grid';
            document.getElementById('customWidth').value = previewCanvas.width;
            document.getElementById('customHeight').value = previewCanvas.height;
        } else {
            customResolution.style.display = 'none';
        }
    });
});

// Výběr formátu
document.querySelectorAll('.format-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.format-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedFormat = option.dataset.format;
    });
});

// Potvrdit export
confirmExportBtn.addEventListener('click', () => {
    exportImage(selectedResolution, selectedFormat);
    exportModal.classList.remove('active');
});

function exportImage(resolution, format) {
    let exportCanvas = previewCanvas;
    let width = previewCanvas.width;
    let height = previewCanvas.height;

    // Vypočítat nové rozměry podle vybraného rozlišení
    if (resolution === '1920x1080') {
        width = 1920;
        height = 1080;
    } else if (resolution === '1280x720') {
        width = 1280;
        height = 720;
    } else if (resolution === '50%') {
        width = Math.round(previewCanvas.width / 2);
        height = Math.round(previewCanvas.height / 2);
    } else if (resolution === '200%') {
        width = previewCanvas.width * 2;
        height = previewCanvas.height * 2;
    } else if (resolution === 'custom') {
        width = parseInt(document.getElementById('customWidth').value) || previewCanvas.width;
        height = parseInt(document.getElementById('customHeight').value) || previewCanvas.height;
    }

    // Vytvořit nový canvas pro export s požadovaným rozlišením
    if (resolution !== 'original') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');

        // Zachovat kvalitu při škálování
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';

        tempCtx.drawImage(previewCanvas, 0, 0, width, height);
        exportCanvas = tempCanvas;
    }

    // Export podle formátu
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const extension = format === 'jpg' ? 'jpg' : 'png';
    const quality = format === 'jpg' ? 0.95 : undefined;

    exportCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lego_no_background_${width}x${height}_${Date.now()}.${extension}`;
        a.click();
        URL.revokeObjectURL(url);
        showStatus(`Staženo! (${width}×${height}, ${format.toUpperCase()})`, 'success');
    }, mimeType, quality);
}

// ==================== Status ====================

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';

    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
}

// ==================== Zoomování ====================

// Získání elementů pro zoom
const leftCanvasInner = document.getElementById('leftCanvasInner');
const rightCanvasInner = document.getElementById('rightCanvasInner');
const leftCanvasWrapper = document.getElementById('leftCanvasWrapper');
const rightCanvasWrapper = document.getElementById('rightCanvasWrapper');

const zoomInLeft = document.getElementById('zoomInLeft');
const zoomOutLeft = document.getElementById('zoomOutLeft');
const zoomResetLeft = document.getElementById('zoomResetLeft');
const zoomInfoLeft = document.getElementById('zoomInfoLeft');

const zoomInRight = document.getElementById('zoomInRight');
const zoomOutRight = document.getElementById('zoomOutRight');
const zoomResetRight = document.getElementById('zoomResetRight');
const zoomInfoRight = document.getElementById('zoomInfoRight');

// Funkce pro aplikaci zoomu a panu
function applyZoom(side) {
    const zoom = side === 'left' ? leftZoom : rightZoom;
    const panX = side === 'left' ? leftPanX : rightPanX;
    const panY = side === 'left' ? leftPanY : rightPanY;
    const inner = side === 'left' ? leftCanvasInner : rightCanvasInner;
    const info = side === 'left' ? zoomInfoLeft : zoomInfoRight;

    inner.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    info.textContent = `${Math.round(zoom * 100)}%`;
}

// Funkce pro změnu zoomu
function changeZoom(side, delta) {
    if (side === 'left') {
        leftZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, leftZoom + delta));
        applyZoom('left');
    } else {
        rightZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rightZoom + delta));
        applyZoom('right');
    }
}

// Funkce pro reset zoomu a panu
function resetZoom(side) {
    if (side === 'left') {
        leftZoom = 1.0;
        leftPanX = 0;
        leftPanY = 0;
        applyZoom('left');
    } else {
        rightZoom = 1.0;
        rightPanX = 0;
        rightPanY = 0;
        applyZoom('right');
    }
}

// Tlačítka zoom - levá strana
zoomInLeft.addEventListener('click', () => changeZoom('left', ZOOM_STEP));
zoomOutLeft.addEventListener('click', () => changeZoom('left', -ZOOM_STEP));
zoomResetLeft.addEventListener('click', () => resetZoom('left'));

// Tlačítka zoom - pravá strana
zoomInRight.addEventListener('click', () => changeZoom('right', ZOOM_STEP));
zoomOutRight.addEventListener('click', () => changeZoom('right', -ZOOM_STEP));
zoomResetRight.addEventListener('click', () => resetZoom('right'));

// Kolečko myši - levá strana (zoom na pozici kurzoru)
leftCanvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    zoomAtPoint('left', e.clientX, e.clientY, delta);
}, { passive: false });

// Kolečko myši - pravá strana (zoom na pozici kurzoru)
rightCanvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    zoomAtPoint('right', e.clientX, e.clientY, delta);
}, { passive: false });

// Zoom na pozici kurzoru
function zoomAtPoint(side, clientX, clientY, delta) {
    const wrapper = side === 'left' ? leftCanvasWrapper : rightCanvasWrapper;
    const rect = wrapper.getBoundingClientRect();

    // Pozice myši relativně k wrapperu
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // Pozice myši relativně kcentru wrapperu
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const offsetX = mouseX - centerX;
    const offsetY = mouseY - centerY;

    // Starý a nový zoom
    const oldZoom = side === 'left' ? leftZoom : rightZoom;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom + delta));

    if (newZoom === oldZoom) return; // Nedošlo ke změně

    const zoomRatio = newZoom / oldZoom;

    // Aktualizace pan pozice tak, aby zoom byl zaměřen na kurzor
    if (side === 'left') {
        leftPanX = leftPanX - offsetX * (zoomRatio - 1);
        leftPanY = leftPanY - offsetY * (zoomRatio - 1);
        leftZoom = newZoom;
        applyZoom('left');
    } else {
        rightPanX = rightPanX - offsetX * (zoomRatio - 1);
        rightPanY = rightPanY - offsetY * (zoomRatio - 1);
        rightZoom = newZoom;
        applyZoom('right');
    }
}

// Pan - levá strana
leftCanvasWrapper.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Prostřední tlačítko nebo Shift+levé
        e.preventDefault();
        isPanning = true;
        panSide = 'left';
        panStartX = e.clientX - leftPanX;
        panStartY = e.clientY - leftPanY;
        leftCanvasWrapper.style.cursor = 'grabbing';
    }
});

leftCanvasWrapper.addEventListener('mousemove', (e) => {
    if (isPanning && panSide === 'left') {
        leftPanX = e.clientX - panStartX;
        leftPanY = e.clientY - panStartY;
        applyZoom('left');
    }
});

leftCanvasWrapper.addEventListener('mouseup', () => {
    if (isPanning && panSide === 'left') {
        isPanning = false;
        panSide = null;
        leftCanvasWrapper.style.cursor = 'default';
    }
});

leftCanvasWrapper.addEventListener('mouseleave', () => {
    if (isPanning && panSide === 'left') {
        isPanning = false;
        panSide = null;
        leftCanvasWrapper.style.cursor = 'default';
    }
});

// Pan - pravá strana
rightCanvasWrapper.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { // Prostřední tlačítko nebo Shift+levé
        e.preventDefault();
        isPanning = true;
        panSide = 'right';
        panStartX = e.clientX - rightPanX;
        panStartY = e.clientY - rightPanY;
        rightCanvasWrapper.style.cursor = 'grabbing';
    }
});

rightCanvasWrapper.addEventListener('mousemove', (e) => {
    if (isPanning && panSide === 'right') {
        rightPanX = e.clientX - panStartX;
        rightPanY = e.clientY - panStartY;
        applyZoom('right');
    }
});

rightCanvasWrapper.addEventListener('mouseup', () => {
    if (isPanning && panSide === 'right') {
        isPanning = false;
        panSide = null;
        rightCanvasWrapper.style.cursor = 'default';
    }
});

rightCanvasWrapper.addEventListener('mouseleave', () => {
    if (isPanning && panSide === 'right') {
        isPanning = false;
        panSide = null;
        rightCanvasWrapper.style.cursor = 'default';
    }
});

// ==================== Nápověda ====================

let helpVisible = false;

helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    helpVisible = !helpVisible;
    if (helpVisible) {
        controlsHelp.classList.add('visible');
    } else {
        controlsHelp.classList.remove('visible');
    }
});

// Zavřít nápovědu kliknutím mimo ni
document.addEventListener('click', (e) => {
    if (helpVisible && !controlsHelp.contains(e.target) && e.target !== helpBtn) {
        helpVisible = false;
        controlsHelp.classList.remove('visible');
    }
});
