// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
const state = {
  originalImage: null,      // Image object
  canvasWidthM: 2.0,        // Canvas physical width in meters
  canvasHeightM: 1.0,       // Canvas physical height in meters
  paperType: 'a4-landscape',// Paper size and orientation
  bindiCount: 5,            // Number of discrete bindi sizes
  bindiSizes: [3, 6, 9, 12, 15], // Bindi diameters in mm
  cellPadding: 1.0,         // Spacing between cells in mm
  brightness: 0,            // Adjustment offset (-100 to 100)
  contrast: 0,              // Adjustment offset (-100 to 100)
  densityFactor: 40,        // Scale/detail limit (used to downscale grid if needed)
  invertMapping: true,      // True: Darker = Larger bindis, False: Lighter = Larger bindis
  colorCodePrint: false,    // True: Faintly color-code numbers on print pages
  activeTab: 'preview-panel', // Active workspace tab
  bindiColor: 'maroon',     // Color for digital mockup
  gridData: null,           // 2D Array of mapped levels (0 to bindiCount)
  gridCols: 0,
  gridRows: 0,
  physicalCellSizeMM: 16,   // Max bindi size + cell padding
  tiledPages: [],            // List of page data for printing/previewing
  zoomLevel: 1.0,
  panX: 0,
  panY: 0
};

// Paper Dimensions (Total dimensions in mm)
const PAPER_SIZES = {
  'a4-portrait':  { width: 210, height: 297, landscape: false },
  'a4-landscape': { width: 297, height: 210, landscape: true },
  'a3-portrait':  { width: 297, height: 420, landscape: false },
  'a3-landscape': { width: 420, height: 297, landscape: true }
};

// Standard safe margins for typical home printers (in mm)
const PRINTER_MARGIN = 8; 

// Digital preview color values
const COLOR_PALETTE = {
  'maroon': '#800020',
  'red':    '#d11a2a',
  'black':  '#111111',
  'gold':   '#c5a059',
  'multi':  ['#800020', '#d11a2a', '#111111', '#c5a059', '#3b82f6', '#10b981']
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const el = {
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  uploadPreviewContainer: document.getElementById('upload-preview-container'),
  uploadPreview: document.getElementById('upload-preview'),
  btnRemoveImage: document.getElementById('btn-remove-image'),
  
  canvasWidth: document.getElementById('input-canvas-width'),
  canvasHeight: document.getElementById('input-canvas-height'),
  paperSize: document.getElementById('select-paper-size'),
  
  sliderBindiCount: document.getElementById('slider-bindi-count'),
  valBindiCount: document.getElementById('val-bindi-count'),
  bindiInputsContainer: document.getElementById('bindi-inputs-container'),
  sliderGridPadding: document.getElementById('slider-grid-padding'),
  valGridPadding: document.getElementById('val-grid-padding'),
  
  sliderContrast: document.getElementById('slider-contrast'),
  valContrast: document.getElementById('val-contrast'),
  sliderBrightness: document.getElementById('slider-brightness'),
  valBrightness: document.getElementById('val-brightness'),
  sliderThreshold: document.getElementById('slider-threshold'),
  valThreshold: document.getElementById('val-threshold'),
  checkInvert: document.getElementById('check-invert'),
  checkColorPrint: document.getElementById('check-color-print'),
  
  tabPreview: document.getElementById('tab-preview'),
  tabGrid: document.getElementById('tab-grid'),
  previewPanel: document.getElementById('preview-panel'),
  gridPanel: document.getElementById('grid-panel'),
  
  digitalCanvas: document.getElementById('digital-canvas'),
  canvasPlaceholder: document.getElementById('canvas-placeholder'),
  btnFitScreen: document.getElementById('btn-fit-screen'),
  colorSwatches: document.querySelectorAll('.color-swatch'),
  
  tiledPagesContainer: document.getElementById('tiled-pages-container'),
  
  statDimensions: document.getElementById('stat-dimensions'),
  statGridSize: document.getElementById('stat-grid-size'),
  statTotalBindis: document.getElementById('stat-total-bindis'),
  statSheetsCount: document.getElementById('stat-sheets-count'),
  shoppingListBody: document.getElementById('shopping-list-body'),
  
  btnPrintFull: document.getElementById('btn-print-full'),
  btnPrintCalibration: document.getElementById('btn-print-calibration'),
  printContainer: document.getElementById('print-container')
};

// ==========================================================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initBindiSizesInputs();
  setupEventListeners();
  updateUIStrings();
});

