import * as THREE from 'three';

const localPoint = (parent, body, point) => parent.worldToLocal(body.localToWorld(point));

function bendChain(upper, lower, end, target, pole) {
  const first = lower.position;
  const second = end.position;
  const firstLength = first.length();
  const secondLength = second.length();
  const axis = target.clone().sub(upper.position);
  const distance = THREE.MathUtils.clamp(axis.length(), Math.abs(firstLength - secondLength) + 0.01, firstLength + secondLength - 0.015);
  axis.normalize();
  const bend = pole.clone().addScaledVector(axis, -pole.dot(axis));
  if (bend.lengthSq() < 0.001) bend.set(0, 0, 1).addScaledVector(axis, -axis.z);
  bend.normalize();
  const along = (firstLength ** 2 - secondLength ** 2 + distance ** 2) / (2 * distance);
  const elbow = axis.clone().multiplyScalar(along).addScaledVector(bend, Math.sqrt(Math.max(0, firstLength ** 2 - along ** 2)));
  const distal = axis.multiplyScalar(distance).sub(elbow);

  upper.quaternion.setFromUnitVectors(first.clone().normalize(), elbow.normalize());
  distal.applyQuaternion(upper.quaternion.clone().invert()).normalize();
  lower.quaternion.setFromUnitVectors(second.clone().normalize(), distal);
}

function horizontalCylinder(radius, width) {
  return new THREE.CylinderGeometry(radius, radius, width, 16).rotateZ(Math.PI / 2);
}

function buildEquipment(body) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x828680, roughness: 0.38, metalness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x282d28, roughness: 0.88 });

  const makeWeight = (length, plateRadius, plateWidth) => {
    const weight = new THREE.Group();
    weight.add(new THREE.Mesh(horizontalCylinder(0.17, length), metal));
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(horizontalCylinder(plateRadius, plateWidth), rubber);
      plate.position.x = side * (length - plateWidth) / 2;
      weight.add(plate);
    }
    group.add(weight);
    return weight;
  };
  const barbell = makeWeight(18, 2.75, 1.05);
  const handle = new THREE.Mesh(horizontalCylinder(0.24, 3.1), metal);
  group.add(handle);
  const dumbbells = [makeWeight(3.9, 0.87, 0.75), makeWeight(3.9, 0.87, 0.75)];

  const pad = new THREE.Mesh(new THREE.BoxGeometry(6.3, 10.5, 0.65), rubber);
  const legs = [-1, 1].map(() => new THREE.Mesh(new THREE.BoxGeometry(0.75, 1, 0.75), metal));
  group.add(pad, ...legs);
  group.visible = false;
  body.add(group);

  return {
    group, barbell, handle, dumbbells, pad, legs,
    dispose: () => { metal.dispose(); rubber.dispose(); },
  };
}

