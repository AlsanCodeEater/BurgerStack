import { BurgerData } from '../types';

export const burgers: BurgerData[] = [
  {
    id: 'classic-stack',
    name: 'Classic Stack',
    price: 9.90,
    description: 'The one that started it all. A perfectly balanced classic with fresh veggies and our signature house sauce.',
    ingredients: 'Beef patty, lettuce, tomato, onion, pickles, house sauce',
    calories: 680,
    spiceLevel: 'None',
    modelVariant: {
      hasPickles: true,
      hasOnion: true,
      hasTomato: true,
      hasCheese: false,
      hasLettuce: true,
      pattyCount: 1,
      sauceColor: '#e0b484', // House sauce
      bunColor: '#d69f62'
    }
  },
  {
    id: 'bbq-king',
    name: 'BBQ King',
    price: 14.90,
    description: 'Two flame-grilled beef patties, smoked cheddar, caramelized onion, crispy bacon and bourbon BBQ sauce.',
    ingredients: 'Double beef, cheddar, caramelized onion, bacon, BBQ sauce',
    calories: 860,
    spiceLevel: 'Mild',
    modelVariant: {
      hasPickles: false,
      hasOnion: true,
      hasTomato: false,
      hasCheese: true,
      hasLettuce: false,
      pattyCount: 2,
      sauceColor: '#4f1a0e', // BBQ sauce
      bunColor: '#c3874c'
    }
  },
  {
    id: 'hot-honey',
    name: 'Hot Honey',
    price: 12.90,
    description: 'Spicy, sweet, and incredibly satisfying. Featuring our special hot honey glaze and fresh jalapeños.',
    ingredients: 'Beef patty, pepper jack, hot honey glaze, jalapeños, lettuce',
    calories: 720,
    spiceLevel: 'Medium',
    modelVariant: {
      hasPickles: true,
      hasOnion: false,
      hasTomato: false,
      hasCheese: true,
      hasLettuce: true,
      pattyCount: 1,
      sauceColor: '#e3842d', // Hot honey
      bunColor: '#d69f62'
    }
  },
  {
    id: 'double-trouble',
    name: 'Double Trouble',
    price: 15.90,
    description: 'For the serious appetite. Double everything. Just meat, cheese, and our secret sauce.',
    ingredients: 'Double beef, double cheddar, extra secret sauce, pickles',
    calories: 950,
    spiceLevel: 'None',
    modelVariant: {
      hasPickles: true,
      hasOnion: false,
      hasTomato: false,
      hasCheese: true,
      hasLettuce: false,
      pattyCount: 2,
      sauceColor: '#e0b484',
      bunColor: '#d69f62'
    }
  },
  {
    id: 'green-stack',
    name: 'Green Stack',
    price: 10.90,
    description: 'A lighter take loaded with fresh greens, creamy avocado, and our zesty herb mayo.',
    ingredients: 'Beef patty, avocado, lettuce, tomato, cucumber, herb mayo',
    calories: 610,
    spiceLevel: 'None',
    modelVariant: {
      hasPickles: false,
      hasOnion: false,
      hasTomato: true,
      hasCheese: false,
      hasLettuce: true,
      pattyCount: 1,
      sauceColor: '#93b573', // Herb mayo
      bunColor: '#d69f62'
    }
  },
  {
    id: 'inferno',
    name: 'Inferno',
    price: 13.90,
    description: 'Not for the faint of heart. Carolina Reaper aioli, pepper jack cheese, and spicy roasted peppers.',
    ingredients: 'Beef patty, pepper jack, roasted peppers, reaper aioli',
    calories: 780,
    spiceLevel: 'Inferno',
    modelVariant: {
      hasPickles: false,
      hasOnion: true,
      hasTomato: false,
      hasCheese: true,
      hasLettuce: false,
      pattyCount: 1,
      sauceColor: '#c22d17', // Reaper aioli
      bunColor: '#c34a36' // Red/spicy bun
    }
  }
];
