const imageInput = document.getElementById('imageInput');
const gridWidthInput = document.getElementById('gridWidth');
const gridWidthVal = document.getElementById('gridWidthVal');
const showGridInput = document.getElementById('showGrid');
const downloadBtn = document.getElementById('downloadBtn');
const canvas = document.getElementById('beadCanvas');
const ctx = canvas.getContext('2d');
const emptyState = document.getElementById('emptyState');
const canvasWrapper = document.querySelector('.canvas-wrapper');

// New Controls
const colorCountInput = document.getElementById('colorCountInput');
const noGradientInput = document.getElementById('noGradientInput');
const statsContainer = document.getElementById('statsContainer');
const totalColorsVal = document.getElementById('totalColorsVal');
const paletteGrid = document.getElementById('paletteGrid');

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
colorCountInput.addEventListener('change', () => {
    if (originalImage) processImage();
});
noGradientInput.addEventListener('change', () => {
    if (originalImage) processImage();
});

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
            statsContainer.style.display = 'flex';
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
    let pixelData = offCtx.getImageData(0, 0, gridW, gridH).data;

    // 2a. Process Colors (No Gradient / Color Count)
    const processedData = processColors(pixelData, gridW, gridH);
    const colorMap = processedData.colorMap; // Map of index -> hex color
    const uniqueColors = processedData.uniqueColors;

    // Update Stats
    totalColorsVal.textContent = uniqueColors.length;
    renderPalette(uniqueColors);

    // 3. Setup Main Canvas
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

            // Check transparency from original (or processed if we handled alpha)
            if (pixelData[index + 3] < 50) continue;

            const hex = colorMap[y * gridW + x];
            if (!hex) continue;

            // Calculate center
            const cx = x * beadRenderSize + beadRenderSize / 2;
            const cy = y * beadRenderSize + beadRenderSize / 2;
            const radius = (beadRenderSize - CONFIG.gap) / 2;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = hex;
            ctx.fill();
        }
    }
}

function processColors(data, width, height) {
    const noGradient = noGradientInput.checked;
    const colorCountVal = colorCountInput.value.trim().toLowerCase();
    const limitColors = colorCountVal !== 'max' && !isNaN(parseInt(colorCountVal));
    const maxColors = limitColors ? parseInt(colorCountVal) : Infinity;

    const pixelIndices = []; // To store color for each pixel index
    const colorCounts = {};

    // First Pass: Quantize & Collect Frequencies
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        const a = data[i + 3];

        if (a < 50) {
            pixelIndices.push(null);
            continue;
        }

        if (noGradient) {
            // Posterize / Quantize to reduce gradient smoothness
            // Round to nearest 32 (8 levels per channel)
            const step = 32;
            r = Math.round(r / step) * step;
            g = Math.round(g / step) * step;
            b = Math.round(b / step) * step;

            // Clamp
            r = Math.min(255, r);
            g = Math.min(255, g);
            b = Math.min(255, b);
        }

        const hex = rgbToHex(r, g, b);
        pixelIndices.push(hex);
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }

    let uniqueColors = Object.keys(colorCounts);

    // Second Pass: Reduce Palette if needed
    if (limitColors && uniqueColors.length > maxColors) {
        // Sort colors by frequency (popularity)
        const sortedColors = uniqueColors.sort((a, b) => colorCounts[b] - colorCounts[a]);
        const topColors = sortedColors.slice(0, maxColors);

        // Map remaining colors to nearest top color
        // Simple Euclidean distance in RGB space
        const finalMap = {}; // cache for color remapping

        topColors.forEach(c => finalMap[c] = c); // Top colors map to themselves

        uniqueColors = topColors; // Update unique list

        // Remap pixel indices
        for (let i = 0; i < pixelIndices.length; i++) {
            const originalHex = pixelIndices[i];
            if (!originalHex) continue;

            if (finalMap[originalHex]) {
                pixelIndices[i] = finalMap[originalHex];
            } else {
                // Find nearest match
                let minDist = Infinity;
                let nearest = topColors[0];

                const c1 = hexToRgb(originalHex);

                for (const targetHex of topColors) {
                    const c2 = hexToRgb(targetHex);
                    const dist = Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = targetHex;
                    }
                }
                finalMap[originalHex] = nearest;
                pixelIndices[i] = nearest;
            }
        }
    }

    return {
        colorMap: pixelIndices,
        uniqueColors: uniqueColors
    };
}

function renderPalette(colors) {
    paletteGrid.innerHTML = '';
    // Limit palette display if massive? checking logic. 
    // Usually beads are < 100 colors.

    // Sort palette by hue/brightness for visuals? Or assume passed order?
    // Let's sort by brightness for organization
    const sorted = colors.sort((a, b) => {
        const c1 = hexToRgb(a);
        const c2 = hexToRgb(b);
        const bri1 = c1.r * 0.299 + c1.g * 0.587 + c1.b * 0.114;
        const bri2 = c2.r * 0.299 + c2.g * 0.587 + c2.b * 0.114;
        return bri2 - bri1;
    });

    sorted.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color;
        paletteGrid.appendChild(swatch);
    });
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
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
