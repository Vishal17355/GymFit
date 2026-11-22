import * as THREE from 'three';

export const SKIN_BONE_SOURCE_OFFSET = 32768;

function writeStrongestWeights(combined, indices, weights, offset, usedJoints) {
  let total = 0;
  indices.fill(0, offset, offset + 4);
  weights.fill(0, offset, offset + 4);
  for (let slot = offset; slot < offset + 4; slot += 1) {
    let largest = 0;
    for (let joint = 1; joint < combined.length; joint += 1) {
      if (combined[joint] > combined[largest]) largest = joint;
    }
    if (combined[largest] === 0) break;
    indices[slot] = largest;
    weights[slot] = combined[largest];
    total += weights[slot];
    combined[largest] = 0;
    usedJoints.add(largest);
  }

  if (total === 0) throw new Error('A skin vertex could not be attached to the anatomy rig.');
  for (let slot = offset; slot < offset + 4; slot += 1) weights[slot] /= total;
}

function smoothJunctionWeights(geometry, zones, combined, indices, weights, usedJoints) {
  if (zones?.itemSize !== 4 || !geometry.index) return;
  const neighbors = new Map();
  for (let vertex = 0; vertex < zones.count; vertex += 1) {
    if (zones.getZ(vertex) > 13) neighbors.set(vertex, new Set());
  }
  const triangles = geometry.index.array;
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i];
    const b = triangles[i + 1];
    const c = triangles[i + 2];
    neighbors.get(a)?.add(b).add(c);
    neighbors.get(b)?.add(a).add(c);
    neighbors.get(c)?.add(a).add(b);
  }

  for (let pass = 0; pass < 4; pass += 1) {
    const oldIndices = indices.slice();
    const oldWeights = weights.slice();
    const accumulate = (vertex, strength) => {
      const start = vertex * 4;
      for (let slot = start; slot < start + 4; slot += 1) {
        combined[oldIndices[slot]] += oldWeights[slot] * strength;
      }
    };
    for (const [vertex, adjacent] of neighbors) {
      if (!adjacent.size) continue;
      combined.fill(0);
      const amount = (zones.getZ(vertex) / 255) * 0.72;
      accumulate(vertex, 1 - amount);
      for (const neighbor of adjacent) accumulate(neighbor, amount / adjacent.size);
      writeStrongestWeights(combined, indices, weights, vertex * 4, usedJoints);
    }
  }
}

export function transferSkinWeights(geometry, sources, jointCount, zoneRules) {
  const referenceMeshes = geometry.getAttribute('_source_mesh')?.array;
  const referenceVertices = geometry.getAttribute('_source_vertex')?.array;
  const referenceShares = geometry.getAttribute('_source_mix')?.array;
  const zones = geometry.getAttribute('_motion_zone');
  const positions = geometry.getAttribute('position');
  const length = positions.count * 4;
  if (referenceMeshes?.length !== length || referenceVertices?.length !== length || referenceShares?.length !== length) {
    throw new Error('Skin rig references are missing.');
  }

  const indices = new Uint16Array(length);
  const weights = new Float32Array(length);
  const combined = new Float32Array(jointCount);
  const usedJoints = new Set();

  for (let offset = 0; offset < length; offset += 4) {
    combined.fill(0);
    for (let reference = offset; reference < offset + 4; reference += 1) {
      const share = referenceShares[reference];
      if (!share) continue;
      const source = sources.get(referenceMeshes[reference]);
      const start = referenceVertices[reference] * 4;
      if (!source || start + 3 >= source.indices.length) {
        throw new Error('This skin does not match the bundled anatomy meshes.');
      }
      for (let slot = start; slot < start + 4; slot += 1) {
        combined[source.indices[slot]] += source.weights[slot] * share;
      }
    }

    const vertex = offset / 4;
    const rule = zones && zoneRules[zones.getX(vertex)];
    if (rule) {
      const influence = zones.getY(vertex) / 255;
      let weight = 0;
      let allowedWeight = 0;
      for (let joint = 0; joint < combined.length; joint += 1) {
        weight += combined[joint];
        if (rule.allowed.has(joint)) allowedWeight += combined[joint];
      }

      // Reallocate the constrained portion within the correct limb.
      const scaleAllowed = allowedWeight > 0 ? 1 + (weight / allowedWeight - 1) * influence : 1;
      for (let joint = 0; joint < combined.length; joint += 1) {
        combined[joint] *= rule.allowed.has(joint) ? scaleAllowed : 1 - influence;
      }
      if (allowedWeight === 0) {
        const fallback = rule.fallback(positions.getY(vertex));
        combined[fallback] += weight * influence;
      }
    }

    writeStrongestWeights(combined, indices, weights, offset, usedJoints);
  }
  smoothJunctionWeights(geometry, zones, combined, indices, weights, usedJoints);

  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
  geometry.deleteAttribute('_source_mesh');
  geometry.deleteAttribute('_source_vertex');
  geometry.deleteAttribute('_source_mix');
  geometry.deleteAttribute('_motion_zone');
  return [...usedJoints];
}

