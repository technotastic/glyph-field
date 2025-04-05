// script.js

// --- DOM Elements ---
const canvas = document.getElementById('glyphCanvas');
const ctx = canvas.getContext('2d');
const hintElement = document.getElementById('hint');
const switcherContainerElement = document.getElementById('switcherContainer'); // Updated ID

// --- Core Configuration ---
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;
const gridSize = 14;
const fontSize = 13;
const font = `${fontSize}px monospace`;

// --- Interaction & Timing ---
const revealSpeed = 0.15;
const shimmerChance = 0.03;
const stillnessThreshold = 150;       // Milliseconds mouse must be still to trigger reveal
const holdThreshold = 350;           // Milliseconds touch must be held to trigger reveal
const revealDuration = 1500;
const switcherTimeoutDuration = 3000; // Hide switcher slightly longer after interaction
const cursorHideThreshold = 300;    // Milliseconds of mouse stillness before hiding custom cursor

// --- Color Scheme Definitions ---
const colorSchemes = {
    matrixGreen: { name: "Matrix", base: 'rgba(0, 255, 0, 0.15)', reveal: 'rgba(0, 255, 0, 0.95)', background: '#101015' },
    terminalAmber: { name: "Amber", base: 'rgba(255, 176, 0, 0.2)', reveal: 'rgba(255, 191, 0, 0.95)', background: '#1a1a10' },
    hackerBlue: { name: "Blue", base: 'rgba(0, 180, 255, 0.15)', reveal: 'rgba(100, 220, 255, 0.95)', background: '#101520' },
    classicWhite: { name: "Mono", base: 'rgba(200, 200, 200, 0.2)', reveal: 'rgba(255, 255, 255, 0.95)', background: '#101010' },
    stealthGray: { name: "Stealth", base: 'rgba(150, 150, 150, 0.2)', reveal: 'rgba(200, 200, 200, 0.85)', background: '#181818' },
    cyberPunk: { name: "Cyber", base: 'rgba(255, 0, 255, 0.15)', reveal: 'rgba(0, 255, 255, 0.95)', background: '#101010' },
    inverted: { name: "Light", base: 'rgba(50, 50, 50, 0.2)', reveal: 'rgba(0, 0, 0, 0.85)', background: '#f0f0f0' }
};

// --- Glyph Set Definitions ---
const glyphSets = {
    matrix: {
        name: "Matrix",
        chars: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｯｬｭｮｶﾞｷﾞｸﾞｹﾞｺﾞｻﾞｼﾞｽﾞｾﾞｿﾞﾀﾞﾁﾞﾂﾞﾃﾞﾄﾞﾊﾞﾋﾞﾌﾞﾍﾞﾎﾟﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟｰ0123456789"
    },
    katakana: {
        name: "Katakana",
        chars: "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォッャュョガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポー"
    },
    ascii: {
        name: "ASCII",
        chars: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()[]{}-_+=\\|;:'\",.<>/?`~ "
    },
    binary: {
        name: "Binary",
        chars: "01 "
    },
    blocks: {
        name: "Blocks",
        chars: "█▓▒░ "
    }
};

// --- Initial Selections ---
let selectedSchemeName = 'matrixGreen';
let selectedGlyphSetName = 'matrix';

// --- Global Mutable Variables for Current Settings ---
let baseColor, revealColor, backgroundColor; // Theme colors
let currentScheme;                           // Full theme object
let glyphSet = glyphSets[selectedGlyphSetName].chars; // Active glyph character string
let currentGlyphSet;                         // Full glyph set object

// --- Reveal Snippets --- (Global for access)
const revealSnippets = [
    "focus", "reveal", "static", "order", "chaos", "signal", "hidden", "latent",
    "decode", "field", "mouse", "still", "touch", "hold", "silence", "glimpse",
    "perceive", "return;", "null", "void", "true", "false", "const", "let",
    "() => {}", "// ...", "data[i]", "<tag>", "{...}", "[...]", "sync", "await"
];