function setupEventListeners() {
  // Drag and drop image
  el.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropzone.classList.add('dragover');
  });

  el.dropzone.addEventListener('dragleave', () => {
    el.dropzone.classList.remove('dragover');
  });

  el.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  });

  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageFile(e.target.files[0]);
    }
  });

  el.btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    removeImage();
  });

  // Inputs change
  el.canvasWidth.addEventListener('input', (e) => {
    state.canvasWidthM = parseFloat(e.target.value) || 0.1;
    processAndRender();
  });

  el.canvasHeight.addEventListener('input', (e) => {
    state.canvasHeightM = parseFloat(e.target.value) || 0.1;
    processAndRender();
  });

  el.paperSize.addEventListener('change', (e) => {
    state.paperType = e.target.value;
    processAndRender();
  });

  // Bindi size sliders
  el.sliderBindiCount.addEventListener('input', (e) => {
    state.bindiCount = parseInt(e.target.value, 10);
    el.valBindiCount.textContent = state.bindiCount;
    // Recalculate bindi default sizes
    state.bindiSizes = Array.from({ length: state.bindiCount }, (_, i) => {
      // Scale from 3mm to 15mm or up to 20mm
      const step = state.bindiCount > 1 ? (15 - 3) / (state.bindiCount - 1) : 0;
      return Math.round(3 + i * step);
    });
    initBindiSizesInputs();
    processAndRender();
  });

  el.sliderGridPadding.addEventListener('input', (e) => {
    state.cellPadding = parseFloat(e.target.value);
    el.valGridPadding.textContent = state.cellPadding.toFixed(1);
    processAndRender();
  });

  // Image parameters
  el.sliderContrast.addEventListener('input', (e) => {
    state.contrast = parseInt(e.target.value, 10);
    el.valContrast.textContent = (state.contrast > 0 ? '+' : '') + state.contrast + '%';
    processAndRender();
  });

  el.sliderBrightness.addEventListener('input', (e) => {
    state.brightness = parseInt(e.target.value, 10);
    el.valBrightness.textContent = (state.brightness > 0 ? '+' : '') + state.brightness + '%';
    processAndRender();
  });

  el.sliderThreshold.addEventListener('input', (e) => {
    state.densityFactor = parseInt(e.target.value, 10);
    el.valThreshold.textContent = state.densityFactor + '%';
    processAndRender();
  });

  el.checkInvert.addEventListener('change', (e) => {
    state.invertMapping = e.target.checked;
    processAndRender();
  });

  el.checkColorPrint.addEventListener('change', (e) => {
    state.colorCodePrint = e.target.checked;
    // Redraw prints only if visible or when clicked
    if (state.activeTab === 'grid-panel') {
      renderTiledPagesPreview();
    }
  });

  // Tabs
  el.tabPreview.addEventListener('click', () => switchTab('preview-panel'));
  el.tabGrid.addEventListener('click', () => switchTab('grid-panel'));

  // Color Swatches
  el.colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      el.colorSwatches.forEach(s => s.classList.remove('active'));
      e.target.classList.add('active');
      state.bindiColor = e.target.getAttribute('data-color');
      renderDigitalPreview();
    });
  });

  // Fit screen & zoom reset
  el.btnFitScreen.addEventListener('click', () => {
    fitCanvasToContainer();
  });

  // Printing Action
  el.btnPrintFull.addEventListener('click', () => {
    if (!state.originalImage) {
      alert('Please upload an image first.');
      return;
    }
    preparePrintLayout(false); // Entire portrait grid
    window.print();
  });

  el.btnPrintCalibration.addEventListener('click', () => {
    preparePrintLayout(true); // Just the calibration test page
    window.print();
  });
}

// Initialize input fields for the bindi sizes
function initBindiSizesInputs() {
  el.bindiInputsContainer.innerHTML = '';
  
  state.bindiSizes.forEach((size, index) => {
    const row = document.createElement('div');
    row.className = 'bindi-size-row';
    
    // Level Badge
    const labelSpan = document.createElement('span');
    labelSpan.className = 'bindi-level-label';
    
    const dot = document.createElement('span');
    dot.className = 'bindi-level-dot';
    // Visual dot sizing proportional to bindi
    const dotSize = Math.max(4, Math.min(16, size));
    dot.style.width = `${dotSize}px`;
    dot.style.height = `${dotSize}px`;
    
    labelSpan.appendChild(dot);
    labelSpan.appendChild(document.createTextNode(`Level ${index + 1}`));
    
    // Size Input
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = '50';
    input.value = size;
    input.addEventListener('change', (e) => {
      const val = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1));
      state.bindiSizes[index] = val;
      e.target.value = val;
      
      // Update dot scale visually
      const newDotSize = Math.max(4, Math.min(16, val));
      dot.style.width = `${newDotSize}px`;
      dot.style.height = `${newDotSize}px`;
      
      processAndRender();
    });
    
    row.appendChild(labelSpan);
    row.appendChild(input);
    el.bindiInputsContainer.appendChild(row);
  });
}

function updateUIStrings() {
  el.statDimensions.innerHTML = `${state.canvasWidthM.toFixed(1)}m &times; ${state.canvasHeightM.toFixed(1)}m`;
}

