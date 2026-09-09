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
    }
  },
  { key: 'PattyBottom', objectName: 'PattyBottom', align: 'left', index: 1, explosionDir: { x: -0.8, y: -0.3 }, title: 'FLAME-GRILLED BEEF', description: 'Smashed · caramelized crust' },
  { key: 'Lettuce', objectName: 'Lettuce', align: 'left', index: 2, explosionDir: { x: -0.7, y: -0.6 }, title: 'FRESH LETTUCE', description: 'Crisp · garden fresh' },
  { key: 'MeltedCheese', objectName: 'MeltedCheese', align: 'right', index: 3, explosionDir: { x: 0.8, y: -0.3 }, title: 'MELTED CHEDDAR', description: 'Rich · creamy · perfectly melted' },
  { key: 'TomatoGroup', objectName: 'TomatoGroup', align: 'right', index: 4, explosionDir: { x: 0.8, y: 0.5 }, title: 'FRESH TOMATO', description: 'Juicy · vine ripened' },
  { key: 'OnionGroup', objectName: 'OnionGroup', align: 'right', index: 5, explosionDir: { x: 0.7, y: 0.8 }, title: 'RED ONION', description: 'Sharp · fresh · paper thin' },
  { key: 'PickleGroup', objectName: 'PickleGroup', align: 'left', index: 6, explosionDir: { x: -0.7, y: 0.7 }, title: 'HOUSE PICKLES', description: 'Tangy · crisp · fresh crunch' },
  { key: 'SauceGroup', objectName: 'SauceGroup', align: 'left', index: 7, explosionDir: { x: -0.8, y: 0.4 }, title: 'HOUSE FIRE SAUCE', description: 'Smoky · creamy · slight heat' },
  { key: 'PattyTop', objectName: 'PattyTop', align: 'left', index: 8, explosionDir: { x: -0.8, y: 0.1 }, title: 'SECOND SMASH', description: 'Double beef · flame grilled' },
  { key: 'PattyCheeseTop', objectName: 'PattyCheeseTop', align: 'right', index: 9, explosionDir: { x: 0.8, y: 0.1 }, title: 'PEPPER JACK', description: 'Rich · creamy · slight kick' },
  { key: 'BunTop', objectName: 'BunTop', align: 'right', index: 10, explosionDir: { x: 0.3, y: 1.0 }, title: 'BRIOCHE CROWN', description: 'Butter toasted · sesame baked' }
];
