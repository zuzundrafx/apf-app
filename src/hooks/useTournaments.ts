import { useState, useEffect } from 'react';
import { Tournament, Fighter } from '../types';
import { getTournamentFiles, downloadTournamentFile, parseTournamentFromFilename } from '../api/yandexDisk';

// Кэш для хранения загруженных турниров
const tournamentCache = new Map<string, {
  data: Fighter[];
  timestamp: number;
}>();

const CACHE_DURATION = 3600000; // 1 час в миллисекундах

// Функция для безопасного парсинга даты
const parseDate = (dateStr: string): Date | null => {
  try {
    if (!dateStr) return null;
    
    // Пробуем разные форматы
    let date: Date | null = null;
    
    // Формат "March 07 2026"
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
        date = new Date(year, months[month], day);
      }
    }
    
    // Если не получилось, пробуем стандартный парсинг
    if (!date || isNaN(date.getTime())) {
      date = new Date(dateStr);
    }
    
    return date && !isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
};

export function useTournaments() {
  const [pastTournament, setPastTournament] = useState<Tournament | null>(null);
  const [upcomingTournaments, setUpcomingTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Функция для загрузки с прогрессом
  const loadWithProgress = async () => {
    try {
      setLoadingStage('Loading tournaments list...');
      setLoadingProgress(10);
      
      // Получаем список всех файлов турниров
      const files = await getTournamentFiles();
      setLoadingProgress(30);
      
      // Разделяем на прошедшие (без префикса UPCOMING_) и будущие (с префиксом UPCOMING_)
      const pastFiles = files.filter(f => !f.name.startsWith('UPCOMING_') && f.name.endsWith('.xlsx'));
      const upcomingFiles = files.filter(f => f.name.startsWith('UPCOMING_'));
      
      console.log('Past files (no prefix):', pastFiles);
      console.log('Upcoming files (UPCOMING_ prefix):', upcomingFiles);
      
      setLoadingStage('Loading past tournament...');
      setLoadingProgress(50);
      
      // Загружаем прошедший турнир (самый свежий по дате)
      const pastTournaments: Tournament[] = [];
      
      for (const file of pastFiles) {
        const tournament = parseTournamentFromFilename(file.name) as Tournament;
        
        // Проверяем кэш
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
        
        pastTournaments.push(tournament);
      }
      
      // Сортируем прошедшие турниры по дате (от новых к старым)
      pastTournaments.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      });
      
      const latestPast = pastTournaments[0] || null;
      
      setLoadingStage('Loading upcoming tournaments...');
      setLoadingProgress(70);
      
      // Загружаем ВСЕ будущие турниры
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
      
      // Сортируем будущие турниры по дате (от ближайших к дальним)
      upcomingList.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });
      
      setLoadingStage('Finalizing...');
      setLoadingProgress(90);
      
      console.log('Past tournament parsed:', latestPast);
      console.log('Upcoming tournaments parsed:', upcomingList);
      
      setPastTournament(latestPast);
      setUpcomingTournaments(upcomingList);
      setLoadingProgress(100);
      setLoadingStage('Ready!');
      
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
    pastTournament, 
    upcomingTournaments, 
    loading, 
    loadingProgress,
    loadingStage,
    error 
  };
}