// ==========================================================================
// IMAGE LOADING & PROCESSING
// ==========================================================================
function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file.');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.originalImage = img;
      
      // Show upload thumbnail preview
      el.uploadPreview.src = e.target.result;
      el.uploadPreviewContainer.classList.remove('hidden');
      el.canvasPlaceholder.classList.add('hidden');
      
      processAndRender();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  state.originalImage = null;
  state.gridData = null;
  el.fileInput.value = '';
  el.uploadPreview.src = '';
  el.uploadPreviewContainer.classList.add('hidden');
  el.canvasPlaceholder.classList.remove('hidden');
  
  // Reset outputs
  const ctx = el.digitalCanvas.getContext('2d');
  ctx.clearRect(0, 0, el.digitalCanvas.width, el.digitalCanvas.height);
  
  el.statGridSize.textContent = '0 \u00D7 0';
  el.statTotalBindis.textContent = '0';
  el.statSheetsCount.textContent = '0 sheets';
  el.tiledPagesContainer.innerHTML = '';
  
  el.shoppingListBody.innerHTML = `
    <tr>
      <td colspan="4" class="empty-list-placeholder">Upload an image to calculate bindi totals</td>
    </tr>
  `;
}

// Coordinates image resizing, contrast tuning, sampling, and layout calculations
function processAndRender() {
  updateUIStrings();
  if (!state.originalImage) return;
  
  calculateGridDimensions();
  sampleImageToGrid();
  calculateTiledLayout();
  
  renderDigitalPreview();
  renderTiledPagesPreview();
  updateDashboardStats();
}

// 1. Grid Sizing Calculations
function calculateGridDimensions() {
  // Max physical size of cell (largest bindi diameter + physical grid padding)
  const maxBindi = Math.max(...state.bindiSizes);
  state.physicalCellSizeMM = maxBindi + state.cellPadding;
  
  // Real world canvas sizes in millimeters
  const canvasWidthMM = state.canvasWidthM * 1000;
  const canvasHeightMM = state.canvasHeightM * 1000;
  
  // Aspect ratio of the uploaded image
  const imgRatio = state.originalImage.width / state.originalImage.height;
  const canvasRatio = canvasWidthMM / canvasHeightMM;
  
  let activeWidthMM, activeHeightMM;
  
  // Adjust portrait bounds based on image aspect ratio to avoid stretching
  if (imgRatio > canvasRatio) {
    activeWidthMM = canvasWidthMM;
    activeHeightMM = canvasWidthMM / imgRatio;
  } else {
    activeHeightMM = canvasHeightMM;
    activeWidthMM = canvasHeightMM * imgRatio;
  }
  
  // Calculate maximum physical grid size
  let cols = Math.floor(activeWidthMM / state.physicalCellSizeMM);
  let rows = Math.floor(activeHeightMM / state.physicalCellSizeMM);
  
  // Scale resolution dynamically based on Density slider
  // 100% means the maximum resolution physical sizes can support.
  // Smaller percentages scale down the grid to place bindis further apart
  const scaling = state.densityFactor / 100;
  cols = Math.max(5, Math.round(cols * scaling));
  rows = Math.max(5, Math.round(rows * scaling));
  
  state.gridCols = cols;
  state.gridRows = rows;
}

