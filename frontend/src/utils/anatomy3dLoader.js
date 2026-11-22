import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bindAnatomyRig } from './anatomyRig';
import { createSkinMaterial, SKIN_BONE_SOURCE_OFFSET } from './anatomySkin';

/**
 * Maps raw anatomical mesh names to parent body part and specific anatomical subdivision / head.
 */
export function getGymFitBodyPart(rawName) {
  if (!rawName) return { bodyPart: 'Other', subdivision: null };
  const n = rawName.replaceAll('_', ' ').toLowerCase();

  // Biceps: Long Head (Outer Head), Short Head (Inner Head), Brachialis, Coracobrachialis
  if (
    (n.includes('biceps') && !n.includes('femoris')) ||
    (n.includes('brachialis') && !n.includes('brachioradialis')) ||
    n.includes('coracobrachialis')
  ) {
    let sub = 'Long Head (Outer Head)';
    if (n.includes('short head')) sub = 'Short Head (Inner Head)';
    else if (n.includes('long head')) sub = 'Long Head (Outer Head)';
    else if (n.includes('brachialis')) sub = 'Brachialis';
    else if (n.includes('coracobrachialis')) sub = 'Coracobrachialis';
    return { bodyPart: 'Biceps', subdivision: sub };
  }

  // Triceps: Long Head, Lateral Head, Medial Head
  if (n.includes('triceps brachii') || n.includes('anconeus')) {
    let sub = 'Medial Head';
    if (n.includes('long head')) sub = 'Long Head';
    else if (n.includes('lateral head')) sub = 'Lateral Head';
    else if (n.includes('medial head')) sub = 'Medial Head';
    return { bodyPart: 'Triceps', subdivision: sub };
  }

  // Back: Upper Back, Middle Back, Lower Back
  if (
    n.includes('trapezius') ||
    n.includes('rhomboid') ||
    n.includes('levator scapulae')
  ) {
    return { bodyPart: 'Back', subdivision: 'Upper Back' };
  }
  if (n.includes('latissimus') || n.includes('teres major') || n.includes('teres minor')) {
    return { bodyPart: 'Back', subdivision: 'Middle Back' };
  }
  if (
    n.includes('erector') ||
    n.includes('iliocostalis') ||
    n.includes('longissimus') ||
    n.includes('spinalis') ||
    n.includes('multifidus') ||
    n.includes('quadratus lumborum')
  ) {
    return { bodyPart: 'Back', subdivision: 'Lower Back' };
  }

  // Leg: Quadriceps (4 muscles), Hamstrings (3 muscles), Glutes (3 muscles), Calves (2 major muscles), Adductors (5 major muscles), Abductors (hip muscles)
  if (n.includes('rectus femoris') || n.includes('vastus') || n.includes('sartorius')) {
    return { bodyPart: 'Leg', subdivision: 'Quadriceps (4 muscles)' };
  }
  if (n.includes('biceps femoris') || n.includes('semitendinosus') || n.includes('semimembranosus')) {
    return { bodyPart: 'Leg', subdivision: 'Hamstrings (3 muscles)' };
  }
  if (n.includes('gluteus') && !n.includes('tensor')) {
    return { bodyPart: 'Leg', subdivision: 'Glutes (3 muscles)' };
  }
  if (
    (n.includes('gastrocnemius') ||
      n.includes('soleus') ||
      n.includes('plantaris') ||
      n.includes('tibialis') ||
      n.includes('fibularis') ||
      n.includes('peroneus')) &&
    !n.includes('hand') &&
    !n.includes('manus')
  ) {
    return { bodyPart: 'Leg', subdivision: 'Calves (2 major muscles)' };
  }
  if (n.includes('adductor') || n.includes('gracilis') || n.includes('pectineus')) {
    return { bodyPart: 'Leg', subdivision: 'Adductors (5 major muscles)' };
  }
  if (
    n.includes('tensor fasciae') ||
    n.includes('piriformis') ||
    n.includes('obturator') ||
    n.includes('gemellus')
  ) {
    return { bodyPart: 'Leg', subdivision: 'Abductors (hip muscles)' };
  }

  // Chest: Upper Chest, Mid & Lower Chest, Serratus Anterior
  if (n.includes('pectoralis') || n.includes('serratus anterior')) {
    let sub = 'Mid & Lower Chest';
    if (n.includes('clavicular')) sub = 'Upper Chest (Clavicular Head)';
    else if (n.includes('serratus')) sub = 'Serratus Anterior';
    return { bodyPart: 'Chest', subdivision: sub };
  }

  // Shoulders: Anterior Deltoid, Lateral Deltoid, Posterior Deltoid
  if (
    n.includes('deltoid') ||
    n.includes('supraspinatus') ||
    n.includes('infraspinatus') ||
    n.includes('subscapularis')
  ) {
    let sub = 'Lateral Deltoid (Side Delts)';
    if (n.includes('clavicular') || n.includes('anterior')) sub = 'Anterior Deltoid (Front Delts)';
    else if (n.includes('spinal') || n.includes('posterior')) sub = 'Posterior Deltoid (Rear Delts)';
    return { bodyPart: 'Shoulders', subdivision: sub };
  }

  // Abs (Rectus Abdominis / 6-Pack)
  if (n.includes('rectus abdominis') || n.includes('pyramidalis')) {
    return { bodyPart: 'Abs', subdivision: 'Rectus Abdominis (6-Pack)' };
  }

  // Oblique (Right & Left External & Internal Obliques)
  if (
    n.includes('oblique') &&
    (n.includes('external') || n.includes('internal') || n.includes('abdom'))
  ) {
    return { bodyPart: 'Oblique', subdivision: 'Right & Left Obliques' };
  }

  // Deep Core / Transverse
  if (n.includes('transversus abdominis')) {
    return { bodyPart: 'Core', subdivision: 'Transverse Abdominis' };
  }

  // Forearms
  if (
    (n.includes('brachioradialis') ||
      n.includes('pronator') ||
      n.includes('supinator') ||
      n.includes('carpi') ||
      n.includes('palmaris') ||
      n.includes('digitorum')) &&
    !n.includes('foot') &&
    !n.includes('pedis')
  ) {
    let sub = 'Wrist Flexors';
    if (n.includes('brachioradialis') || n.includes('extensor')) sub = 'Brachioradialis';
    return { bodyPart: 'Forearms', subdivision: sub };
  }

  return { bodyPart: 'Other', subdivision: null };
}