// --- Application State ---
let gridCols, gridRows;
let glyphGrid = [];           // Base noise character per cell
let targetGrid = [];          // Target character/object for reveal {char, revealId}
let intensityGrid = [];       // Reveal intensity (0-1) per cell
let pointerPos = { x: null, y: null }; // Unified pointer position (mouse or touch)
let lastPointerMoveTime = performance.now(); // Timestamp of last pointer movement
let mouseStillnessTimer = null;  // Timeout handle for MOUSE stillness
let touchHoldTimer = null;       // Timeout handle for TOUCH hold
let currentRevealId = 0;         // ID of the active reveal event
let revealTimeoutHandle = null;   // Timeout handle for ending reveal duration
let switcherHideTimeout = null;   // Timeout handle for hiding the switcher

/**
 * Applies the specified color scheme.
 * Updates global color variables and DOM styles.
 */
function applyTheme(schemeName) {
    const newScheme = colorSchemes[schemeName];
    if (!newScheme) {
        console.warn(`Theme "${schemeName}" not found.`);
        return;
    }
    selectedSchemeName = schemeName;
    currentScheme = newScheme;
    baseColor = currentScheme.base;
    revealColor = currentScheme.reveal;
    backgroundColor = currentScheme.background;

    document.body.style.backgroundColor = backgroundColor;

    const buttons = switcherContainerElement.querySelectorAll('.switcher-group[data-group="theme"] button');
    buttons.forEach(button => {
        button.classList.toggle('active', button.dataset.key === schemeName);
    });

    const bgHex = backgroundColor.startsWith('#') ? backgroundColor : '#101010';
    const bgLum = parseInt(bgHex.slice(1,3), 16) * 0.299 + parseInt(bgHex.slice(3,5), 16) * 0.587 + parseInt(bgHex.slice(5,7), 16) * 0.114;
    hintElement.style.color = bgLum > 128 ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.3)';
    hintElement.textContent = "Hold still / Tap & Hold to reveal..."; // Update hint text
}

/**
 * Applies the specified glyph set.
 * Updates the global glyphSet variable and resets the grid data.
 */
function applyGlyphSet(setName) {
    const newGlyphSet = glyphSets[setName];
    if (!newGlyphSet) {
        console.warn(`Glyph set "${setName}" not found.`);
        return;
    }
    selectedGlyphSetName = setName;
    currentGlyphSet = newGlyphSet;
    glyphSet = currentGlyphSet.chars; // Update the active glyph string

    console.log(`Applying glyph set: ${currentGlyphSet.name}`);

    const buttons = switcherContainerElement.querySelectorAll('.switcher-group[data-group="glyph"] button');
    buttons.forEach(button => {
        button.classList.toggle('active', button.dataset.key === setName);
    });

    // Reinitialize grid data with new glyphs
    initializeGridData();
    // No need to redraw immediately, animate loop will handle it.
}

/**
 * Populates the switcher UI with theme and glyph set buttons.
 */
function createSwitcherUI() {
    switcherContainerElement.innerHTML = ''; // Clear previous

    // Create Theme Group
    const themeGroup = document.createElement('div');
    themeGroup.className = 'switcher-group';
    themeGroup.dataset.group = 'theme';
    for (const key in colorSchemes) {
        if (colorSchemes.hasOwnProperty(key)) {
            const scheme = colorSchemes[key];
            const button = document.createElement('button');
            button.textContent = scheme.name;
            button.dataset.key = key; // Use key for applying theme
            button.addEventListener('click', () => { applyTheme(key); hideSwitcher(); });
            themeGroup.appendChild(button);
        }
    }
    switcherContainerElement.appendChild(themeGroup);

    // Create Glyph Set Group
    const glyphGroup = document.createElement('div');
    glyphGroup.className = 'switcher-group';
    glyphGroup.dataset.group = 'glyph';
    for (const key in glyphSets) {
        if (glyphSets.hasOwnProperty(key)) {
            const set = glyphSets[key];
            const button = document.createElement('button');
            button.textContent = set.name;
            button.dataset.key = key; // Use key for applying glyph set
            button.addEventListener('click', () => { applyGlyphSet(key); hideSwitcher(); });
            glyphGroup.appendChild(button);
        }
    }
    switcherContainerElement.appendChild(glyphGroup);

    // Apply initial selections to highlight buttons
    applyTheme(selectedSchemeName);
    applyGlyphSet(selectedGlyphSetName);
}

/** Hides the switcher immediately and clears its hide timer */
function hideSwitcher() {
    switcherContainerElement.classList.remove('visible');
    if (switcherHideTimeout) clearTimeout(switcherHideTimeout);
    switcherHideTimeout = null;
}

