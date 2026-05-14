// src/utils/weightUtils.ts

export const WEIGHT_CLASS_COLORS: Record<string, string> = {
  'Flyweight': '#00FFA3',
  'Bantamweight': '#00E0FF',
  'Featherweight': '#0075FF',
  'Lightweight': '#AD00FF',
  'Welterweight': '#FF00D6',
  'Middleweight': '#FFD700',
  'Light Heavyweight': '#FF5C00',
  'Heavyweight': '#FF0000',
  "Women's Strawweight": '#FF6B9D',
  "Women's Flyweight": '#5EEAD4',
  "Women's Bantamweight": '#818CF8',
  "Catch Weight": '#94A3B8'
};

export const getWeightClassColor = (weightClass: string): string => {
  return WEIGHT_CLASS_COLORS[weightClass] || '#666666';
};

export const getAvatarFilename = (weightClass: string): string => {
  const map: Record<string, string> = {
    'Flyweight': 'Flyweight_avatar.png',
    'Bantamweight': 'Bantamweight_avatar.png',
    'Featherweight': 'Featherweight_avatar.png',
    'Lightweight': 'Lightweight_avatar.png',
    'Welterweight': 'Welterweight_avatar.png',
    'Middleweight': 'Middleweight_avatar.png',
    'Light Heavyweight': 'Light_Heavyweight_avatar.png',
    'Heavyweight': 'Heavyweight_avatar.png',
    "Women's Strawweight": "Women's_Strawweight_avatar.png",
    "Women's Flyweight": "Women's_Flyweight_avatar.png",
    "Women's Bantamweight": "Women's_Bantamweight_avatar.png",
    "Catch Weight": 'default-avatar.png'
  };
  return map[weightClass] || 'default-avatar.png';
};

export const getWeightClassIcon = (weightClass: string): string => {
  const icons: Record<string, string> = {
    'Flyweight': 'Flyweight_icon.webp',
    'Bantamweight': 'Bantamweight_icon.webp',
    'Featherweight': 'Featherweight_icon.webp',
    'Lightweight': 'Lightweight_icon.webp',
    'Welterweight': 'Welterweight_icon.webp',
    'Middleweight': 'Middleweight_icon.webp',
    'Light Heavyweight': 'Ligh_Heavyweight_icon.webp',
    'Heavyweight': 'Heavyweight_icon.webp',
    "Women's Strawweight": "Women's_Strawweight_icon.webp",
    "Women's Flyweight": "Women's_Flyweight_icon.webp",
    "Women's Bantamweight": "Women's_Bantamweight_icon.webp",
    "Catch Weight": 'Catch_weight_icon.webp'
  };
  return icons[weightClass] || 'default_icon.webp';
};