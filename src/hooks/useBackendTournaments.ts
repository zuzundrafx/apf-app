import { useState, useEffect } from 'react';
import { Tournament, Fighter } from '../types';

interface BackendTournament {
  id: number;
  name: string;
  league: string;
  date: string;
  status: string;
}

interface BackendFighter {
  id: number;
  fighter_name: string;
  weight_class: string;
  wl: string | null;
  total_damage: number;
  method: string;
  round: number;
  time: string;
  str: number;
  td: number;
  sub: number;
}

export function useBackendTournaments(authToken: string | null, userId: string | null) {
  const [pastTournaments, setPastTournaments] = useState<Tournament[]>([]);
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userBets, setUserBets] = useState<Map<number, any>>(new Map());

  const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

  const apiRequest = async (endpoint: string, options?: RequestInit) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  };

  useEffect(() => {
    const loadData = async () => {
      if (!authToken || !userId) return;
      try {
        setLoading(true);
        // 1. Загружаем все турниры
        const tournamentsData: BackendTournament[] = await apiRequest('/api/tournaments');
        // 2. Загружаем все ставки пользователя (чтобы знать, на какие турниры есть ставка)
        const betsData = await apiRequest(`/api/bets/user/${userId}`);
        const betsMap = new Map();
        betsData.forEach((bet: any) => betsMap.set(bet.tournament_id, bet));
        setUserBets(betsMap);

        // Преобразуем в формат Tournament
        const allTournaments = tournamentsData.map(t => ({
          id: t.id.toString(),
          name: t.name,
          league: t.league,
          date: t.date,
          status: t.status as 'active' | 'upcoming',
          filename: '',
          data: null,
          url: '',
        }));

        // Разделяем: upcoming – те, на которые нет ставки, active – те, на которые есть ставка
        const upcoming = allTournaments.filter(t => !betsMap.has(Number(t.id)));
        const active = allTournaments.filter(t => betsMap.has(Number(t.id)));

        setPastTournaments(active);   // ACTIVE TOURNAMENTS (есть ставка)
        setUpcomingTournaments(upcoming); // UPCOMING TOURNAMENTS (нет ставки)
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [authToken, userId]);

  // Функция для загрузки бойцов конкретного турнира
  const loadFighters = async (tournamentId: string): Promise<Fighter[]> => {
    try {
      const fightersData: BackendFighter[] = await apiRequest(`/api/tournaments/${tournamentId}/fighters`);
      return fightersData.map(f => ({
        Fight_ID: f.id,
        Fighter: f.fighter_name,
        'W/L': (f.wl as 'win' | 'lose' | 'draw' | null) || null,
        'Kd': 0,
        'Str': f.str,
        'Td': f.td,
        'Sub': f.sub,
        'Head': 0,
        'Body': 0,
        'Leg': 0,
        'Weight class': f.weight_class,
        'Weight Coefficient': 1,
        'Method': f.method,
        'Round': f.round,
        'Time': f.time,
        'Total Damage': f.total_damage
      }));
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  return { pastTournaments, upcomingTournaments, loading, error, userBets, loadFighters };
}