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
};

export const BURGER_LAYERS: BurgerLayer[] = [
  { 
    key: 'BunBottom', 
    objectName: 'BunBottom', 
    align: 'left', 
    index: 0, 
    explosionDir: { x: -0.55, y: -1.2 }, 
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
    }
  },
  { key: 'Lettuce', objectName: 'Lettuce', align: 'left', index: 1, explosionDir: { x: -0.8, y: -1.05 }, title: 'FRESH LETTUCE', description: 'Crisp · garden fresh' },
  { key: 'PattyBottom', objectName: 'PattyBottom', align: 'left', index: 2, explosionDir: { x: -0.8, y: -0.75 }, title: 'FLAME-GRILLED BEEF', description: 'Smashed · caramelized crust' },
  { key: 'MeltedCheese', objectName: 'MeltedCheese', align: 'right', index: 3, explosionDir: { x: 0.75, y: -0.6 }, title: 'MELTED CHEDDAR', description: 'Rich · creamy · perfectly melted' },
  { key: 'PattyTop', objectName: 'PattyTop', align: 'left', index: 4, explosionDir: { x: -0.8, y: -0.5 }, title: 'SECOND SMASH', description: 'Double beef · flame grilled' },
  { key: 'PattyCheeseTop', objectName: 'PattyCheeseTop', align: 'right', index: 5, explosionDir: { x: 0.75, y: -0.3 }, title: 'PEPPER JACK', description: 'Rich · creamy · slight kick' },
  { key: 'SauceGroup', objectName: 'SauceGroup', align: 'left', index: 6, explosionDir: { x: -0.85, y: -0.15 }, title: 'HOUSE FIRE SAUCE', description: 'Smoky · creamy · slight heat' },
  { key: 'TomatoGroup', objectName: 'TomatoGroup', align: 'right', index: 7, explosionDir: { x: 0.9, y: 0.05 }, title: 'FRESH TOMATO', description: 'Juicy · vine ripened' },
  { key: 'PickleGroup', objectName: 'PickleGroup', align: 'left', index: 8, explosionDir: { x: -0.95, y: 0.3 }, title: 'HOUSE PICKLES', description: 'Tangy · crisp · fresh crunch' },
  { key: 'OnionGroup', objectName: 'OnionGroup', align: 'right', index: 9, explosionDir: { x: 0.9, y: 0.65 }, title: 'RED ONION', description: 'Sharp · fresh · paper thin' },
  { key: 'BunTop', objectName: 'BunTop', align: 'right', index: 10, explosionDir: { x: 0.6, y: 1.2 }, title: 'BRIOCHE CROWN', description: 'Butter toasted · sesame baked' }
];

export const STORY_PHASES = {
  HERO_START: 0.00,
  EXPLOSION_START: 0.10,
  EXPLOSION_END: 0.27,
  TRANSITION_END: 0.30,
  SHOWCASE_START: 0.30,
  SHOWCASE_END: 0.92,
  FINAL_END: 1.00
};

export const getLayerSegment = (index: number) => {
  const total = BURGER_LAYERS.length;
  const segmentDuration = (STORY_PHASES.SHOWCASE_END - STORY_PHASES.SHOWCASE_START) / total;
  const start = STORY_PHASES.SHOWCASE_START + index * segmentDuration;
  const end = start + segmentDuration;
  return { start, end };
};
