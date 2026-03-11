// src/components/Pvp.tsx

import React from 'react';
import { Tournament, SelectedFighter } from '../types';

interface PvpProps {
  pastTournaments: Tournament[];
  userSelections: SelectedFighter[];
}

const Pvp: React.FC<PvpProps> = ({
  pastTournaments,
  userSelections,
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
              {/* Верхняя часть карточки (65%) */}
              <div className="pvp-card-top">
                {/* Левая часть - лига */}
                <div className="pvp-card-league" style={{ backgroundColor: '#B20101' }}>
                  <span>{tournament.league || 'UFC'}</span>
                </div>
                
                {/* Центральная часть - название турнира */}
                <div className="pvp-card-name">
                  {tournament.name}
                </div>
                
                {/* Правая часть - урон игрока */}
                <div className="pvp-card-damage">
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

              {/* Нижняя часть карточки (35%) */}
              <div className="pvp-card-bottom">
                {/* Левая часть - стоимость */}
                <div className="pvp-card-cost">
                  Entry pass: <span className="pvp-cost-icon">🪙</span>50
                </div>
                
                {/* Правая часть - кнопка ENGAGE (неактивная) */}
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