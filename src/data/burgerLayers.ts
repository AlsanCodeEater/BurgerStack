import * as THREE from 'three';

export type LayerName = 
  | 'BunBottom'
  | 'Lettuce'
  | 'PattyBottom'
  | 'MeltedCheese'
  | 'PattyTop'
  | 'PattyCheeseTop'
  | 'SauceGroup'
  | 'TomatoGroup'
  | 'PickleGroup'
  | 'OnionGroup'
  | 'BunTop';

export type BurgerLayer = {
  key: LayerName;
  objectName: string;
  title: string;
  description: string;
  align: 'left' | 'right';
  index: number;
  explosionDir: { x: number, y: number };
  getAnchor?: (target: THREE.Object3D) => THREE.Vector3;
  buildStart: number;
  buildEnd: number;
  lineStart: number;
  textStart: number;
};

export const STORY_PHASES = {
  HERO_END: 0.10,
  CENTERING_END: 0.18,
  CENTER_HOLD_END: 0.24,
  EXPLOSION_START: 0.24,
  EXPLOSION_END: 0.40,
  CROSSOVER_END: 0.43,
  REBUILD_START: 0.43,
  REBUILD_END: 0.88,
  FINAL_SETTLE_END: 0.94,
  LABELS_END: 1.00
};

const generateLayerTimings = (index: number, total: number) => {
    // Rebuild duration 0.43 to 0.88
    const rebuildDuration = STORY_PHASES.REBUILD_END - STORY_PHASES.REBUILD_START;
    const startOffset = STORY_PHASES.REBUILD_START;
    
    // Each layer takes some time to build
    const buildDuration = 0.10; // overlap
    const step = (rebuildDuration - buildDuration) / (total - 1);
    
    const buildStart = startOffset + index * step;
    const buildEnd = buildStart + buildDuration;
    
    // "reaches approximately 80-90% settled state" -> buildT = 0.85
    const settleTime = buildStart + buildDuration * 0.85;
    
    const lineStart = settleTime;
    const textStart = lineStart + 0.015;

    return { buildStart, buildEnd, lineStart, textStart };
};

export const BURGER_LAYERS: BurgerLayer[] = [
  { 
    key: 'BunBottom', 
    objectName: 'BunBottom', 
    align: 'left', 
    index: 0, 
    explosionDir: { x: -0.2, y: -0.8 }, 
    title: 'BOTTOM BRIOCHE', 
    description: 'Butter toasted · fresh cut',
    getAnchor: (target) => {
      const box = new THREE.Box3().setFromObject(target);
      const size = new THREE.Vector3();
      box.getSize(size);
      return new THREE.Vector3(
        box.min.x + size.x * 0.18,
        box.min.y + size.y * 0.78,
        box.min.z + size.z * 0.55
      );
    },
    ...generateLayerTimings(0, 11)
  },
  { key: 'Lettuce', objectName: 'Lettuce', align: 'left', index: 1, explosionDir: { x: -0.7, y: -0.6 }, title: 'FRESH LETTUCE', description: 'Crisp · garden fresh', ...generateLayerTimings(1, 11) },
  { key: 'PattyBottom', objectName: 'PattyBottom', align: 'left', index: 2, explosionDir: { x: -0.8, y: -0.3 }, title: 'FLAME-GRILLED BEEF', description: 'Smashed · caramelized crust', ...generateLayerTimings(2, 11) },
  { key: 'MeltedCheese', objectName: 'MeltedCheese', align: 'right', index: 3, explosionDir: { x: 0.8, y: -0.3 }, title: 'MELTED CHEDDAR', description: 'Rich · creamy · perfectly melted', ...generateLayerTimings(3, 11) },
  { key: 'PattyTop', objectName: 'PattyTop', align: 'left', index: 4, explosionDir: { x: -0.8, y: 0.1 }, title: 'SECOND SMASH', description: 'Double beef · flame grilled', ...generateLayerTimings(4, 11) },
  { key: 'PattyCheeseTop', objectName: 'PattyCheeseTop', align: 'right', index: 5, explosionDir: { x: 0.8, y: 0.1 }, title: 'PEPPER JACK', description: 'Rich · creamy · slight kick', ...generateLayerTimings(5, 11) },
  { key: 'SauceGroup', objectName: 'SauceGroup', align: 'left', index: 6, explosionDir: { x: -0.8, y: 0.4 }, title: 'HOUSE FIRE SAUCE', description: 'Smoky · creamy · slight heat', ...generateLayerTimings(6, 11) },
  { key: 'TomatoGroup', objectName: 'TomatoGroup', align: 'right', index: 7, explosionDir: { x: 0.8, y: 0.5 }, title: 'FRESH TOMATO', description: 'Juicy · vine ripened', ...generateLayerTimings(7, 11) },
  { key: 'PickleGroup', objectName: 'PickleGroup', align: 'left', index: 8, explosionDir: { x: -0.7, y: 0.7 }, title: 'HOUSE PICKLES', description: 'Tangy · crisp · fresh crunch', ...generateLayerTimings(8, 11) },
  { key: 'OnionGroup', objectName: 'OnionGroup', align: 'right', index: 9, explosionDir: { x: 0.7, y: 0.8 }, title: 'RED ONION', description: 'Sharp · fresh · paper thin', ...generateLayerTimings(9, 11) },
  { key: 'BunTop', objectName: 'BunTop', align: 'right', index: 10, explosionDir: { x: 0.3, y: 1.0 }, title: 'BRIOCHE CROWN', description: 'Butter toasted · sesame baked', ...generateLayerTimings(10, 11) }
];
