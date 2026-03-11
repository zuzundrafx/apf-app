// src/components/Pvp.tsx

import React from 'react';
import { Tournament, SelectedFighter } from '../types';

interface PvpProps {
  pastTournaments: Tournament[];
  userSelections: SelectedFighter[];
  userAvatar?: string;  // ← добавляем пропс для аватарки
}

const Pvp: React.FC<PvpProps> = ({
  pastTournaments,
  userSelections,
  userAvatar,  // ← получаем аватарку
}) => {
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

  // Список лиг для пустых ячеек
  const otherLeagues = ['PFL', 'ONE', 'Bellator'];

  // Получаем baseUrl
  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  return (
    <div className="pvp-screen">
      {/* Заголовок Active Tournaments */}
      <div className="pvp-header">
        <div className="pvp-header-title">ACTIVE TOURNAMENTS</div>
      </div>

      {/* Список турниров */}
      <div className="pvp-list">
        {/* Сначала отображаем реальные турниры */}
        {pastTournaments.slice(0, 3).map((tournament) => {
          const userDamage = getUserDamageForTournament(tournament);
          
          return (
            <div key={tournament.id} className="pvp-tournament-card">
              {/* Верхняя часть (20%) - лига и название */}
              <div className="pvp-card-top">
                <div className="pvp-card-league" style={{ backgroundColor: '#B20101' }}>
                  <span>{tournament.league || 'UFC'}</span>
                </div>
                <div className="pvp-card-name">
                  {tournament.name}
                </div>
              </div>

              {/* Средняя часть (50%) - аватарки и VS */}
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
                        <div className="pvp-damage-label">Your Dmg:</div>
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

                {/* Правая часть (45%) - аватарка соперника и надпись */}
                <div className="pvp-middle-right">
                  <div className="pvp-rival-avatar">
                    <img src={`${BASE_URL}/default-avatar.png`} alt="rival" />
                  </div>
                  <div className="pvp-rival-label">Next RIVAL</div>
                </div>
              </div>

              {/* Нижняя часть (30%) - стоимость и кнопка */}
              <div className="pvp-card-bottom">
                <div className="pvp-card-cost">
                  Entry pass: <span className="pvp-cost-icon">🪙</span>50
                </div>
                <button 
                  className="pvp-card-engage disabled"
                  disabled
                >
                  ENGAGE
                </button>
              </div>
            </div>
          );
        })}

        {/* Добавляем пустые ячейки до 3 штук */}
        {pastTournaments.length < 3 && 
          otherLeagues.slice(0, 3 - pastTournaments.length).map((league, index) => (
            <div key={`empty-${league}`} className="pvp-empty-card">
              <div className="pvp-empty-content">
                {league}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
};

export default Pvp;