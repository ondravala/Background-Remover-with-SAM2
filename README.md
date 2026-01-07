# Lego Background Remover

An AI-powered web application for removing backgrounds from images using Meta's SAM2 (Segment Anything Model 2). Perfect for product photography, LEGO builds, or any object that needs a clean white background.

## Features

- **AI-Powered Segmentation** - Uses SAM2 for accurate object detection
- **Multiple Model Sizes** - Choose from 4 models (tiny to large) based on your hardware
- **Interactive Tools**:
  - Bounding box selection
  - Point-based refinement (add/remove areas)
  - Real-time mask preview
- **Advanced Controls**:
  - Zoom to cursor
  - Pan navigation (Shift+drag or middle mouse button)
  - Brightness, contrast, and saturation adjustments
  - Edge blur for smoother results
- **Export Options** - Save as PNG or JPG in various resolutions
- **CUDA Support** - GPU acceleration when available, CPU fallback

## Prerequisites

- Python 3.8 or higher
- Node.js (for serving frontend) or any web server
- CUDA-capable GPU (optional, but recommended for better performance)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/lego_background_remover.git
cd lego_background_remover
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Setup SAM2

You need to install Meta's SAM2 model. Follow the official installation instructions at:
**https://github.com/facebookresearch/segment-anything-2**

The typical setup is:
```bash
git clone https://github.com/facebookresearch/segment-anything-2.git sam2
cd sam2
pip install -e .
# Download model checkpoints following SAM2's instructions
cd ..
```

**Important**: Place the SAM2 folder in the project root and ensure you have at least one model checkpoint in `sam2/checkpoints/`. Recommended model: `sam2.1_hiera_small.pt`

### 4. Verify Directory Structure

```
lego_background_remover/
├── backend/
│   ├── app.py
│   ├── uploads/         (created automatically)
│   └── outputs/         (created automatically)
├── frontend/
│   ├── index.html
│   └── app.js
├── sam2/
│   ├── checkpoints/     (place .pt files here)
│   └── configs/
├── requirements.txt
└── README.md
```

## Usage

### 1. Start the Backend Server

```bash
cd backend
python app.py
```

The backend will start on `http://localhost:5001`

### 2. Open the Frontend

Simply open `frontend/index.html` in your web browser, or serve it with a local web server:

```bash
cd frontend
python -m http.server 8000
```

Then navigate to `http://localhost:8000`

### 3. Using the Application

1. **Upload Image** - Click "Nahrát obrázek" and select your image
2. **Select Model** - Choose a SAM2 model based on your hardware
3. **Create Bounding Box** - Draw a box around your object
4. **Refine (Optional)** - Add positive points (include) or negative points (exclude)
5. **Run Segmentation** - Click "Spustit segmentaci"
6. **Adjust** - Fine-tune brightness, contrast, saturation, and edge blur
7. **Export** - Click "Exportovat" to save your result

### Controls

- **Mouse Wheel** - Zoom in/out at cursor position
- **Shift + Drag** - Pan around the image
- **Middle Mouse Button** - Pan around the image
- **Right Click** - Delete a point
- **?** button - Show/hide controls help

## Model Selection Guide

| Model | VRAM | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| Tiny | 2GB | Very Fast | Basic | Quick previews, low-end hardware |
| Small | 4GB | Fast | Good | General use, balanced performance |
| Base Plus | 6GB | Medium | Very Good | High quality results |
| Large | 8GB | Slow | Best | Maximum quality, professional work |

## Troubleshooting

### "SAM2 model není dostupný"
- Ensure you downloaded the checkpoint files
- Verify files are placed in `sam2/checkpoints/`
- Check file names match exactly (e.g., `sam2.1_hiera_small.pt`)

### Slow Performance
- Try a smaller model (tiny or small)
- Check if CUDA is available: `python -c "import torch; print(torch.cuda.is_available())"`
- Close other GPU-intensive applications

### Out of Memory Errors
- Use a smaller model
- Reduce image resolution before uploading
- Restart the backend to clear GPU memory

## Technology Stack

- **Backend**: Flask, Python
- **AI Model**: Meta SAM2 (Segment Anything Model 2)
- **Image Processing**: NumPy, PIL, OpenCV
- **Frontend**: Vanilla JavaScript, HTML5 Canvas

## Credits

- SAM2 model by Meta AI: https://github.com/facebookresearch/segment-anything-2
- UI design inspired by modern AI tools

<div align="center">
  <img src="https://github.com/user-attachments/assets/959a16fc-4828-460d-ba86-ff8263ece7cf" width="200" alt="Example 1"/>
  <img src="https://github.com/user-attachments/assets/14cf840e-4cca-499a-843f-84d127763c69" width="200" alt="Example 2"/>
  <img src="https://github.com/user-attachments/assets/f74c323d-72ad-4953-b74f-3a7ec6e5d801" width="200" alt="Example 3"/>
  <img src="https://github.com/user-attachments/assets/ee323b9f-8f22-43a0-abff-db3ab1b7783d" width="200" alt="Example 4"/>
</div>

<div align="center">
  <img src="https://github.com/user-attachments/assets/2872f1d3-ec2d-4d68-8f21-1b2b68d714a8" width="200" alt="Example 5"/>
  <img src="https://github.com/user-attachments/assets/89b78112-b930-4fc4-9008-60b53ed5b573" width="200" alt="Example 6"/>
  <img src="https://github.com/user-attachments/assets/a89e1f58-6778-4a2e-bf8e-01724f35c3b8" width="200" alt="Example 7"/>
  <img src="https://github.com/user-attachments/assets/9e5a9a06-fa31-4c46-8ffe-0e1dd88986fc" width="200" alt="Example 8"/>
</div>

<div align="center">
  <img src="https://github.com/user-attachments/assets/30a0c251-4efa-43e6-bc64-7979595b4586" width="200" alt="Example 9"/>
  <img src="https://github.com/user-attachments/assets/d5aaa8d6-bd38-454e-a560-6cea879e86c1" width="200" alt="Example 10"/>
  <img src="https://github.com/user-attachments/assets/bca3d9c9-6951-4a4a-898a-9871b6cb6b6c" width="200" alt="Example 11"/>
  <img src="https://github.com/user-attachments/assets/75369738-2ac5-45de-8320-32ae2762dfdb" width="200" alt="Example 12"/>

</div>

## License

This project is provided as-is for any use. SAM2 model has its own license - please refer to Meta's repository for details.
