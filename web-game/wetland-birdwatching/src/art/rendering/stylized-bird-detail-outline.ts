import * as THREE from 'three';

export const isStylizedBirdDetailOutline = (object: THREE.Object3D) => (
  object.userData.stylizedBirdDetailOutline === true
);

type StylizedBirdDetailOutlineOptions = {
  inflation?: 'normal' | 'bounds';
};

const inflateGeometryInParentSpace = (
  source: THREE.BufferGeometry,
  sourceScale: THREE.Vector3,
  thickness: number,
) => {
  const geometry = source.clone();
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  if (!positions || !normals) {
    geometry.dispose();
    throw new Error('Stylized detail outlines require position and normal attributes');
  }

  const scaleX = Math.max(Math.abs(sourceScale.x), 1e-5);
  const scaleY = Math.max(Math.abs(sourceScale.y), 1e-5);
  const scaleZ = Math.max(Math.abs(sourceScale.z), 1e-5);
  for (let index = 0; index < positions.count; index += 1) {
    const normalX = normals.getX(index);
    const normalY = normals.getY(index);
    const normalZ = normals.getZ(index);
    const transformedNormalLength = Math.hypot(
      normalX / scaleX,
      normalY / scaleY,
      normalZ / scaleZ,
    ) || 1;
    positions.setXYZ(
      index,
      positions.getX(index) + normalX * thickness / (scaleX * scaleX * transformedNormalLength),
      positions.getY(index) + normalY * thickness / (scaleY * scaleY * transformedNormalLength),
      positions.getZ(index) + normalZ * thickness / (scaleZ * scaleZ * transformedNormalLength),
    );
  }
  positions.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

const inflateGeometryFromBoundsInParentSpace = (
  source: THREE.BufferGeometry,
  sourceScale: THREE.Vector3,
  thickness: number,
) => {
  const geometry = source.clone();
  const positions = geometry.getAttribute('position');
  if (!positions) {
    geometry.dispose();
    throw new Error('Stylized detail outlines require position attributes');
  }

  const bounds = new THREE.Box3().makeEmpty();
  const point = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += 1) {
    bounds.expandByPoint(point.fromBufferAttribute(positions, index));
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const halfSize = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const scaleX = Math.max(Math.abs(sourceScale.x), 1e-5);
  const scaleY = Math.max(Math.abs(sourceScale.y), 1e-5);
  const scaleZ = Math.max(Math.abs(sourceScale.z), 1e-5);
  const inflationScale = new THREE.Vector3(
    1 + thickness / (scaleX * Math.max(halfSize.x, 1e-5)),
    1 + thickness / (scaleY * Math.max(halfSize.y, 1e-5)),
    1 + thickness / (scaleZ * Math.max(halfSize.z, 1e-5)),
  );

  for (let index = 0; index < positions.count; index += 1) {
    positions.setXYZ(
      index,
      center.x + (positions.getX(index) - center.x) * inflationScale.x,
      center.y + (positions.getY(index) - center.y) * inflationScale.y,
      center.z + (positions.getZ(index) - center.z) * inflationScale.z,
    );
  }
  positions.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

export const attachStylizedBirdDetailOutline = (
  source: THREE.Mesh,
  thickness: number,
  options: StylizedBirdDetailOutlineOptions = {},
) => {
  const geometry = options.inflation === 'bounds'
    ? inflateGeometryFromBoundsInParentSpace(source.geometry, source.scale, thickness)
    : inflateGeometryInParentSpace(source.geometry, source.scale, thickness);
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: '#000000',
      side: THREE.BackSide,
      toneMapped: false,
    }),
  );
  outline.name = `${source.name}-detail-outline`;
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.userData.stylizedBirdDetailOutline = true;
  source.add(outline);
  return outline;
};
