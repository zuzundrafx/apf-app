// src/components/Pvp.tsx (исправлен)
import { useState, forwardRef, useImperativeHandle, useEffect, useCallback, useRef } from 'react';
import { Tournament, SelectedFighter, Fighter, UserResult } from '../types';
import { UserProfile } from '../api/userProfiles';
import ArenaModal from './ArenaModal';

interface PvpProps {
  pastTournaments: Tournament[];
  userBets: Map<number, any>; // вместо userSelections
  userAvatar?: string;
  userId?: string;
  userName: string;
  userStyle?: 'striker' | 'grappler' | null;
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
  authToken?: string; // <-- ДОБАВИТЬ
  onUpdateExperience?: (expData: { 
    totalExp: number; 
    level: number; 
    currentExp: number; 
    nextLevelExp: number;
    expPoints: number;
  }) => void;
}

export interface PvpRef {
  engage: (tournament: Tournament, betAmount: number) => Promise<void>;
}

type IntervalId = ReturnType<typeof setInterval>;

const LOADING_TIPS = [
  "💡 TIP: Bet multipliers by result: KO grants you 2x, Unanimous Decision - 1.5x, Split Decision - 1.25x, DRAW - 1x (refund), LOSS = 0x.",
  "💡 TIP: Higher bet amounts increase your potential rewards, but also the risk. Choose wisely!",
  "💡 TIP: Winning fighters earn you TICKETS, which can be used for special PvP battles with higher rewards!",
  "💡 TIP: Save your coins for upcoming tournaments — the more you bet, the bigger the prize pool!",
  "💡 TIP: Each round features a random weight class, with fighters from that class participating in the tournament!"
];