// 2. Sample Image Pixels to 2D Level Grid (Advanced Pipeline)
function sampleImageToGrid() {
  const cols = state.gridCols;
  const rows = state.gridRows;
  
  // ---- STEP A: Read image at a higher resolution for the unsharp mask ----
  // We sample at 3x then downscale, so the edge detection has sub-cell detail
  const hiResFactor = 3;
  const hiW = cols * hiResFactor;
  const hiH = rows * hiResFactor;
  
  const hiCanvas = document.createElement('canvas');
  hiCanvas.width = hiW;
  hiCanvas.height = hiH;
  const hiCtx = hiCanvas.getContext('2d');
  hiCtx.drawImage(state.originalImage, 0, 0, hiW, hiH);
  const hiData = hiCtx.getImageData(0, 0, hiW, hiH);
  
  // Build high-res grayscale float array
  const hiGray = new Float32Array(hiW * hiH);
  const contrastFactor = (259 * (state.contrast + 255)) / (255 * (259 - state.contrast));
  const brightnessOffset = state.brightness * 2.55; // Scale -100..100 to -255..255
  
  for (let i = 0; i < hiW * hiH; i++) {
    const idx = i * 4;
    let g = 0.299 * hiData.data[idx] + 0.587 * hiData.data[idx+1] + 0.114 * hiData.data[idx+2];
    g = g + brightnessOffset;
    g = contrastFactor * (g - 128) + 128;
    hiGray[i] = Math.max(0, Math.min(255, g));
  }
  
  // ---- STEP B: Unsharp Mask (edge enhancement) ----
  // Apply a 5x5 Gaussian blur, then sharpen: sharpened = original + strength * (original - blurred)
  const blurred = gaussianBlur5x5(hiGray, hiW, hiH);
  const sharpStrength = 1.5; // Controls how much edges are boosted
  for (let i = 0; i < hiGray.length; i++) {
    hiGray[i] = Math.max(0, Math.min(255, hiGray[i] + sharpStrength * (hiGray[i] - blurred[i])));
  }
  
  // ---- STEP C: Downsample sharpened hi-res to grid resolution (area average) ----
  const grayGrid = new Float32Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let sum = 0;
      for (let dy = 0; dy < hiResFactor; dy++) {
        for (let dx = 0; dx < hiResFactor; dx++) {
          sum += hiGray[(gy * hiResFactor + dy) * hiW + (gx * hiResFactor + dx)];
        }
      }
      grayGrid[gy * cols + gx] = sum / (hiResFactor * hiResFactor);
    }
  }
  
  // ---- STEP D: Histogram Equalization ----
  // Build a cumulative distribution function to spread tonal values evenly
  const histogram = new Uint32Array(256);
  for (let i = 0; i < grayGrid.length; i++) {
    histogram[Math.round(grayGrid[i])]++;
  }
  
  const cdf = new Float32Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i-1] + histogram[i];
  }
  
  // Find CDF min (first non-zero bin)
  let cdfMin = 0;
  for (let i = 0; i < 256; i++) {
    if (cdf[i] > 0) { cdfMin = cdf[i]; break; }
  }
  
  const totalPixels = cols * rows;
  const eqLUT = new Float32Array(256); // equalized lookup table
  for (let i = 0; i < 256; i++) {
    eqLUT[i] = totalPixels > 1 ? ((cdf[i] - cdfMin) / (totalPixels - cdfMin)) * 255 : i;
  }
  
  // Apply equalization with a blend factor (don't go full equalization, it can be harsh)
  const eqBlend = 0.6; // 0 = original, 1 = fully equalized
  for (let i = 0; i < grayGrid.length; i++) {
    const orig = grayGrid[i];
    const eq = eqLUT[Math.round(orig)];
    grayGrid[i] = orig * (1 - eqBlend) + eq * eqBlend;
  }
  
  // ---- STEP E: Sigmoid Tone Curve ----
  // Applies an S-curve to push highlights brighter and shadows darker
  // This dramatically increases perceived contrast in the final bindi portrait
  const sigmoidSteepness = 8; // Higher = more aggressive contrast push
  const sigmoidMidpoint = 0.5;
  
  for (let i = 0; i < grayGrid.length; i++) {
    let n = grayGrid[i] / 255; // normalize 0-1
    // Sigmoid: f(x) = 1 / (1 + e^(-k*(x - mid)))
    n = 1.0 / (1.0 + Math.exp(-sigmoidSteepness * (n - sigmoidMidpoint)));
    grayGrid[i] = n * 255;
  }
  
  // ---- STEP F: Quantize to Bindi Levels ----
  state.gridData = Array.from({ length: rows }, () => new Uint8Array(cols));
  
  // Background suppression threshold: pixels lighter than this get no bindi (level 0)
  // Higher value = more aggressive background removal
  const bgThreshold = 0.15;
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const val = grayGrid[y * cols + x];
      let normalized = val / 255; // 0 = black, 1 = white
      let level = 0;
      
      if (state.invertMapping) {
        // Darker pixels = Larger bindis
        const darkness = 1 - normalized;
        
        if (darkness > bgThreshold) {
          // Non-linear quantization: use power curve for better level distribution
          // Map darkness (bgThreshold..1) to (0..1), then power-curve, then to levels
          const mapped = (darkness - bgThreshold) / (1 - bgThreshold);
          // Power curve: slightly boost mid-darks to give more weight to medium bindis
          const curved = Math.pow(mapped, 0.85);
          level = Math.ceil(curved * state.bindiCount);
          level = Math.max(1, Math.min(state.bindiCount, level));
        }
      } else {
        // Lighter pixels = Larger bindis
        if (normalized > bgThreshold) {
          const mapped = (normalized - bgThreshold) / (1 - bgThreshold);
          const curved = Math.pow(mapped, 0.85);
          level = Math.ceil(curved * state.bindiCount);
          level = Math.max(1, Math.min(state.bindiCount, level));
        }
      }
      
      state.gridData[y][x] = level;
    }
  }
}

// Gaussian blur helper (5x5 kernel, separable for performance)
function gaussianBlur5x5(src, width, height) {
  // 5-tap Gaussian kernel (sigma ≈ 1.0): [1, 4, 6, 4, 1] / 16
  const kernel = [1/16, 4/16, 6/16, 4/16, 1/16];
  const temp = new Float32Array(width * height);
  const dest = new Float32Array(width * height);
  
  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        const sx = Math.max(0, Math.min(width - 1, x + k));
        sum += src[y * width + sx] * kernel[k + 2];
      }
      temp[y * width + x] = sum;
    }
  }
  
  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) {
        const sy = Math.max(0, Math.min(height - 1, y + k));
        sum += temp[sy * width + x] * kernel[k + 2];
      }
      dest[y * width + x] = sum;
    }
  }
  
  return dest;
}

