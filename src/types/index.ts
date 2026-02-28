// Тип для одного бойца
export interface Fighter {
  Fight_ID: number;
  Fighter: string;
  'W/L': 'win' | 'lose';
  Kd: number;
  Str: number;
  Td: number;
  Sub: number;
  Head: number;
  Body: number;
  Leg: number;
  'Weight class': string;
  'Weight Coefficient': number;
  Method: string;
  Round: number;
  Time: string;
  'Total Damage': number;
}

// Тип для сгруппированных по весовым категориям
export interface FightersByWeight {
  [weightClass: string]: Fighter[];
}

// Тип для пары бойцов (одного боя)
export interface FightPair {
  fightId: number;
  fighter1: Fighter;
  fighter2: Fighter;
}

// Тип для выбранного пользователем бойца
export interface SelectedFighter {
  weightClass: string;
  fighter: Fighter;
}

// Тип для результата пользователя
export interface UserResult {
  userId: string;
  username: string;
  totalDamage: number;
  timestamp: string;
  selections: SelectedFighter[];
}

// НОВЫЕ ТИПЫ ДЛЯ ТУРНИРОВ И ПРОФИЛЯ

// Статус турнира
export type TournamentStatus = 'active' | 'upcoming' | 'completed';

// Интерфейс турнира
export interface Tournament {
  id: string;          // уникальный ID (можно из URL)
  name: string;        // полное название
  date: string;        // дата проведения
  status: TournamentStatus;
  filename: string;    // имя файла на Яндекс.Диске
  data: Fighter[] | null; // данные бойцов (null для будущего)
  url: string;         // ссылка на страницу турнира
}

// Выбор пользователя для конкретного турнира
export interface UserSelection {
  tournamentId: string;
  userId: string;
  selections: SelectedFighter[];
  totalDamage: number;
  timestamp: string;
}

// Профиль пользователя
export interface UserProfile {
  userId: string;
  username: string;
  avatar: string;
  level: number;
  experience: number;
  coins: number;
  selections: UserSelection[]; // история выборов
}

// Для работы с Яндекс.Диском
export interface DiskFileInfo {
  name: string;
  path: string;
  created: string;
}