import * as THREE from 'three';
import type { GrayMagpiePose } from './gray-magpie-model';

export type GrayMagpieState =
  | 'perch'
  | 'inspect'
  | 'contact'
  | 'patrol'
  | 'alarm'
  | 'takeoff'
  | 'flight'
  | 'land'
  | 'preen';

export type GrayMagpieHabitat = 'ground' | 'low' | 'high';

export const grayMagpieStateDurationRanges: Record<GrayMagpieState, [number, number]> = {
  perch: [1.2, 2.5],
  inspect: [0.7, 1.25],
  contact: [0.8, 1.6],
  patrol: [0.55, 1.15],
  alarm: [0.55, 1.1],
  takeoff: [0.28, 0.45],
  flight: [0.72, 1.25],
  land: [0.32, 0.52],
  preen: [1.0, 1.8],
};

export const grayMagpieStateLabels: Record<GrayMagpieState, string> = {
  perch: 'Perched',
  inspect: 'Watching you',
  contact: 'Calling',
  patrol: 'Hopping branches',
  alarm: 'Alarm call',
  takeoff: 'Taking off',
  flight: 'In flight',
  land: 'Landing',
  preen: 'Preening',
};

export const sampleGrayMagpiePose = (
  state: GrayMagpieState,
  cycle: number,
  time: number,
  habitat: GrayMagpieHabitat = 'high',
): GrayMagpiePose => {
  const onBranch = habitat !== 'ground';
  const restBodyX = onBranch ? -0.26 : 0.02;
  const restTailX = onBranch ? -0.66 : -0.08;
  const pose: GrayMagpiePose = {
    bodyX: restBodyX,
    bodyY: 0,
    bodyZ: 0,
    headX: 0,
    headY: 0,
    headZ: 0,
    tailX: restTailX,
    tailY: 0,
    tailZ: 0,
    tailFan: 0,
    wingSpread: 0,
    wingFlap: 0,
    leftLegX: 0,
    rightLegX: 0,
    beakOpen: 0,
  };
  const pulse = Math.sin(cycle * Math.PI * 2);
  const halfPulse = Math.sin(cycle * Math.PI);

  if (state === 'perch') {
    pose.bodyX = restBodyX + Math.sin(time * 1.35) * 0.018;
    pose.headX = Math.sin(time * 1.8) * 0.045;
    pose.tailX = restTailX + Math.sin(time * 1.1) * 0.020;
    pose.tailZ = pulse * 0.018;
  } else if (state === 'inspect') {
    pose.bodyX = restBodyX - 0.04;
    pose.headX = -0.08;
    pose.headY = Math.sin(cycle * Math.PI * 2) * 0.24;
    pose.headZ = Math.sin(cycle * Math.PI * 2) * 0.10;
    pose.tailX = restTailX;
    pose.tailZ = -pose.headY * 0.22;
  } else if (state === 'contact') {
    const note = Math.max(0, Math.sin(cycle * Math.PI * 3));
    pose.bodyX = restBodyX - 0.06 - note * 0.04;
    pose.headX = -0.10 + note * 0.04;
    pose.headY = Math.sin(cycle * Math.PI * 2) * 0.08;
    pose.tailX = restTailX + note * 0.020;
    pose.beakOpen = note * 0.68;
  } else if (state === 'patrol') {
    pose.bodyX = restBodyX + 0.04;
    pose.headX = -halfPulse * 0.08;
    pose.tailX = restTailX + halfPulse * 0.10;
    pose.tailZ = -pulse * 0.06;
    pose.leftLegX = -halfPulse * 0.20;
    pose.rightLegX = halfPulse * 0.20;
  } else if (state === 'alarm') {
    pose.bodyX = restBodyX - 0.06;
    pose.headX = -0.20;
    pose.headY = Math.sin(cycle * Math.PI * 4) * 0.14;
    pose.headZ = Math.sin(cycle * Math.PI * 2) * 0.10;
    pose.tailX = restTailX + (onBranch ? 0.12 : 0.04);
    pose.tailZ = -Math.sin(cycle * Math.PI * 2) * 0.07;
    pose.tailFan = 0.12;
    pose.beakOpen = Math.max(0, Math.sin(cycle * Math.PI * 5)) * 0.95;
  } else if (state === 'takeoff') {
    const launch = cycle * cycle * (3 - 2 * cycle);
    pose.bodyX = THREE.MathUtils.lerp(restBodyX, -0.24, launch);
    pose.headX = -launch * 0.12;
    pose.tailX = THREE.MathUtils.lerp(restTailX, -0.02, launch);
    pose.tailFan = launch * 0.80;
    pose.wingSpread = launch;
    pose.wingFlap = Math.sin(cycle * Math.PI * 3) * 0.24;
    pose.leftLegX = -launch * 1.0;
    pose.rightLegX = -launch * 1.0;
  } else if (state === 'flight') {
    pose.bodyX = -0.14;
    pose.headX = -0.04;
    pose.tailX = -0.02;
    pose.tailFan = 0.48 + Math.max(0, Math.sin(time * 12.5)) * 0.12;
    pose.wingSpread = 1;
    pose.wingFlap = Math.sin(time * 12.5) * 0.56;
    pose.leftLegX = 0.95;
    pose.rightLegX = 0.95;
  } else if (state === 'land') {
    const brake = cycle * cycle * (3 - 2 * cycle);
    pose.bodyX = THREE.MathUtils.lerp(-0.16, restBodyX, brake);
    pose.headX = THREE.MathUtils.lerp(-0.05, 0, brake);
    pose.tailX = THREE.MathUtils.lerp(-0.02, restTailX, brake);
    pose.tailFan = 0.80 * (1 - brake);
    pose.wingSpread = 1 - brake;
    pose.wingFlap = Math.sin(time * 10.5) * (0.42 * (1 - brake));
    pose.leftLegX = 0.95 - brake * 0.95;
    pose.rightLegX = 0.95 - brake * 0.95;
  } else if (state === 'preen') {
    const side = Math.sin(cycle * Math.PI * 2);
    pose.bodyX = restBodyX + 0.04;
    pose.headX = 0.22;
    pose.headY = side * 0.34;
    pose.headZ = side * 0.10;
    pose.tailX = restTailX;
    pose.tailZ = -side * 0.08;
    pose.beakOpen = 0.06;
  }
  return pose;
};

export const chooseGrayMagpieState = (
  current: GrayMagpieState,
  pressure: number,
  habitat: GrayMagpieHabitat,
  random: number,
): GrayMagpieState => {
  if (current === 'takeoff') return 'flight';
  if (current === 'flight') return 'land';
  if (current === 'land') return habitat === 'ground' ? 'patrol' : 'perch';
  if (current === 'alarm') return pressure > 0.72 ? 'takeoff' : 'patrol';
  if (pressure > 0.78) return 'takeoff';
  if (pressure > 0.48) return 'alarm';
  if (habitat === 'high') {
    if (random < 0.28) return 'contact';
    if (random < 0.52) return 'inspect';
    if (random < 0.76) return 'patrol';
    return 'perch';
  }
  if (random < 0.30) return 'inspect';
  if (random < 0.58) return 'patrol';
  if (random < 0.76) return 'preen';
  return 'perch';
};
