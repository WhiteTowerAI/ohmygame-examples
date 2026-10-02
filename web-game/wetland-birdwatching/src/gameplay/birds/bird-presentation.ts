import * as THREE from 'three';
import type { HabitatLevel } from './contracts';

export type BirdMotionKind = 'still' | 'ground-step' | 'takeoff' | 'flight' | 'land';

export type BirdPresentationOptions<State extends string> = Readonly<{
  root: THREE.Group;
  motionByState: Partial<Readonly<Record<State, BirdMotionKind>>>;
  applyPose: (state: State, cycle: number, time: number, delta: number, habitatLevel: HabitatLevel) => void;
}>;

const smooth01 = (value: number) => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};

export class BirdPresentationAdapter<State extends string> {
  readonly root: THREE.Group;
  readonly #motionByState: Partial<Readonly<Record<State, BirdMotionKind>>>;
  readonly #applyPose: BirdPresentationOptions<State>['applyPose'];
  readonly #origin = new THREE.Vector3();
  readonly #target = new THREE.Vector3();
  #desiredYaw = 0;

  constructor(options: BirdPresentationOptions<State>) {
    this.root = options.root;
    this.#motionByState = options.motionByState;
    this.#applyPose = options.applyPose;
    this.#origin.copy(this.root.position);
    this.#target.copy(this.root.position);
    this.#desiredYaw = this.root.rotation.y;
  }

  beginState(state: State, target?: THREE.Vector3, faceTarget?: THREE.Vector3) {
    this.#origin.copy(this.root.position);
    this.#target.copy(target ?? this.root.position);
    const facing = faceTarget ?? target;
    if (facing && facing.distanceToSquared(this.#origin) > 0.0001) {
      this.#desiredYaw = Math.atan2(facing.x - this.#origin.x, facing.z - this.#origin.z);
    }
    const motion = this.#motionByState[state] ?? 'still';
    if (motion === 'takeoff') this.#target.copy(this.#origin).add(new THREE.Vector3(0, 0.25, 0));
  }

  setFacing(target: THREE.Vector3) {
    if (target.distanceToSquared(this.root.position) <= 0.0001) return;
    this.#desiredYaw = Math.atan2(target.x - this.root.position.x, target.z - this.root.position.z);
  }

  update(state: State, cycle: number, time: number, delta: number, habitatLevel: HabitatLevel) {
    const motion = this.#motionByState[state] ?? 'still';
    const position = this.#origin.clone();
    if (motion === 'ground-step') {
      position.lerp(this.#target, smooth01(cycle));
      position.y += Math.sin(Math.PI * cycle) * 0.15;
    } else if (motion === 'takeoff') {
      position.lerp(this.#target, smooth01(cycle));
    } else if (motion === 'flight') {
      position.lerp(this.#target, smooth01(cycle));
      position.y += Math.sin(Math.PI * cycle) * 0.38;
    } else if (motion === 'land') {
      position.lerp(this.#target, smooth01(cycle));
      position.y += Math.sin(Math.PI * cycle) * 0.08;
    } else if (state === 'idle' || state === 'perch') {
      position.y += Math.sin(time * 2.1) * 0.008;
    } else if (state === 'forage' || state === 'peck') {
      position.x += Math.sin(cycle * Math.PI * 2) * 0.025;
    }
    this.root.position.copy(position);
    this.root.rotation.y = THREE.MathUtils.lerp(
      this.root.rotation.y,
      this.#desiredYaw,
      1 - Math.exp(-delta * 7),
    );
    this.#applyPose(state, cycle, time, delta, habitatLevel);
  }
}
