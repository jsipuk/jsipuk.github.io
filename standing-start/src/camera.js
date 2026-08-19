/* Standing Start — chase camera.
 *
 * The camera follows the direction of travel rather than where the car is
 * pointing. That is what makes a drift legible: the car visibly sits sideways
 * in frame while the view keeps tracking where it is actually going.
 */

import { forwardX, forwardZ, angleDelta } from './track.js';

const DEG = Math.PI / 180;

export function createCamera() {
  return { x: 0, y: 10, z: -20, yaw: 0, pullback: 1, dist: 20 };
}

function smooth(dt, ms) {
  if (ms <= 1) return 1;
  return 1 - Math.exp(-dt / (ms / 1000));
}

export function updateCamera(cam, sim, cfg, dt, lock, snap) {
  const targetYaw = sim.velDir + lock * cfg.lookAhead * DEG;

  if (snap) {
    cam.yaw = targetYaw;
    cam.pullback = 1;
  } else {
    cam.yaw += angleDelta(targetYaw, cam.yaw) * smooth(dt, cfg.followLag);
    const wantPull = sim.boostLeft > 0 ? 1 + cfg.boostPullback : 1;
    const ms = wantPull > cam.pullback ? cfg.pullbackIn : cfg.pullbackOut;
    cam.pullback += (wantPull - cam.pullback) * smooth(dt, ms);
  }

  cam.dist = cfg.followDist * cam.pullback;
  cam.x = sim.x - forwardX(cam.yaw) * cam.dist;
  cam.z = sim.z - forwardZ(cam.yaw) * cam.dist;
  cam.y = cfg.camHeight * cam.pullback;
  return cam;
}
