import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
  Sparkles
} from 'lucide-react';

export const GymFit3DAnatomyViewer = ({
  selectedMuscles = ['Biceps'],
  selectedSubdivision = null,
  onToggleMuscle = () => {},
  hoveredMuscle = null,
  onHoverMuscle = () => {}
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Three.js internal references
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  // Mesh & grouping storage
  const muscleMeshesRef = useRef([]);
  const groupMeshMapRef = useRef({});
  const skeletonGroupRef = useRef(null);
  const bodyGroupRef = useRef(null);

  // Interaction refs
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredGroupRef = useRef(null);
  const pointerDownRef = useRef({ time: 0, x: 0, y: 0 });

  // Camera framing refs
  const optimalDistRef = useRef(42);
  const modelCenterRef = useRef(new THREE.Vector3(0, 0, 0));

  // Component UI State
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [activeView, setActiveView] = useState('front');

  // Single active body part
  const currentSelectedPart = Array.isArray(selectedMuscles)
    ? selectedMuscles[0]
    : selectedMuscles;

  // 1. Highlight updater for single muscle and sub-head focus
  const updateMeshHighlights = useCallback(() => {
    const meshes = muscleMeshesRef.current;
    if (!meshes || meshes.length === 0) return;

    const selectedNorm = currentSelectedPart?.toLowerCase();
    const hoveredNorm = (hoveredMuscle || hoveredGroupRef.current)?.toLowerCase();

    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      const bp = mesh.userData.bodyPart;
      const sub = mesh.userData.subdivision;
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

      const isSubSelected =
        selectedSubdivision &&
        (sub === selectedSubdivision || (mesh.userData.displayName && mesh.userData.displayName.includes(selectedSubdivision)));

      const isHovered =
        Boolean(hoveredNorm) &&
        !isPartSelected &&
        (bpNorm === hoveredNorm ||
          legacyNorm === hoveredNorm ||
          (['abs', 'box'].includes(hoveredNorm) && ['abs', 'box'].includes(bpNorm)) ||
          (['oblique', 'obliques', 'oblicque'].includes(hoveredNorm) && ['oblique', 'obliques'].includes(bpNorm)));

      if (isPartSelected) {
        if (selectedSubdivision) {
          if (isSubSelected) {
            mesh.material = selectedSubdivisionMaterial;
          } else {
            mesh.material = selectedGroupSubtleMaterial;
          }
        } else {
          mesh.material = selectedRedMaterial;
        }
      } else if (isHovered) {
        mesh.material = hoverMaterial;
      } else {
        mesh.material = mesh.userData.originalMaterial || defaultMuscleMaterial;
      }
    }
  }, [currentSelectedPart, selectedSubdivision, hoveredMuscle]);

  useEffect(() => {
    updateMeshHighlights();
  }, [updateMeshHighlights]);

  // 2. Camera Preset Transitions
  const setCameraView = (viewType) => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

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

  const animateCamera = (toPos, toTarget, durationMs = 650) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      camera.position.lerpVectors(startPos, toPos, ease);
      controls.target.lerpVectors(startTarget, toTarget, ease);
      controls.update();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  // 3. Mount Three.js Scene and Load 3D Model
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width || container.clientWidth, 320);
    const height = Math.max(rect.height || container.clientHeight, 480);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

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

    // ───────────── Load 3D Anatomy Model ─────────────
    load3DAnatomyModel((pct) => {
      if (isMounted) setLoadProgress(pct);
    })
      .then(({ bodyGroup, muscleMeshes, skeletonGroup, groupMeshMap, bodyBox, bodyCenter, bodySize }) => {
        if (!isMounted) return;

        // 1. Center the model at origin (0, 0, 0)
        bodyGroup.position.set(-bodyCenter.x, -bodyCenter.y, -bodyCenter.z);
        scene.add(bodyGroup);

        bodyGroupRef.current = bodyGroup;
        muscleMeshesRef.current = muscleMeshes;
        skeletonGroupRef.current = skeletonGroup;
        groupMeshMapRef.current = groupMeshMap;

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

        // 4. Ground Shadow Plane & Grid at feet
        const feetY = worldBox.min.y - 0.15;
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(60, 60),
          new THREE.ShadowMaterial({ opacity: 0.22 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(worldCenter.x, feetY, worldCenter.z);
        ground.receiveShadow = true;
        scene.add(ground);

        const grid = new THREE.GridHelper(50, 25, 0x334155, 0x1e293b);
        grid.position.set(worldCenter.x, feetY, worldCenter.z);
        scene.add(grid);

        setLoading(false);
        updateMeshHighlights();
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
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      isMounted = false;
      resizeObserver.disconnect();
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      renderer.dispose();
    };
  }, []);

  // 4. Toggle Skeleton visibility
  useEffect(() => {
    if (skeletonGroupRef.current) {
      skeletonGroupRef.current.visible = showSkeleton;
    }
  }, [showSkeleton]);

  // 5. Raycasting for Single Muscle Selection
  const handlePointerDown = (e) => {
    pointerDownRef.current = {
      time: performance.now(),
      x: e.clientX,
      y: e.clientY
    };
  };

  const handlePointerUp = (e) => {
    const dt = performance.now() - pointerDownRef.current.time;
    const dist = Math.hypot(e.clientX - pointerDownRef.current.x, e.clientY - pointerDownRef.current.y);
    // If it was a quick click and not a camera rotation drag (< 400ms and < 6px movement)
    if (dt < 400 && dist < 6) {
      processRaycastClick(e.clientX, e.clientY);
    }
  };

  const processRaycastClick = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const meshes = muscleMeshesRef.current;
    if (!canvas || !camera || meshes.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    // Filter only visible interactive meshes (skipping Other, non-muscle membranes)
    const visibleInteractiveMeshes = meshes.filter((m) => {
      const bp = m.userData.bodyPart || m.userData.gymFitGroup;
      return m.visible && bp && bp !== 'Other';
    });
    const intersects = raycasterRef.current.intersectObjects(visibleInteractiveMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const bodyPart = hit.userData.bodyPart || hit.userData.gymFitGroup;
      if (bodyPart && bodyPart !== 'Other') {
        onToggleMuscle(bodyPart, hit.userData);
      }
    }
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const meshes = muscleMeshesRef.current;
    if (!canvas || !camera || meshes.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    const visibleInteractiveMeshes = meshes.filter((m) => {
      const bp = m.userData.bodyPart || m.userData.gymFitGroup;
      return m.visible && bp && bp !== 'Other';
    });
    const intersects = raycasterRef.current.intersectObjects(visibleInteractiveMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const bodyPart = hit.userData.bodyPart || hit.userData.gymFitGroup;
      if (bodyPart && bodyPart !== 'Other') {
        canvas.style.cursor = 'pointer';
        hoveredGroupRef.current = bodyPart;
        setHoveredInfo({
          name: hit.userData.displayName,
          bodyPart: bodyPart,
          subdivision: hit.userData.subdivision
        });
        onHoverMuscle(bodyPart);
        updateMeshHighlights();
        return;
      }
    }

    canvas.style.cursor = 'default';
    if (hoveredGroupRef.current !== null) {
      hoveredGroupRef.current = null;
      setHoveredInfo(null);
      onHoverMuscle(null);
      updateMeshHighlights();
    }
  };

  const handleClick = (e) => {
    processRaycastClick(e.clientX, e.clientY);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[680px] sm:h-[760px] lg:h-[800px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-black select-none shadow-2xl"
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        className="w-full h-full block focus:outline-none touch-none"
      />

      {/* Loading Overlay */}
      {loading && !loadError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full border-4 border-red-500/30 border-t-red-500 animate-spin mb-4" />
          <p className="text-sm font-bold text-white tracking-wide">
            Loading Real 3D Muscular Anatomy...
          </p>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            467 MRI-based muscle meshes ({loadProgress}%)
          </p>
          <div className="w-52 h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-200"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {loadError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">
            Failed to Load 3D Model
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Viewer
          </button>
        </div>
      )}

      {/* Top Header Badge */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-white text-xs font-semibold shadow-lg">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>3D Anatomical Body</span>
          <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-800">
            Single Muscle Focus
          </span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium pl-1 drop-shadow">
          Click any muscle to isolate it and inspect its anatomical subdivisions
        </p>
      </div>

      {/* Top Right Camera Preset View Controls & Skeleton Toggle */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 p-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-lg">
        <button
          type="button"
          onClick={() => setCameraView('front')}
          title="Front View"
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
            activeView === 'front'
              ? 'bg-red-500 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          Front
        </button>
        <button
          type="button"
          onClick={() => setCameraView('back')}
          title="Back View"
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
            activeView === 'back'
              ? 'bg-red-500 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setCameraView('side-left')}
          title="Left Profile"
          className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
            activeView === 'side-left'
              ? 'bg-red-500 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          L-Side
        </button>
        <button
          type="button"
          onClick={() => setCameraView('side-right')}
          title="Right Profile"
          className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
            activeView === 'side-right'
              ? 'bg-red-500 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          R-Side
        </button>
        <button
          type="button"
          onClick={() => setCameraView('reset')}
          title="Reset Camera & Rotation"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors ml-0.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-slate-700/60 mx-1" />

        <button
          type="button"
          onClick={() => setShowSkeleton(!showSkeleton)}
          title={showSkeleton ? 'Hide Skeletal Framework' : 'Show Skeletal Framework'}
          className={`p-1.5 rounded-lg transition-colors ${
            showSkeleton ? 'text-amber-400 bg-amber-950/40' : 'text-slate-400 hover:text-white'
          }`}
        >
          {showSkeleton ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Floating Hover HUD - Live Anatomical Muscle Details */}
      {hoveredInfo && (
        <div className="absolute top-20 left-4 z-10 max-w-xs animate-fadeIn">
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
              Click to select this body part & view anatomical subdivisions
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
              {currentSelectedPart}
              {selectedSubdivision ? ` • ${selectedSubdivision}` : ''}
            </span>
          ) : (
            <span className="text-slate-400 italic">None selected</span>
          )}
        </div>
      </div>

      {/* 360 Rotation & Zoom Tip - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-400">
        <Compass className="w-3.5 h-3.5 text-slate-400" />
        <span>Drag to rotate 360° • Scroll to zoom</span>
      </div>
    </div>
  );
};
