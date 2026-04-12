export interface Fighter {
  Fight_ID: number;
  Fighter: string;
  'W/L': 'win' | 'lose' | 'draw' | null;  
  'Kd': number | string;
  'Str': number | string;
  'Td': number | string;
  'Sub': number | string;
  'Head': number | string;
  'Body': number | string;
  'Leg': number | string;
  'Weight class': string;
  'Weight Coefficient': number;
  'Method': string;
  'Round': number | string;
  'Time': string;
  'Total Damage': number;
}

export interface SelectedFighter {
  weightClass: string;
  fighter: Fighter;
}

export interface Tournament {
  id: string;
  name: string;
  league: string;
  date: string;
  status: 'active' | 'upcoming';
  filename: string;
  data: Fighter[] | null;
  url: string;
}

export interface DiskFileInfo {
  name: string;
  path: string;
  created: string;
}

// ← НОВЫЙ ИНТЕРФЕЙС: Результаты пользователя
export interface UserResult {
  userId: string;
  username: string;
  totalDamage: number;
  timestamp: string;
  selections: SelectedFighter[];
  betAmount?: number;           // ← НОВОЕ: сумма ставки
  rewardsAccepted?: boolean;
  rewards?: {
    coins: number;
    experience: number;
  };
}