/**
 * Maps raw anatomical mesh names to legacy GymFit workout muscle groups.
 */
export function getGymFitMuscleGroup(rawName) {
  const { bodyPart, subdivision } = getGymFitBodyPart(rawName);
  if (bodyPart === 'Back') {
    if (subdivision === 'Upper Back') return 'Upper Back';
    if (subdivision === 'Middle Back') return 'Lats';
    if (subdivision === 'Lower Back') return 'Lower Back';
    return 'Upper Back';
  }
  if (bodyPart === 'Leg') {
    if (subdivision === 'Quadriceps (4 muscles)') return 'Quadriceps';
    if (subdivision === 'Hamstrings (3 muscles)') return 'Hamstrings';
    if (subdivision === 'Glutes (3 muscles)') return 'Glutes';
    if (subdivision === 'Calves (2 major muscles)') return 'Calves';
    return 'Quadriceps';
  }
  return bodyPart;
}

/**
 * Format raw anatomical name into clean title case.
 */
export function formatMuscleName(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (lower.includes('rectus abdominis')) {
    const side = lower.includes('left') ? 'Left ' : lower.includes('right') ? 'Right ' : '';
    return `${side}Rectus Abdominis (Abs / 6-Pack)`;
  }
  if (lower.includes('external oblique')) {
    const side = lower.includes('left') ? 'Left ' : lower.includes('right') ? 'Right ' : '';
    return `${side}External Oblique`;
  }
  if (lower.includes('internal oblique')) {
    const side = lower.includes('left') ? 'Left ' : lower.includes('right') ? 'Right ' : '';
    return `${side}Internal Oblique`;
  }

  let clean = name.replace(/\s*\(\d+\)\s*$/, '').replace(/_/g, ' ').trim();

  const partMatch = clean.match(/^(.+?)\s+(part|head|belly)\s+of\s+(?:(left|right)\s+)?(.+)$/i);
  if (partMatch) {
    const qualifier = partMatch[1];
    const keyword = partMatch[2];
    const side = partMatch[3] ? partMatch[3].charAt(0).toUpperCase() + partMatch[3].slice(1) + ' ' : '';
    const muscle = partMatch[4];
    clean = `${side}${muscle} (${qualifier} ${keyword})`;
  }

  const smallWords = new Set(['of', 'the', 'and', 'in', 'at', 'to', 'for', 'on', 'by', 'or']);
  return clean
    .split(' ')
    .map((w, i) =>
      i > 0 && smallWords.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(' ');
}

/**
 * Applies BodyParts3D -> Three.js coordinate transform in place.
 * BP3D mm space: X=left-right, Y=front-back, Z=bottom-top
 * Three.js scene: X=left-right, Y=up, Z=front
 */
function transformGeometry(geometry, center, scaleFactor) {
  const posAttr = geometry.getAttribute('position');
  if (posAttr) {
    const pos = posAttr.array;
    for (let i = 0; i < pos.length; i += 3) {
      const bx = pos[i];
      const by = pos[i + 1];
      const bz = pos[i + 2];

      pos[i] = (bx - center.x) * scaleFactor;
      pos[i + 1] = (bz - center.z) * scaleFactor;
      pos[i + 2] = -(by - center.y) * scaleFactor;
    }
    posAttr.needsUpdate = true;
  }

  const normAttr = geometry.getAttribute('normal');
  if (normAttr) {
    const norms = normAttr.array;
    for (let i = 0; i < norms.length; i += 3) {
      const nx = norms[i];
      const ny = norms[i + 1];
      const nz = norms[i + 2];
      norms[i] = nx;
      norms[i + 1] = nz;
      norms[i + 2] = -ny;
    }
    normAttr.needsUpdate = true;
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Material presets
 */
export const defaultMuscleMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#b83a2b'),
  roughness: 0.52,
  metalness: 0.04,
  side: THREE.DoubleSide
});

export const tendonMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.92, 0.88, 0.80),
  roughness: 0.45,
  metalness: 0.0,
  side: THREE.DoubleSide
});