export function createSkinMaterial(vertexColors = false, origin = new THREE.Vector3(), scale = 1) {
  const material = new THREE.MeshPhysicalMaterial({
    color: vertexColors ? 0xffffff : 0xad7762,
    vertexColors,
    roughness: 0.57,
    specularIntensity: 0.33,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.skinSourceOrigin = { value: origin };
    shader.uniforms.skinSourceInverseScale = { value: 1 / scale };
    shader.uniforms.skinSclera = { value: new THREE.Color(0xcbc3b8) };
    shader.uniforms.skinIris = { value: new THREE.Color(0x514439) };
    shader.uniforms.skinPupil = { value: new THREE.Color(0x201915) };
    shader.uniforms.skinBrow = { value: new THREE.Color(0x553c31) };
    // Sample the relaxed surface so the detail stays attached as the skin deforms.
    shader.vertexShader = `
      varying vec3 vSkinRest;
      ${shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vSkinRest = position;
      `)}
    `;
    shader.fragmentShader = `
      varying vec3 vSkinRest;
      uniform vec3 skinSourceOrigin;
      uniform float skinSourceInverseScale;
      uniform vec3 skinSclera;
      uniform vec3 skinIris;
      uniform vec3 skinPupil;
      uniform vec3 skinBrow;

      vec3 skinFacialColor(vec3 color, out float eyeSurface) {
        vec3 p = skinSourceOrigin + vec3(vSkinRest.x, -vSkinRest.z, vSkinRest.y) * skinSourceInverseScale;
        float front = 1.0 - smoothstep(-169.0, -148.0, p.y);
        float x = abs(p.x) - 30.5;
        float y = p.z - 1517.5 - x * 0.065;
        float lidHeight = y > 0.0 ? 3.53 : 2.91;
        float almond = x*x / 151.29 + y*y / (lidHeight * lidHeight);
        float eye = (1.0 - smoothstep(0.83, 1.03, almond)) * front;
        eyeSurface = eye;

        float upperShade = 1.0 - 0.18 * smoothstep(0.15, 3.7, y);
        float lidEdge = (1.0 - smoothstep(1.05, 1.19, almond)) * smoothstep(0.86, 0.99, almond) * front;
        color = mix(color, skinBrow, lidEdge * (0.27 + 0.23 * smoothstep(0.5, 3.1, y)));
        color = mix(color, skinSclera * upperShade, eye * 0.74);
        vec2 irisOffset = vec2(x - 0.27, y - 0.17);
        float irisRadius = length(irisOffset);
        float iris = 1.0 - smoothstep(5.16, 5.53, irisRadius);
        float ring = smoothstep(4.68, 5.49, irisRadius);
        float angle = atan(irisOffset.y, irisOffset.x + 0.0001);
        float fibers = 1.0 + 0.13 * sin(angle * 26.0 + irisRadius * 5.0);
        vec3 irisColor = mix(skinIris * fibers, skinPupil, ring * 0.62);
        color = mix(color, irisColor * upperShade, iris * eye);
        float pupil = 1.0 - smoothstep(1.36, 1.57, irisRadius);
        color = mix(color, skinPupil, pupil * eye);

        float browY = p.z - 1534.0 - 3.0 * exp(-pow(abs((abs(p.x) - 36.0) / 10.0), 2.0));
        float brow = exp(-pow(abs((x - 1.5) / 13.7), 4.0) - pow(abs(browY / 1.9), 2.0)) * front;
        return mix(color, skinBrow, brow * 0.66);
      }

      float skinHash(vec3 point) {
        point = fract(point * 0.3183099 + vec3(0.1, 0.2, 0.3));
        point *= 17.0;
        return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
      }

      float skinGrainAt(vec3 point) {
        vec3 cell = floor(point);
        vec3 t = fract(point);
        t = t * t * (3.0 - 2.0 * t);
        float lower = mix(
          mix(skinHash(cell), skinHash(cell + vec3(1, 0, 0)), t.x),
          mix(skinHash(cell + vec3(0, 1, 0)), skinHash(cell + vec3(1, 1, 0)), t.x),
          t.y
        );
        float upper = mix(
          mix(skinHash(cell + vec3(0, 0, 1)), skinHash(cell + vec3(1, 0, 1)), t.x),
          mix(skinHash(cell + vec3(0, 1, 1)), skinHash(cell + vec3(1, 1, 1)), t.x),
          t.y
        );
        return mix(lower, upper, t.z) - 0.5;
      }

      ${shader.fragmentShader
        .replace('#include <roughnessmap_fragment>', `
          #include <roughnessmap_fragment>
          vec3 skinDetailPoint = vSkinRest * 64.0;
          vec3 skinPixelSpan = fwidth(skinDetailPoint);
          float skinFilter = 1.0 - smoothstep(0.36, 1.3, max(max(skinPixelSpan.x, skinPixelSpan.y), skinPixelSpan.z));
          float skinGrainSample = skinGrainAt(skinDetailPoint);
          float skinGrain = skinGrainSample * skinFilter;
          roughnessFactor = clamp(roughnessFactor + skinGrain * 0.17, 0.43, 0.74);
          diffuseColor.rgb *= 1.0 + skinGrain * 0.045;
          float eyeSurface = 0.0;
          if (vSkinRest.y * skinSourceInverseScale + skinSourceOrigin.z > 1498.0) {
            diffuseColor.rgb = skinFacialColor(diffuseColor.rgb, eyeSurface);
          }
          roughnessFactor = mix(roughnessFactor, 0.29, eyeSurface * 0.85);
        `)
        .replace('#include <normal_fragment_maps>', `
          #include <normal_fragment_maps>
          vec3 skinDx = dFdx(-vViewPosition);
          vec3 skinDy = dFdy(-vViewPosition);
          vec3 skinAcrossX = cross(skinDy, normal);
          vec3 skinAcrossY = cross(normal, skinDx);
          float skinDeterminant = dot(skinDx, skinAcrossX);
          vec2 skinSlope = vec2(dFdx(skinGrainSample), dFdy(skinGrainSample)) * (0.0011 * skinFilter * (1.0 - eyeSurface));
          if (abs(skinDeterminant) > 1e-8) {
            normal = normalize(normal - (skinSlope.x * skinAcrossX + skinSlope.y * skinAcrossY) / skinDeterminant);
          }
        `)}
    `;
  };

  return material;
}
