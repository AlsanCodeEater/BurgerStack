export interface Ingredient {
  id: string;
  name: string;
  description: string;
}

export interface BurgerVariant {
  hasPickles: boolean;
  hasOnion: boolean;
  hasTomato: boolean;
  hasCheese: boolean;
  hasLettuce: boolean;
  pattyCount: number;
  sauceColor: string;
  bunColor: string;
}

export interface BurgerData {
  id: string;
  name: string;
  price: number;
  description: string;
  ingredients: string;
  calories: number;
  spiceLevel: 'None' | 'Mild' | 'Medium' | 'Hot' | 'Inferno';
  modelVariant: BurgerVariant;
}
