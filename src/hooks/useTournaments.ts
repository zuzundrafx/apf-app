import { useState, useEffect } from 'react';
import { Tournament, Fighter } from '../types';
import { getTournamentFiles, downloadTournamentFile, parseTournamentFromFilename } from '../api/yandexDisk';

// Кэш для хранения загруженных турниров
const tournamentCache = new Map<string, {
  data: Fighter[];
  timestamp: number;
}>();

const CACHE_DURATION = 3600000; // 1 час в миллисекундах

// Функция для проверки, есть ли у бойца результат (win/lose/draw)
const hasFightResult = (fighter: Fighter): boolean => {
  return fighter['W/L'] === 'win' || 
         fighter['W/L'] === 'lose' || 
         fighter['W/L'] === 'draw';
};

// Функция для безопасного парсинга даты
const parseDate = (dateStr: string): Date | null => {
  try {
    if (!dateStr) return null;
    
    const parts = dateStr.split(' ');
    if (parts.length === 3) {
      const month = parts[0];
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      const months: { [key: string]: number } = {
        'January': 0, 'February': 1, 'March': 2, 'April': 3,
        'May': 4, 'June': 5, 'July': 6, 'August': 7,
        'September': 8, 'October': 9, 'November': 10, 'December': 11
      };
      
      if (months[month] !== undefined) {
        return new Date(year, months[month], day);
      }
    }
    
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
};

// Функция для определения лиги из имени файла
const detectLeague = (filename: string): string => {
  if (filename.includes('PFL_')) return 'PFL';
  if (filename.includes('ONE_')) return 'ONE';
  if (filename.includes('Bellator_')) return 'Bellator';
  return 'UFC';
};

export function useTournaments() {
  const [pastTournaments, setPastTournaments] = useState<Tournament[]>([]);
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadWithProgress = async () => {
    try {
      setLoadingStage('Loading tournaments list...');
      setLoadingProgress(10);
      
      const files = await getTournamentFiles();
      setLoadingProgress(30);
      
      const pastFiles = files.filter(f => !f.name.startsWith('UPCOMING_') && f.name.endsWith('.xlsx'));
      const upcomingFiles = files.filter(f => f.name.startsWith('UPCOMING_'));
      
      console.log('Past files (no prefix):', pastFiles);
      console.log('Upcoming files (UPCOMING_ prefix):', upcomingFiles);
      
      setLoadingStage('Selecting latest tournaments...');
      setLoadingProgress(50);
      
      const latestByLeague = new Map<string, { file: typeof pastFiles[0], tournament: Partial<Tournament> }>();
      
      for (const file of pastFiles) {
        const tournament = parseTournamentFromFilename(file.name);
        const league = detectLeague(file.name);
        const tournamentDate = parseDate(tournament.date || '');
        
        if (!tournamentDate) continue;
        
        const existing = latestByLeague.get(league);
        if (!existing) {
          latestByLeague.set(league, { file, tournament });
        } else {
          const existingDate = parseDate(existing.tournament.date || '');
          if (existingDate && tournamentDate > existingDate) {
            latestByLeague.set(league, { file, tournament });
          }
        }
      }
      
      setLoadingStage('Loading tournament data...');
      setLoadingProgress(70);
      
      const latestPastTournaments: Tournament[] = [];
      let loadedCount = 0;
      const totalToLoad = latestByLeague.size;
      
      for (const [league, { file }] of latestByLeague.entries()) {
        const tournament = parseTournamentFromFilename(file.name) as Tournament;
        
        const cacheKey = `tournament_${file.name}`;
        const cached = tournamentCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log(`📦 Загружено из кэша: ${file.name}`);
          tournament.data = cached.data;
        } else {
          const data = await downloadTournamentFile(file.name);
          console.log('📊 ПЕРВЫЙ БОЕЦ ИЗ ФАЙЛА:', data?.[0]);
          tournament.data = data;
          
          if (data) {
            tournamentCache.set(cacheKey, {
              data,
              timestamp: Date.now()
            });
          }
        }
        
        // Определяем статус турнира на основе данных
        if (tournament.data && tournament.data.length > 0) {
          const allHaveResults = tournament.data.every(fighter => hasFightResult(fighter));
          tournament.status = allHaveResults ? 'active' : 'upcoming';
        } else {
          tournament.status = 'upcoming';
        }
        
        latestPastTournaments.push(tournament);
        loadedCount++;
        setLoadingProgress(70 + (loadedCount / totalToLoad) * 20);
      }
      
      latestPastTournaments.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      });
      
      setLoadingStage('Loading upcoming tournaments...');
      
      const upcomingList: Tournament[] = [];
      
      for (const file of upcomingFiles) {
        const tournament = parseTournamentFromFilename(file.name) as Tournament;
        
        const cacheKey = `tournament_${file.name}`;
        const cached = tournamentCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log(`📦 Загружено из кэша: ${file.name}`);
          tournament.data = cached.data;
        } else {
          const data = await downloadTournamentFile(file.name);
          tournament.data = data;
          
          if (data) {
            tournamentCache.set(cacheKey, {
              data,
              timestamp: Date.now()
            });
          }
        }
        
        upcomingList.push(tournament);
      }
      
      upcomingList.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });
      
      setLoadingStage('Finalizing...');
      setLoadingProgress(100);
      
      console.log('Past tournaments (latest per league):', latestPastTournaments);
      console.log('Upcoming tournaments:', upcomingList);
      
      setPastTournaments(latestPastTournaments);
      setUpcomingTournaments(upcomingList);
      
    } catch (err) {
      console.error('Ошибка загрузки турниров:', err);
      setError('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithProgress();
  }, []);

  return { 
    pastTournaments, 
    upcomingTournaments, 
    loading, 
    loadingProgress,
    loadingStage,
    error 
  };
}