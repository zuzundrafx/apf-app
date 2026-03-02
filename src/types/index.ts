export interface Fighter {
  Fight_ID: number;
  Fighter: string;
  'W/L': 'win' | 'lose' | null;  // null для будущих/незавершенных боев
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