export const boneMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0.94, 0.92, 0.86),
  roughness: 0.6,
  metalness: 0.0,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide,
  depthWrite: false
});

// Vivid glowing red for selected muscle/subdivision
export const selectedRedMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#ef4444'),
  emissive: new THREE.Color('#dc2626'),
  emissiveIntensity: 0.9,
  roughness: 0.32,
  metalness: 0.08,
  side: THREE.DoubleSide
});

// Extra intense highlight for the active subdivision head
export const selectedSubdivisionMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#ff2222'),
  emissive: new THREE.Color('#ef4444'),
  emissiveIntensity: 1.15,
  roughness: 0.28,
  metalness: 0.1,
  side: THREE.DoubleSide
});

// Subtle secondary red for other heads of the selected body part
export const selectedGroupSubtleMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#e11d48'),
  emissive: new THREE.Color('#be123c'),
  emissiveIntensity: 0.45,
  roughness: 0.42,
  metalness: 0.05,
  side: THREE.DoubleSide
});

export const hoverMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#f87171'),
  emissive: new THREE.Color('#ef4444'),
  emissiveIntensity: 0.45,
  roughness: 0.4,
  metalness: 0.05,
  side: THREE.DoubleSide
});

/**
 * Loads both anatomy.glb (muscles/tendons) and skeleton.glb (bones).
 * Returns the assembled anatomy, its rest bounds, and the shared movement rig.
 */
