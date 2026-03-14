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
    
    setIsEngaging(true);
    
    try {
      const tournamentData = await loadTournamentData(tournament.name);
      
      const rivals = tournamentData.results.filter(r => r.userId !== userId);
      
      console.log(`🔍 Найдено соперников: ${rivals.length}`);
      
      if (rivals.length === 0) {
        alert('No rivals available for this tournament');
        setIsEngaging(false);
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * rivals.length);
      const selectedRival = rivals[randomIndex];
      const rivalProfile = allProfiles.get(selectedRival.userId);
      
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
      
      setIsEngaging(false);
      
    } catch (error) {
      console.error('Ошибка при поиске соперника:', error);
      alert('Error finding rival');
      setIsEngaging(false);
    }
  };

  const handleSurrender = () => {
    setArenaData(null);
  };

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  return (
    <div className="pvp-screen">
      {arenaData && <div className="pvp-overlay" />}
      
      <div className="pvp-header">
        <div className="pvp-header-title">ACTIVE TOURNAMENTS</div>
      </div>

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
                {/* Левая часть (43%) - только аватарка игрока */}
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
                </div>

                {/* Центральная часть (14%) - VS логотип */}
                <div className="pvp-middle-center">
                  <img 
                    src={`${BASE_URL}/VS_logo.webp`} 
                    alt="VS" 
                    className="pvp-vs-logo"
                  />
                </div>

                {/* Правая часть (43%) - только аватарка противника */}
                <div className="pvp-middle-right">
                  <div className="pvp-rival-avatar">
                    <img src={`${BASE_URL}/default-avatar.png`} alt="rival" />
                  </div>
                </div>
              </div>

              {/* Нижняя часть (25%) - урон и кнопка */}
              <div className="pvp-card-bottom">
                {/* Левая часть - урон */}
                <div className="pvp-bottom-left">
                  <div className={`pvp-damage-block ${!hasBet ? 'disabled' : ''}`}>
                    {userDamage !== null ? (
                      <>
                        <span className="pvp-damage-value">{userDamage}</span>
                        <span className="pvp-fist-icon">👊</span>
                      </>
                    ) : (
                      <span className="pvp-damage-na">not available</span>
                    )}
                  </div>
                </div>

                {/* Правая часть - кнопка */}
                <div className="pvp-bottom-right">
                  <button 
                    className={`pvp-engage-button ${!hasBet ? 'disabled' : ''}`}
                    onClick={() => handleEngage(tournament)}
                    disabled={isDisabled}
                  >
                    ENTRY PASS: 50 <span className="pvp-cost-icon">🪙</span>
                    {!hasBet && <span className="pvp-lock-icon">🔒</span>}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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