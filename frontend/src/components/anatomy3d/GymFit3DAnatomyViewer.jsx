import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { exerciseMotions } from '../../data/exerciseMotions';
import { createAnatomyMotion } from '../../utils/anatomyMotion';
import {
  load3DAnatomyModel,
  selectedRedMaterial,
  selectedSubdivisionMaterial,
  selectedGroupSubtleMaterial,
  hoverMaterial,
  defaultMuscleMaterial
} from '../../utils/anatomy3dLoader';
import {
  RotateCcw,
  Eye,
  EyeOff,
  Compass,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Play,
  Pause
} from 'lucide-react';

function getMuscleLabel(muscle) {
  return [muscle.bodyPart, muscle.gymFitGroup].find((part) => part && part !== 'Other') ?? muscle.displayName;
}

export const GymFit3DAnatomyViewer = ({
  exerciseId = null,
  selectedMuscles = ['Biceps'],
  selectedMuscleDetails = null,
  onToggleMuscle = () => {},
  hoveredMuscle = null,
  onHoverMuscle = () => {}
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Three.js internal references
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const cameraFrameRef = useRef(null);
  const rigRef = useRef(null);
  const playbackRef = useRef({ motion: null, phase: 0, playing: false, dirty: false });

  // Mesh & grouping storage
  const muscleMeshesRef = useRef([]);
  const muscleGroupRef = useRef(null);
  const loadSkinRef = useRef(null);
  const skinMeshRef = useRef(null);
  const skinLightingRef = useRef(null);
  const skeletonGroupRef = useRef(null);

  // Interaction refs
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredGroupRef = useRef(null);
  const pointerDownRef = useRef(null);

  // Camera framing refs
  const optimalDistRef = useRef(42);
  const modelCenterRef = useRef(new THREE.Vector3(0, 0, 0));
  const viewBeforeFocusRef = useRef(null);

  // Component UI State
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showSkin, setShowSkin] = useState(false);
  const [skinOpacity, setSkinOpacity] = useState(100);
  const [skinStatus, setSkinStatus] = useState('idle');
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [activeView, setActiveView] = useState('front');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const motion = exerciseMotions[exerciseId] ?? null;

  useEffect(() => {
    playbackRef.current = { motion, phase: 0, playing: false, dirty: true };
    setPlaying(false);
    setProgress(0);
  }, [motion]);

  const pauseMotion = () => {
    playbackRef.current.playing = false;
    setPlaying(false);
    setProgress(playbackRef.current.phase);
  };

  const toggleMotion = () => {
    const playback = playbackRef.current;
    if (playback.playing) {
      pauseMotion();
    } else {
      playback.playing = true;
      setPlaying(true);
    }
  };

  const scrubMotion = (event) => {
    pauseMotion();
    const phase = Number(event.target.value) / 100;
    playbackRef.current.phase = phase;
    playbackRef.current.dirty = true;
    setProgress(phase);
  };

  const toggleSkin = async () => {
    if (skinMeshRef.current) {
      setShowSkin((visible) => !visible);
      return;
    }

    const rig = rigRef.current;
    const loadSkin = loadSkinRef.current;
    if (!rig || !loadSkin || skinStatus === 'loading') return;

    setSkinStatus('loading');
    let mesh;
    try {
      mesh = await loadSkin();
      if (rigRef.current !== rig) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        return;
      }
      rig.addSkin(mesh);
      skinMeshRef.current = mesh;
      setSkinStatus('ready');
      setShowSkin(true);
    } catch {
      mesh?.geometry.dispose();
      mesh?.material.dispose();
      if (rigRef.current === rig) setSkinStatus('error');
    }
  };

  // Single active body part
  const currentSelectedPart = Array.isArray(selectedMuscles)
    ? selectedMuscles[0]
    : selectedMuscles;

  // Highlight the exact mesh after a tap, or the group selected by the toolbar.
  const updateMeshHighlights = useCallback(() => {
    const meshes = muscleMeshesRef.current;
    if (!meshes || meshes.length === 0) return;

    const selectedNorm = currentSelectedPart?.toLowerCase();
    const hoveredNorm = (hoveredMuscle || hoveredGroupRef.current)?.toLowerCase();
    const selectedMeshId = selectedMuscleDetails?.meshId;

    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      const bp = mesh.userData.bodyPart;
      const legacyGroup = mesh.userData.gymFitGroup;

      const bpNorm = bp?.toLowerCase();
      const legacyNorm = legacyGroup?.toLowerCase();

      // Precise isolation: Abs/Box vs Obliques bilateral (right & left)
      const isPartSelected =
        Boolean(selectedNorm) &&
        (bpNorm === selectedNorm ||
          legacyNorm === selectedNorm ||
          (['abs', 'box'].includes(selectedNorm) && ['abs', 'box'].includes(bpNorm)) ||
          (['oblique', 'obliques', 'oblicque'].includes(selectedNorm) && ['oblique', 'obliques'].includes(bpNorm)));

      const isHovered =
        Boolean(hoveredNorm) &&
        !isPartSelected &&
        (bpNorm === hoveredNorm ||
          legacyNorm === hoveredNorm ||
          (bpNorm === 'other' && mesh.userData.displayName?.toLowerCase() === hoveredNorm) ||
          (['abs', 'box'].includes(hoveredNorm) && ['abs', 'box'].includes(bpNorm)) ||
          (['oblique', 'obliques', 'oblicque'].includes(hoveredNorm) && ['oblique', 'obliques'].includes(bpNorm)));

      if (mesh.uuid === selectedMeshId) {
        mesh.material = selectedSubdivisionMaterial;
      } else if (isPartSelected) {
        mesh.material = selectedMeshId ? selectedGroupSubtleMaterial : selectedRedMaterial;
      } else if (isHovered) {
        mesh.material = hoverMaterial;
      } else {
        mesh.material = mesh.userData.originalMaterial || defaultMuscleMaterial;
      }
    }
  }, [currentSelectedPart, selectedMuscleDetails, hoveredMuscle]);

  useEffect(() => {
    updateMeshHighlights();
  }, [loading, updateMeshHighlights]);

  // 2. Camera Preset Transitions
  const setCameraView = (viewType) => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    viewBeforeFocusRef.current = null;
    setActiveView(viewType);
    const center = modelCenterRef.current;
    const dist = optimalDistRef.current;

    let targetPos = new THREE.Vector3(center.x, center.y, center.z + dist);

    switch (viewType) {
      case 'front':
        targetPos.set(center.x, center.y, center.z + dist);
        break;
      case 'back':
        targetPos.set(center.x, center.y, center.z - dist);
        break;
      case 'side-left':
        targetPos.set(center.x - dist, center.y, center.z);
        break;
      case 'side-right':
        targetPos.set(center.x + dist, center.y, center.z);
        break;
      case 'reset':
      default:
        targetPos.set(center.x, center.y, center.z + dist);
        setActiveView('front');
        break;
    }

    animateCamera(targetPos, center, 650);
  };

  const animateCamera = useCallback((toPos, toTarget, durationMs = 650) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    cancelAnimationFrame(cameraFrameRef.current);
    const startTarget = controls.target.clone();
    const startOffset = new THREE.Spherical().setFromVector3(camera.position.clone().sub(startTarget));
    const endOffset = new THREE.Spherical().setFromVector3(toPos.clone().sub(toTarget));
    const thetaChange = Math.atan2(
      Math.sin(endOffset.theta - startOffset.theta),
      Math.cos(endOffset.theta - startOffset.theta)
    );
    const offset = new THREE.Spherical();
    const startTime = performance.now();
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : durationMs;

    const step = (now) => {
      const progress = duration ? Math.min(1, (now - startTime) / duration) : 1;
      const eased = progress * progress * (3 - 2 * progress);
      offset.set(
        THREE.MathUtils.lerp(startOffset.radius, endOffset.radius, eased),
        THREE.MathUtils.lerp(startOffset.phi, endOffset.phi, eased),
        startOffset.theta + thetaChange * eased
      );
      controls.target.lerpVectors(startTarget, toTarget, eased);
      camera.position.setFromSpherical(offset).add(controls.target);
      controls.update();
      cameraFrameRef.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    cameraFrameRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (loading || loadError) return;
    const center = modelCenterRef.current;
    const offset = motion ? new THREE.Vector3(0.74, 0.32, 0.62).normalize() : new THREE.Vector3(0, 0, 1);
    viewBeforeFocusRef.current = null;
    setActiveView(motion ? null : 'front');
    animateCamera(offset.multiplyScalar(optimalDistRef.current).add(center), center);
  }, [animateCamera, loading, loadError, motion]);

  const focusMuscle = ({ object, point }) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const bounds = new THREE.Box3().setFromObject(object, true);
    if (bounds.isEmpty()) return;
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    // Aim toward the visible surface while keeping the rest of the mesh in frame.
    const focus = sphere.center.clone().lerp(point, 0.25);
    const radius = sphere.radius + focus.distanceTo(sphere.center);
    const verticalHalfFov = THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2);
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
    const distance = THREE.MathUtils.clamp(
      (radius * 1.15) / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov)),
      controls.minDistance,
      controls.maxDistance
    );
    const offset = camera.position.clone().sub(controls.target).setLength(distance);

    viewBeforeFocusRef.current ??= {
      position: camera.position.clone(),
      target: controls.target.clone(),
      view: activeView
    };
    setActiveView(null);
    animateCamera(focus.clone().add(offset), focus);
  };

  useEffect(() => {
    if (selectedMuscleDetails || !viewBeforeFocusRef.current) return;
    const { position, target, view } = viewBeforeFocusRef.current;
    viewBeforeFocusRef.current = null;
    setActiveView(view);
    animateCamera(position, target);
  }, [animateCamera, selectedMuscleDetails]);

  const getPointerHit = (clientX, clientY, meshes) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    if (!canvas || !camera || meshes.length === 0) return null;

    const { left, top, width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return null;

    mouseRef.current.set(
      ((clientX - left) / width) * 2 - 1,
      -((clientY - top) / height) * 2 + 1
    );
    rigRef.current?.updatePickingBounds();
    camera.updateMatrixWorld();
    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    return raycasterRef.current.intersectObjects(meshes, false)[0] ?? null;
  };

  // 3. Mount Three.js Scene and Load 3D Model
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let isMounted = true;
    setLoading(true);
    setLoadError(null);
    setLoadProgress(0);
    setShowSkin(false);
    setSkinStatus('idle');
    setActiveView('front');
    viewBeforeFocusRef.current = null;

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch {
      setLoading(false);
      setLoadError('The 3D viewer could not start. WebGL is required.');
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);
    camera.position.set(0, 0, 45);
    cameraRef.current = camera;

    // OrbitControls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 120;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;
    const stopCameraTransition = () => {
      cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = null;
    };
    controls.addEventListener('start', stopCameraTransition);

    const hitsModel = (event) => {
      const skeleton = skeletonGroupRef.current;
      const visibleMeshes = [
        ...muscleMeshesRef.current,
        ...(skeleton?.visible ? skeleton.children : [])
      ].filter((mesh) => mesh.visible);
      if (getPointerHit(event.clientX, event.clientY, visibleMeshes)) return true;
      const skin = skinMeshRef.current;
      return Boolean(skin?.visible && getPointerHit(event.clientX, event.clientY, [skin]));
    };

    const modelTouches = new Set();
    let pageTouch = null;
    const gateOrbitPointer = (event) => {
      const isTouch = event.pointerType === 'touch';
      // A second finger can join only a gesture already started on the model.
      if ((isTouch && pageTouch) || (!(isTouch && modelTouches.size) && !hitsModel(event))) {
        if (isTouch && event.isPrimary) {
          pageTouch = { id: event.pointerId, y: event.clientY };
          canvas.setPointerCapture(event.pointerId);
        }
        event.stopImmediatePropagation();
        return;
      }
      if (isTouch) modelTouches.add(event.pointerId);
    };

    const scrollPageOnBackground = (event) => {
      if (pageTouch?.id !== event.pointerId) return;
      const delta = pageTouch.y - event.clientY;
      pageTouch.y = event.clientY;
      canvas.ownerDocument.defaultView.scrollBy(0, delta);
    };

    const releaseTouch = (event) => {
      modelTouches.delete(event.pointerId);
      if (pageTouch?.id === event.pointerId) pageTouch = null;
    };

    let lastPinchWheelTime = -Infinity;
    let pinchStartedOnModel = false;
    const gateOrbitWheel = (event) => {
      if (!event.ctrlKey) {
        lastPinchWheelTime = -Infinity;
        event.stopImmediatePropagation();
        return;
      }
      // Trackpad pinches arrive as Ctrl-modified wheel events.
      if (event.timeStamp - lastPinchWheelTime > 180) {
        pinchStartedOnModel = hitsModel(event);
      }
      lastPinchWheelTime = event.timeStamp;
      if (!pinchStartedOnModel) event.stopImmediatePropagation();
    };

    // Intercept before OrbitControls so normal wheel events retain browser scrolling.
    canvas.addEventListener('pointerdown', gateOrbitPointer, true);
    canvas.addEventListener('pointermove', scrollPageOnBackground, { passive: true });
    canvas.addEventListener('lostpointercapture', releaseTouch);
    canvas.addEventListener('wheel', gateOrbitWheel, { capture: true, passive: true });
    canvas.ownerDocument.addEventListener('pointerup', releaseTouch, true);
    canvas.ownerDocument.addEventListener('pointercancel', releaseTouch, true);

    // ───────────── 360° Studio Lighting ─────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.8);
    scene.add(hemiLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.35);
    frontLight.position.set(0, 3, 35);
    frontLight.target.position.set(0, 0, 0);
    scene.add(frontLight);
    scene.add(frontLight.target);

    const keyLight = new THREE.DirectionalLight(0xfff5ee, 1.6);
    keyLight.position.set(18, 24, 22);
    keyLight.target.position.set(0, 0, 0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);
    scene.add(keyLight.target);

    const backLight = new THREE.DirectionalLight(0xfff0ea, 1.4);
    backLight.position.set(0, 3, -35);
    backLight.target.position.set(0, 0, 0);
    scene.add(backLight);
    scene.add(backLight.target);

    const leftLight = new THREE.DirectionalLight(0xaaccff, 0.9);
    leftLight.position.set(-25, 4, 0);
    leftLight.target.position.set(0, 0, 0);
    scene.add(leftLight);
    scene.add(leftLight.target);

    const rightLight = new THREE.DirectionalLight(0xaaccff, 0.9);
    rightLight.position.set(25, 4, 0);
    rightLight.target.position.set(0, 0, 0);
    scene.add(rightLight);
    scene.add(rightLight.target);

    const skinLights = [
      [ambientLight, 0.53],
      [hemiLight, 0.46],
      [frontLight, 0.66],
      [keyLight, 2.05],
      [backLight, 0.95],
      [leftLight, 0.46],
      [rightLight, 0.34],
    ].map(([light, skinIntensity]) => ({ light, skinIntensity, anatomyIntensity: light.intensity }));

    skinLightingRef.current = (enabled) => {
      for (const { light, skinIntensity, anatomyIntensity } of skinLights) {
        light.intensity = enabled ? skinIntensity : anatomyIntensity;
      }
      leftLight.color.setHex(enabled ? 0xf0e8e1 : 0xaaccff);
      rightLight.color.setHex(enabled ? 0xeaeefa : 0xaaccff);
      renderer.toneMappingExposure = enabled ? 1.14 : 1.45;
    };

    // ───────────── Load 3D Anatomy Model ─────────────
    let motionController = null;
    load3DAnatomyModel((pct) => {
      if (isMounted) setLoadProgress(pct);
    })
      .then(({ bodyGroup, muscleMeshes, muscleGroup, skeletonGroup, bodyCenter, rig, loadSkin }) => {
        if (!isMounted) {
          bodyGroup.traverse((object) => object.geometry?.dispose());
          rig.dispose();
          return;
        }

        // 1. Center the model at origin (0, 0, 0)
        bodyGroup.position.set(-bodyCenter.x, -bodyCenter.y, -bodyCenter.z);
        scene.add(bodyGroup);

        muscleMeshesRef.current = muscleMeshes;
        muscleGroupRef.current = muscleGroup;
        skeletonGroupRef.current = skeletonGroup;
        loadSkinRef.current = loadSkin;

        // 2. Compute true world bounds
        const worldBox = new THREE.Box3().setFromObject(bodyGroup);
        const worldCenter = worldBox.getCenter(new THREE.Vector3());
        const worldSize = worldBox.getSize(new THREE.Vector3());

        modelCenterRef.current.copy(worldCenter);

        // 3. Automatically adjust camera distance for complete full-body framing
        const fovRad = (camera.fov * Math.PI) / 180;
        const currentAspect = (container.clientWidth || width) / (container.clientHeight || height);
        camera.aspect = currentAspect;

        const fovH = 2 * Math.atan(Math.tan(fovRad / 2) * currentAspect);
        const distVertical = (worldSize.y / 2) / Math.tan(fovRad / 2);
        const distHorizontal = (worldSize.x / 2) / Math.tan(fovH / 2);

        const optimalDistance = Math.max(distVertical, distHorizontal) * 1.32;
        optimalDistRef.current = optimalDistance;

        camera.near = Math.max(0.1, optimalDistance * 0.05);
        camera.far = Math.max(250, optimalDistance * 6);
        camera.updateProjectionMatrix();

        camera.position.set(worldCenter.x, worldCenter.y, worldCenter.z + optimalDistance);
        camera.lookAt(worldCenter);

        controls.target.copy(worldCenter);
        controls.minDistance = optimalDistance * 0.2;
        controls.maxDistance = optimalDistance * 3.2;
        controls.update();

        // Soft contact shadow beneath the model.
        const feetY = worldBox.min.y - 0.15;
        rigRef.current = rig;
        motionController = createAnatomyMotion(rig, feetY - bodyGroup.position.y, worldSize.y);
        playbackRef.current.dirty = true;
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(60, 60),
          new THREE.ShadowMaterial({ opacity: 0.22 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(worldCenter.x, feetY, worldCenter.z);
        ground.receiveShadow = true;
        scene.add(ground);

        setLoading(false);
      })
      .catch((err) => {
        console.error('[3D Anatomy] Error:', err);
        if (isMounted) {
          setLoading(false);
          setLoadError(err.message || 'Failed to load 3D model.');
        }
      });

    // ───────────── Resize Observer ─────────────
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const r = container.getBoundingClientRect();
      const newW = r.width;
      const newH = r.height;
      if (newW === 0 || newH === 0) return;

      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH, false);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // ───────────── Render Loop ─────────────
    let lastFrame = performance.now();
    let lastProgressUpdate = lastFrame;
    const animate = (now) => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const elapsed = Math.min(now - lastFrame, 100);
      lastFrame = now;
      const playback = playbackRef.current;

      if (motionController && (playback.dirty || playback.playing)) {
        if (playback.playing && playback.motion) {
          playback.phase = (playback.phase + elapsed / (1000 * playback.motion.seconds)) % 1;
          if (now - lastProgressUpdate >= 75) {
            lastProgressUpdate = now;
            setProgress(playback.phase);
          }
        }
        motionController.apply(playback.motion, playback.phase);
        playback.dirty = false;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animationFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameIdRef.current);
      stopCameraTransition();
      controls.removeEventListener('start', stopCameraTransition);
      canvas.removeEventListener('pointerdown', gateOrbitPointer, true);
      canvas.removeEventListener('pointermove', scrollPageOnBackground);
      canvas.removeEventListener('lostpointercapture', releaseTouch);
      canvas.removeEventListener('wheel', gateOrbitWheel, true);
      canvas.ownerDocument.removeEventListener('pointerup', releaseTouch, true);
      canvas.ownerDocument.removeEventListener('pointercancel', releaseTouch, true);
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material?.isShadowMaterial) object.material.dispose();
        object.shadow?.dispose();
      });
      motionController?.dispose();
      skinMeshRef.current?.material.dispose();
      rigRef.current?.dispose();
      rigRef.current = null;
      renderer.dispose();
      muscleMeshesRef.current = [];
      muscleGroupRef.current = null;
      skeletonGroupRef.current = null;
      skinMeshRef.current = null;
      skinLightingRef.current = null;
      loadSkinRef.current = null;
      controlsRef.current = null;
      cameraRef.current = null;
    };
  }, [loadAttempt]);

  useEffect(() => {
    const skin = skinMeshRef.current;
    const opaqueSkin = Boolean(showSkin && skin && skinOpacity === 100);
    skinLightingRef.current?.(opaqueSkin);
    if (skin) {
      const transparent = skinOpacity < 100;
      if (skin.material.transparent !== transparent) {
        skin.material.transparent = transparent;
        skin.material.needsUpdate = true;
      }
      skin.material.opacity = skinOpacity / 100;
      skin.material.depthWrite = !transparent;
      skin.castShadow = !transparent;
      skin.visible = showSkin;
    }
    if (muscleGroupRef.current) muscleGroupRef.current.visible = !opaqueSkin;
    if (skeletonGroupRef.current) skeletonGroupRef.current.visible = showSkeleton && !opaqueSkin;
  }, [loading, showSkeleton, showSkin, skinOpacity]);

  // 5. Raycasting for Single Muscle Selection
  const handlePointerDown = (event) => {
    if (!event.isPrimary || event.button !== 0) {
      pointerDownRef.current = null;
      return;
    }
    pointerDownRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
  };

  const handlePointerUp = (event) => {
    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!start || start.id !== event.pointerId) return;

    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) {
      processRaycastClick(event.clientX, event.clientY);
    }
  };

  const getSelectableMuscle = (clientX, clientY) => {
    const meshes = muscleMeshesRef.current.filter((mesh) => mesh.visible && !mesh.userData.isTendon);
    return getPointerHit(clientX, clientY, meshes);
  };

  const processRaycastClick = (clientX, clientY) => {
    const hit = getSelectableMuscle(clientX, clientY);
    if (!hit) return;

    const muscle = hit.object.userData;
    if (playbackRef.current.playing) pauseMotion();
    onToggleMuscle(getMuscleLabel(muscle), { ...muscle, meshId: hit.object.uuid });
    focusMuscle(hit);
  };

  const handlePointerMove = (event) => {
    const start = pointerDownRef.current;
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6) {
      pointerDownRef.current = null;
      setActiveView(null);
    }
    if (event.pointerType !== 'mouse' || event.buttons) return;

    const muscle = getSelectableMuscle(event.clientX, event.clientY)?.object.userData;
    if (!muscle) {
      clearHover();
      return;
    }

    const bodyPart = getMuscleLabel(muscle);
    canvasRef.current.style.cursor = 'pointer';
    hoveredGroupRef.current = bodyPart;
    setHoveredInfo({ name: muscle.displayName, bodyPart, subdivision: muscle.subdivision });
    onHoverMuscle(bodyPart);
    updateMeshHighlights();
  };

  const clearHover = () => {
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    if (hoveredGroupRef.current !== null) {
      hoveredGroupRef.current = null;
      setHoveredInfo(null);
      onHoverMuscle(null);
      updateMeshHighlights();
    }
  };

  return (
    <div>
      {motion && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-3">
          <button
            type="button"
            className="action action-small action-ink disabled:opacity-50"
            disabled={loading || Boolean(loadError)}
            onClick={toggleMotion}
          >
            {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {playing ? 'Pause' : 'Play rep'}
          </button>
          <label className="flex min-w-40 flex-1 items-center gap-2 text-sm">
            Rep progress
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(progress * 100)}
              disabled={loading || Boolean(loadError)}
              onChange={scrubMotion}
              className="min-w-0 flex-1 accent-cyan-600 dark:accent-cyan-400"
            />
          </label>
        </div>
      )}
      {showSkin && (
        <div className="flex flex-wrap items-center justify-end gap-3 px-2 py-2 text-sm">
          <label className="flex items-center gap-2">
            Skin opacity
            <input
              type="range"
              min="25"
              max="100"
              value={skinOpacity}
              onChange={(event) => setSkinOpacity(Number(event.target.value))}
              className="w-24 accent-cyan-600 dark:accent-cyan-400 sm:w-32"
            />
            <span className="w-10 text-right tabular-nums" aria-hidden="true">{skinOpacity}%</span>
          </label>
        </div>
      )}
      {skinStatus === 'error' && <p role="status" className="px-2 py-2 text-sm text-[color:var(--muted)]">Could not load the skin. Select Skin to retry.</p>}
      <div
        ref={containerRef}
        className="relative w-full h-[530px] sm:h-[630px] lg:h-[740px] select-none"
      >
        {/* 3D WebGL Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerCancel={() => { pointerDownRef.current = null; clearHover(); }}
          onPointerLeave={clearHover}
          className="w-full h-full block focus:outline-none touch-none"
        />

        {/* Loading Overlay */}
        {loading && !loadError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full border-4 border-red-500/30 border-t-red-500 animate-spin mb-4" />
            <p className="text-sm font-bold text-[color:var(--ink)] tracking-wide">
              Loading anatomy model…
            </p>
            <p className="text-xs text-[color:var(--muted)] mt-1 font-mono">
              467 MRI-based muscle meshes ({loadProgress}%)
            </p>
            <div className="w-52 h-1.5 bg-[color:var(--line)] rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-200"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Fallback */}
        {loadError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[color:var(--ink)] mb-1">
              Failed to Load 3D Model
            </h4>
            <p className="text-xs text-[color:var(--muted)] max-w-sm mb-4">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Viewer
            </button>
          </div>
        )}

        {/* Top Header Badge */}
        <div className="absolute top-4 left-4 z-10 hidden xl:flex flex-col gap-1 pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-white text-xs font-semibold shadow-lg">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>3D Anatomical Body</span>
            <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-800">
              {showSkin ? 'Skin layer' : 'Single Muscle Focus'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium pl-1 drop-shadow">
            Click any muscle to isolate it and inspect its anatomical subdivisions
          </p>
        </div>

        {/* Top Right Camera Preset View Controls & Skeleton Toggle */}
        <fieldset disabled={loading || Boolean(loadError)} aria-label="Camera and anatomy layers" className="absolute left-2 right-2 top-3 z-10 flex min-w-0 flex-wrap sm:left-auto sm:right-4 items-center gap-1 p-1 rounded-xl bg-[color:var(--surface)] border border-[color:var(--line)]">
          <button
            type="button"
            onClick={() => setCameraView('front')}
            aria-pressed={activeView === 'front'}
            title="Front View"
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'front'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)]'
            }`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => setCameraView('back')}
            aria-pressed={activeView === 'back'}
            title="Back View"
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'back'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)]'
            }`}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setCameraView('side-left')}
            aria-pressed={activeView === 'side-left'}
            title="Left Profile"
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'side-left'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)]'
            }`}
          >
            L-Side
          </button>
          <button
            type="button"
            onClick={() => setCameraView('side-right')}
            aria-pressed={activeView === 'side-right'}
            title="Right Profile"
            className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'side-right'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)]'
            }`}
          >
            R-Side
          </button>
          <button
            type="button"
            onClick={() => setCameraView('reset')}
            aria-label="Reset camera and rotation"
            title="Reset Camera & Rotation"
            className="p-1.5 text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)] rounded-lg transition-colors ml-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-[color:var(--line)] mx-1" />

          <button
            type="button"
            onClick={toggleSkin}
            aria-pressed={showSkin}
            disabled={skinStatus === 'loading'}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
              showSkin
                ? 'bg-[color:var(--role-color)] text-slate-950'
                : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:bg-[color:var(--soft)]'
            }`}
          >
            {skinStatus === 'loading' ? 'Loading skin…' : 'Skin'}
          </button>

          <button
            type="button"
            onClick={() => setShowSkeleton(!showSkeleton)}
            aria-label="Show skeleton"
            aria-pressed={showSkeleton}
            title={showSkeleton ? 'Hide Skeletal Framework' : 'Show Skeletal Framework'}
            className={`p-1.5 rounded-lg transition-colors ${
              showSkeleton ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40' : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
            }`}
          >
            {showSkeleton ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </fieldset>

        {/* Floating Hover HUD - Live Anatomical Muscle Details */}
        {hoveredInfo && (
          <div className="pointer-events-none absolute top-20 left-4 z-10 max-w-xs animate-fadeIn">
            <div className="p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-red-500/40 text-white shadow-2xl">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 mb-0.5">
                <Sparkles className="w-3 h-3" />
                <span>{hoveredInfo.bodyPart}</span>
              </div>
              <h5 className="text-sm font-bold text-white leading-snug">
                {hoveredInfo.name}
              </h5>
              {hoveredInfo.subdivision && (
                <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/50">
                  {hoveredInfo.subdivision}
                </span>
              )}
              <p className="text-[11px] text-slate-400 mt-1.5">
                Click to zoom into this muscle
              </p>
            </div>
          </div>
        )}

        {/* Selected Muscle Indicator - Bottom Left */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300 shadow-lg flex items-center gap-2">
            <span className="font-semibold text-white">Active Muscle:</span>
            {currentSelectedPart ? (
              <span className="px-2.5 py-0.5 rounded-md bg-red-500 text-white text-xs font-bold shadow-sm">
                {selectedMuscleDetails?.displayName ?? currentSelectedPart}
              </span>
            ) : (
              <span className="text-slate-400 italic">None selected</span>
            )}
          </div>
        </div>

        {/* 360 Rotation & Zoom Tip - Bottom Right */}
        <div className="absolute bottom-4 right-4 z-10 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-400">
          <Compass className="w-3.5 h-3.5 text-slate-400" />
          <span>Drag to rotate • Two-finger pinch to zoom</span>
        </div>
      </div>
    </div>
  );
};