// 3. Tiled Layout Slicing Engine
function calculateTiledLayout() {
  const paper = PAPER_SIZES[state.paperType];
  
  // Calculate printable page dimensions in mm (excluding borders)
  const printableWidthMM = paper.width - (PRINTER_MARGIN * 2);
  const printableHeightMM = paper.height - (PRINTER_MARGIN * 2);
  
  // Calculate how many cells fit on a single page
  const cellWidthMM = state.physicalCellSizeMM;
  const colsPerPage = Math.floor(printableWidthMM / cellWidthMM);
  const rowsPerPage = Math.floor(printableHeightMM / cellWidthMM);
  
  if (colsPerPage <= 0 || rowsPerPage <= 0) {
    alert("Warning: Bindi sizes are too large to fit on a single page of this paper size! Choose a larger paper size.");
    return;
  }
  
  // Total pages needed wide and high
  const pagesWide = Math.ceil(state.gridCols / colsPerPage);
  const pagesHigh = Math.ceil(state.gridRows / rowsPerPage);
  
  state.tiledPages = [];
  
  for (let pr = 0; pr < pagesHigh; pr++) {
    for (let pc = 0; pc < pagesWide; pc++) {
      const startCol = pc * colsPerPage;
      const startRow = pr * rowsPerPage;
      const endCol = Math.min(startCol + colsPerPage, state.gridCols);
      const endRow = Math.min(startRow + rowsPerPage, state.gridRows);
      
      const pageWidthCells = endCol - startCol;
      const pageHeightCells = endRow - startRow;
      
      // Scan page segment to check if it contains any bindis.
      // If it doesn't contain any bindis, we flag it as 'empty' so we can skip printing
      let isEmpty = true;
      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          if (state.gridData[r][c] > 0) {
            isEmpty = false;
            break;
          }
        }
        if (!isEmpty) break;
      }
      
      state.tiledPages.push({
        id: `p-${pr}-${pc}`,
        pageRow: pr,
        pageCol: pc,
        startRow,
        startCol,
        endRow,
        endCol,
        widthCells: pageWidthCells,
        heightCells: pageHeightCells,
        isEmpty
      });
    }
  }
}

// ==========================================================================
// RENDERERS
// ==========================================================================

// 1. Digital Art Simulation (HTML5 Canvas)
function renderDigitalPreview() {
  const canvas = el.digitalCanvas;
  if (!state.gridData) return;
  
  const cols = state.gridCols;
  const rows = state.gridRows;
  
  // Scale canvas context
  const cellRenderSize = 12; // cell virtual diameter in pixels
  canvas.width = cols * cellRenderSize;
  canvas.height = rows * cellRenderSize;
  
  const ctx = canvas.getContext('2d');
  
  // Canvas background (simulated textured canvas paper)
  ctx.fillStyle = '#fbf9f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Subtle canvas grid coordinates
  ctx.strokeStyle = '#eae6e0';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellRenderSize, 0);
    ctx.lineTo(x * cellRenderSize, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellRenderSize);
    ctx.lineTo(canvas.width, y * cellRenderSize);
    ctx.stroke();
  }
  
  // Draw Bindis
  const bindiColorType = state.bindiColor;
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const level = state.gridData[y][x];
      if (level === 0) continue;
      
      const bindiDiameterMM = state.bindiSizes[level - 1];
      
      // Calculate drawing dimensions relative to cell spacing
      const diameterRatio = bindiDiameterMM / state.physicalCellSizeMM;
      const bindiRadiusPx = (cellRenderSize * diameterRatio) / 2;
      
      const centerX = x * cellRenderSize + cellRenderSize / 2;
      const centerY = y * cellRenderSize + cellRenderSize / 2;
      
      // Select Color
      let color;
      if (bindiColorType === 'multi') {
        const palette = COLOR_PALETTE.multi;
        // Deterministic pseudo-random selection based on coordinate to avoid flickering
        const hash = (x * 374761393 + y * 668265263) >>> 0;
        color = palette[hash % palette.length];
      } else {
        color = COLOR_PALETTE[bindiColorType];
      }
      
      // Draw simulated 3D bindi circle (gradient shading)
      const grad = ctx.createRadialGradient(
        centerX - bindiRadiusPx/4, centerY - bindiRadiusPx/4, bindiRadiusPx * 0.1,
        centerX, centerY, bindiRadiusPx
      );
      grad.addColorStop(0, lightenColor(color, 40));
      grad.addColorStop(0.3, color);
      grad.addColorStop(1, darkenColor(color, 20));
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, bindiRadiusPx, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 0.5;
      ctx.shadowOffsetY = 1;
      ctx.fill();
      ctx.shadowColor = 'transparent'; // Reset shadow
    }
  }
}

