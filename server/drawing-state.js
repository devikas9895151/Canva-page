const socket = io('http://localhost:4000');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.getElementById('canvas-wrapper');
const chatMessages = document.getElementById('chat-messages');

// Tool and UI element references
const brushBtn = document.getElementById('brushBtn');
const pencilBtn = document.getElementById('pencilBtn');
const eraserBtn = document.getElementById('eraserBtn');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const userListDiv = document.getElementById('user-list');
const toolButtons = [brushBtn, pencilBtn, eraserBtn];

// Drawing state variables
let userId = null;
let brushColor = colorPicker.value;
let brushSize = parseInt(sizePicker.value);
let tool = 'brush';
let isDrawing = false;
let currentStroke = [];
let userColors = {}; // Stores colors for remote cursors

// --- 1. CANVAS MANAGER (DRAWING/RENDERING LOGIC) ---

const canvasManager = {
    history: [], 
    cursors: {}, 
    
    redrawAll() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        this.history.filter(s => s.status === 'active').forEach(s => this.drawStroke(s));
        
        this.drawCursors();
    },
    
    drawStroke(stroke) {
        if (!stroke.points || stroke.points.length < 2) return;
        
        ctx.strokeStyle = (stroke.tool === 'eraser') ? '#FFFFFF' : stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    },
    
    drawCursors() {
        document.querySelectorAll('.cursor').forEach(el => {
            if (!this.cursors[el.dataset.userId]) {
                el.remove();
            }
        });

        Object.entries(this.cursors).forEach(([id, cursor]) => {
            if (id === userId) return;
            
            let c = cursor.element;
            if (!c) {
                c = document.createElement('div');
                c.className = 'cursor';
                c.style.backgroundColor = userColors[id] || '#000';
                c.dataset.userId = id;
                document.body.appendChild(c);
                cursor.element = c;
            }
            
            const wrapperRect = canvasWrapper.getBoundingClientRect();
            c.style.left = (cursor.x + wrapperRect.left) + 'px';
            c.style.top = (cursor.y + wrapperRect.top) + 'px';
        });
    }
};

// --- 2. UI HANDLERS ---

function setActiveToolButton(activeTool) {
    toolButtons.forEach(btn => btn.classList.remove('active-tool'));
    if (activeTool === 'brush') brushBtn.classList.add('active-tool');
    else if (activeTool === 'pencil') pencilBtn.classList.add('active-tool');
    else if (activeTool === 'eraser') eraserBtn.classList.add('active-tool');
}

// Toolbar events
brushBtn.onclick = () => { tool = 'brush'; brushSize = parseInt(sizePicker.value); setActiveToolButton(tool); };
pencilBtn.onclick = () => { tool = 'pencil'; brushSize = 2; setActiveToolButton(tool); };
eraserBtn.onclick = () => { tool = 'eraser'; brushSize = parseInt(sizePicker.value); setActiveToolButton(tool); };
colorPicker.onchange = e => brushColor = e.target.value;
sizePicker.onchange = e => { if (tool !== 'pencil') brushSize = parseInt(e.target.value); };

// Undo/Redo requests
undoBtn.onclick = () => { if (userId) socket.emit('requestUndo', { userId }); };
redoBtn.onclick = () => { if (userId) socket.emit('requestRedo', { userId }); };

// Chat submit handler
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (message && userId) {
        socket.emit('chatMessage', { message });
        chatInput.value = '';
    }
});

// --- 3. SOCKET.IO EVENT LISTENERS ---

// Initial setup from server
socket.on('assignUserId', ({ userId: id, color }) => {
    userId = id;
    brushColor = color; 
    console.log(`Assigned User ID: ${userId}`);
    // Set the user's color picker to their assigned color
    colorPicker.value = color;
});

// Updates the list of currently connected users
socket.on('updateUsers', users => {
    userListDiv.innerHTML = '';
    users.forEach(u => {
        userColors[u.userId] = u.color; 
        const userCard = document.createElement('div');
        userCard.className = "flex items-center gap-2 px-3 py-1 rounded-lg border shadow-sm bg-white text-sm";
        userCard.style.borderColor = u.color;
        userCard.style.color = u.color;

        const dot = document.createElement('div');
        dot.className = "w-2 h-2 rounded-full";
        dot.style.backgroundColor = u.color;

        const name = document.createElement('span');
        name.textContent = u.userId;

        userCard.appendChild(dot);
        userCard.appendChild(name);
        userListDiv.appendChild(userCard);
    });
    // Cleanup any cursor elements of disconnected users
    Object.keys(canvasManager.cursors).forEach(id => {
        if (!users.some(u => u.userId === id)) {
            canvasManager.cursors[id]?.element?.remove();
            delete canvasManager.cursors[id];
        }
    });
});

