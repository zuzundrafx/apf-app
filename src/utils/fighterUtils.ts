// src/utils/fighterUtils.ts

// Базовая функция (принимает числа)
export const getFighterStyle = (str: number, td: number, sub: number): string => {
  const tdSubSum = td + sub;
  if (tdSubSum >= 2 && str < 50) return 'grappler';
  if (str >= 50 && tdSubSum < 2) return 'striker';
  if (str >= 50 && tdSubSum >= 2) return 'universal';
  return 'simple';
};

// Для SelectedFighter (где fighter уже объект с Str, Td, Sub)
export const getFighterStyleFromSelected = (fighter: { Str?: number | string; Td?: number | string; Sub?: number | string }): string => {
  const str = Number(fighter.Str) || 0;
  const td = Number(fighter.Td) || 0;
  const sub = Number(fighter.Sub) || 0;
  return getFighterStyle(str, td, sub);
};

// Получить отображаемое название стиля (для UI)
export const getStyleDisplayName = (style: string): string => {
  const map: Record<string, string> = {
    'striker': 'STRIKER',
    'grappler': 'GRAPPLER',
    'universal': 'UNIVERSAL',
    'simple': 'SIMPLE'
  };
  return map[style] || style.toUpperCase();
};

// Получить имя файла иконки для стиля
export const getStyleIconFilename = (style: string): string => {
  const icons: Record<string, string> = {
    'striker': 'Striker_style_icon.webp',
    'grappler': 'Grappler_style_icon.webp',
    'universal': 'Universal_style_icon.webp',
    'simple': 'Simple_style_icon.webp'
  };
  return icons[style] || 'Simple_style_icon.webp';
};

// Получить цветовую схему для стиля (для обводок, градиентов)
export const getStyleGradient = (style: string): string => {
  const gradients: Record<string, string> = {
    'striker': 'linear-gradient(180deg, #FF0000 0%, #8C1519 100%)',
    'grappler': 'linear-gradient(180deg, #FF9933 0%, #663300 100%)',
    'universal': 'linear-gradient(180deg, #9B59B6 0%, #6C3483 100%)',
    'simple': 'linear-gradient(180deg, #3D3D3B 0%, #2A2A2A 100%)'
  };
  return gradients[style] || gradients.simple;
};