export function load3DAnatomyModel(onProgress) {
  return new Promise((resolve, reject) => {
    console.log('[3D Anatomy] Initiating GLB download for anatomy and skeleton...');
    const loader = new GLTFLoader();
    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'HumanBodyAnatomy';

    const muscleMeshes = [];
    const muscleGroup = new THREE.Group();
    muscleGroup.name = 'Musculature';
    const skeletonGroup = new THREE.Group();
    skeletonGroup.name = 'SkeletalFramework';
    const groupMeshMap = {};

    bodyGroup.add(skeletonGroup, muscleGroup);

    const baseUrl = import.meta.env?.BASE_URL || '/';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const anatomyUrl = `${cleanBase}anatomy3d/anatomy.glb`;
    const skeletonUrl = `${cleanBase}anatomy3d/skeleton.glb`;

    const loadGLB = (url, weight, basePct) =>
      new Promise((res, rej) => {
        loader.load(
          url,
          (gltf) => {
            console.log(`[3D Anatomy] Successfully parsed GLTF from: ${url}`);
            res(gltf);
          },
          (evt) => {
            if (evt.total > 0 && onProgress) {
              const current = basePct + Math.round((evt.loaded / evt.total) * weight);
              onProgress(Math.min(99, current));
            }
          },
          (err) => {
            console.error(`[3D Anatomy] Error fetching ${url}:`, err);
            rej(err);
          }
        );
      });

    // Load anatomy and skeleton
    Promise.all([
      loadGLB(anatomyUrl, 70, 0),
      loadGLB(skeletonUrl, 30, 70)
    ])
      .then(([anatomyGLTF, skeletonGLTF]) => {
        console.log('[3D Anatomy] Both GLB files downloaded. Processing geometries...');

        const anatomyRoot = anatomyGLTF.scene;
        const anatomyBox = new THREE.Box3().setFromObject(anatomyRoot);
        const anatomyCenter = anatomyBox.getCenter(new THREE.Vector3());
        const anatomySize = anatomyBox.getSize(new THREE.Vector3());

        const targetHeight = 30;
        const scaleFactor = targetHeight / (anatomySize.z || 1672);

        // 1. Process Anatomy (muscles and tendons)
        let muscleCount = 0;
        anatomyRoot.traverse((child) => {
          if (!child.isMesh) return;

          const rawName = child.name || `muscle_${muscleCount}`;
          const isTendon =
            rawName.toLowerCase().includes('tendon') ||
            rawName.toLowerCase().includes('ligament') ||
            rawName.toLowerCase().includes('retinaculum') ||
            rawName.toLowerCase().includes('membrane');

          const { bodyPart, subdivision } = getGymFitBodyPart(rawName);
          const gymFitGroup = getGymFitMuscleGroup(rawName);

          const geometry = child.geometry.clone();
          transformGeometry(geometry, anatomyCenter, scaleFactor);

          const mat = isTendon ? tendonMaterial : defaultMuscleMaterial;
          const mesh = new THREE.SkinnedMesh(geometry, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.renderOrder = 1;

          mesh.userData = {
            rawName,
            displayName: formatMuscleName(rawName),
            gymFitGroup,
            bodyPart,
            subdivision,
            isTendon,
            skinSourceId: anatomyGLTF.parser.associations.get(child)?.meshes,
            originalMaterial: mat
          };

          // Group indexing for fast access
          if (bodyPart) {
            if (!groupMeshMap[bodyPart]) groupMeshMap[bodyPart] = [];
            groupMeshMap[bodyPart].push(mesh);
          }
          if (subdivision) {
            if (!groupMeshMap[subdivision]) groupMeshMap[subdivision] = [];
            groupMeshMap[subdivision].push(mesh);
          }
          if (gymFitGroup && gymFitGroup !== bodyPart) {
            if (!groupMeshMap[gymFitGroup]) groupMeshMap[gymFitGroup] = [];
            groupMeshMap[gymFitGroup].push(mesh);
          }

          muscleMeshes.push(mesh);
          muscleGroup.add(mesh);
          muscleCount++;
        });

        console.log(`[3D Anatomy] Processed ${muscleCount} muscular meshes.`);

        // 2. Process Skeleton (bones)
        const skeletonRoot = skeletonGLTF.scene;
        let boneCount = 0;
        skeletonRoot.traverse((child) => {
          if (!child.isMesh) return;

          const geometry = child.geometry.clone();
          transformGeometry(geometry, anatomyCenter, scaleFactor);

          const boneMesh = new THREE.SkinnedMesh(geometry, boneMaterial);
          boneMesh.castShadow = false;
          boneMesh.receiveShadow = false;
          boneMesh.renderOrder = 0;

          const sourceIndex = skeletonGLTF.parser.associations.get(child)?.meshes;
          boneMesh.userData = {
            skinSourceId: Number.isInteger(sourceIndex) ? SKIN_BONE_SOURCE_OFFSET + sourceIndex : null,
            rawName: child.name || `bone_${boneCount}`,
            displayName: formatMuscleName(child.name || `bone_${boneCount}`),
            isBone: true
          };

          skeletonGroup.add(boneMesh);
          boneCount++;
        });

        console.log(`[3D Anatomy] Processed ${boneCount} skeletal bone meshes.`);

        // 3. Bind the meshes before reading their rest bounds.
        const rig = bindAnatomyRig(bodyGroup, muscleMeshes, skeletonGroup.children, anatomyCenter, scaleFactor);
        const bodyBox = new THREE.Box3().setFromObject(bodyGroup);
        const bodyCenter = bodyBox.getCenter(new THREE.Vector3());
        const bodySize = bodyBox.getSize(new THREE.Vector3());
        if (onProgress) onProgress(100);

        const loadSkin = async () => {
          const { scene } = await loader.loadAsync(`${cleanBase}anatomy3d/skin.glb?v=3`);
          const surface = scene.getObjectByName('FittedSkin');
          if (!surface?.isMesh) throw new Error('The fitted skin surface is missing.');

          transformGeometry(surface.geometry, anatomyCenter, scaleFactor);
          const material = createSkinMaterial(surface.geometry.hasAttribute('color'), anatomyCenter, scaleFactor);
          const mesh = new THREE.SkinnedMesh(surface.geometry, material);
          mesh.name = 'Skin';
          mesh.visible = false;
          mesh.receiveShadow = true;
          mesh.renderOrder = 2;
          return mesh;
        };

        resolve({
          bodyGroup,
          muscleMeshes,
          muscleGroup,
          skeletonGroup,
          loadSkin,
          groupMeshMap,
          bodyBox,
          bodyCenter,
          bodySize,
          rig
        });
      })
      .catch((err) => {
        console.error('[3D Anatomy] Critical Error in load3DAnatomyModel:', err);
        reject(err);
      });
  });
}
