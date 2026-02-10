const imageInput = document.getElementById('imageInput');
const gridWidthInput = document.getElementById('gridWidth');
const gridWidthVal = document.getElementById('gridWidthVal');
const showGridInput = document.getElementById('showGrid');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('beadCanvas');
const ctx = canvas.getContext('2d');
const emptyState = document.getElementById('emptyState');
const canvasWrapper = document.querySelector('.canvas-wrapper');

let originalImage = null;

// Configuration
const CONFIG = {
    beadSizeDisplay: 20, // Pixel size of each bead on screen
    gap: 2, // Gap between beads
    bgColor: '#121212', // Background for transparent parts
    gridColor: '#333333'
};

// Event Listeners
imageInput.addEventListener('change', handleImageUpload);
gridWidthInput.addEventListener('input', (e) => {
    gridWidthVal.textContent = e.target.value;
    if (originalImage) debounce(processImage, 100)();
});
showGridInput.addEventListener('change', () => {
    if (originalImage) processImage();
});
downloadBtn.addEventListener('click', downloadPattern);

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            emptyState.style.display = 'none';
            canvasWrapper.classList.add('active');
            downloadBtn.disabled = false;
            processImage();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function processImage() {
    if (!originalImage) return;

    // 1. Determine Grid Dimensions
    const gridW = parseInt(gridWidthInput.value, 10);
    const aspectRatio = originalImage.height / originalImage.width;
    const gridH = Math.round(gridW * aspectRatio);

    // 2. Offscreen Rendering for Pixelation
    const offCanvas = document.createElement('canvas');
    offCanvas.width = gridW;
    offCanvas.height = gridH;
    const offCtx = offCanvas.getContext('2d');

    // Draw resized image (pixel sampling)
    offCtx.drawImage(originalImage, 0, 0, gridW, gridH);
    const pixelData = offCtx.getImageData(0, 0, gridW, gridH).data;

    // 3. Setup Main Canvas
    // Total size = (beads * size) + (gaps)
    // We'll calculate a render size that fits nicely or is high res
    const beadRenderSize = CONFIG.beadSizeDisplay;
    const totalWidth = gridW * beadRenderSize;
    const totalHeight = gridH * beadRenderSize;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    // Clear
    ctx.fillStyle = CONFIG.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines (Optional)
    if (showGridInput.checked) {
        ctx.strokeStyle = CONFIG.gridColor;
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= gridW; x++) {
            ctx.beginPath();
            ctx.moveTo(x * beadRenderSize, 0);
            ctx.lineTo(x * beadRenderSize, totalHeight);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= gridH; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * beadRenderSize);
            ctx.lineTo(totalWidth, y * beadRenderSize);
            ctx.stroke();
        }
    }

    // 4. Draw Beads
    for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
            const index = (y * gridW + x) * 4;
            const r = pixelData[index];
            const g = pixelData[index + 1];
            const b = pixelData[index + 2];
            const a = pixelData[index + 3];

            // Skip transparent pixels
            if (a < 50) continue;

            // Calculate center
            const cx = x * beadRenderSize + beadRenderSize / 2;
            const cy = y * beadRenderSize + beadRenderSize / 2;
            // Adjust radius slightly to fit within grid lines if present
            const radius = (beadRenderSize - CONFIG.gap) / 2;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
            ctx.fill();
        }
    }
}

function downloadPattern() {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'bead-pattern.png';
    link.href = canvas.toDataURL();
    link.click();
}

// Utility
let timeout;
function debounce(func, wait) {
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