// Helper: Fit canvas bounds to container width/height
function fitCanvasToContainer() {
  if (!state.gridData) return;
  // Canvas scales nicely with CSS container constraints, this is simple.
  el.digitalCanvas.style.width = '100%';
  el.digitalCanvas.style.height = '100%';
}

// 2. Interactive Tiled Pages Panel (Mocked Print Previews)
function renderTiledPagesPreview() {
  el.tiledPagesContainer.innerHTML = '';
  if (!state.gridData || state.tiledPages.length === 0) return;
  
  const paper = PAPER_SIZES[state.paperType];
  
  // Calculate relative aspect ratio for rendering thumbnails
  const ratio = paper.height / paper.width;
  const thumbWidthPx = 180; // fixed width for thumb preview
  const thumbHeightPx = Math.round(thumbWidthPx * ratio);
  
  // Find total grid dimensions of pages to style CSS Grid
  let maxCol = 0, maxRow = 0;
  state.tiledPages.forEach(p => {
    if (p.pageCol > maxCol) maxCol = p.pageCol;
    if (p.pageRow > maxRow) maxRow = p.pageRow;
  });
  
  el.tiledPagesContainer.style.gridTemplateColumns = `repeat(${maxCol + 1}, ${thumbWidthPx}px)`;
  
  state.tiledPages.forEach(p => {
    const pageCard = document.createElement('div');
    pageCard.className = `page-thumbnail ${p.isEmpty ? 'empty-page' : ''}`;
    pageCard.style.width = `${thumbWidthPx}px`;
    pageCard.style.height = `${thumbHeightPx}px`;
    
    // Page Header
    const header = document.createElement('div');
    header.className = 'page-thumb-header';
    header.innerHTML = `<span>Page ${p.pageRow + 1}-${p.pageCol + 1}</span>`;
    
    // Page Body
    const body = document.createElement('div');
    body.className = 'page-thumb-body';
    
    // Page coordinate indicator overlay
    const coordinate = document.createElement('div');
    coordinate.className = 'page-coordinate-badge';
    coordinate.textContent = `R${p.pageRow + 1} C${p.pageCol + 1}`;
    
    // Quick mini preview of points in page
    const canvas = document.createElement('canvas');
    canvas.width = thumbWidthPx;
    canvas.height = thumbHeightPx - 24; // offset header height
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    drawMiniPagePreview(canvas, p);
    
    body.appendChild(canvas);
    body.appendChild(coordinate);
    pageCard.appendChild(header);
    pageCard.appendChild(body);
    
    // Double click or click to download/print single sheet
    pageCard.addEventListener('click', () => {
      if (p.isEmpty) {
        alert("This page is empty. Sticking bindis is not required here.");
        return;
      }
      prepareSinglePagePrint(p);
      window.print();
    });
    
    el.tiledPagesContainer.appendChild(pageCard);
  });
}

