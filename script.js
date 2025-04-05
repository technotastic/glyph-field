const canvas = document.getElementById('glyphCanvas');
const ctx = canvas.getContext('2d');
const hintElement = document.getElementById('hint');

// --- Configuration ---
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;
const gridSize = 14;
const fontSize = 13; // Slightly larger for clarity
const font = `${fontSize}px monospace`;
const baseColor = 'rgba(180, 180, 200, 0.2)';
const revealColor = 'rgba(230, 240, 255, 0.95)'; // Brighter reveal
const revealSpeed = 0.15; // Faster interpolation speed for reveal/fade
const shimmerChance = 0.03; // Lowered shimmer chance slightly
const stillnessThreshold = 150; // ms mouse must be still to trigger
const revealDuration = 1500; // ms reveal stays active after trigger

// More diverse characters
const glyphSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`-=[]\\;',./~!@#$%^&*()_+{}|:\"<>? ";
const revealSnippets = [
    "focus", "reveal", "static", "order", "chaos", "signal", "hidden", "latent",
    "decode", "field", "mouse", "still", "silence", "glimpse", "perceive",
    "return;", "null", "void", "true", "false", "const", "let", "var",
    "() => {}", "// ...", "data[i]", "<tag>", "{...}", "[...]"
];

// --- State ---
let gridCols, gridRows;
let glyphGrid = [];      // Character currently displayed or base noise character
let targetGrid = [];     // The target character (noise or revealed snippet)
let intensityGrid = [];  // Reveal intensity (0 to 1) for each cell
let mousePos = { x: 0, y: 0 };
let lastMoveTime = performance.now();
let stillnessTimer = null; // Timer for detecting stillness
let currentRevealId = 0; // To track the active reveal event
let revealTimeoutHandle = null; // Handle for the reveal duration timer

// --- Initialization ---
function setup() {
    gridCols = Math.ceil(width / gridSize);
    gridRows = Math.ceil(height / gridSize);
    glyphGrid = new Array(gridCols * gridRows);
    targetGrid = new Array(gridCols * gridRows);
    intensityGrid = new Array(gridCols * gridRows).fill(0); // Initialize all intensities to 0

    // Initialize noise characters
    for (let i = 0; i < glyphGrid.length; i++) {
        const noiseChar = glyphSet[Math.floor(Math.random() * glyphSet.length)];
        glyphGrid[i] = noiseChar;
        targetGrid[i] = noiseChar; // Initially, target is just the noise
    }

    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    console.log(`Grid initialized: ${gridCols}x${gridRows}`);
    // Start animation
    requestAnimationFrame(animate);
}

// --- Interaction ---
canvas.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
    lastMoveTime = performance.now();

    // If mouse moves, cancel any pending stillness check
    if (stillnessTimer) {
        clearTimeout(stillnessTimer);
        stillnessTimer = null;
    }
    // If mouse moves, signal that we are no longer actively revealing *this specific set*
    // The fade-out happens naturally via target intensity being set back to 0 below
    currentRevealId = 0; // Mark no active reveal targetting

    // Optionally hide hint faster
    if (hintElement) hintElement.style.opacity = '0';
});

// --- Reveal Logic ---
function checkForStillness() {
    if (performance.now() - lastMoveTime >= stillnessThreshold) {
        // Mouse has been still long enough
        triggerReveal();
    } else {
        // Mouse moved recently, keep checking
        stillnessTimer = setTimeout(checkForStillness, stillnessThreshold / 2); // Check again soon
    }
}

function triggerReveal() {
    console.log("Stillness detected - Triggering reveal");
    const gridX = Math.floor(mousePos.x / gridSize);
    const gridY = Math.floor(mousePos.y / gridSize);

    if (gridY < 0 || gridY >= gridRows) return; // Basic bounds check

    // Choose snippet and calculate start position
    const snippet = revealSnippets[Math.floor(Math.random() * revealSnippets.length)];
    const snippetLen = snippet.length;
    // Center the snippet roughly under the mouse
    const startX = Math.max(0, gridX - Math.floor(snippetLen / 2));

    currentRevealId = performance.now(); // Use timestamp as unique ID for this reveal

    console.log(`Revealing "${snippet}" at ${startX},${gridY} (ID: ${currentRevealId})`);

    // Update target grid for the snippet area
    for (let i = 0; i < snippetLen; i++) {
        const currentX = startX + i;
        if (currentX >= gridCols) break; // Stay within bounds

        const index = gridY * gridCols + currentX;
        if (index < targetGrid.length) {
             // Set target character AND associate with current reveal ID
            targetGrid[index] = { char: snippet[i], revealId: currentRevealId };
            // Note: Intensity change is handled in the animation loop
        }
    }

    // Clear any existing reveal duration timer and start a new one
    if (revealTimeoutHandle) clearTimeout(revealTimeoutHandle);
    revealTimeoutHandle = setTimeout(() => {
        console.log(`Reveal duration ended for ID: ${currentRevealId}`);
        // When duration ends, mark the reveal as inactive.
        // Cells will fade because currentRevealId will no longer match.
         currentRevealId = 0;
         revealTimeoutHandle = null;
    }, revealDuration);

    // Prevent immediate re-triggering by clearing stillness timer
     if (stillnessTimer) clearTimeout(stillnessTimer);
     stillnessTimer = null; // Needs mouse move to restart check
}

// --- Color Interpolation Helper ---
function lerpColor(colorA, colorB, t) {
    const rA = parseInt(colorA.slice(1, 3), 16);
    const gA = parseInt(colorA.slice(3, 5), 16);
    const bA = parseInt(colorA.slice(5, 7), 16);
    const aA = colorA.length > 7 ? parseInt(colorA.slice(7, 9), 16) / 255 : 1;

    const rB = parseInt(colorB.slice(1, 3), 16);
    const gB = parseInt(colorB.slice(3, 5), 16);
    const bB = parseInt(colorB.slice(5, 7), 16);
    const aB = colorB.length > 7 ? parseInt(colorB.slice(7, 9), 16) / 255 : 1;

    const r = Math.round(rA + (rB - rA) * t);
    const g = Math.round(gA + (gB - gA) * t);
    const b = Math.round(bA + (bB - bA) * t);
    const a = aA + (aB - aA) * t;

    return `rgba(${r},${g},${b},${a})`;
}
// Quick parse function for rgba (needed because lerp needs hex or numbers)
function parseRGBA(rgbaString) {
    const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return { r: 0, g: 0, b: 0, a: 0 };
    return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1
    };
}


// --- Animation Loop ---
function animate(timestamp) {
    // Request next frame immediately
    requestAnimationFrame(animate);

    // Check if we should start looking for stillness
    if (!stillnessTimer && currentRevealId === 0 && !revealTimeoutHandle) {
        stillnessTimer = setTimeout(checkForStillness, stillnessThreshold);
    }

    // Clear canvas
    ctx.fillStyle = '#101015'; // Use background color from config if changed
    ctx.fillRect(0, 0, width, height);

    // Colors for interpolation
    const clrBase = parseRGBA(baseColor); // Parse color strings once per frame
    const clrReveal = parseRGBA(revealColor);


    // Draw grid
    for (let y = 0; y < gridRows; y++) {
        for (let x = 0; x < gridCols; x++) {
            const index = y * gridCols + x;
            if (index >= glyphGrid.length) continue; // Bounds check

            let targetCharObj = targetGrid[index];
            let targetCh = '';
            let targetId = 0;

            if (typeof targetCharObj === 'object' && targetCharObj !== null && targetCharObj.hasOwnProperty('revealId')) {
                targetCh = targetCharObj.char;
                targetId = targetCharObj.revealId;
            } else {
                // Reset target to noise character if it's not a valid reveal object
                if (!glyphGrid[index]) glyphGrid[index] = glyphSet[Math.floor(Math.random() * glyphSet.length)];
                targetCh = glyphGrid[index]; // The base noise char for this cell
                if (targetGrid[index] !== targetCh) targetGrid[index] = targetCh; // Ensure targetGrid also has noise if not revealing
            }

            // Determine target intensity: 1 if part of the currently active reveal, 0 otherwise
            const targetIntensity = (targetId !== 0 && targetId === currentRevealId) ? 1 : 0;

            // Smoothly interpolate current intensity towards target
            intensityGrid[index] += (targetIntensity - intensityGrid[index]) * revealSpeed;
            intensityGrid[index] = Math.max(0, Math.min(1, intensityGrid[index])); // Clamp 0-1

            let charToDraw;
            let finalColor;
            let currentIntensity = intensityGrid[index];

            if (currentIntensity < 0.01) {
                // Not revealing: Show noise, shimmer, reset target if needed
                if (Math.random() < shimmerChance) {
                   glyphGrid[index] = glyphSet[Math.floor(Math.random() * glyphSet.length)];
                }
                charToDraw = glyphGrid[index];
                finalColor = baseColor;

                // Explicitly reset targetGrid entry back to the noise character if it was part of a finished reveal
                if (typeof targetGrid[index] === 'object') {
                     targetGrid[index] = glyphGrid[index];
                }
            } else {
                // Revealing: Show target char, interpolate color
                charToDraw = targetCh; // Should be the reveal character

                // Lerp color
                 const r = Math.round(clrBase.r + (clrReveal.r - clrBase.r) * currentIntensity);
                 const g = Math.round(clrBase.g + (clrReveal.g - clrBase.g) * currentIntensity);
                 const b = Math.round(clrBase.b + (clrReveal.b - clrBase.b) * currentIntensity);
                 const a = clrBase.a + (clrReveal.a - clrBase.a) * currentIntensity;
                 finalColor = `rgba(${r},${g},${b},${a})`;
            }

            ctx.fillStyle = finalColor;
            ctx.fillText(
                charToDraw,
                x * gridSize + gridSize / 2,
                y * gridSize + gridSize / 2
            ); // Semicolon is present here!
        }
    }

    // --- DRAW CUSTOM CURSOR --- (Added section)
    // Check if mouse position is valid (has been recorded at least once)
    if (mousePos.x !== null && mousePos.y !== null) {
        // Style for the custom cursor (make it subtle)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // Semi-transparent white dot
        // ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Optional outline
        // ctx.lineWidth = 1;

        // Draw a small circle
        const cursorRadius = 4;
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, cursorRadius, 0, Math.PI * 2);
        ctx.fill();
        // Optionally add a small outline if you prefer:
        // ctx.stroke();

        // === Alternative: Crosshairs ===
        // const crosshairSize = 8;
        // ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        // ctx.lineWidth = 1;
        // ctx.beginPath();
        // ctx.moveTo(mousePos.x - crosshairSize, mousePos.y);
        // ctx.lineTo(mousePos.x + crosshairSize, mousePos.y);
        // ctx.moveTo(mousePos.x, mousePos.y - crosshairSize);
        // ctx.lineTo(mousePos.x, mousePos.y + crosshairSize);
        // ctx.stroke();
        // === End Alternative ===
    }
    // --- END CUSTOM CURSOR ---

} // *** End of the animate function ***

// --- Resize Handling ---
window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    console.log("Resizing - reinitializing grid.");
    // Clear any pending timers to avoid issues
     if (stillnessTimer) clearTimeout(stillnessTimer);
     if (revealTimeoutHandle) clearTimeout(revealTimeoutHandle);
     stillnessTimer = null;
     revealTimeoutHandle = null;
     currentRevealId = 0;
    // Re-initialize grid on resize
    setup();
});

// --- Start ---
setup();