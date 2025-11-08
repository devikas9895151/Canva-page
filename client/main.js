window.MY_USER_ID = null;

document.addEventListener('DOMContentLoaded', () => {
  const canvasManager = new CanvasManager();
  const websocketManager = new WebsocketManager(canvasManager);
  window.canvasManager = canvasManager;
  window.websocketManager = websocketManager;

  document.getElementById('tool-brush').onclick = () => (canvasManager.currentTool = 'brush');
  document.getElementById('tool-eraser').onclick = () => (canvasManager.currentTool = 'eraser');
  document.getElementById('color-picker').onchange = e => (canvasManager.currentColor = e.target.value);
  document.getElementById('stroke-width').oninput = e => (canvasManager.currentWidth = parseInt(e.target.value));
  document.getElementById('undo-btn').onclick = () => {
    console.log('[UI] Undo clicked');
    websocketManager.emit('requestUndo', { userId: window.MY_USER_ID });
  };
});

window.updateUserList = function (users) {
  const list = document.getElementById('user-list');
  list.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u.userId;
    li.style.color = u.color;
    list.appendChild(li);
  });
};
