import React, { forwardRef, useImperativeHandle, useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { BURGER_LAYERS, BurgerLayer, LayerName, STORY_PHASES, getLayerSegment } from '../../data/burgerLayers';
import { getResponsiveScale, getExplosionMultiplier, screenYToWorldY, calculateCameraDistanceToFit } from '../../utils/responsiveConfig';

const MODEL_PATH = '/models/burger-final.glb';
const MODEL_POSITION: [number, number, number] = [0, -0.5, 0];
const MODEL_ROTATION: [number, number, number] = [0, 0, 0];

export interface GLBBurgerModelRef {
  presentationGroup: THREE.Group | null;
  setScrollProgress: (p: number) => void;
  getSnapshot: () => any;
}

interface GLBBurgerModelProps {
  enableIdleAnimation?: boolean;
  scale?: number;
  position?: [number, number, number];
  url?: string;
  activeLayer?: LayerName | null;
  mode?: 'story' | 'configurator';
  onPositionsUpdate?: (positions: Record<string, {x: number, y: number, r: number}>, progress: number) => void;
  onResolvedLayers?: (layers: BurgerLayer[]) => void;
}

function rangeProgress(progress: number, start: number, end: number) {
  return THREE.MathUtils.clamp((progress - start) / (end - start), 0, 1);
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export const GLBBurgerModel = forwardRef<GLBBurgerModelRef, GLBBurgerModelProps>(
  ({ enableIdleAnimation = true, position, scale = 1, url = '/models/burger-final.glb', activeLayer = null, mode = 'story', onPositionsUpdate, onResolvedLayers }, ref) => {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
    const presentationRef = useRef<THREE.Group>(null);
    const floatingRef = useRef<THREE.Group>(null);
    const centeringRef = useRef<THREE.Group>(null);
    const scrollProgressRef = useRef(0);
    const { size, viewport, camera, gl } = useThree();
    
    const canvasWidth = size.width;
    const canvasHeight = size.height;

    const isMobile = canvasWidth < 768;
    const isTablet = canvasWidth >= 768 && canvasWidth < 1024;
    const isDesktop = canvasWidth >= 1024;

    const config = isMobile
      ? { scale: 0.975, cameraZ: 14 }
      : isTablet
      ? { scale: 1.275, cameraZ: 13 }
      : { scale: 1.5, cameraZ: 12 };

    const baseScale = config.scale;

    const originalTransforms = useRef(new Map<string, { position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3 }>());
    const resolvedNodes = useRef(new Map<string, THREE.Object3D>());
    const groupCenters = useRef(new Map<string, THREE.Vector3>());
    const groupRadii = useRef(new Map<string, number>());
    const animationTargets = useRef(new Map<string, { explosionExit: THREE.Vector3, hiddenAbove: THREE.Vector3 }>());

    useEffect(() => {
      console.log('[GLBBurgerModel] Traversing GLB to verify contents...');
      let meshCount = 0;
      clonedScene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) meshCount++;
      });
      console.log(`[GLBBurgerModel] Meshes found: ${meshCount}`);

      clonedScene.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(clonedScene);
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        console.log('[GLBBurgerModel] Assembled Box Center:', center);
        console.log('[GLBBurgerModel] Assembled Box Size:', size);
        
        if (centeringRef.current) {
          centeringRef.current.position.set(-center.x, -center.y, -center.z);
        }
      } else {
        console.warn('[GLBBurgerModel] WARNING: Bounding box is empty!');
      }
      
      const resolvedList: BurgerLayer[] = [];

      BURGER_LAYERS.forEach(layer => {
        // Find the exact object by name per user rule
        const matchedObj = clonedScene.getObjectByName(layer.objectName);
        
        if (matchedObj) {
          resolvedNodes.current.set(layer.key, matchedObj);
          resolvedList.push(layer);
          
          const objBox = new THREE.Box3().setFromObject(matchedObj);
          const objCenter = objBox.getCenter(new THREE.Vector3());
          const objSize = objBox.getSize(new THREE.Vector3());
          const approxRadius = Math.max(objSize.x, objSize.z) * 0.5;

          matchedObj.worldToLocal(objCenter);
          groupCenters.current.set(layer.key, objCenter);
          groupRadii.current.set(layer.key, approxRadius);

          originalTransforms.current.set(layer.key, {
            position: matchedObj.position.clone(),
            quaternion: matchedObj.quaternion.clone(),
            scale: matchedObj.scale.clone(),
          });
        } else {
          console.warn(`[GLBBurgerModel] Missing GLB target: ${layer.objectName}`);
        }
      });
      
      console.log(`[burger labels] configured: ${BURGER_LAYERS.length} resolved: ${resolvedList.length}`);
      
      if (onResolvedLayers) {
        onResolvedLayers(resolvedList);
      }
      
      const assembledBox = box.isEmpty() ? new THREE.Box3(new THREE.Vector3(-1,-1,-1), new THREE.Vector3(1,1,1)) : box;
      const size = assembledBox.getSize(new THREE.Vector3());
      const currentModelUnitY = size.y;
      
      const distanceToCamera = config.cameraZ; // Approximate
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const visibleHeight = 2 * Math.tan(vFov / 2) * distanceToCamera;
      const visibleWidth = visibleHeight * viewport.aspect;
      
      resolvedNodes.current.forEach((obj, key) => {
        const orig = originalTransforms.current.get(key);
        const layerConfig = BURGER_LAYERS.find(l => l.key === key);
        if (orig && layerConfig) {
          const explosionExit = orig.position.clone();
          
          const maxDistX = visibleWidth * 0.35;
          const maxDistY = visibleHeight * 0.25;

          explosionExit.x += layerConfig.explosionDir.x * maxDistX;
          explosionExit.y += layerConfig.explosionDir.y * maxDistY;
          
          const hiddenAbove = orig.position.clone();
          hiddenAbove.y += Math.min(size.y * 1.5, visibleHeight * 0.4);
          
          animationTargets.current.set(key, { explosionExit, hiddenAbove });
          obj.position.copy(orig.position);
          obj.quaternion.copy(orig.quaternion);
          obj.scale.copy(orig.scale);
        }
      });
    }, [clonedScene, viewport.width, viewport.height, isMobile, onResolvedLayers, camera.fov, config.cameraZ, viewport.aspect]);

    useFrame((state) => {
      let targetScreenYPct = 0.5; // Default center
      let currentCameraZ = config.cameraZ;
      
      if (mode === 'configurator') {
        targetScreenYPct = 0.55;
        // In configurator, we'd calculate to fit, but we'll let the user provide a general distance or use the fit logic.
        const box = new THREE.Box3().setFromObject(clonedScene);
        if (!box.isEmpty()) {
            currentCameraZ = calculateCameraDistanceToFit(box.getSize(new THREE.Vector3()), camera.fov, viewport.aspect);
        }
      } else {
        const p = scrollProgressRef.current;
        if (p < 0.05) {
          targetScreenYPct = 0.315;
        } else if (p >= 0.05 && p < 0.10) {
          const ease = (p - 0.05) / 0.05;
          targetScreenYPct = THREE.MathUtils.lerp(0.315, 0.5, easeInOutQuad(ease));
        } else {
          targetScreenYPct = 0.5;
        }
      }

      state.camera.position.z = currentCameraZ;
      
      if (presentationRef.current) {
        const targetWorldY = screenYToWorldY(targetScreenYPct * canvasHeight, canvasHeight, state.camera.position.z, state.camera.fov);
        presentationRef.current.position.y = targetWorldY;
      }

      const progress = scrollProgressRef.current;
      
      resolvedNodes.current.forEach((obj, key) => {
        const original = originalTransforms.current.get(key);
        const targets = animationTargets.current.get(key);
        const config = BURGER_LAYERS.find(l => l.key === key);
        
        if (original && targets && config) {
          let targetPos = new THREE.Vector3();
          
          let yOffset = 0;
          if (activeLayer) {
             const activeConfig = BURGER_LAYERS.find(l => l.key === activeLayer);
             if (activeConfig) {
               if (config.index > activeConfig.index) yOffset = 0.8;
               if (config.index < activeConfig.index) yOffset = -0.8;
               if (config.key === activeLayer) {
                 yOffset = 0.1; 
                 // We could rotate here as well
               }
             }
          }

          if (mode === 'configurator') {
            targetPos.copy(original.position);
          } else if (progress <= STORY_PHASES.EXPLOSION_START) {
            targetPos.copy(original.position);
          }
          else if (progress > STORY_PHASES.EXPLOSION_START && progress <= STORY_PHASES.EXPLOSION_END) {
            const expP = rangeProgress(progress, STORY_PHASES.EXPLOSION_START, STORY_PHASES.EXPLOSION_END);
            const ease = easeInOutQuad(expP);
            targetPos.lerpVectors(original.position, targets.explosionExit, ease);
          }
          else if (progress > STORY_PHASES.EXPLOSION_END && progress <= STORY_PHASES.SHOWCASE_START) {
            const expP = rangeProgress(progress, STORY_PHASES.EXPLOSION_END, STORY_PHASES.SHOWCASE_START);
            const ease = easeInOutQuad(expP);
            targetPos.lerpVectors(targets.explosionExit, targets.hiddenAbove, ease);
          }
          else if (progress > STORY_PHASES.SHOWCASE_START) {
            const { start: segStart, end: segEnd } = getLayerSegment(config.index);
            if (progress <= segStart) {
              targetPos.copy(targets.hiddenAbove);
            }
            else if (progress > segStart && progress <= segEnd) {
              const segP = rangeProgress(progress, segStart, segEnd);
              if (segP <= 0.10) {
                targetPos.copy(targets.hiddenAbove);
              } else if (segP <= 0.70) {
                const p = easeInOutQuad(rangeProgress(segP, 0.10, 0.70));
                targetPos.lerpVectors(targets.hiddenAbove, original.position, p);
              } else {
                targetPos.copy(original.position);
              }
            }
            else {
              targetPos.copy(original.position);
            }
          }
          
          if (activeLayer && progress > STORY_PHASES.SHOWCASE_END) {
            targetPos.y += yOffset;
          }

          obj.position.copy(targetPos);
          if (activeLayer === config.key && progress > STORY_PHASES.SHOWCASE_END) {
             const time = state.clock.getElapsedTime();
             obj.rotation.y = time * 0.5;
          } else {
             obj.quaternion.copy(original.quaternion);
          }
        }
      });

      if (presentationRef.current) {
        let currentScale = 1;
        if (mode !== 'configurator' && progress > STORY_PHASES.SHOWCASE_END) {
          const settleP = rangeProgress(progress, STORY_PHASES.SHOWCASE_END, 1.0);
          if (settleP < 0.3) {
            const bounceP = settleP / 0.3;
            currentScale = 1 + 0.01 * easeInOutQuad(bounceP);
          } else if (settleP < 0.6) {
            const bounceP = (settleP - 0.3) / 0.3;
            currentScale = 1.01 - 0.01 * easeInOutQuad(bounceP);
          }
        }
        
        presentationRef.current.scale.set(
          baseScale * scale * currentScale, 
          baseScale * scale * currentScale, 
          baseScale * scale * currentScale
        );
        
        let idleFactor = 1.0;
        if (mode === 'configurator') {
          idleFactor = 1.0;
        } else if (progress <= STORY_PHASES.EXPLOSION_START) {
          idleFactor = 1.0;
        } else if (progress > STORY_PHASES.EXPLOSION_START && progress <= STORY_PHASES.SHOWCASE_START) {
          idleFactor = 0.15;
        } else if (progress > STORY_PHASES.SHOWCASE_START && progress <= STORY_PHASES.SHOWCASE_END) {
          idleFactor = 0.25;
        } else if (progress > STORY_PHASES.SHOWCASE_END) {
          idleFactor = 0.25 + 0.75 * easeInOutQuad(rangeProgress(progress, STORY_PHASES.SHOWCASE_END, 0.96));
        }

        if (enableIdleAnimation && typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          // Temporarily disabled for deterministic testing
          if (floatingRef.current) floatingRef.current.position.y = 0;
          presentationRef.current.rotation.set(...MODEL_ROTATION);
        } else {
          if (floatingRef.current) floatingRef.current.position.y = 0;
          presentationRef.current.rotation.set(...MODEL_ROTATION);
        }
      }

      if (onPositionsUpdate && presentationRef.current) {
        presentationRef.current.updateMatrixWorld(true);
        const rect = gl.domElement.getBoundingClientRect();

        const positions: Record<string, {x: number, y: number, r: number}> = {};
        resolvedNodes.current.forEach((obj, key) => {
          const localCenter = groupCenters.current.get(key);
          const r = groupRadii.current.get(key) || 1;
          const config = BURGER_LAYERS.find(l => l.key === key);
          let worldPos: THREE.Vector3 | null = null;
          
          if (config && config.getAnchor) {
            worldPos = config.getAnchor(obj);
          } else if (localCenter) {
            worldPos = localCenter.clone();
            worldPos.applyMatrix4(obj.matrixWorld);
          }
          
          if (worldPos) {
            const ptRight = worldPos.clone().add(new THREE.Vector3(r, 0, 0));
            worldPos.project(state.camera);
            ptRight.project(state.camera);
            // Only emit points that are in front of the camera and generally within viewport bounds
            if (worldPos.z < 1 && Math.abs(worldPos.x) <= 1.5 && Math.abs(worldPos.y) <= 1.5) {
              const sx = (worldPos.x * 0.5 + 0.5) * rect.width;
              const sy = (-worldPos.y * 0.5 + 0.5) * rect.height;
              const sxr = (ptRight.x * 0.5 + 0.5) * rect.width;
              const screenRadius = Math.abs(sxr - sx);

              if (Number.isFinite(sx) && Number.isFinite(sy)) {
                positions[key] = { x: sx, y: sy, r: screenRadius };
              }
            }
          }
        });
        onPositionsUpdate(positions, progress);
      }
    });

    useImperativeHandle(ref, () => ({
      get presentationGroup() { return presentationRef.current; },
      setScrollProgress: (p: number) => {
        scrollProgressRef.current = p;
      },
      getSnapshot: () => {
        const layersSnapshot: Record<string, any> = {};
        resolvedNodes.current.forEach((obj, key) => {
          layersSnapshot[key] = {
            position: obj.position.clone(),
            quaternion: obj.quaternion.clone(),
            scale: obj.scale.clone(),
            visible: obj.visible
          };
        });
        return layersSnapshot;
      }
    }));

    return (
      <group
        ref={presentationRef}
        position={position ?? [0, 0, 0]}
        rotation={MODEL_ROTATION}
        scale={[baseScale * scale, baseScale * scale, baseScale * scale]}
      >
        <group ref={floatingRef}>
          <group ref={centeringRef}>
            <primitive object={clonedScene} />
          </group>
        </group>
        <ContactShadows position={[0, -1.8, 0]} opacity={0.7} scale={10} blur={2.5} far={4} resolution={1024} color="#2d1306" />
      </group>
    );
  }
);

GLBBurgerModel.displayName = 'GLBBurgerModel';
useGLTF.preload(MODEL_PATH);