export function createAnatomyMotion(rig, floorY, height) {
  const { body, pelvis, spine, chains } = rig;
  const props = buildEquipment(body);
  const restRotation = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);

  const updateEquipment = (motion, tilt) => {
    const isDumbbell = motion.equipment === 'dumbbells';
    const inverseBodyRotation = body.getWorldQuaternion(new THREE.Quaternion()).invert();
    const hands = Object.values(chains).map(({ sign, arm: { wrist }, hand }) => {
      const offset = isDumbbell ? hand.gripOffset.clone() : new THREE.Vector3(sign * 0.06, -0.72, 0.46);
      const grip = body.worldToLocal(wrist.localToWorld(offset));
      const wristRotation = wrist.getWorldQuaternion(new THREE.Quaternion()).premultiply(inverseBodyRotation);
      return { grip, handleAxis: hand.across.clone().applyQuaternion(wristRotation) };
    });
    const wrists = hands.map(({ grip }) => grip);

    const center = wrists[0].clone().lerp(wrists[1], 0.5);
    const gripDirection = wrists[0].clone().sub(wrists[1]).normalize();
    for (const [prop, active] of [[props.barbell, motion.equipment === 'barbell'], [props.handle, motion.equipment === 'handle']]) {
      prop.visible = active;
      if (active) {
        prop.position.copy(center);
        prop.quaternion.setFromUnitVectors(xAxis, gripDirection);
      }
    }
    for (const [index, dumbbell] of props.dumbbells.entries()) {
      dumbbell.visible = isDumbbell;
      if (dumbbell.visible) {
        dumbbell.position.copy(hands[index].grip);
        dumbbell.quaternion.setFromUnitVectors(xAxis, hands[index].handleAxis);
      }
    }

    props.pad.visible = Boolean(motion.bench || motion.seat);
    for (const leg of props.legs) leg.visible = props.pad.visible;
    if (props.pad.visible) {
      props.pad.rotation.x = motion.seat ? -Math.PI / 2 : tilt;
      props.pad.scale.y = motion.seat ? 0.56 : 1;
      const offset = new THREE.Vector3(0, motion.seat ? 0 : 4.2, -1.8)
        .applyQuaternion(pelvis.quaternion);
      if (motion.seat) offset.set(0, -1.8, -0.5);
      props.pad.position.copy(pelvis.position).add(offset);
      for (const [index, leg] of props.legs.entries()) {
        const top = new THREE.Vector3(index ? 1.95 : -1.95, 0, -0.34)
          .applyQuaternion(props.pad.quaternion).add(props.pad.position);
        leg.scale.y = Math.max(0.1, top.y - floorY);
        leg.position.set(top.x, floorY + leg.scale.y / 2, top.z);
      }
    }
  };

  const apply = (motion, phase) => {
    if (!motion) {
      props.group.visible = false;
      rig.reset();
      return;
    }
    const blend = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const interpolate = (key) => THREE.MathUtils.lerp(motion.bottom[key] ?? 0, motion.top[key] ?? 0, blend);
    const armTarget = new THREE.Vector3(...motion.bottom.arm).lerp(new THREE.Vector3(...motion.top.arm), blend);
    const tilt = THREE.MathUtils.degToRad(interpolate('tilt'));
    pelvis.position.copy(pelvis.userData.center);
    pelvis.position.y += interpolate('lift') * height;
    pelvis.position.z += interpolate('shift') * height;
    pelvis.rotation.set(tilt, 0, 0);
    spine.rotation.set(THREE.MathUtils.degToRad(interpolate('lean')), 0, 0);

    for (const { sign, arm: { shoulder, elbow, wrist }, leg: { hip, knee, ankle }, hand } of Object.values(chains)) {
      const [spread, forward] = motion.feet ?? [0, 0];
      const plantedFoot = ankle.userData.center.clone();
      plantedFoot.x += sign * spread * height;
      plantedFoot.y = Math.max(plantedFoot.y, floorY + height * 0.035);
      plantedFoot.z += forward * height;
      const bentKnee = hip.position.clone().add(new THREE.Vector3(sign * 0.15, 0, 1)
        .applyQuaternion(pelvis.quaternion.clone().invert()));
      bendChain(hip, knee, ankle, localPoint(pelvis, body, plantedFoot), bentKnee.sub(hip.position));
      ankle.quaternion.copy(knee.getWorldQuaternion(new THREE.Quaternion())).invert().multiply(restRotation);

      const reach = elbow.position.length() + wrist.position.length();
      const relative = new THREE.Vector3(sign * armTarget.x, armTarget.y, armTarget.z).multiplyScalar(reach);
      const target = motion.armSpace === 'world'
        ? spine.worldToLocal(shoulder.getWorldPosition(new THREE.Vector3()).add(relative))
        : shoulder.position.clone().add(relative);
      const [out, up, front] = motion.elbow;
      bendChain(shoulder, elbow, wrist, target, new THREE.Vector3(sign * out, up, front));
      hand.setClosed(motion.equipment === 'dumbbells');
    }

    props.group.visible = true;
    updateEquipment(motion, tilt);
    rig.invalidatePickingBounds();
  };

  return { apply, dispose: props.dispose };
}
