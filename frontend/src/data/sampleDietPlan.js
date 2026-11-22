const oats = {
  slot: 'Breakfast',
  title: 'Berry yogurt oats',
  ingredients: ['Rolled oats', 'Greek yogurt', 'Mixed berries', 'Walnuts'],
  protein: 27,
  carbs: 63,
  fat: 16,
};

const eggs = {
  slot: 'Breakfast',
  title: 'Eggs and avocado toast',
  ingredients: ['Eggs', 'Whole-grain toast', 'Avocado', 'Orange'],
  protein: 26,
  carbs: 56,
  fat: 25,
};

const chicken = {
  slot: 'Lunch',
  title: 'Lemon chicken rice bowl',
  ingredients: ['Chicken', 'Brown rice', 'Spinach', 'Roasted carrots'],
  protein: 46,
  carbs: 77,
  fat: 18,
};

const chickpeas = {
  slot: 'Lunch',
  title: 'Chickpea and quinoa bowl',
  ingredients: ['Chickpeas', 'Quinoa', 'Cucumber', 'Tomato', 'Feta'],
  protein: 30,
  carbs: 79,
  fat: 22,
};

const yogurt = {
  slot: 'Snack',
  title: 'Yogurt, banana, and almonds',
  ingredients: ['Greek yogurt', 'Banana', 'Almonds'],
  protein: 20,
  carbs: 35,
  fat: 12,
};

const hummus = {
  slot: 'Snack',
  title: 'Hummus and whole-grain pita',
  ingredients: ['Hummus', 'Whole-grain pita', 'Bell peppers'],
  protein: 13,
  carbs: 43,
  fat: 13,
};

const fish = {
  slot: 'Dinner',
  title: 'Roasted salmon and potatoes',
  ingredients: ['Salmon', 'Baby potatoes', 'Green beans', 'Olive oil'],
  protein: 41,
  carbs: 57,
  fat: 28,
};

const tofu = {
  slot: 'Dinner',
  title: 'Ginger tofu stir-fry',
  ingredients: ['Tofu', 'Rice noodles', 'Broccoli', 'Bell peppers', 'Sesame'],
  protein: 35,
  carbs: 71,
  fat: 25,
};

export const sampleDietWeek = [
  { name: 'Monday', meals: [oats, chicken, yogurt, fish] },
  { name: 'Tuesday', meals: [eggs, chickpeas, hummus, tofu] },
  { name: 'Wednesday', meals: [oats, chickpeas, yogurt, fish] },
  { name: 'Thursday', meals: [eggs, chicken, hummus, tofu] },
  { name: 'Friday', meals: [oats, chicken, yogurt, tofu] },
  { name: 'Saturday', meals: [eggs, chickpeas, hummus, fish] },
  { name: 'Sunday', meals: [oats, chickpeas, yogurt, tofu] },
];