const Pvp = forwardRef<PvpRef, PvpProps>(({
  pastTournaments,
  userBets,
  userAvatar,
  userId,
  userName,
  userCoins,
  userTickets,
  userStyle,
  allProfiles,
  onOpenBetModal,
  onUpdateBalance,
  onClaimRewards,
  loadTournamentData,
  authToken, // <-- ДОБАВИТЬ
  onUpdateExperience,
}, ref) => {
  const [arenaData, setArenaData] = useState<{
    tournament: Tournament;
    pvpBetAmount: number;
  } | null>(null);
  
  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  
  const [currentTip, setCurrentTip] = useState<string>(LOADING_TIPS[0]);
  const tipIntervalRef = useRef<IntervalId | null>(null);

  const getRandomTip = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * LOADING_TIPS.length);
    return LOADING_TIPS[randomIndex];
  }, []);

  const startTipRotation = useCallback(() => {
    if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    setCurrentTip(getRandomTip());
    tipIntervalRef.current = setInterval(() => {
      setCurrentTip(getRandomTip());
    }, 5000);
  }, [getRandomTip]);

  const stopTipRotation = useCallback(() => {
    if (tipIntervalRef.current) {
      clearInterval(tipIntervalRef.current);
      tipIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTipRotation();
  }, [stopTipRotation]);

  const getUserDamageForTournament = (tournament: Tournament): number | null => {
    const bet = userBets.get(Number(tournament.id));
    if (!bet) return null;
    return bet.total_damage || 0;
  };

  const checkCanJoinPvp = (tournament: Tournament): { canJoin: boolean; reason: string } => {
    const hasBet = userBets.has(Number(tournament.id));
    
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

  const handlePvpClick = (tournament: Tournament) => {
    console.log('🖱️ Pvp button clicked for tournament:', tournament.name);
    const { canJoin, reason } = checkCanJoinPvp(tournament);
    console.log('   canJoin:', canJoin, 'reason:', reason);
    if (!canJoin) {
      if (reason) {
        setMessageText(reason);
        setShowMessage(true);
        setTimeout(() => setShowMessage(false), 1000);
      }
      return;
    }
    console.log('   Opening bet modal...');
    onOpenBetModal(tournament);
  };
  
  const handleEngage = async (tournament: Tournament, betAmount: number): Promise<void> => {
    console.log('⚔️ engage called with tournament:', tournament.name, 'betAmount:', betAmount);
    if (!userId) {
      console.warn('❌ userId is missing, cannot start PvP');
      return;
    }
    if (arenaData) {
      console.warn('❌ arenaData already exists, cannot start new battle');
      return;
    }
    console.log('✅ Starting arena, betAmount:', betAmount);
    startTipRotation();
    setArenaData({ tournament, pvpBetAmount: betAmount });
  };

  const handleSurrender = async () => {
  stopTipRotation();
  
  // Обновляем баланс после боя (запрашиваем актуальный с сервера)
  if (authToken && onUpdateBalance) {
    try {
      const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';
      const profileResponse = await fetch(`${API_BASE}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        await onUpdateBalance(profile.coins, profile.tickets);
      }
    } catch (e) {
      console.error('Failed to update balance:', e);
    }
  }
  
  setArenaData(null);
};

  useImperativeHandle(ref, () => ({
    engage: handleEngage
  }));

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  // Показываем все завершённые турниры без ограничения в 3
  const completedTournaments = pastTournaments.filter(t => t.status === 'completed');

  return (
    <div className="pvp-screen">
      <div className="pvp-header">
        <div className="pvp-header-title">ACTIVE TOURNAMENTS</div>
      </div>

      <div className="pvp-list">
        {completedTournaments.map((tournament) => {
          const userDamage = getUserDamageForTournament(tournament);
          const hasBet = userBets.has(Number(tournament.id));
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
  {/* Grid: 1 строка, 4 столбца */}
  <div style={{
    display: 'grid',
    gridTemplateRows: '100%',
    gridTemplateColumns: 'repeat(4, 25%)',
    width: '100%',
    height: '100%',
  }}>
    
    {/* ===== ЯЧЕЙКА 1 (строка 1, колонка 1) ===== */}
    <div style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Слой 1: BaseLeague_icon.webp — 90% ширины ячейки */}
      <img 
        src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
        alt="base league"
        style={{
          width: '80%',
          aspectRatio: '1/1',
          objectFit: 'contain',
          position: 'absolute',
        }}
      />
      {/* Слой 2: ContenderLeague_icon.webp — 80% ширины ячейки */}
      <img 
        src={`${BASE_URL}/icons/ContenderLeague_icon.webp`}
        alt="contender league"
        style={{
          width: '55%',
          aspectRatio: '1/1',
          objectFit: 'contain',
          position: 'absolute',
        }}
      />
      {/* Слой 3: BaseLeague_icon.webp — 20% ширины ячейки, правый нижний угол */}
      <img 
        src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
        alt="small base league"
        style={{
          width: '40%',
          aspectRatio: '1/1',
          objectFit: 'contain',
          position: 'absolute',
          right: 0,
          bottom: '10%',
        }}
      />
      {/* Слой 4: BaseLeague_icon.webp — 70% от маленькой, чёрный фильтр, по центру */}
      <img 
        src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
        alt="black small base league"
        style={{
          width: '28%', // 40% * 0.7 = 14% от ширины ячейки
          aspectRatio: '1/1',
          objectFit: 'contain',
          position: 'absolute',
          right: '6%', // центрирование относительно маленькой иконки (40% - 28%) / 2 = 6%
          bottom: '6%',
          filter: 'brightness(0)',
        }}
      />
      {/* Текст "3" поверх чёрной иконки */}
      <span style={{
        position: 'absolute',
        right: '3%',
        bottom: '3%',
        width: '21%',
        aspectRatio: '1/1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: 'clamp(10px, 4vw, 20px)',
        fontWeight: 700,
        zIndex: 10,
      }}>
        3
      </span>
    </div>

    {/* Ячейки 2-8 пока пустые */}
    <div /> {/* строка 1, колонка 2 */}
    <div /> {/* строка 1, колонка 3 */}
    <div /> {/* строка 1, колонка 4 */}
    <div /> {/* строка 2, колонка 1 */}
    <div /> {/* строка 2, колонка 2 */}
    <div /> {/* строка 2, колонка 3 */}
    <div /> {/* строка 2, колонка 4 */}

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
                      <span className="pvp-damage-na">No bet</span>
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
          userSelections={userBets.get(Number(arenaData.tournament.id))?.selections || []}
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
          authToken={authToken}
          onUpdateExperience={onUpdateExperience}
          userStyle={userStyle}
        />
      )}
    </div>
  );
});

export default Pvp;