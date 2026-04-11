// src/components/Pvp.tsx

import { useState, forwardRef, useImperativeHandle, useEffect, useCallback, useRef } from 'react';
import { Tournament, SelectedFighter, Fighter, UserResult } from '../types';
import { UserProfile } from '../api/userProfiles';
import ArenaModal from './ArenaModal';

interface PvpProps {
  pastTournaments: Tournament[];
  userSelections: SelectedFighter[];
  userAvatar?: string;
  userId?: string;
  userName: string;
  userCoins: number;
  userTickets: number;
  allProfiles: Map<string, UserProfile>;
  onOpenBetModal: (tournament: Tournament) => void;
  onUpdateBalance: (coins: number, tickets: number) => Promise<void>;
  onClaimRewards: (rewards: { coins: number; experience: number }) => Promise<void>;
  loadTournamentData: (tournamentName: string) => Promise<{
    weightClasses: string[];
    results: UserResult[];
    fightersData: Fighter[];
  }>;
}

export interface PvpRef {
  engage: (tournament: Tournament, betAmount: number) => Promise<void>;
}

// Тип для интервала (浏览器环境)
type IntervalId = ReturnType<typeof setInterval>;

// Список советов для загрузки
const LOADING_TIPS = [
  "💡 TIP: Bet multipliers by result: KO grants you 2x, Unanimous Decision - 1.5x, Split Decision - 1.25x, DRAW - 1x (refund), LOSS = 0x.",
  "💡 TIP: Higher bet amounts increase your potential rewards, but also the risk. Choose wisely!",
  "💡 TIP: Winning fighters earn you TICKETS, which can be used for special PvP battles with higher rewards!",
  "💡 TIP: Save your coins for upcoming tournaments — the more you bet, the bigger the prize pool!",
  "💡 TIP: Each round features a random weight class, with fighters from that class participating in the tournament!"
];

const Pvp = forwardRef<PvpRef, PvpProps>(({
  pastTournaments,
  userSelections,
  userAvatar,
  userId,
  userName,
  userCoins,
  userTickets,
  allProfiles,
  onOpenBetModal,
  onUpdateBalance,
  onClaimRewards,
  loadTournamentData,
}, ref) => {
  const [arenaData, setArenaData] = useState<{
    tournament: Tournament;
    pvpBetAmount: number;
  } | null>(null);
  
  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  
  // Состояния для советов при загрузке
  const [currentTip, setCurrentTip] = useState<string>(LOADING_TIPS[0]);
  const tipIntervalRef = useRef<IntervalId | null>(null);

  // Функция для получения случайного совета
  const getRandomTip = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * LOADING_TIPS.length);
    return LOADING_TIPS[randomIndex];
  }, []);

  // Запуск ротации советов
  const startTipRotation = useCallback(() => {
    // Очищаем предыдущий интервал
    if (tipIntervalRef.current) {
      clearInterval(tipIntervalRef.current);
      tipIntervalRef.current = null;
    }
    
    // Устанавливаем первый случайный совет
    setCurrentTip(getRandomTip());
    
    // Запускаем интервал для смены советов каждые 5 секунд
    tipIntervalRef.current = setInterval(() => {
      setCurrentTip(getRandomTip());
    }, 5000);
  }, [getRandomTip]);

  // Остановка ротации советов
  const stopTipRotation = useCallback(() => {
    if (tipIntervalRef.current) {
      clearInterval(tipIntervalRef.current);
      tipIntervalRef.current = null;
    }
  }, []);

  // Очистка интервала при размонтировании
  useEffect(() => {
    return () => {
      stopTipRotation();
    };
  }, [stopTipRotation]);

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

  const checkCanJoinPvp = (tournament: Tournament): { canJoin: boolean; reason: string } => {
    const hasBet = hasUserBetOnTournament(tournament);
    
    if (!hasBet) {
      return { canJoin: false, reason: '' };
    }
    
    if (userCoins < 5 && userTickets < 1) {
      return { canJoin: false, reason: 'Not enough coins & tickets' };
    }
    if (userCoins < 5) {
      return { canJoin: false, reason: 'Not enough coins' };
    }
    if (userTickets < 1) {
      return { canJoin: false, reason: 'Not enough tickets' };
    }
    
    return { canJoin: true, reason: '' };
  };

  const handleEngage = async (tournament: Tournament, betAmount: number): Promise<void> => {
    if (!userId || arenaData) return;
    
    // Запускаем ротацию советов при открытии арены
    startTipRotation();
    
    setArenaData({
      tournament,
      pvpBetAmount: betAmount
    });
  };

  const handlePvpClick = (tournament: Tournament) => {
    const { canJoin, reason } = checkCanJoinPvp(tournament);
    
    if (!canJoin) {
      if (reason) {
        setMessageText(reason);
        setShowMessage(true);
        setTimeout(() => setShowMessage(false), 1000);
      }
      return;
    }
    
    onOpenBetModal(tournament);
  };

  const handleSurrender = () => {
    // Останавливаем ротацию советов при закрытии арены
    stopTipRotation();
    setArenaData(null);
  };

  useImperativeHandle(ref, () => ({
    engage: handleEngage
  }));

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  return (
    <div className="pvp-screen">
      <div className="pvp-header">
        <div className="pvp-header-title">ACTIVE TOURNAMENTS</div>
      </div>

      <div className="pvp-list">
        {pastTournaments.slice(0, 3).map((tournament) => {
          const userDamage = getUserDamageForTournament(tournament);
          const hasBet = hasUserBetOnTournament(tournament);
          const isDisabled = !!arenaData || !hasBet;
          
          return (
            <div key={tournament.id} className="pvp-tournament-card" style={{ position: 'relative' }}>
              <div className="pvp-card-top">
                <div className="pvp-card-league" style={{ backgroundColor: '#B20101' }}>
                  <span>{tournament.league || 'UFC'}</span>
                </div>
                <div className="pvp-card-name">
                  {tournament.name}
                </div>
              </div>

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
                    className={`pvp-engage-button ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => handlePvpClick(tournament)}
                    disabled={isDisabled}
                  >
                    ENTRY BET
                  </button>
                </div>
              </div>

              {showMessage && (
                <div className="upcoming-overlay-text">
                  {messageText}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {arenaData && (
        <ArenaModal
          tournament={arenaData.tournament}
          userSelections={userSelections}
          userAvatar={userAvatar}
          userDamage={0}
          userName={userName}
          rivalData={null as any}
          weightClasses={[]}
          isOpen={true}
          onSurrender={handleSurrender}
          pvpMode={true}
          pvpBetAmount={arenaData.pvpBetAmount}
          userId={userId}
          userCoins={userCoins}
          userTickets={userTickets}
          allProfiles={allProfiles}
          onUpdateBalance={onUpdateBalance}
          onClaimRewards={onClaimRewards}
          loadTournamentData={loadTournamentData}
          loadingTip={currentTip}
        />
      )}
    </div>
  );
});

export default Pvp;