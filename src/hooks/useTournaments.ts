import { useState, useEffect } from 'react';
import { Tournament } from '../types';
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
        
        // Получаем список файлов
        const files = await getTournamentFiles();
        console.log('Найденные файлы:', files);
        
        // Разделяем на прошедшие и будущие
        const pastFiles = files.filter(f => f.name.startsWith('UFC_'));
        const upcomingFiles = files.filter(f => f.name.startsWith('UPCOMING_'));
        
        console.log('Past files:', pastFiles);
        console.log('Upcoming files:', upcomingFiles);
        
        if (pastFiles.length === 0) {
          console.log('⚠️ Не найден файл прошедшего турнира');
        } else {
          // Берем самый свежий прошедший турнир (по дате создания)
          pastFiles.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
          const latestPast = pastFiles[0];
          console.log('Загружаю прошедший турнир:', latestPast);
          
          // Загружаем данные прошедшего турнира
          const pastData = await downloadTournamentFile(latestPast.name);
          
          if (pastData) {
            const pastInfo = parseTournamentFromFilename(latestPast.name);
            console.log('Past tournament parsed:', pastInfo);
            
            setPastTournament({
              id: 'past',
              name: pastInfo.name || 'Unknown',
              date: pastInfo.date || 'Date TBD',
              status: 'active',
              filename: latestPast.name,
              data: pastData,
              url: ''
            });
            console.log('✅ Прошедший турнир загружен');
          }
        }
        
        // Если есть будущий турнир, загружаем его
        if (upcomingFiles.length > 0) {
          // Сортируем и берем ближайший
          upcomingFiles.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
          const nearestUpcoming = upcomingFiles[0];
          console.log('Загружаю будущий турнир:', nearestUpcoming);
          
          const upcomingData = await downloadTournamentFile(nearestUpcoming.name);
          const upcomingInfo = parseTournamentFromFilename(nearestUpcoming.name);
          console.log('Upcoming tournament parsed:', upcomingInfo);
          
          setUpcomingTournament({
            id: 'upcoming',
            name: upcomingInfo.name || 'Unknown',
            date: upcomingInfo.date || 'Date TBD',
            status: 'upcoming',
            filename: nearestUpcoming.name,
            data: upcomingData,
            url: ''
          });
          console.log('✅ Будущий турнир загружен');
        } else {
          console.log('⚠️ Нет будущих турниров');
        }
        
      } catch (err) {
        console.error('❌ Ошибка загрузки турниров:', err);
        setError(err instanceof Error ? err.message : 'Ошибка загрузки турниров');
      } finally {
        setLoading(false);
      }
    };
    
    loadTournaments();
  }, []);

  return { pastTournament, upcomingTournament, loading, error };
}