// src/components/Pvp.tsx

import React, { useState } from 'react';
import { Tournament, SelectedFighter } from '../types';
import { UserResult } from '../api/yandexUpload';
import { UserProfile } from '../api/userProfiles';

interface PvpProps {
  pastTournaments: Tournament[];
  userSelections: SelectedFighter[];
  userAvatar?: string;
  userId?: string;
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
  allProfiles,
  loadTournamentData,
}) => {
  // Состояния для режима боя
  const [engagedTournamentId, setEngagedTournamentId] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<'searching' | 'found' | 'no-rivals'>('searching');
  const [rivalData, setRivalData] = useState<{ username: string; photoUrl?: string; totalDamage: number } | null>(null);

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
    if (!userId) return;
    
    // Помечаем этот турнир как "в бою"
    setEngagedTournamentId(tournament.id);
    setSearchStatus('searching');
    setRivalData(null);
    
    try {
      // Загружаем данные турнира
      const tournamentData = await loadTournamentData(tournament.name);
      
      // Ищем соперников (исключая себя)
      const rivals = tournamentData.results.filter(r => r.userId !== userId);
      
      console.log(`🔍 Найдено соперников: ${rivals.length}`);
      
      if (rivals.length === 0) {
        console.log('❌ Соперников нет');
        setSearchStatus('no-rivals');
      } else {
        // Случайный выбор соперника
        const randomIndex = Math.floor(Math.random() * rivals.length);
        const selectedRival = rivals[randomIndex];
        
        console.log(`✅ Выбран соперник: ${selectedRival.username} (урон: ${selectedRival.totalDamage})`);
        
        // Получаем аватарку из allProfiles
        const rivalProfile = allProfiles.get(selectedRival.userId);
        
        setRivalData({
          username: selectedRival.username,
          photoUrl: rivalProfile?.photoUrl,
          totalDamage: selectedRival.totalDamage
        });
        setSearchStatus('found');
      }
      
    } catch (error) {
      console.error('Ошибка при поиске соперника:', error);
      setSearchStatus('no-rivals');
    }
  };

  // Обработчик SURRENDER
  const handleSurrender = () => {
    setEngagedTournamentId(null);
    setSearchStatus('searching');
    setRivalData(null);
  };

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  return (
    <div className="pvp-screen">
      {/* Затемнение фона когда есть активный бой */}
      {engagedTournamentId && <div className="pvp-overlay" />}
      
      {/* Кнопка SURRENDER (показывается только если есть активный бой) */}
      {engagedTournamentId && (
        <button className="pvp-surrender-button" onClick={handleSurrender}>
          SURRENDER
        </button>
      )}
      
      {/* Заголовок Active Tournaments */}
      <div className="pvp-header">
        <div className="pvp-header-title">ACTIVE TOURNAMENTS</div>
      </div>

      {/* Список турниров */}
      <div className={`pvp-list ${engagedTournamentId ? 'blurred' : ''}`}>
        {pastTournaments.slice(0, 3).map((tournament) => {
          const userDamage = getUserDamageForTournament(tournament);
          const isEngaged = engagedTournamentId === tournament.id;
          
          return (
            <div 
              key={tournament.id} 
              className={`pvp-tournament-card ${isEngaged ? 'engaged' : ''}`}
            >
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

                {/* Правая часть (45%) - аватарка соперника или "Next RIVAL" */}
                <div className="pvp-middle-right">
                  {isEngaged ? (
                    // В режиме боя показываем соперника
                    <>
                      <div className="pvp-rival-avatar">
                        <img 
                          src={rivalData?.photoUrl || `${BASE_URL}/default-avatar.png`} 
                          alt="rival"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `${BASE_URL}/default-avatar.png`;
                          }}
                        />
                      </div>
                      <div className="pvp-rival-damage">
                        {searchStatus === 'found' && rivalData ? (
                          <div className="pvp-damage-value">{rivalData.totalDamage}</div>
                        ) : searchStatus === 'no-rivals' ? (
                          <div className="pvp-no-rivals-text">No rivals</div>
                        ) : (
                          <div className="pvp-searching-text">???</div>
                        )}
                      </div>
                    </>
                  ) : (
                    // В обычном режиме показываем "Next RIVAL"
                    <>
                      <div className="pvp-rival-avatar">
                        <img src={`${BASE_URL}/default-avatar.png`} alt="rival" />
                      </div>
                      <div className="pvp-rival-label">Next RIVAL</div>
                    </>
                  )}
                </div>
              </div>

              {/* Нижняя часть (25%) - стоимость и кнопка */}
              <div className="pvp-card-bottom">
                <div className="pvp-card-cost">
                  Entry pass: <span className="pvp-cost-icon">🪙</span>50
                </div>
                <button 
                  className="pvp-card-engage"
                  onClick={() => handleEngage(tournament)}
                  disabled={!!engagedTournamentId} // Блокируем все кнопки если есть активный бой
                >
                  ENGAGE
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Статус поиска под карточкой (только для engaged турнира) */}
      {engagedTournamentId && (
        <div className="pvp-battle-status">
          {searchStatus === 'searching' && 'Searching for Rivals...'}
          {searchStatus === 'no-rivals' && 'There are no Rivals... Try Later'}
          {searchStatus === 'found' && rivalData && `Rival found: ${rivalData.username}`}
        </div>
      )}
    </div>
  );
};

export default Pvp;