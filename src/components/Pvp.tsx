import React from 'react';
import { Tournament, SelectedFighter } from '../types';

interface PvpProps {
  pastTournaments: Tournament[];
  userSelections: SelectedFighter[];
  username: string;
  level: number;
  currentExp: number;
  nextLevelExp: number;
  coins: number;
  photoUrl?: string;
  baseUrl: string;
}

const Pvp: React.FC<PvpProps> = ({
  pastTournaments,
  userSelections,
  username,
  level,
  currentExp,
  nextLevelExp,
  coins,
  photoUrl,
  baseUrl
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

  return (
    <div className="pvp-screen">
      {/* Верхняя панель (копируем из App.tsx) */}
      <header className="profile-header">
        <div className="profile-avatar">
          {photoUrl ? (
            <img src={photoUrl} alt="avatar" />
          ) : (
            <img src={`${baseUrl}/Home_button.png`} alt="avatar" />
          )}
        </div>
        <div className="profile-info">
          <div className="profile-name">{username}</div>
          <div className="level-bar">
            <div 
              className="level-progress" 
              style={{ width: `${(currentExp / nextLevelExp) * 100}%` }}
            ></div>
            <span className="level-text">
              Lvl {level} • {currentExp}/{nextLevelExp}
            </span>
          </div>
          <div className="profile-coins">🪙 {coins}</div>
        </div>
      </header>

      {/* Заголовок Active Tournaments */}
      <div className="pvp-header">
        <div className="pvp-header-title">ACTIVE TOURNAMENTS</div>
      </div>

      {/* Список турниров */}
      <div className="pvp-list">
        {pastTournaments.length > 0 ? (
          pastTournaments.map((tournament) => {
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
                    Cost: 50 coins
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
          })
        ) : (
          <div className="pvp-empty">NO ACTIVE TOURNAMENTS</div>
        )}
      </div>
    </div>
  );
};

export default Pvp;