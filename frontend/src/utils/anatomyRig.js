import * as THREE from 'three';
import { bindHandGrip } from './anatomyGrip';
import { transferSkinWeights } from './anatomySkin';

// Joint centers in the source meshes' millimeter coordinate system.
const limbCenters = {
  shoulder: [156, -77, 1309],
  elbow: [212, -73, 1041],
  wrist: [239, -110, 811],
  hip: [59, -77, 811],
  knee: [83, -83, 374],
  ankle: [74, -80, 0],
};

const regionPatterns = {
  upperArm: /deltoid|biceps brachii|brachialis|triceps|coracobrachialis|\bhumerus\b/,
  forearm: /brachioradialis|pronator|supinator|carpi|palmaris|\bradius\b|\bulna\b/,
  hand: /hand|finger|thumb|metacarpal|scaphoid|lunate|trapezoid|capitate|hamate|pisiform|triquetr/,
  thigh: /gluteus|fasciae latae|femoris|semimembranosus|semitendinosus|sartorius|vastus|gracilis|pectineus|adductor|iliotibial/,
  lowerLeg: /\btibia\b|\bfibula\b|tibialis|fibularis|gastrocnemius|soleus|plantaris|achilles/,
  foot: /foot|toe|metatarsal|calcaneus|talus|cuneiform|cuboid/,
  head: /skull|cranium|mandibl|maxilla|zygomatic|orbicularis|masseter|temporalis|atlas|axis/,
};

const smooth = (value, boundary, span) => THREE.MathUtils.smoothstep(value, boundary - span, boundary + span);

function createJoint(parent, name, center, joints) {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.position.copy(center);
  if (parent.isBone) bone.position.sub(parent.userData.center);
  bone.userData = { center, skinIndex: joints.length };
  parent.add(bone);
  joints.push(bone);
  return bone;
}

function getMeshRegion(mesh, toSource) {
  const name = mesh.userData.rawName.replaceAll('_', ' ').toLowerCase();
  const center = toSource(mesh.geometry.boundingBox.getCenter(new THREE.Vector3()));
  const side = center.x >= 0 ? 'left' : 'right';
  const lateral = Math.abs(center.x);
  const { upperArm, forearm, hand, thigh, lowerLeg, foot, head } = regionPatterns;
  const arm = center.z > 610 && (lateral > 177 || upperArm.test(name) || forearm.test(name) || hand.test(name));

  if (arm) {
    const joint = hand.test(name) || center.z < 811 ? 'wrist'
      : forearm.test(name) || center.z < 1041 ? 'elbow' : 'shoulder';
    return { side, limb: 'arm', joint };
  }
  if (lateral > 19 && (center.z < 773 || thigh.test(name) || lowerLeg.test(name) || foot.test(name))) {
    const joint = foot.test(name) || center.z < 0 ? 'ankle'
      : lowerLeg.test(name) || center.z < 364 ? 'knee' : 'hip';
    return { side, limb: 'leg', joint };
  }
  return { joint: center.z > 1450 || head.test(name) ? 'neck' : center.z > 940 ? 'spine' : 'pelvis' };
}

function writeInfluences(mesh, region, jointsByName, chains, toSource) {
  const position = mesh.geometry.getAttribute('position');
  const indices = new Uint16Array(position.count * 4);
  const weights = new Float32Array(position.count * 4);
  const usedIndices = new Set();
  const { limb, side, joint } = region;
  const chain = chains[side]?.[limb];
  const grip = limb === 'arm' ? chains[side].hand : null;
  const rigidJoint = grip?.drivenBones.get(mesh) ?? (chain ? chain[joint] : jointsByName[joint]);

  // Bone geometry stays rigid. Soft tissue blends between neighboring joints.
  const boundaries = limb === 'arm'
    ? [[811, 34, chain?.wrist], [1041, 52, chain?.elbow], [1300, 62, chain?.shoulder], [Infinity, 0, jointsByName.spine]]
    : limb === 'leg'
      ? [[0, 34, chain?.ankle], [374, 64, chain?.knee], [811, 60, chain?.hip], [Infinity, 0, jointsByName.pelvis]]
      : [[940, 105, jointsByName.pelvis], [1450, 52, jointsByName.spine], [Infinity, 0, jointsByName.neck]];

  const point = new THREE.Vector3();
  const rigid = mesh.userData.isBone || ['wrist', 'ankle', 'neck'].includes(joint);
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const index = vertex * 4;
    let primary = rigidJoint;
    let secondary = null;
    let blend = 0;

    if (!mesh.userData.isBone) {
      point.fromBufferAttribute(position, vertex);
      const fingerInfluences = grip?.getInfluences(point);
      if (fingerInfluences) {
        [primary, secondary, blend] = fingerInfluences;
      } else if (!rigid) {
        const height = toSource(point).z;
        const boundaryIndex = boundaries.findIndex(([boundary, span]) => height <= boundary + span);
        const [boundary, span, lowerJoint] = boundaries[boundaryIndex];
        primary = lowerJoint;
        secondary = boundaries[boundaryIndex + 1]?.[2];
        blend = secondary ? smooth(height, boundary, span) : 0;
      }
    }

    indices[index] = primary.userData.skinIndex;
    weights[index] = 1 - blend;
    if (blend < 1) usedIndices.add(indices[index]);
    if (blend > 0) {
      indices[index + 1] = secondary.userData.skinIndex;
      weights[index + 1] = blend;
      usedIndices.add(indices[index + 1]);
    }
  }

  mesh.geometry.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4));
  mesh.geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
  return [...usedIndices];
}

