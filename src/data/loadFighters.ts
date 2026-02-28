import { Fighter, FightersByWeight } from '../types';

export function groupFightersByWeight(fighters: Fighter[]): FightersByWeight {
  const grouped: FightersByWeight = {};
  
  fighters.forEach(fighter => {
    const weightClass = fighter['Weight class'];
    if (!grouped[weightClass]) {
      grouped[weightClass] = [];
    }
    grouped[weightClass].push(fighter);
  });
  
  // Сортируем бойцов в каждой категории по Fight_ID
  Object.keys(grouped).forEach(weightClass => {
    grouped[weightClass].sort((a, b) => a.Fight_ID - b.Fight_ID);
  });
  
  return grouped;
}

// Функция для получения пары бойцов по ID боя
export function getFightPairs(fighters: Fighter[]): Map<number, Fighter[]> {
  const pairs = new Map<number, Fighter[]>();
  
  fighters.forEach(fighter => {
    const fightId = fighter.Fight_ID;
    if (!pairs.has(fightId)) {
      pairs.set(fightId, []);
    }
    pairs.get(fightId)!.push(fighter);
  });
  
  return pairs;
}

// Вспомогательная функция для получения цвета категории
export function getWeightClassColor(weightClass: string): string {
  const colors: { [key: string]: string } = {
    'Flyweight': '#168760',
    'Bantamweight': '#446E87',
    'Featherweight': '#424A87',
    'Lightweight': '#5F3A87',
    'Welterweight': '#813D87',
    'Middleweight': '#87863B',
    'Light Heavyweight': '#876A0B',
    'Heavyweight': '#870000',
    "Women's Strawweight": '#A6125F',
    "Women's Flyweight": '#58C467',
    "Women's Bantamweight": '#66A4C9',
    "Catch Weight": '#666666'
  };
  
  return colors[weightClass] || '#666666';
}