import { useState, useEffect } from 'react';
import { Tournament, Fighter } from '../types';
import { getTournamentFiles, downloadTournamentFile, parseTournamentFromFilename } from '../api/yandexDisk';

export function useTournaments() {
  const [pastTournament, setPastTournament] = useState<Tournament | null>(null);
  const [upcomingTournament, setUpcomingTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTournaments = async () => {
      try {
        setLoading(true);
        console.log('📥 Загружаю список турниров...');
        
        // Получаем список всех файлов турниров
        const files = await getTournamentFiles();
        
        // Разделяем на прошедшие (UFC_) и будущие (UPCOMING_)
        const pastFiles = files.filter(f => f.name.startsWith('UFC_'));
        const upcomingFiles = files.filter(f => f.name.startsWith('UPCOMING_'));
        
        console.log('Past files:', pastFiles);
        console.log('Upcoming files:', upcomingFiles);
        
        // Группируем файлы по названию турнира (без префикса)
        const tournamentMap = new Map();
        
        // Сначала обрабатываем UPCOMING_ файлы
        upcomingFiles.forEach(file => {
          const baseName = file.name.replace(/^UPCOMING_/, '');
          if (!tournamentMap.has(baseName)) {
            tournamentMap.set(baseName, { upcoming: file, past: null });
          } else {
            tournamentMap.get(baseName).upcoming = file;
          }
        });
        
        // Потом обрабатываем UFC_ файлы
        pastFiles.forEach(file => {
          const baseName = file.name.replace(/^UFC_/, '');
          if (!tournamentMap.has(baseName)) {
            tournamentMap.set(baseName, { past: file, upcoming: null });
          } else {
            tournamentMap.get(baseName).past = file;
          }
        });
        
        // Теперь определяем актуальные турниры
        let latestPast: Tournament | null = null;
        let latestUpcoming: Tournament | null = null;
        
        // Текущая дата для сравнения
        const now = new Date();
        
        for (const [baseName, files] of tournamentMap.entries()) {
          // Если есть UFC_ файл - это прошедший турнир
          if (files.past) {
            const tournament = parseTournamentFromFilename(files.past.name) as Tournament;
            const data = await downloadTournamentFile(files.past.name);
            tournament.data = data;
            
            if (!latestPast || new Date(tournament.date) > new Date(latestPast.date)) {
              latestPast = tournament;
            }
          }
          
          // Если есть UPCOMING_ файл и нет UFC_ файла с таким же названием
          if (files.upcoming && !files.past) {
            const tournament = parseTournamentFromFilename(files.upcoming.name) as Tournament;
            const data = await downloadTournamentFile(files.upcoming.name);
            tournament.data = data;
            
            // Проверяем, что дата турнира еще не прошла
            const tournamentDate = new Date(tournament.date);
            if (tournamentDate >= now) {
              if (!latestUpcoming || new Date(tournament.date) < new Date(latestUpcoming.date)) {
                latestUpcoming = tournament;
              }
            }
          }
        }
        
        // Если не нашли подходящий будущий турнир, но есть UPCOMING_ файл с датой после сегодня
        if (!latestUpcoming && upcomingFiles.length > 0) {
          // Ближайший по дате
          const sortedUpcoming = await Promise.all(
            upcomingFiles.map(async (file) => {
              const tournament = parseTournamentFromFilename(file.name) as Tournament;
              tournament.data = await downloadTournamentFile(file.name);
              return tournament;
            })
          );
          
          const futureTournaments = sortedUpcoming.filter(t => new Date(t.date) >= now);
          if (futureTournaments.length > 0) {
            futureTournaments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            latestUpcoming = futureTournaments[0];
          }
        }
        
        console.log('Past tournament parsed:', latestPast);
        console.log('Upcoming tournament parsed:', latestUpcoming);
        
        if (latestPast) {
          console.log('✅ Прошедший турнир загружен');
        }
        if (latestUpcoming) {
          console.log('✅ Будущий турнир загружен');
        }
        
        setPastTournament(latestPast);
        setUpcomingTournament(latestUpcoming);
        
      } catch (err) {
        console.error('Ошибка загрузки турниров:', err);
        setError('Не удалось загрузить турниры');
      } finally {
        setLoading(false);
      }
    };

    loadTournaments();
  }, []);

  return { pastTournament, upcomingTournament, loading, error };
}