export function bindAnatomyRig(body, muscles, bones, origin, scale) {
  const toLocal = ([x, y, z]) => new THREE.Vector3(
    (x - origin.x) * scale, (z - origin.z) * scale, -(y - origin.y) * scale
  );
  const toSource = (point) => point.set(
    point.x / scale + origin.x,
    origin.y - point.z / scale,
    point.y / scale + origin.z
  );
  const joints = [];
  const pelvis = createJoint(body, 'pelvis', toLocal([0, -76, 811]), joints);
  const spine = createJoint(pelvis, 'spine', toLocal([0, -83, 940]), joints);
  const neck = createJoint(spine, 'neck', toLocal([0, -84, 1450]), joints);
  const chains = {};
  const namedBones = new Map(bones.map((mesh) => [
    mesh.userData.rawName.toLowerCase().replaceAll('_', ' '),
    mesh
  ]));

  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    const pivot = (name, parent) => {
      const [x, y, z] = limbCenters[name];
      return createJoint(parent, `${side}-${name}`, toLocal([x * sign, y, z]), joints);
    };
    const shoulder = pivot('shoulder', spine);
    const elbow = pivot('elbow', shoulder);
    const wrist = pivot('wrist', elbow);
    const hip = pivot('hip', pelvis);
    const knee = pivot('knee', hip);
    const ankle = pivot('ankle', knee);
    const hand = bindHandGrip(wrist, side, sign, namedBones,
      (parent, name, center) => createJoint(parent, name, center, joints), scale);
    chains[side] = { sign, arm: { shoulder, elbow, wrist }, leg: { hip, knee, ankle }, hand };
  }

  body.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(joints);
  const restMatrix = body.matrixWorld.clone();
  const bindings = [];
  const sources = new Map();

  const attachMesh = (mesh, indices, bindMatrix) => {
    mesh.bind(skeleton, bindMatrix);
    mesh.frustumCulled = false;
    mesh.boundingBox = mesh.geometry.boundingBox.clone();
    mesh.boundingSphere = mesh.geometry.boundingSphere.clone();
    bindings.push({ mesh, indices });
  };

  for (const mesh of [...muscles, ...bones]) {
    const indices = writeInfluences(mesh, getMeshRegion(mesh, toSource), { pelvis, spine, neck }, chains, toSource);
    attachMesh(mesh, indices, mesh.matrixWorld);
    if (Number.isInteger(mesh.userData.skinSourceId)) {
      sources.set(mesh.userData.skinSourceId, {
        indices: mesh.geometry.getAttribute('skinIndex').array,
        weights: mesh.geometry.getAttribute('skinWeight').array,
      });
    }
  }

  const jointMatrices = joints.map(() => new THREE.Matrix4());
  const inverseBody = new THREE.Matrix4();
  const worldBox = new THREE.Box3();
  let pickingBoundsDirty = false;

  const invalidatePickingBounds = () => { pickingBoundsDirty = true; };

  const updatePickingBounds = () => {
    if (!pickingBoundsDirty) return;
    body.updateMatrixWorld(true);
    inverseBody.copy(body.matrixWorld).invert();
    for (const [index, joint] of joints.entries()) {
      jointMatrices[index].multiplyMatrices(inverseBody, joint.matrixWorld).multiply(skeleton.boneInverses[index]);
    }
    for (const { mesh, indices } of bindings) {
      mesh.boundingBox.makeEmpty();
      for (const index of indices) {
        worldBox.copy(mesh.geometry.boundingBox).applyMatrix4(jointMatrices[index]);
        mesh.boundingBox.union(worldBox);
      }
      mesh.boundingBox.getBoundingSphere(mesh.boundingSphere);
    }
    pickingBoundsDirty = false;
  };

  const rule = (allowed, fallback) => ({
    allowed: new Set(allowed.map((bone) => bone.userData.skinIndex)),
    fallback: (height) => fallback(height).userData.skinIndex,
  });
  const armRule = ({ arm: { shoulder, elbow, wrist }, hand }) =>
    rule([shoulder, elbow, wrist, ...hand.drivenBones.values()], (height) =>
      height < wrist.userData.center.y ? wrist : height < elbow.userData.center.y ? elbow : shoulder
    );
  const legRule = ({ leg: { hip, knee, ankle } }) => rule([pelvis, hip, knee, ankle], (height) =>
    height < ankle.userData.center.y ? ankle : height < knee.userData.center.y ? knee : hip
  );
  // The numeric order matches the zones exported with the fitted surface.
  const zoneRules = [
    null,
    rule([pelvis, spine, neck], (height) => height < spine.userData.center.y ? pelvis : spine),
    armRule(chains.left),
    armRule(chains.right),
    legRule(chains.left),
    legRule(chains.right),
  ];

  const addSkin = (mesh) => {
    const indices = transferSkinWeights(mesh.geometry, sources, joints.length, zoneRules);
    attachMesh(mesh, indices, restMatrix);
    body.add(mesh);
    invalidatePickingBounds();
  };

  const reset = () => {
    for (const joint of joints) joint.quaternion.identity();
    pelvis.position.copy(pelvis.userData.center);
    invalidatePickingBounds();
  };

  return { body, pelvis, spine, neck, chains, addSkin, reset, invalidatePickingBounds, updatePickingBounds, dispose: () => skeleton.dispose() };
}