/** Shows the switcher and resets its hide timer */
function showSwitcher() {
    switcherContainerElement.classList.add('visible');
    if (switcherHideTimeout) clearTimeout(switcherHideTimeout);
    switcherHideTimeout = setTimeout(hideSwitcher, switcherTimeoutDuration);
}


/** Initializes or reinitializes the grid data arrays. */
function initializeGridData() {
    gridCols = Math.ceil(width / gridSize);
    gridRows = Math.ceil(height / gridSize);
    glyphGrid = new Array(gridCols * gridRows);
    targetGrid = new Array(gridCols * gridRows);
    intensityGrid = new Array(gridCols * gridRows).fill(0);

    // Populate initial noise grid using the currently selected glyphSet
    if (!glyphSet || glyphSet.length === 0) {
        console.error("Glyph set is empty or invalid!");
        glyphSet = "?"; // Fallback character
    }
    for (let i = 0; i < glyphGrid.length; i++) {
        const noiseChar = glyphSet[Math.floor(Math.random() * glyphSet.length)];
        glyphGrid[i] = noiseChar;
        targetGrid[i] = noiseChar; // Target initially matches noise
    }
     console.log(`Grid data reinitialized with ${glyphSet.length} glyphs.`);
}


/** Parses an RGBA color string into an object {r, g, b, a}. */
function parseRGBA(rgbaString) { /* ... same implementation as before ... */
    if (!rgbaString || typeof rgbaString !== 'string') return { r: 0, g: 0, b: 0, a: 0 };
    const match = rgbaString.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/);
    if (!match) {
        const tempCtx = document.createElement('canvas').getContext('2d'); // Hacky way to parse hex/named colors if needed
        tempCtx.fillStyle = rgbaString;
        if(tempCtx.fillStyle === ''){ return { r: 0, g: 0, b: 0, a: 1 }; } // Fallback black on fail
         const colorData = tempCtx.getImageData(0,0,1,1).data; // Not fully reliable but might work for basic hex
        return {r: colorData[0], g: colorData[1], b: colorData[2], a: 1}; //Assume opaque for non-rgba parse attempts
    }
    return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]), a: match[4] !== undefined ? parseFloat(match[4]) : 1 };
}

/** Checks if the mouse has been still long enough to trigger reveal. */
function checkForMouseStillness() {
    if (performance.now() - lastPointerMoveTime >= stillnessThreshold) {
        triggerRevealAt(pointerPos.x, pointerPos.y); // Reveal at last mouse position
    } else {
        // Not still long enough, check again shortly
        mouseStillnessTimer = setTimeout(checkForMouseStillness, stillnessThreshold / 2);
    }
}

/** Called when a touch hold threshold is met. */
function checkForTouchHold() {
    // Check if touch is potentially still active (no touchend/cancel received)
    if(touchHoldTimer){
       triggerRevealAt(pointerPos.x, pointerPos.y); // Reveal at touch position
       // Prevent immediate re-trigger if finger doesn't move slightly
       clearTimeout(touchHoldTimer);
       touchHoldTimer = null;
    }
}

/**
 * Triggers the reveal effect at the specified coordinates.
 * Updates targetGrid and manages reveal timers.
 * @param {number} x - The x-coordinate for the reveal center.
 * @param {number} y - The y-coordinate for the reveal center.
 */
function triggerRevealAt(x, y) {
     if (x === null || y === null) return; // Need a valid position

    const gridX = Math.floor(x / gridSize);
    const gridY = Math.floor(y / gridSize);

    // Basic bounds check
    if (gridY < 0 || gridY >= gridRows || gridX < 0 || gridX >= gridCols) return;

    // Select a snippet
    const snippet = revealSnippets[Math.floor(Math.random() * revealSnippets.length)];
    const snippetLen = snippet.length;
    const startX = Math.max(0, gridX - Math.floor(snippetLen / 2));

    // Unique ID for this reveal event
    const newRevealId = performance.now();
    currentRevealId = newRevealId;

    // Update targetGrid for the snippet area
    for (let i = 0; i < snippetLen; i++) {
        const currentX = startX + i;
        if (currentX >= gridCols) break;
        const index = gridY * gridCols + currentX;
        if (index < targetGrid.length && index >= 0) {
            targetGrid[index] = { char: snippet[i], revealId: newRevealId };
        }
    }

    // Manage reveal duration timer
    if (revealTimeoutHandle) clearTimeout(revealTimeoutHandle);
    revealTimeoutHandle = setTimeout(() => {
        if (currentRevealId === newRevealId) { // Deactivate only if still the current reveal
            currentRevealId = 0;
        }
        revealTimeoutHandle = null;
    }, revealDuration);

    // Clear any pending stillness/hold checks
    if (mouseStillnessTimer) clearTimeout(mouseStillnessTimer);
    if (touchHoldTimer) clearTimeout(touchHoldTimer);
    mouseStillnessTimer = null;
    touchHoldTimer = null;
}