// Receives chat messages and displays them
socket.on('chatMessage', ({ userId: uId, message, color }) => {
    const msgContainer = document.createElement('div');
    msgContainer.className = 'p-1';
    
    const userSpan = document.createElement('span');
    userSpan.textContent = `${uId}: `;
    userSpan.style.color = color;
    userSpan.className = 'font-semibold text-xs';
    
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    msgSpan.className = 'text-gray-700 text-sm break-words';
    
    msgContainer.appendChild(userSpan);
    msgContainer.appendChild(msgSpan);
    chatMessages.appendChild(msgContainer);
    
    // Scroll to the bottom of the chat window
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Receives the full history on connection
socket.on('canvasState', state => {
    canvasManager.history = [];
    Object.values(state).forEach(userStrokes => userStrokes.forEach(s => canvasManager.history.push(s)));
    canvasManager.redrawAll();
});

// Receives a remote stroke
socket.on('stroke', ({ stroke }) => {
    canvasManager.history.push(stroke);
    canvasManager.redrawAll();
});

// Receives Undo/Redo operation from server
socket.on('canvasOperation', ({ type, stroke, strokeId }) => {
    if (type === 'undo') {
        const s = canvasManager.history.find(s => s.id === strokeId);
        if (s) s.status = 'undone';
    } else if (type === 'redo' && stroke) {
        canvasManager.history.push(stroke);
    }
    canvasManager.redrawAll();
});

// Receives remote cursor movement
socket.on('cursorMove', ({ userId: uId, x, y }) => {
    if (uId === userId) return;

    let cursor = canvasManager.cursors[uId];
    if (!cursor) {
        cursor = { x: x, y: y, element: null };
        canvasManager.cursors[uId] = cursor;
    } else {
        cursor.x = x; 
        cursor.y = y; 
    }
    canvasManager.drawCursors();
});

// --- 4. LOCAL DRAWING & SENDING LOGIC (Mouse Events) ---

const getCoords = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
};

// Drawing Segment Helper for continuous local drawing
function drawSegment(from, to) {
    ctx.strokeStyle = (tool === 'eraser') ? '#FFFFFF' : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

canvas.addEventListener('mousedown', e => {
    if (!userId) return; 
    isDrawing = true;
    const coords = getCoords(e);
    currentStroke = [coords];
    
    // Start drawing the path
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    // Draw an initial dot if necessary
    ctx.lineTo(coords.x + 0.01, coords.y + 0.01);
    ctx.stroke();
});

canvas.addEventListener('mousemove', e => {
    const coords = getCoords(e);
    socket.emit('cursorMove', { x: coords.x, y: coords.y }); 

    if (!isDrawing) return;
    
    // Draw segment and add point to stroke array
    if (currentStroke.length > 0) {
        const lastPoint = currentStroke[currentStroke.length - 1];
        drawSegment(lastPoint, coords);
    }
    currentStroke.push(coords);
});

canvas.addEventListener('mouseup', () => {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.closePath(); // Finalize the local drawing path
    
    if (currentStroke.length > 1) { 
        const strokeData = {
            id: crypto.randomUUID(),
            color: brushColor,
            size: brushSize,
            points: currentStroke,
            status: 'active',
            tool: tool
        };
        
        // Add to local history and broadcast
        canvasManager.history.push(strokeData);
        socket.emit('stroke', { stroke: strokeData });
    }
    currentStroke = [];
});

// Stop drawing if mouse leaves canvas while drawing
canvas.addEventListener('mouseleave', () => { 
    if (isDrawing) canvas.dispatchEvent(new Event('mouseup')); 
});


// --- 5. INITIALIZATION ---

window.onload = () => {
    setActiveToolButton(tool);
    canvasManager.redrawAll(); 
    window.addEventListener('resize', canvasManager.redrawAll); 
};