// Renders a tiny dot mockup onto individual page cards
function drawMiniPagePreview(canvas, page) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const cellWidthPx = canvas.width / page.widthCells;
  const cellHeightPx = canvas.height / page.heightCells;
  
  ctx.fillStyle = '#d11a2a';
  for (let r = 0; r < page.heightCells; r++) {
    const globalRow = page.startRow + r;
    for (let c = 0; c < page.widthCells; c++) {
      const globalCol = page.startCol + c;
      
      const level = state.gridData[globalRow][globalCol];
      if (level > 0) {
        const bindiDiameterMM = state.bindiSizes[level - 1];
        const diameterRatio = bindiDiameterMM / state.physicalCellSizeMM;
        
        const pxRadius = Math.max(1, (Math.min(cellWidthPx, cellHeightPx) * diameterRatio) / 2);
        const cx = c * cellWidthPx + cellWidthPx / 2;
        const cy = r * cellHeightPx + cellHeightPx / 2;
        
        ctx.beginPath();
        ctx.arc(cx, cy, pxRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// 3. Stats & Shopping List Calculators
function updateDashboardStats() {
  const cols = state.gridCols;
  const rows = state.gridRows;
  
  el.statGridSize.textContent = `${cols} \u00D7 ${rows}`;
  
  // Calculate total counts per level
  const counts = Array(state.bindiCount).fill(0);
  let totalBindis = 0;
  
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const level = state.gridData[y][x];
      if (level > 0) {
        counts[level - 1]++;
        totalBindis++;
      }
    }
  }
  
  el.statTotalBindis.textContent = totalBindis.toLocaleString();
  
  // Non-empty printable pages
  const printablePages = state.tiledPages.filter(p => !p.isEmpty).length;
  el.statSheetsCount.textContent = `${printablePages} / ${state.tiledPages.length} pages`;
  
  // Build shopping list table
  el.shoppingListBody.innerHTML = '';
  
  if (totalBindis === 0) {
    el.shoppingListBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-list-placeholder">No bindis needed for current settings</td>
      </tr>
    `;
    return;
  }
  
  for (let i = 0; i < state.bindiCount; i++) {
    const count = counts[i];
    const diameter = state.bindiSizes[i];
    const ratio = totalBindis > 0 ? (count / totalBindis * 100).toFixed(1) : '0.0';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>Level ${i + 1}</strong></td>
      <td><span class="slider-value">${diameter}mm</span></td>
      <td><strong>${count.toLocaleString()}</strong></td>
      <td><span class="text-muted">${ratio}%</span></td>
    `;
    
    el.shoppingListBody.appendChild(tr);
  }
}

// ==========================================================================
// PHYSICAL LAYOUT EXPORTER (PRINT ENGINE)
// ==========================================================================

// Prepares print container blocks with scale-perfect grid elements
function preparePrintLayout(calibrationOnly = false) {
  el.printContainer.innerHTML = '';
  const paper = PAPER_SIZES[state.paperType];
  
  // Create print sheets styles
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    @media print {
      @page {
        size: ${paper.width}mm ${paper.height}mm ${paper.landscape ? 'landscape' : 'portrait'};
      }
      .print-page {
        width: ${paper.width}mm;
        height: ${paper.height}mm;
      }
    }
  `;
  el.printContainer.appendChild(styleEl);
  
  if (calibrationOnly) {
    // Inject single test/calibration square page
    const pageDiv = document.createElement('div');
    pageDiv.className = 'print-page';
    
    pageDiv.innerHTML = `
      <div class="print-header">
        <span class="print-title">Bindi Portrait Planner - Calibration Test Page</span>
        <span class="print-meta">Verify layout scale</span>
      </div>
      <div class="calibration-test-card">
        <h3>Scale Calibration Test</h3>
        <p>Before printing your entire massive grid, measure the box below with a physical ruler to ensure printer scaling is set correctly.</p>
        
        <div class="calibration-box-container">
          <div class="physical-calibration-box"></div>
        </div>
        
        <div class="calibration-instructions">
          <strong>Instructions:</strong>
          <ol>
            <li>Print this page using your browser's Print dialog.</li>
            <li>In the print settings dialog, set <strong>Margins = None</strong> and <strong>Scale = 100%</strong> (do NOT check "Fit to printable area" or "Fit to page").</li>
            <li>Measure the printed square above. It should measure <strong>exactly 5.0 cm x 5.0 cm</strong>.</li>
            <li>If it is too small or too large, adjust your printer scale percentages until the box is exactly 50mm.</li>
          </ol>
        </div>
      </div>
    `;
    el.printContainer.appendChild(pageDiv);
    return;
  }
  
  // Render full canvas pages (filtering empty pages to save user paper)
  const printablePages = state.tiledPages.filter(p => !p.isEmpty);
  const totalPrintPages = printablePages.length;
  
  printablePages.forEach((p, index) => {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'print-page';
    
    // Create Header Metadata
    const header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = `
      <span class="print-title">Bindi Portrait Template - Page ${p.pageRow + 1}-${p.pageCol + 1}</span>
      <span class="print-meta">Row ${p.pageRow + 1}, Col ${p.pageCol + 1} (${index + 1} of ${totalPrintPages})</span>
    `;
    pageDiv.appendChild(header);
    
    // Add page alignment mark crosshairs
    const marks = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    marks.forEach(m => {
      const mark = document.createElement('div');
      mark.className = `alignment-mark mark-${m}`;
      pageDiv.appendChild(mark);
    });
    
    // Create Grid Container
    const grid = document.createElement('div');
    grid.className = 'print-grid-container';
    
    // Physical size of cells
    const cellWidthMM = state.physicalCellSizeMM;
    grid.style.gridTemplateColumns = `repeat(${p.widthCells}, ${cellWidthMM}mm)`;
    grid.style.gridTemplateRows = `repeat(${p.heightCells}, ${cellWidthMM}mm)`;
    
    for (let r = 0; r < p.heightCells; r++) {
      const globalRow = p.startRow + r;
      for (let c = 0; c < p.widthCells; c++) {
        const globalCol = p.startCol + c;
        
        const cell = document.createElement('div');
        cell.className = 'print-cell';
        cell.style.width = `${cellWidthMM}mm`;
        cell.style.height = `${cellWidthMM}mm`;
        
        const level = state.gridData[globalRow][globalCol];
        
        if (level > 0) {
          // Label number
          const numSpan = document.createElement('span');
          numSpan.className = 'print-cell-number';
          numSpan.textContent = level;
          cell.appendChild(numSpan);
          
          // Add color code class if activated
          if (state.colorCodePrint) {
            cell.classList.add(`color-${level}`);
          }
          
          // Circular guide showing exact diameter of target bindi
          const bindiDiameterMM = state.bindiSizes[level - 1];
          const outline = document.createElement('div');
          outline.className = 'print-cell-outline';
          outline.style.width = `${bindiDiameterMM}mm`;
          outline.style.height = `${bindiDiameterMM}mm`;
          // Center the circle inside cell
          const offsetMM = (cellWidthMM - bindiDiameterMM) / 2;
          outline.style.top = `${offsetMM}mm`;
          outline.style.left = `${offsetMM}mm`;
          
          cell.appendChild(outline);
        } else {
          // Empty cells print absolutely blank to keep it clean
          cell.innerHTML = '&nbsp;';
        }
        
        grid.appendChild(cell);
      }
    }
    
    pageDiv.appendChild(grid);
    el.printContainer.appendChild(pageDiv);
  });
}

// Prepares a single page sheet for printing
function prepareSinglePagePrint(page) {
  el.printContainer.innerHTML = '';
  const paper = PAPER_SIZES[state.paperType];
  
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    @media print {
      @page {
        size: ${paper.width}mm ${paper.height}mm ${paper.landscape ? 'landscape' : 'portrait'};
      }
      .print-page {
        width: ${paper.width}mm;
        height: ${paper.height}mm;
      }
    }
  `;
  el.printContainer.appendChild(styleEl);
  
  const pageDiv = document.createElement('div');
  pageDiv.className = 'print-page';
  
  const header = document.createElement('div');
  header.className = 'print-header';
  header.innerHTML = `
    <span class="print-title">Bindi Portrait Template - Page ${page.pageRow + 1}-${page.pageCol + 1} (Single Page Export)</span>
    <span class="print-meta">Row ${page.pageRow + 1}, Col ${page.pageCol + 1}</span>
  `;
  pageDiv.appendChild(header);
  
  const marks = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  marks.forEach(m => {
    const mark = document.createElement('div');
    mark.className = `alignment-mark mark-${m}`;
    pageDiv.appendChild(mark);
  });
  
  const grid = document.createElement('div');
  grid.className = 'print-grid-container';
  
  const cellWidthMM = state.physicalCellSizeMM;
  grid.style.gridTemplateColumns = `repeat(${page.widthCells}, ${cellWidthMM}mm)`;
  grid.style.gridTemplateRows = `repeat(${page.heightCells}, ${cellWidthMM}mm)`;
  
  for (let r = 0; r < page.heightCells; r++) {
    const globalRow = page.startRow + r;
    for (let c = 0; c < page.widthCells; c++) {
      const globalCol = page.startCol + c;
      
      const cell = document.createElement('div');
      cell.className = 'print-cell';
      cell.style.width = `${cellWidthMM}mm`;
      cell.style.height = `${cellWidthMM}mm`;
      
      const level = state.gridData[globalRow][globalCol];
      
      if (level > 0) {
        const numSpan = document.createElement('span');
        numSpan.className = 'print-cell-number';
        numSpan.textContent = level;
        cell.appendChild(numSpan);
        
        if (state.colorCodePrint) {
          cell.classList.add(`color-${level}`);
        }
        
        const bindiDiameterMM = state.bindiSizes[level - 1];
        const outline = document.createElement('div');
        outline.className = 'print-cell-outline';
        outline.style.width = `${bindiDiameterMM}mm`;
        outline.style.height = `${bindiDiameterMM}mm`;
        const offsetMM = (cellWidthMM - bindiDiameterMM) / 2;
        outline.style.top = `${offsetMM}mm`;
        outline.style.left = `${offsetMM}mm`;
        
        cell.appendChild(outline);
      } else {
        cell.innerHTML = '&nbsp;';
      }
      
      grid.appendChild(cell);
    }
  }
  
  pageDiv.appendChild(grid);
  el.printContainer.appendChild(pageDiv);
}

// ==========================================================================
// CONTROLLERS & TAB SWITCHING
// ==========================================================================
function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Update buttons
  if (tabId === 'preview-panel') {
    el.tabPreview.classList.add('active');
    el.tabGrid.classList.remove('active');
    el.previewPanel.classList.add('active');
    el.gridPanel.classList.remove('active');
    renderDigitalPreview();
  } else {
    el.tabPreview.classList.remove('active');
    el.tabGrid.classList.add('active');
    el.previewPanel.classList.remove('active');
    el.gridPanel.classList.add('active');
    renderTiledPagesPreview();
  }
}

// ==========================================================================
// COLOR HELPERS
// ==========================================================================
function lightenColor(col, amt) {
  return adjustColorBrightness(col, amt);
}

function darkenColor(col, amt) {
  return adjustColorBrightness(col, -amt);
}

function adjustColorBrightness(hex, percent) {
  let R = parseInt(hex.substring(1, 3), 16);
  let G = parseInt(hex.substring(3, 5), 16);
  let B = parseInt(hex.substring(5, 7), 16);

  R = parseInt((R * (100 + percent)) / 100);
  G = parseInt((G * (100 + percent)) / 100);
  B = parseInt((B * (100 + percent)) / 100);

  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;

  R = R > 0 ? R : 0;
  G = G > 0 ? G : 0;
  B = B > 0 ? B : 0;

  const rHex = R.toString(16).padStart(2, '0');
  const gHex = G.toString(16).padStart(2, '0');
  const bHex = B.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}
