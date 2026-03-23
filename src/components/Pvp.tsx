// src/components/Pvp.tsx

import React, { useState } from 'react';
import { Tournament, SelectedFighter, Fighter } from '../types';
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
    fightersData: Fighter[];  // ← добавили fightersData
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
  
  const [isEngaging, setIsEngaging] = useState(false);

  const hasUserBetOnTournament = (tournament: Tournament): boolean => {
    return userSelections.some(sel => 
      tournament.data?.some(f => f.Fighter === sel.fighter.Fighter)
    );
  };

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

  const handleEngage = async (tournament: Tournament) => {
    if (!userId || isEngaging || arenaData) return;
    
    setIsEngaging(true);
    
    try {
      const tournamentData = await loadTournamentData(tournament.name);
      
      // Создаем карту бойцов для быстрого поиска по имени
      const fightersMap = new Map<string, Fighter>();
      tournamentData.fightersData.forEach((fighter: Fighter) => {
        fightersMap.set(fighter.Fighter, fighter);
      });
      
      // Обогащаем выборы пользователя полной статистикой
      const enrichedUserSelections = userSelections.map(sel => ({
        ...sel,
        fighter: fightersMap.get(sel.fighter.Fighter) || sel.fighter
      }));
      
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
      
      // Обогащаем выборы соперника полной статистикой
      const enrichedRivalSelections = selectedRival.selections.map(sel => ({
        ...sel,
        fighter: fightersMap.get(sel.fighter.Fighter) || sel.fighter
      }));
      
      // Открываем арену с обогащенными данными
      setArenaData({
        tournament,
        weightClasses: tournamentData.weightClasses,
        rival: {
          username: selectedRival.username,
          photoUrl: rivalProfile?.photoUrl,
          totalDamage: selectedRival.totalDamage,
          selections: enrichedRivalSelections
        }
      });
      
    } catch (error) {
      console.error('Ошибка при поиске соперника:', error);
      alert('Error finding rival');
      setIsEngaging(false);
    }
  };

  const handleSurrender = () => {
    setArenaData(null);
    setIsEngaging(false);
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
          const isDisabled = !!arenaData || isEngaging || !hasBet;
          
          return (
            <div key={tournament.id} className="pvp-tournament-card">
              {/* Верхняя часть */}
              <div className="pvp-card-top">
                <div className="pvp-card-league" style={{ backgroundColor: '#B20101' }}>
                  <span>{tournament.league || 'UFC'}</span>
                </div>
                <div className="pvp-card-name">
                  {tournament.name}
                </div>
              </div>

              {/* Средняя часть */}
              <div className="pvp-card-middle">
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

                <div className="pvp-middle-center">
                  <img 
                    src={`${BASE_URL}/VS_logo.webp`} 
                    alt="VS" 
                    className="pvp-vs-logo"
                  />
                </div>

                <div className="pvp-middle-right">
                  <div className="pvp-rival-avatar">
                    <img src={`${BASE_URL}/default-avatar.png`} alt="rival" />
                  </div>
                </div>
              </div>

              {/* Нижняя часть */}
              <div className="pvp-card-bottom">
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

                <div className="pvp-bottom-right">
                  <button 
                    className={`pvp-engage-button ${isEngaging ? 'loading' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => handleEngage(tournament)}
                    disabled={isDisabled}
                  >
                    {isEngaging ? 'SEARCHING...' : `ENTRY PASS: 50 🪙`}
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