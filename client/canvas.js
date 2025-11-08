const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');

class CanvasManager {
  constructor() {
    this.isDrawing = false;
    this.color = '#000000';
    this.size = 3;
    this.history = []; // { id, color, size, points[], status }
    this.socket = null;
    this.userId = null;

    this.initEvents();
  }

  initEvents() {
    canvas.addEventListener('mousedown', (e) => this.startDraw(e));
    canvas.addEventListener('mousemove', (e) => this.draw(e));
    canvas.addEventListener('mouseup', () => this.stopDraw());
    canvas.addEventListener('mouseout', () => this.stopDraw());

    document.getElementById('colorPicker').addEventListener('change', (e) => this.color = e.target.value);
    document.getElementById('sizePicker').addEventListener('input', (e) => this.size = e.target.value);
    document.getElementById('undoBtn').addEventListener('click', () => this.requestUndo());
  }

  startDraw(e) {
    this.isDrawing = true;
    this.currentStroke = {
      id: Date.now().toString(),
      color: this.color,
      size: this.size,
      points: [{ x: e.offsetX, y: e.offsetY }],
      status: 'active'
    };
  }

  draw(e) {
    if (!this.isDrawing) return;
    const point = { x: e.offsetX, y: e.offsetY };
    const points = this.currentStroke.points;
    points.push(point);

    this.drawSegment(ctx, points[points.length - 2], point, this.currentStroke);
  }

  stopDraw() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.history.push(this.currentStroke);
    this.socket.emit('stroke', { userId: this.userId, stroke: this.currentStroke });
  }

  drawSegment(context, from, to, stroke) {
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  requestUndo() {
    if (this.socket && this.userId) {
      this.socket.emit('requestUndo', { userId: this.userId });
    }
  }

  redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const activeStrokes = this.history.filter(s => s.status === 'active');
    activeStrokes.forEach(stroke => {
      for (let i = 1; i < stroke.points.length; i++) {
        this.drawSegment(ctx, stroke.points[i - 1], stroke.points[i], stroke);
      }
    });
  }
}

window.CanvasManager = CanvasManager;
