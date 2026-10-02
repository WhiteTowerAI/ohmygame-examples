import * as THREE from 'three';

type DarkCanopyVec3Tuple = readonly [number, number, number];
export type DarkCanopyLobeVariant = 'broad' | 'swept' | 'fan' | 'crown';
type Vec3Tuple = DarkCanopyVec3Tuple;

type DarkCanopyBranchPathSpec = {
  id: string;
  points: readonly Vec3Tuple[];
  startRadius: number;
  endRadius: number;
  tone: number;
};
type BranchPathSpec = DarkCanopyBranchPathSpec;

const tupleToVector = ([x, y, z]: Vec3Tuple) => new THREE.Vector3(x, y, z);

const darkCanopyBranchPaths: readonly BranchPathSpec[] = [
  { id: 'trunk', points: [[0, 0, 0], [0.05, 1.35, -0.03], [-0.10, 2.65, 0.06], [0.12, 3.85, -0.04], [-0.08, 5.10, 0.10], [0.10, 6.25, -0.06], [-0.04, 7.35, 0.04]], startRadius: 0.60, endRadius: 0.070, tone: 0 },
  { id: 'root-west', points: [[0, 0.22, 0], [-0.48, 0.08, 0.20], [-1.08, 0.01, 0.46]], startRadius: 0.23, endRadius: 0.035, tone: 1 },
  { id: 'root-east', points: [[0, 0.20, 0], [0.46, 0.07, -0.12], [1.02, 0.01, -0.40]], startRadius: 0.22, endRadius: 0.032, tone: 1 },
  { id: 'root-back', points: [[0, 0.18, 0], [-0.10, 0.06, -0.42], [-0.28, 0.01, -0.92]], startRadius: 0.18, endRadius: 0.030, tone: 2 },
  { id: 'low-west-front', points: [[-0.06, 2.45, 0.04], [-0.62, 3.12, 0.82], [-1.56, 3.66, 1.76], [-2.72, 4.28, 1.58]], startRadius: 0.29, endRadius: 0.040, tone: 0 },
  { id: 'low-east-front', points: [[0.03, 2.72, 0.05], [0.64, 3.32, 0.76], [1.64, 3.80, 1.66], [2.82, 4.50, 1.34]], startRadius: 0.28, endRadius: 0.040, tone: 0 },
  { id: 'low-west-back', points: [[-0.02, 2.95, -0.02], [-0.48, 3.52, -0.78], [-1.08, 3.92, -1.84], [-2.02, 4.42, -2.66]], startRadius: 0.24, endRadius: 0.036, tone: 1 },
  { id: 'low-east-back', points: [[0.06, 3.12, -0.02], [0.46, 3.62, -0.84], [1.02, 3.96, -1.94], [1.92, 4.36, -2.70]], startRadius: 0.23, endRadius: 0.034, tone: 1 },
  { id: 'mid-front', points: [[0.04, 3.55, 0.06], [-0.12, 4.16, 0.95], [-0.42, 4.70, 2.10], [-0.78, 5.36, 2.82]], startRadius: 0.22, endRadius: 0.032, tone: 1 },
  { id: 'mid-back', points: [[-0.02, 3.82, 0], [0.18, 4.40, -0.90], [0.30, 4.80, -2.10], [0.62, 5.58, -2.94]], startRadius: 0.20, endRadius: 0.030, tone: 1 },
  { id: 'mid-west', points: [[-0.02, 4.10, 0.02], [-0.76, 4.66, -0.05], [-1.92, 5.05, 0.22], [-3.30, 5.14, 0.32]], startRadius: 0.18, endRadius: 0.029, tone: 1 },
  { id: 'mid-east', points: [[0.04, 4.34, 0.02], [0.78, 4.82, 0.05], [1.90, 5.14, -0.22], [3.34, 5.48, -0.38]], startRadius: 0.17, endRadius: 0.028, tone: 1 },
  { id: 'upper-northwest', points: [[-0.02, 5.05, 0.06], [-0.62, 5.54, 0.42], [-1.62, 5.92, 0.82], [-2.82, 6.06, 1.18]], startRadius: 0.14, endRadius: 0.024, tone: 2 },
  { id: 'upper-southeast', points: [[0.04, 5.22, -0.02], [0.64, 5.68, -0.40], [1.66, 6.08, -0.78], [2.94, 6.40, -1.12]], startRadius: 0.13, endRadius: 0.023, tone: 2 },
  { id: 'crown-west', points: [[-0.02, 5.82, 0.03], [-0.40, 6.38, -0.24], [-0.95, 6.78, -0.56], [-1.56, 7.00, -0.88]], startRadius: 0.105, endRadius: 0.020, tone: 2 },
  { id: 'crown-east', points: [[0.02, 6.00, 0.00], [0.35, 6.52, 0.34], [0.85, 6.86, 0.62], [1.58, 7.32, 0.92]], startRadius: 0.100, endRadius: 0.020, tone: 2 },
];
const branchPaths = darkCanopyBranchPaths;

const maxBranchControlTurn = THREE.MathUtils.degToRad(55);
const branchControlTurns = branchPaths.flatMap((path) => path.points.slice(1, -1).map((point, index) => {
  const incoming = tupleToVector(point).sub(tupleToVector(path.points[index])).normalize();
  const outgoing = tupleToVector(path.points[index + 2]).sub(tupleToVector(point)).normalize();
  return { id: path.id, angle: incoming.angleTo(outgoing) };
}));
const excessiveBranchTurn = branchControlTurns.find(({ angle }) => angle > maxBranchControlTurn);
if (excessiveBranchTurn) {
  throw new Error(`Branch ${excessiveBranchTurn.id} turns ${THREE.MathUtils.radToDeg(excessiveBranchTurn.angle).toFixed(1)} degrees at one control point`);
}
