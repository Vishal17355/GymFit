import * as THREE from 'three';

const fingerNames = ['index finger', 'middle finger', 'ring finger', 'little finger', 'thumb'];
const normalSegments = ['proximal', 'middle', 'distal'];
const fingerCurl = [0.66, 0.94, 0.55];

function endCenter(mesh, proximal) {
  const { min, max } = mesh.geometry.boundingBox;
  const range = (max.y - min.y) * 0.18;
  const positions = mesh.geometry.getAttribute('position');
  const center = new THREE.Vector3();
  const point = new THREE.Vector3();
  let count = 0;

  for (let i = 0; i < positions.count; i += 1) {
    point.fromBufferAttribute(positions, i);
    if (proximal ? point.y >= max.y - range : point.y <= min.y + range) {
      center.add(point);
      count += 1;
    }
  }
  return count ? center.divideScalar(count) : mesh.geometry.boundingBox.getCenter(center);
}

export function bindHandGrip(wrist, side, sign, namedBones, addJoint, scale) {
  const digits = [];
  const drivenBones = new Map();

  for (const finger of fingerNames) {
    const segments = finger === 'thumb' ? ['proximal', 'distal'] : normalSegments;
    const meshes = segments.map((part) => namedBones.get(`${part} phalanx of ${side} ${finger}`));
    if (meshes.some((mesh) => !mesh)) continue;

    const joints = [];
    let parent = wrist;
    for (const [index, mesh] of meshes.entries()) {
      const center = endCenter(mesh, true);
      if (index > 0) center.lerp(endCenter(meshes[index - 1], false), 0.5);
      const joint = addJoint(parent, `${side}-${finger}-${segments[index]}`, center);
      drivenBones.set(mesh, joint);
      joints.push(joint);
      parent = joint;
    }

    const tip = endCenter(meshes.at(-1), false);
    digits.push({
      finger,
      joints,
      segments: joints.map((joint, index) => {
        const start = joint.userData.center;
        const end = joints[index + 1]?.userData.center ?? tip;
        const direction = end.clone().sub(start);
        return { start, direction, lengthSq: direction.lengthSq(), index, joints };
      })
    });
  }

  const first = digits.find(({ finger }) => finger === 'index finger')?.joints[0].userData.center;
  const last = digits.find(({ finger }) => finger === 'little finger')?.joints[0].userData.center;
  const knuckles = first && last ? first.clone().lerp(last, 0.5) : wrist.userData.center.clone();
  const across = first && last ? first.clone().sub(last).multiplyScalar(sign).normalize() : new THREE.Vector3(1, 0, 0);
  const forward = knuckles.clone().sub(wrist.userData.center);
  forward.addScaledVector(across, -forward.dot(across));
  if (!forward.lengthSq()) forward.set(0, -1, 0);
  forward.normalize();
  const palmNormal = forward.clone().cross(across).normalize();
  const gripOffset = knuckles.sub(wrist.userData.center).addScaledVector(forward, 17 * scale).addScaledVector(palmNormal, 23 * scale);

  const allSegments = digits.flatMap((digit) => digit.segments);
  const top = Math.max(...allSegments.map(({ start }) => start.y)) + 12 * scale;
  const reachSq = (22 * scale) ** 2;
  const relative = new THREE.Vector3();
  const nearestPoint = new THREE.Vector3();

  const getInfluences = (point) => {
    if (point.y > top) return null;

    let hit;
    let bestDistance = reachSq;
    let projection = 0;
    for (const segment of allSegments) {
      if (!segment.lengthSq) continue;
      relative.copy(point).sub(segment.start);
      const t = relative.dot(segment.direction) / segment.lengthSq;
      nearestPoint.copy(segment.start).addScaledVector(segment.direction, THREE.MathUtils.clamp(t, 0, 1));
      const distance = point.distanceToSquared(nearestPoint);
      if (distance < bestDistance) {
        bestDistance = distance;
        hit = segment;
        projection = t;
      }
    }
    if (!hit) return null;

    const { index, joints } = hit;
    if (projection < 0.22) {
      return [joints[index - 1] ?? wrist, joints[index], THREE.MathUtils.smoothstep(projection, -0.22, 0.22)];
    }
    if (projection > 0.78 && joints[index + 1]) {
      return [joints[index], joints[index + 1], THREE.MathUtils.smoothstep(projection, 0.78, 1.22)];
    }
    return [joints[index], null, 0];
  };

  const setClosed = (closed) => {
    const amount = closed ? 1 : 0;
    for (const { finger, joints } of digits) {
      if (finger === 'thumb') {
        joints[0].quaternion.setFromAxisAngle(palmNormal, -sign * 0.56 * amount);
        joints[1].quaternion.setFromAxisAngle(across, -0.64 * amount);
      } else {
        for (const [index, joint] of joints.entries()) {
          joint.quaternion.setFromAxisAngle(across, -fingerCurl[index] * amount);
        }
      }
    }
  };

  return { drivenBones, getInfluences, setClosed, gripOffset, across };
}
