const { v4: uuidv4 } = require('uuid');

const roomStates = new Map();

function getRoomState(roomId) {
    if (!roomStates.has(roomId)) {
        // Initialize state with history (strokes) and an undo stack
        roomStates.set(roomId, { history: [], redoStack: [] }); 
    }
    // Note: We won't manage users here, as that's handled by rooms.js
    return roomStates.get(roomId);
}

/**
 * Adds a stroke to the room's history.
 */
function addStroke(roomId, stroke) {
    const state = getRoomState(roomId);
    stroke.id = stroke.id || uuidv4(); // Ensure stroke has an ID
    stroke.status = 'active';
    stroke.createdAt = Date.now();
    
    state.history.push(stroke);
    state.redoStack = []; // Clear redo stack on new drawing action
    
    return stroke;
}

/**
 * Executes a localized undo for the requesting user.
 */
function undoStroke(roomId, requestingUserId) {
    const state = getRoomState(roomId);
    
    // Find the last active stroke made by the requesting user
    const lastActive = state.history
        .filter(s => s.userId === requestingUserId && s.status === 'active')
        .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (lastActive) {
        lastActive.status = 'undone';
        state.redoStack.push(lastActive); // Move to the redo stack
        return { strokeId: lastActive.id };
    }
    return null;
}

/**
 * Executes a redo operation.
 */
function redoStroke(roomId, requestingUserId) {
    const state = getRoomState(roomId);
    const strokeToRedo = state.redoStack.pop(); // Pop from the redo stack

    if (strokeToRedo) {
        strokeToRedo.status = 'active';
        state.history.push(strokeToRedo); // Add back to history (optional, but keeps history clean)
        return { stroke: strokeToRedo };
    }
    return null;
}

/**
 * Gets all active strokes for a room (used for canvasState initialization).
 */
function getActiveStrokes(roomId) {
    const state = getRoomState(roomId);
    // Group strokes by user ID for easy client consumption
    const groupedStrokes = {};
    state.history
        .filter(s => s.status === 'active')
        .forEach(s => {
            if (!groupedStrokes[s.userId]) {
                groupedStrokes[s.userId] = [];
            }
            groupedStrokes[s.userId].push(s);
        });
    return groupedStrokes;
}


module.exports = {
    addStroke,
    undoStroke,
    redoStroke,
    getActiveStrokes
};