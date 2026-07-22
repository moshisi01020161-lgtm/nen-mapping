document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const dragLayer = document.getElementById('dragLayer');
    const chartContainer = document.getElementById('chartContainer');

    // Handle Image Upload
    imageUpload.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files) return;

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    createDraggableCharacter(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        }
        
        // Reset input
        imageUpload.value = '';
    });

    function createDraggableCharacter(imgSrc) {
        const card = document.createElement('div');
        card.classList.add('character-card');
        card.style.backgroundImage = `url(${imgSrc})`;

        // Initial position (center of drag layer / center of chart)
        const rect = dragLayer.getBoundingClientRect();
        card.style.left = `${rect.width / 2}px`;
        card.style.top = `${rect.height / 2}px`;

        dragLayer.appendChild(card);
        
        makeDraggable(card);
    }

    function makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const onPointerDown = (e) => {
            // Only left mouse button or touch
            if (e.button !== 0 && e.type !== 'touchstart') return;
            
            isDragging = true;
            startX = e.clientX || (e.touches && e.touches[0].clientX);
            startY = e.clientY || (e.touches && e.touches[0].clientY);
            
            // Get current computed style
            initialLeft = parseFloat(getComputedStyle(element).left) || 0;
            initialTop = parseFloat(getComputedStyle(element).top) || 0;

            if (e.pointerId !== undefined) {
                element.setPointerCapture(e.pointerId);
            }
            element.style.zIndex = 1000;
            element.style.cursor = 'grabbing';
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const currentX = e.clientX || (e.touches && e.touches[0].clientX);
            const currentY = e.clientY || (e.touches && e.touches[0].clientY);
            
            const dx = currentX - startX;
            const dy = currentY - startY;

            const targetX = initialLeft + dx;
            const targetY = initialTop + dy;

            // Apply snapping
            const chartSize = chartContainer.getBoundingClientRect().width;
            const snapped = getSnappedPoint(targetX, targetY, chartSize);

            element.style.left = `${snapped.x}px`;
            element.style.top = `${snapped.y}px`;
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            if (e.pointerId !== undefined) {
                element.releasePointerCapture(e.pointerId);
            }
            element.style.zIndex = '';
            element.style.cursor = 'grab';
        };

        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointermove', onPointerMove);
        element.addEventListener('pointerup', onPointerUp);
        element.addEventListener('pointercancel', onPointerUp);
        
        // Touch support fallback
        element.addEventListener('touchstart', onPointerDown, {passive: false});
        element.addEventListener('touchmove', onPointerMove, {passive: false});
        element.addEventListener('touchend', onPointerUp);
        element.addEventListener('touchcancel', onPointerUp);
    }

    // Handle Copy to Clipboard
    const copyBtn = document.getElementById('copyBtn');
    const captureArea = document.getElementById('captureArea');
    if (copyBtn && captureArea) {
        copyBtn.addEventListener('click', async () => {
            try {
                const span = copyBtn.querySelector('span');
                const originalText = span.innerText;
                span.innerText = 'コピー中...';
                
                const canvas = await html2canvas(captureArea, {
                    backgroundColor: '#f1f5f9',
                    scale: 2
                });
                
                canvas.toBlob(async (blob) => {
                    if (!blob) throw new Error('Canvas generation failed');
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                    
                    span.innerText = 'コピー完了！';
                    setTimeout(() => { span.innerText = originalText; }, 2000);
                }, 'image/png');
            } catch (error) {
                console.error('Copy failed:', error);
                const span = copyBtn.querySelector('span');
                span.innerText = 'エラー';
                setTimeout(() => { span.innerText = '画像をコピー'; }, 2000);
            }
        });
    }
});

// --- Snapping Logic ---
const hexagonVertices = [
    {x: 50, y: 5},
    {x: 95, y: 27.5},
    {x: 95, y: 72.5},
    {x: 50, y: 95},
    {x: 5, y: 72.5},
    {x: 5, y: 27.5}
];
const hexagonCenter = {x: 50, y: 50};
const segments = [];

// Outer hexagon lines
for (let i = 0; i < 6; i++) {
    segments.push({
        p1: hexagonVertices[i],
        p2: hexagonVertices[(i + 1) % 6]
    });
}
// Inner lines connecting center to vertices
for (let i = 0; i < 6; i++) {
    segments.push({
        p1: hexagonCenter,
        p2: hexagonVertices[i]
    });
}

function getClosestPointOnSegment(p, a, b) {
    const atob = { x: b.x - a.x, y: b.y - a.y };
    const atop = { x: p.x - a.x, y: p.y - a.y };
    const len2 = atob.x * atob.x + atob.y * atob.y;
    let dot = atop.x * atob.x + atop.y * atob.y;
    const t = Math.min(1, Math.max(0, dot / len2));
    return {
        x: a.x + atob.x * t,
        y: a.y + atob.y * t
    };
}

function getSnappedPoint(x, y, chartSize) {
    // Convert dragLayer coords to viewBox coords (0-100)
    const vx = ((x - 50) / chartSize) * 100;
    const vy = ((y - 50) / chartSize) * 100;
    
    let minDist = Infinity;
    let closestV = null;
    
    for (const seg of segments) {
        const pt = getClosestPointOnSegment({x: vx, y: vy}, seg.p1, seg.p2);
        const dist = Math.hypot(pt.x - vx, pt.y - vy);
        if (dist < minDist) {
            minDist = dist;
            closestV = pt;
        }
    }
    
    // Convert back to dragLayer coords
    return {
        x: (closestV.x / 100) * chartSize + 50,
        y: (closestV.y / 100) * chartSize + 50
    };
}
