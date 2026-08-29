globalThis.G = globalThis.G || {};
var G = globalThis.G;

// G.Camera — tracks currentAngle/targetAngle derived from the player's
// gravityIndex, and animates currentAngle toward targetAngle over time
// (the "rotation transition" requirement) instead of snapping instantly.
// Rendering always uses currentAngle, never targetAngle directly.

const ROTATE_SPEED = Math.PI * 2; // rad/s — a 90-degree turn takes ~0.25s

function shortestDelta(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

const Camera = function (player) {
  this.player = player || null;
  this.currentAngle = this.player ? -this.player.gravityIndex * (Math.PI / 2) : 0;
  this.targetAngle = this.currentAngle;
};

Camera.prototype.update = function (dt) {
  if (this.player) {
    this.targetAngle = -this.player.gravityIndex * (Math.PI / 2);
  }
  const delta = shortestDelta(this.currentAngle, this.targetAngle);
  const maxStep = ROTATE_SPEED * dt;
  if (Math.abs(delta) <= maxStep || maxStep <= 0) {
    this.currentAngle += delta;
  } else {
    this.currentAngle += (delta > 0 ? maxStep : -maxStep);
  }
};

G.Camera = Camera;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = G.Camera;
}