/**
 * Main animation loop. Clears canvas, updates states, draws elements.
 */
function animate(timestamp) {
    requestAnimationFrame(animate); // Schedule next frame

    const timeSinceLastPointerMove = timestamp - lastPointerMoveTime;

    // --- Stillness Check Scheduling (MOUSE ONLY) ---
    // Schedule only if mouse was the last input type and relevant timers aren't active
    // (Assume touch doesn't trigger mouse stillness checks)
    if (!mouseStillnessTimer && currentRevealId === 0 && !revealTimeoutHandle && !touchHoldTimer) {
        if(timeSinceLastPointerMove > stillnessThreshold / 2) {
           mouseStillnessTimer = setTimeout(checkForMouseStillness, stillnessThreshold);
        }
    }

    // --- Apply Theme If Needed ---
    if (!backgroundColor) applyTheme(selectedSchemeName);

    // --- Canvas Clearing ---
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // --- Color Parsing ---
    const clrBase = parseRGBA(baseColor);
    const clrReveal = parseRGBA(revealColor);

    // --- Grid Update and Drawing ---
    // ...(Grid drawing loop remains functionally the same as previous version)...
     for (let y = 0; y < gridRows; y++) {
        for (let x = 0; x < gridCols; x++) {
            const index = y * gridCols + x;
            if (index >= glyphGrid.length) continue;

            let targetCharData = targetGrid[index];
            let targetChar = '';
            let revealId = 0;

            if (typeof targetCharData === 'object' && targetCharData !== null && targetCharData.hasOwnProperty('revealId')) {
                targetChar = targetCharData.char;
                revealId = targetCharData.revealId;
            } else {
                if (!glyphGrid[index] || glyphSet.indexOf(glyphGrid[index]) === -1) { // Ensure noise character is valid
                    glyphGrid[index] = glyphSet[Math.floor(Math.random() * glyphSet.length)];
                 }
                targetChar = glyphGrid[index];
                if (targetGrid[index] !== targetChar) targetGrid[index] = targetChar;
            }

            const targetIntensity = (revealId !== 0 && revealId === currentRevealId) ? 1.0 : 0.0;

            intensityGrid[index] += (targetIntensity - intensityGrid[index]) * revealSpeed;
            intensityGrid[index] = Math.max(0.0, Math.min(1.0, intensityGrid[index]));

            let charToDraw;
            let finalColor;
            const currentIntensity = intensityGrid[index];

            if (currentIntensity < 0.01) {
                 if (Math.random() < shimmerChance) {
                    const noiseCharIndex = Math.floor(Math.random() * glyphSet.length);
                    glyphGrid[index] = glyphSet[noiseCharIndex] || ' '; // Use space if index is invalid
                    if (typeof targetGrid[index] !== 'object') targetGrid[index] = glyphGrid[index];
                }
                charToDraw = glyphGrid[index];
                finalColor = baseColor;
                if (typeof targetGrid[index] === 'object') {
                    targetGrid[index] = glyphGrid[index];
                }
            } else {
                charToDraw = targetChar;
                const r = Math.round(clrBase.r + (clrReveal.r - clrBase.r) * currentIntensity);
                const g = Math.round(clrBase.g + (clrReveal.g - clrBase.g) * currentIntensity);
                const b = Math.round(clrBase.b + (clrReveal.b - clrBase.b) * currentIntensity);
                const a = clrBase.a + (clrReveal.a - clrBase.a) * currentIntensity;
                finalColor = `rgba(${r},${g},${b},${a})`;
            }

            ctx.fillStyle = finalColor;
            ctx.fillText( charToDraw, x * gridSize + gridSize / 2, y * gridSize + gridSize / 2 );
        }
    }

    // --- Draw Custom Cursor (Desktop Only and Conditional) ---
    // Hide if mouse hasn't moved recently
    if (pointerPos.x !== null && pointerPos.y !== null && timeSinceLastPointerMove < cursorHideThreshold) {
        // Detect if touch is active (crude check, better ways exist)
        const isLikelyTouchEvent = 'ontouchstart' in window && navigator.maxTouchPoints > 0;
        if (!isLikelyTouchEvent) { // Only draw if not likely a touch interaction
            const cursorRadius = 4;
            const cursorClr = clrReveal;
            ctx.fillStyle = `rgba(${cursorClr.r},${cursorClr.g},${cursorClr.b},0.4)`;
            ctx.beginPath();
            ctx.arc(pointerPos.x, pointerPos.y, cursorRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/**
 * Initializes the application.
 * Sets up canvas, context, grid data, UI, and event listeners.
 */
function setup() {
    // Initialize grid data first (needs width/height)
    initializeGridData();

    // Configure canvas context for drawing
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Create theme switcher buttons and apply initial theme/glyphs
    createSwitcherUI();

    console.log(`Glyph Field initialized: ${gridCols}x${gridRows} cells.`);

    // Start the animation loop
    requestAnimationFrame(animate);
}

// --- Event Listener Setup ---

/** Handles pointer movement (from mouse or touch) */
function handlePointerMove(x, y) {
    pointerPos.x = x;
    pointerPos.y = y;
    lastPointerMoveTime = performance.now(); // Record movement time

    showSwitcher(); // Show UI controls on interaction

    // Clear stillness/hold timers as movement occurred
    if (mouseStillnessTimer) clearTimeout(mouseStillnessTimer);
    if (touchHoldTimer) clearTimeout(touchHoldTimer);
    mouseStillnessTimer = null;
    touchHoldTimer = null;

    // Cancel any active reveal targeting on movement
    currentRevealId = 0;

    // Hide hint text on interaction
    if (hintElement) hintElement.style.opacity = '0';
}

/** Handles the end of an interaction (mouse up, leave, touch end/cancel) */
function handlePointerEnd() {
     // Clear timers associated with active interaction
    if (mouseStillnessTimer) clearTimeout(mouseStillnessTimer);
    if (touchHoldTimer) clearTimeout(touchHoldTimer);
    mouseStillnessTimer = null;
    touchHoldTimer = null;

     // We might still be revealing (due to revealDuration timer), so don't reset currentRevealId here
     // Restart the switcher hide timer explicitly on pointer end
    if (switcherHideTimeout) clearTimeout(switcherHideTimeout);
     switcherHideTimeout = setTimeout(hideSwitcher, switcherTimeoutDuration);
}


// -- Mouse Listeners --
canvas.addEventListener('mousemove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
});
canvas.addEventListener('mouseleave', handlePointerEnd); // Handle mouse leaving the canvas


// -- Touch Listeners --
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default scroll/zoom on touch
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        handlePointerMove(touch.clientX, touch.clientY); // Update position on start

        // Start hold timer
        if (touchHoldTimer) clearTimeout(touchHoldTimer); // Clear previous if any
        touchHoldTimer = setTimeout(checkForTouchHold, holdThreshold);
    }
}, { passive: false }); // Need passive:false to use preventDefault

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent default scroll/zoom during drag
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        handlePointerMove(touch.clientX, touch.clientY); // Updates position and clears hold timer via handlePointerMove
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handlePointerEnd(); // Clear timers etc.
}, { passive: false });

canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    handlePointerEnd(); // Clear timers etc. on cancel
}, { passive: false });


// --- Window Resize Listener ---
window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    console.log("Window resized - Reinitializing.");
    // Clear all pending timers
    if (mouseStillnessTimer) clearTimeout(mouseStillnessTimer);
    if (touchHoldTimer) clearTimeout(touchHoldTimer);
    if (revealTimeoutHandle) clearTimeout(revealTimeoutHandle);
    if (switcherHideTimeout) clearTimeout(switcherHideTimeout);
    mouseStillnessTimer = null;
    touchHoldTimer = null;
    revealTimeoutHandle = null;
    switcherHideTimeout = null;
    currentRevealId = 0; // Reset active reveal
    // Rerun setup (which calls initializeGridData and createSwitcherUI)
    setup();
});


// --- Start Application ---
setup(); // Initial call