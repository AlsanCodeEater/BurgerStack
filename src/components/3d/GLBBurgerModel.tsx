import React, { forwardRef, useImperativeHandle, useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { BURGER_LAYERS, BurgerLayer, LayerName, STORY_PHASES, getLayerSegment } from '../../data/burgerLayers';
import { getResponsiveScale, getExplosionMultiplier } from '../../utils/responsiveConfig';

const MODEL_PATH = '/models/burger-final.glb';
const MODEL_POSITION: [number, number, number] = [0, -0.5, 0];
const MODEL_ROTATION: [number, number, number] = [0, 0, 0];

export interface GLBBurgerModelRef {
  presentationGroup: THREE.Group | null;
  setScrollProgress: (p: number) => void;
}

interface GLBBurgerModelProps {
  enableIdleAnimation?: boolean;
  scale?: number;
  position?: [number, number, number];
  url?: string;
  activeLayer?: LayerName | null;
  mode?: 'story' | 'configurator';
  onPositionsUpdate?: (positions: Record<string, {x: number, y: number, r: number}>) => void;
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
    const clonedScene = useMemo(() => scene.clone(), [scene]);
    const presentationRef = useRef<THREE.Group>(null);
    const floatingRef = useRef<THREE.Group>(null);
    const centeringRef = useRef<THREE.Group>(null);
    const scrollProgressRef = useRef(0);
    const { size, viewport, camera, gl } = useThree();
    
    const canvasWidth = size.width;
    const isMobile = canvasWidth < 768;
    const isTablet = canvasWidth >= 768 && canvasWidth < 1024;
    
    // Step 12: Pure outer wrapper scaling for responsiveness
    let presentationScale = 1;
    if (mode !== 'configurator') {
      if (isMobile) presentationScale = 0.65;
      else if (isTablet) presentationScale = 0.85;
    } else {
      if (isMobile) presentationScale = 0.8;
      else if (isTablet) presentationScale = 0.9;
    }

    const config = {
      hero: { scale: 1.5, y: -0.35, cameraZ: 12 },
      story: { scale: 1.5, y: 0, cameraZ: 12 },
      configurator: { scale: 1.5, y: -0.35, cameraZ: 12 }
    };

    const currentMode = mode === 'configurator' ? config.configurator : (scrollProgressRef.current < 0.1 ? config.hero : config.story);
    const baseScale = currentMode.scale;

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
      
      if (onResolvedLayers) {
        onResolvedLayers(resolvedList);
      }
      
      const currentModelUnitY = box.isEmpty() ? 10 : box.getSize(new THREE.Vector3()).y;
      const offscreenDistY = currentModelUnitY * 2.5;
      
      resolvedNodes.current.forEach((obj, key) => {
        const orig = originalTransforms.current.get(key);
        const configLayer = BURGER_LAYERS.find(l => l.key === key);
        if (orig && configLayer) {
          const explosionExit = orig.position.clone();
          // Desktop constants
          explosionExit.x += configLayer.explosionDir.x * viewport.width * 0.35;
          explosionExit.y += configLayer.explosionDir.y * viewport.height * 0.35;
          
          const hiddenAbove = explosionExit.clone();
          hiddenAbove.y += offscreenDistY;
          
          animationTargets.current.set(key, { explosionExit, hiddenAbove });
          obj.position.copy(orig.position);
          obj.quaternion.copy(orig.quaternion);
          obj.scale.copy(orig.scale);
        }
      });
    }, [clonedScene, viewport.width, viewport.height, onResolvedLayers]);

    useFrame((state) => {
      // Determine target configuration based on current progress/mode
      let currentModeConfig = config.story;
      if (mode === 'configurator') {
        currentModeConfig = config.configurator;
      } else {
        const p = scrollProgressRef.current;
        if (p < 0.1) {
          currentModeConfig = config.hero;
        } else if (p >= 0.1 && p < 0.2) {
          const ease = (p - 0.1) / 0.1;
          currentModeConfig = {
            ...config.story,
            y: THREE.MathUtils.lerp(config.hero.y, config.story.y, ease)
          };
        }
      }

      // Smoothly adjust camera Z and PresentationRoot Y per breakpoint/mode
      state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, currentModeConfig.cameraZ, 0.05);
      if (presentationRef.current) {
        presentationRef.current.position.y = THREE.MathUtils.lerp(presentationRef.current.position.y, currentModeConfig.y, 0.1);
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

          if (progress <= STORY_PHASES.EXPLOSION_START) {
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

          if ((window as any).__BURGER_DEBUG__?.isInstant) {
            obj.position.copy(targetPos);
            if (activeLayer === config.key && progress > STORY_PHASES.SHOWCASE_END) {
              const time = state.clock.getElapsedTime();
              obj.rotation.y = time * 0.5;
            } else {
              obj.quaternion.copy(original.quaternion);
            }
          } else {
            obj.position.lerp(targetPos, 0.12);
            if (activeLayer === config.key && progress > STORY_PHASES.SHOWCASE_END) {
               const time = state.clock.getElapsedTime();
               obj.rotation.y = time * 0.5;
            } else {
               obj.quaternion.slerp(original.quaternion, 0.12);
            }
          }
        }
      });

      if (presentationRef.current) {
        let currentScale = 1;
        if (progress > STORY_PHASES.SHOWCASE_END) {
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
        if (progress <= STORY_PHASES.EXPLOSION_START) {
          idleFactor = 1.0;
        } else if (progress > STORY_PHASES.EXPLOSION_START && progress <= STORY_PHASES.SHOWCASE_START) {
          idleFactor = 0.15;
        } else if (progress > STORY_PHASES.SHOWCASE_START && progress <= STORY_PHASES.SHOWCASE_END) {
          idleFactor = 0.25;
        } else if (progress > STORY_PHASES.SHOWCASE_END) {
          idleFactor = 0.25 + 0.75 * easeInOutQuad(rangeProgress(progress, STORY_PHASES.SHOWCASE_END, 0.96));
        }

        if (enableIdleAnimation && typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const t = state.clock.getElapsedTime();
          let targetRotY = MODEL_ROTATION[1] + Math.sin(t * 0.4) * 0.03 * idleFactor;
          let targetRotZ = MODEL_ROTATION[2] + Math.cos(t * 0.5) * 0.01 * idleFactor;
          let targetRotX = MODEL_ROTATION[0];

          if (floatingRef.current) {
            floatingRef.current.position.y = Math.sin(t * 0.6) * 0.1 * idleFactor;
          }
          presentationRef.current.rotation.y = THREE.MathUtils.lerp(presentationRef.current.rotation.y, targetRotY, 0.06);
          presentationRef.current.rotation.x = THREE.MathUtils.lerp(presentationRef.current.rotation.x, targetRotX, 0.06);
          presentationRef.current.rotation.z = THREE.MathUtils.lerp(presentationRef.current.rotation.z, targetRotZ, 0.06);
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
        onPositionsUpdate(positions);
      }
    });

    useImperativeHandle(ref, () => ({
      get presentationGroup() { return presentationRef.current; },
      setScrollProgress: (p: number) => {
        scrollProgressRef.current = p;
      }
    }));

    return (
      <group
        ref={presentationRef}
        position={position ?? [0, 0, 0]}
        rotation={MODEL_ROTATION}
        scale={presentationScale * baseScale * scale}
      >
        <group ref={floatingRef}>
          <group ref={centeringRef}>
            <primitive object={clonedScene} />
          </group>
        </group>
      </group>
    );
  }
);

GLBBurgerModel.displayName = 'GLBBurgerModel';
useGLTF.preload(MODEL_PATH);
