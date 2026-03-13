// src/components/Pvp.tsx

import React, { useState } from 'react';
import { Tournament, SelectedFighter } from '../types';
import { UserResult } from '../api/yandexUpload';
import { UserProfile } from '../api/userProfiles';
import ArenaModal from './ArenaModal';

interface PvpProps {
  pastTournaments: Tournament[];
  userSelections: SelectedFighter[];
  userAvatar?: string;
  userId?: string;
  userName: string;
  allProfiles: Map<string, UserProfile>;
  loadTournamentData: (tournamentName: string) => Promise<{
    weightClasses: string[];
    results: UserResult[];
  }>;
}

const Pvp: React.FC<PvpProps> = ({
  pastTournaments,
  userSelections,
  userAvatar,
  userId,
  userName,
  allProfiles,
  loadTournamentData,
}) => {
  // Состояния для модального окна арены
  const [arenaData, setArenaData] = useState<{
    tournament: Tournament;
    weightClasses: string[];
    rival: {
      username: string;
      photoUrl?: string;
      totalDamage: number;
      selections: SelectedFighter[];
    };
  } | null>(null);
  
  // Состояние для блокировки кнопки во время загрузки
  const [isEngaging, setIsEngaging] = useState(false);

  // Функция для проверки наличия ставки у игрока в конкретном турнире
  const hasUserBetOnTournament = (tournament: Tournament): boolean => {
    // Проверяем, есть ли у игрока выбранные бойцы в этом турнире
    return userSelections.some(sel => 
      tournament.data?.some(f => f.Fighter === sel.fighter.Fighter)
    );
  };

  // Функция для получения урона игрока в конкретном турнире
  const getUserDamageForTournament = (tournament: Tournament): number | null => {
    const tournamentSelections = userSelections.filter(sel => 
      tournament.data?.some(f => f.Fighter === sel.fighter.Fighter)
    );
    
    if (tournamentSelections.length === 0) return null;
    
    const totalDamage = tournamentSelections.reduce(
      (sum, sel) => sum + (sel.fighter['Total Damage'] || 0), 
      0
    );
    return Math.round(totalDamage);
  };

  // Обработчик нажатия на ENGAGE
  const handleEngage = async (tournament: Tournament) => {
    if (!userId || isEngaging) return;
    
    // Блокируем кнопку
    setIsEngaging(true);
    
    try {
      // Загружаем данные турнира
      const tournamentData = await loadTournamentData(tournament.name);
      
      // Ищем соперников (исключая себя)
      const rivals = tournamentData.results.filter(r => r.userId !== userId);
      
      console.log(`🔍 Найдено соперников: ${rivals.length}`);
      
      if (rivals.length === 0) {
        alert('No rivals available for this tournament');
        setIsEngaging(false);
        return;
      }
      
      // Случайный выбор соперника
      const randomIndex = Math.floor(Math.random() * rivals.length);
      const selectedRival = rivals[randomIndex];
      const rivalProfile = allProfiles.get(selectedRival.userId);
      
      // Открываем арену
      setArenaData({
        tournament,
        weightClasses: tournamentData.weightClasses,
        rival: {
          username: selectedRival.username,
          photoUrl: rivalProfile?.photoUrl,
          totalDamage: selectedRival.totalDamage,
          selections: selectedRival.selections
        }
      });
      
      // Разблокируем кнопку после открытия арены
      setIsEngaging(false);
      
    } catch (error) {
      console.error('Ошибка при поиске соперника:', error);
      alert('Error finding rival');
      setIsEngaging(false);
    }
  };

  // Обработчик закрытия арены
  const handleSurrender = () => {
    setArenaData(null);
  };

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  return (
    <div className="pvp-screen">
      {/* Затемнение фона когда арена открыта */}
      {arenaData && <div className="pvp-overlay" />}
      
      {/* Заголовок Active Tournaments */}
      <div className="pvp-header">
        <div className="pvp-header-title">ACTIVE TOURNAMENTS</div>
      </div>

      {/* Список турниров */}
      <div className={`pvp-list ${arenaData ? 'blurred' : ''}`}>
        {pastTournaments.slice(0, 3).map((tournament) => {
          const userDamage = getUserDamageForTournament(tournament);
          const hasBet = hasUserBetOnTournament(tournament);
          const isDisabled = !!arenaData || !hasBet || isEngaging;
          
          return (
            <div key={tournament.id} className="pvp-tournament-card">
              {/* Верхняя часть (15%) - лига и название */}
              <div className="pvp-card-top">
                <div className="pvp-card-league" style={{ backgroundColor: '#B20101' }}>
                  <span>{tournament.league || 'UFC'}</span>
                </div>
                <div className="pvp-card-name">
                  {tournament.name}
                </div>
              </div>

              {/* Средняя часть (60%) - аватарки и VS */}
              <div className="pvp-card-middle">
                {/* Левая часть (45%) - аватарка игрока и его урон */}
                <div className="pvp-middle-left">
                  <div className="pvp-player-avatar">
                    <img 
                      src={userAvatar || `${BASE_URL}/Home_button.png`} 
                      alt="player"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `${BASE_URL}/Home_button.png`;
                      }}
                    />
                  </div>
                  <div className="pvp-player-damage">
                    {userDamage !== null ? (
                      <>
                        <div className="pvp-damage-label">Dmg:</div>
                        <div className="pvp-damage-value">{userDamage}</div>
                      </>
                    ) : (
                      <div className="pvp-damage-na">not available</div>
                    )}
                  </div>
                </div>

                {/* Центральная часть (10%) - VS */}
                <div className="pvp-middle-center">
                  <span className="pvp-vs-text">VS</span>
                </div>

                {/* Правая часть (45%) - "Next RIVAL" */}
                <div className="pvp-middle-right">
                  <div className="pvp-rival-avatar">
                    <img src={`${BASE_URL}/default-avatar.png`} alt="rival" />
                  </div>
                  <div className="pvp-rival-label">Next RIVAL</div>
                </div>
              </div>

              {/* Нижняя часть (25%) - стоимость и кнопка */}
              <div className="pvp-card-bottom">
                <div className="pvp-card-cost">
                  Entry pass: <span className="pvp-cost-icon">🪙</span>50
                </div>
                <button 
                  className={`pvp-card-engage ${!hasBet ? 'disabled' : ''}`}
                  onClick={() => handleEngage(tournament)}
                  disabled={isDisabled}
                >
                  ENGAGE {!hasBet && <span className="pvp-lock-icon">🔒</span>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Модальное окно арены */}
      {arenaData && (
        <ArenaModal
          tournament={arenaData.tournament}
          userSelections={userSelections}
          userAvatar={userAvatar}
          userDamage={getUserDamageForTournament(arenaData.tournament) || 0}
          userName={userName}
          rivalData={arenaData.rival}
          weightClasses={arenaData.weightClasses}
          isOpen={true}
          onSurrender={handleSurrender}
        />
      )}
    </div>
  );
};

export default Pvp;