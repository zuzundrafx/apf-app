import { useState, useEffect } from 'react';
import { Tournament, Fighter } from '../types';
import { getTournamentFiles, downloadTournamentFile, parseTournamentFromFilename } from '../api/yandexDisk';

// Кэш для хранения загруженных турниров
const tournamentCache = new Map<string, {
  data: Fighter[];
  timestamp: number;
}>();

const CACHE_DURATION = 3600000; // 1 час в миллисекундах

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
      const pastFiles = files.filter(f => f.name.startsWith('UFC_'));
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
      
      // Загружаем прошедший турнир
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
          
          if (!latestPast || new Date(tournament.date) > new Date(latestPast.date)) {
            latestPast = tournament;
          }
        }
      }
      
      setLoadingStage('Loading upcoming tournament...');
      setLoadingProgress(70);
      
      // Загружаем будущий турнир
      for (const [baseName, files] of tournamentMap.entries()) {
        if (files.upcoming && !files.past) {
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
          
          const tournamentDate = new Date(tournament.date);
          if (tournamentDate >= now) {
            if (!latestUpcoming || new Date(tournament.date) < new Date(latestUpcoming.date)) {
              latestUpcoming = tournament;
            }
          }
        }
      }
      
      // Если не нашли подходящий будущий турнир, берем ближайший
      if (!latestUpcoming && upcomingFiles.length > 0) {
        const sortedUpcoming = await Promise.all(
          upcomingFiles.map(async (file) => {
            const tournament = parseTournamentFromFilename(file.name) as Tournament;
            
            const cacheKey = `tournament_${file.name}`;
            const cached = tournamentCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
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
            
            return tournament;
          })
        );
        
        const futureTournaments = sortedUpcoming.filter(t => new Date(t.date) >= now);
        if (futureTournaments.length > 0) {
          futureTournaments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          latestUpcoming = futureTournaments[0];
        }
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