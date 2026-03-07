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
  const [upcomingTournament, setUpcomingTournament] = useState<Tournament | null>(null);
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
      
      // Разделяем на прошедшие и будущие
      const pastFiles = files.filter(f => f.name.startsWith('UFC_') && !f.name.startsWith('UPCOMING_'));
      const upcomingFiles = files.filter(f => f.name.startsWith('UPCOMING_'));
      
      console.log('Past files:', pastFiles);
      console.log('Upcoming files:', upcomingFiles);
      
      // Группируем файлы по названию турнира
      const tournamentMap = new Map();
      
      upcomingFiles.forEach(file => {
        const baseName = file.name.replace(/^UPCOMING_/, '');
        tournamentMap.set(baseName, { upcoming: file, past: null });
      });
      
      pastFiles.forEach(file => {
        const baseName = file.name.replace(/^UFC_/, '');
        if (!tournamentMap.has(baseName)) {
          tournamentMap.set(baseName, { past: file, upcoming: null });
        } else {
          tournamentMap.get(baseName).past = file;
        }
      });
      
      // Определяем актуальные турниры
      let latestPast: Tournament | null = null;
      let latestUpcoming: Tournament | null = null;
      
      const now = new Date();
      
      setLoadingStage('Loading past tournament...');
      setLoadingProgress(50);
      
      // Загружаем прошедший турнир (самый свежий по дате)
      const pastTournaments: Tournament[] = [];
      
      for (const [baseName, files] of tournamentMap.entries()) {
        if (files.past) {
          const tournament = parseTournamentFromFilename(files.past.name) as Tournament;
          
          // Проверяем кэш
          const cacheKey = `tournament_${files.past.name}`;
          const cached = tournamentCache.get(cacheKey);
          
          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`📦 Загружено из кэша: ${files.past.name}`);
            tournament.data = cached.data;
          } else {
            const data = await downloadTournamentFile(files.past.name);
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
      }
      
      // Сортируем прошедшие турниры по дате (от новых к старым)
      pastTournaments.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      });
      
      latestPast = pastTournaments[0] || null;
      
      setLoadingStage('Loading upcoming tournament...');
      setLoadingProgress(70);
      
      // Загружаем будущие турниры
      const upcomingTournaments: Tournament[] = [];
      
      for (const [baseName, files] of tournamentMap.entries()) {
        if (files.upcoming) {
          const tournament = parseTournamentFromFilename(files.upcoming.name) as Tournament;
          
          // Проверяем кэш
          const cacheKey = `tournament_${files.upcoming.name}`;
          const cached = tournamentCache.get(cacheKey);
          
          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`📦 Загружено из кэша: ${files.upcoming.name}`);
            tournament.data = cached.data;
          } else {
            const data = await downloadTournamentFile(files.upcoming.name);
            tournament.data = data;
            
            if (data) {
              tournamentCache.set(cacheKey, {
                data,
                timestamp: Date.now()
              });
            }
          }
          
          // Парсим дату турнира
          const tournamentDate = parseDate(tournament.date);
          console.log(`Tournament ${tournament.name} date:`, tournament.date, 'parsed:', tournamentDate);
          
          // Если дата парсится и турнир в будущем (или сегодня)
          if (tournamentDate) {
            // Сравниваем без времени, только по дате
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const tourDate = new Date(tournamentDate);
            tourDate.setHours(0, 0, 0, 0);
            
            if (tourDate >= today) {
              upcomingTournaments.push(tournament);
            } else {
              console.log(`Турнир ${tournament.name} пропущен - дата в прошлом`);
            }
          } else {
            // Если дату не удалось распарсить, все равно показываем турнир
            console.log(`Дата не распарсилась для ${tournament.name}, показываем как есть`);
            upcomingTournaments.push(tournament);
          }
        }
      }
      
      // Сортируем будущие турниры по дате (от ближайших к дальним)
      upcomingTournaments.sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });
      
      // Берем самый ближайший будущий турнир
      latestUpcoming = upcomingTournaments[0] || null;
      
      // Если не нашли ни одного будущего турнира с корректной датой,
      // но есть файлы с префиксом UPCOMING_, показываем первый
      if (!latestUpcoming && upcomingFiles.length > 0) {
        console.log('Используем первый UPCOMING файл без проверки даты');
        const firstUpcoming = upcomingFiles[0];
        const tournament = parseTournamentFromFilename(firstUpcoming.name) as Tournament;
        
        const cacheKey = `tournament_${firstUpcoming.name}`;
        const cached = tournamentCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          tournament.data = cached.data;
        } else {
          const data = await downloadTournamentFile(firstUpcoming.name);
          tournament.data = data;
        }
        
        latestUpcoming = tournament;
      }
      
      setLoadingStage('Finalizing...');
      setLoadingProgress(90);
      
      console.log('Past tournament parsed:', latestPast);
      console.log('Upcoming tournament parsed:', latestUpcoming);
      
      setPastTournament(latestPast);
      setUpcomingTournament(latestUpcoming);
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
    upcomingTournament, 
    loading, 
    loadingProgress,
    loadingStage,
    error 
  };
}