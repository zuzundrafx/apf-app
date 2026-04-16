// src/components/ArenaModal.tsx – ФИНАЛЬНАЯ ВЕРСИЯ (исправлено отображение наград)
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Tournament, SelectedFighter, UserResult, Fighter } from '../types';
import { UserProfile } from '../api/userProfiles';
import BattleResultModal from './BattleResultModal';

interface ArenaModalProps {
  tournament: Tournament;
  userSelections: SelectedFighter[];
  userAvatar?: string;
  userDamage: number;
  userName: string;
  rivalData: {
    username: string;
    photoUrl?: string;
    totalDamage: number;
    selections: SelectedFighter[];
  };
  weightClasses: string[];
  isOpen: boolean;
  onSurrender: () => void;
  pvpMode?: boolean;
  pvpBetAmount?: number;
  userId?: string;
  userCoins?: number;
  userTickets?: number;
  allProfiles?: Map<string, UserProfile>;
  onUpdateBalance?: (coins: number, tickets: number) => Promise<void>;
  onClaimRewards?: (rewards: { coins: number; experience: number }) => Promise<void>;
  loadTournamentData?: (tournamentName: string) => Promise<{
    weightClasses: string[];
    results: UserResult[];
    fightersData: Fighter[];
  }>;
  loadingTip?: string;
  authToken?: string;
}

const DEFAULT_LOADING_TIPS = [
  "💡 TIP: Bet multipliers by result: KO grants you 2x, Unanimous Decision - 1.5x, Split Decision - 1.25x, DRAW - 1x (refund), LOSS = 0x.",
  "💡 TIP: Higher bet amounts increase your potential rewards, but also the risk. Choose wisely!",
  "💡 TIP: Winning fighters earn you TICKETS, which can be used for special PvP battles with higher rewards!",
  "💡 TIP: Save your coins for upcoming tournaments — the more you bet, the bigger the prize pool!",
  "💡 TIP: Each round features a random weight class, with fighters from that class participating in the tournament!"
];

const getAvatarFilename = (weightClass: string): string => {
  const map: { [key: string]: string } = {
    'Flyweight': 'Flyweight_avatar.png',
    'Bantamweight': 'Bantamweight_avatar.png',
    'Featherweight': 'Featherweight_avatar.png',
    'Lightweight': 'Lightweight_avatar.png',
    'Welterweight': 'Welterweight_avatar.png',
    'Middleweight': 'Middleweight_avatar.png',
    'Light Heavyweight': 'Light_Heavyweight_avatar.png',
    'Heavyweight': 'Heavyweight_avatar.png',
    "Women's Strawweight": "Women's_Strawweight_avatar.png",
    "Women's Flyweight": "Women's_Flyweight_avatar.png",
    "Women's Bantamweight": "Women's_Bantamweight_avatar.png",
    "Catch Weight": 'default-avatar.png'
  };
  return map[weightClass] || 'default-avatar.png';
};

const getWeightClassColor = (weightClass: string): string => {
  const colors: { [key: string]: string } = {
    'Flyweight': '#00FFA3',
    'Bantamweight': '#00E0FF',
    'Featherweight': '#0075FF',
    'Lightweight': '#AD00FF',
    'Welterweight': '#FF00D6',
    'Middleweight': '#FFD700',
    'Light Heavyweight': '#FF5C00',
    'Heavyweight': '#FF0000',
    "Women's Strawweight": '#FF6B9D',
    "Women's Flyweight": '#5EEAD4',
    "Women's Bantamweight": '#818CF8',
    "Catch Weight": '#94A3B8'
  };
  return colors[weightClass] || '#666666';
};

const getFighterStyle = (fighter: SelectedFighter): string => {
  const str = Number(fighter.fighter.Str) || 0;
  const td = Number(fighter.fighter.Td) || 0;
  const sub = Number(fighter.fighter.Sub) || 0;
  const tdSubSum = td + sub;
  if (tdSubSum >= 2 && str < 50) return 'Grappler';
  if (str >= 50 && tdSubSum < 2) return 'Striker';
  if (str >= 50 && tdSubSum >= 2) return 'Universal';
  return 'Simple';
};

const getStyleIconFilename = (style: string): string => {
  const icons: { [key: string]: string } = {
    'Grappler': 'Grappler_style_icon.webp',
    'Striker': 'Striker_style_icon.webp',
    'Universal': 'Universal_style_icon.webp',
    'Simple': 'Simple_style_icon.webp'
  };
  return icons[style] || 'Simple_style_icon.webp';
};

type BattleEvent = {
  type: 'countdown' | 'round-start' | 'card-appear' | 'damage' | 'round-end' | 'battle-end';
  round?: number;
  weightClass?: string;
  userActiveCards?: SelectedFighter[];
  rivalActiveCards?: SelectedFighter[];
  userDamage?: number;
  rivalDamage?: number;
  userHealthAfter?: number;
  rivalHealthAfter?: number;
  result?: any;
};

type IntervalId = ReturnType<typeof setInterval>;

const ArenaModal: React.FC<ArenaModalProps> = ({
  tournament,
  userSelections,
  userAvatar,
  userName,
  isOpen,
  onSurrender,
  pvpMode,
  pvpBetAmount,
  userId,
  userCoins,
  userTickets,
  allProfiles,
  onUpdateBalance,
  onClaimRewards,
  loadTournamentData,
  loadingTip,
  authToken,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [battleScript, setBattleScript] = useState<BattleEvent[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [showRoundText, setShowRoundText] = useState(false);
  const [userHealth, setUserHealth] = useState(1000);
  const [rivalHealth, setRivalHealth] = useState(1000);
  const [userActiveCards, setUserActiveCards] = useState<SelectedFighter[]>([]);
  const [rivalActiveCards, setRivalActiveCards] = useState<SelectedFighter[]>([]);
  const [usedWeightClasses, setUsedWeightClasses] = useState<string[]>([]);
  const [battleResult, setBattleResult] = useState<{
    isOpen: boolean;
    result: 'win' | 'loss' | 'draw' | 'tech-loss';
    resultType?: 'ko' | 'decision-unanimous' | 'decision-split';
  } | null>(null);
  const [battleRewards, setBattleRewards] = useState<{ coins: number; experience: number } | null>(null);
  const [countdownStep, setCountdownStep] = useState<'ready' | 'steady' | 'fight' | null>('ready');
  const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false, false, false]);
  const [animatedDamage, setAnimatedDamage] = useState<{ player: number; rival: number }>({ player: 0, rival: 0 });
  const [showDamageIncrease, setShowDamageIncrease] = useState<{ player: boolean; rival: boolean }>({ player: false, rival: false });
  const [showDamageNumber, setShowDamageNumber] = useState<{ player: number | null; rival: number | null }>({ player: null, rival: null });
  const [shakeScreen, setShakeScreen] = useState(false);
  const [healthFlash, setHealthFlash] = useState<'player' | 'rival' | null>(null);
  const [isBattleLoaded, setIsBattleLoaded] = useState(false);
  const [currentLoadingTip, setCurrentLoadingTip] = useState<string>(loadingTip || DEFAULT_LOADING_TIPS[0]);
  const tipIntervalRef = useRef<IntervalId | null>(null);
  const [rivalData, setRivalData] = useState<{
    username: string;
    photoUrl?: string;
    totalDamage: number;
    selections: SelectedFighter[];
  } | null>(null);
  const [weightClasses, setWeightClasses] = useState<string[]>([]);

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
  const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

  const getRandomTip = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * DEFAULT_LOADING_TIPS.length);
    return DEFAULT_LOADING_TIPS[randomIndex];
  }, []);

  const startTipRotation = useCallback(() => {
    if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    setCurrentLoadingTip(loadingTip || DEFAULT_LOADING_TIPS[0]);
    tipIntervalRef.current = setInterval(() => {
      setCurrentLoadingTip(getRandomTip());
    }, 5000);
  }, [loadingTip, getRandomTip]);

  const stopTipRotation = useCallback(() => {
    if (tipIntervalRef.current) {
      clearInterval(tipIntervalRef.current);
      tipIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTipRotation();
  }, [stopTipRotation]);

  const applyHitEffect = (target: 'player' | 'rival', damage: number) => {
    const avatarElement = document.querySelector(
      target === 'player' ? '.arena-bottom .arena-avatar' : '.arena-top .arena-avatar'
    );
    if (!avatarElement) return;
    let glowColor = '';
    if (damage < 50) glowColor = 'rgba(255, 255, 255, 0.3)';
    else if (damage >= 50 && damage < 150) glowColor = 'rgba(255, 255, 0, 0.3)';
    else glowColor = 'rgba(255, 0, 0, 0.3)';
    avatarElement.classList.remove('avatar-hit', 'avatar-glow');
    void (avatarElement as HTMLElement).offsetHeight;
    avatarElement.classList.add('avatar-hit');
    (avatarElement as HTMLElement).style.setProperty('--glow-color', glowColor);
    avatarElement.classList.add('avatar-glow');
    setTimeout(() => {
      avatarElement.classList.remove('avatar-hit', 'avatar-glow');
      (avatarElement as HTMLElement).style.removeProperty('--glow-color');
    }, 300);
  };

  // ========== PvP через API ==========
  useEffect(() => {
    if (!isOpen || !pvpMode || !userId || !tournament.id || pvpBetAmount === undefined) return;

    const startPvpBattle = async () => {
      setIsLoading(true);
      startTipRotation();

      try {
        console.log(`🚀 PvP API call: tournamentId=${tournament.id}, betAmount=${pvpBetAmount}`);
        const response = await fetch(`${API_BASE}/api/pvp/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken || ''}`
          },
          body: JSON.stringify({
            tournamentId: Number(tournament.id),
            betAmount: pvpBetAmount
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'PvP request failed');
        }

        const data = await response.json();
        console.log('✅ PvP response:', data);

        if (onUpdateBalance && data.updatedBalance) {
          await onUpdateBalance(data.updatedBalance.coins, data.updatedBalance.tickets);
        }

        const rival = data.rival;
        const rivalSelections = rival.selections.map((sel: any) => ({
          weightClass: sel.weightClass,
          fighter: {
            Fighter: sel.fighter.Fighter,
            'Total Damage': sel.fighter['Total Damage'],
            'W/L': sel.fighter['W/L'],
            Str: sel.fighter.Str,
            Td: sel.fighter.Td,
            Sub: sel.fighter.Sub,
            Method: sel.fighter.Method,
            Round: sel.fighter.Round,
            Time: sel.fighter.Time,
            'Weight class': sel.weightClass,
          }
        }));

        setRivalData({
          username: rival.username,
          photoUrl: rival.photoUrl,
          totalDamage: rivalSelections.reduce((s: number, c: any) => s + c.fighter['Total Damage'], 0),
          selections: rivalSelections
        });

        setBattleRewards(data.rewards);
        setWeightClasses(['Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Heavyweight']);

        if (data.battleScript && data.battleScript.events) {
          setBattleScript(data.battleScript.events);
          // Предзагрузка изображений
          const allCards = new Set<string>();
          data.battleScript.events.forEach((event: any) => {
            if (event.type === 'card-appear') {
              event.userActiveCards?.forEach((card: any) => allCards.add(`${BASE_URL}/avatars/${getAvatarFilename(card.weightClass)}`));
              event.rivalActiveCards?.forEach((card: any) => allCards.add(`${BASE_URL}/avatars/${getAvatarFilename(card.weightClass)}`));
            }
          });
          await Promise.allSettled(Array.from(allCards).map(src => new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = resolve;
            img.onerror = reject;
          })));
        } else {
          // fallback (не должен вызываться)
          setBattleScript([{ type: 'countdown' }, { type: 'battle-end', result: { isOpen: true, result: 'draw' } }]);
        }

        setIsLoading(false);
        setIsBattleLoaded(true);
        stopTipRotation();
      } catch (error: any) {
        console.error('❌ PvP error:', error);
        alert(error.message || 'Failed to start PvP battle');
        stopTipRotation();
        onSurrender();
      }
    };

    startPvpBattle();
  }, [isOpen, pvpMode, tournament.id, pvpBetAmount, userId, authToken]);

  const playNextEvent = () => {
    if (currentEventIndex >= battleScript.length) return;
    const event = battleScript[currentEventIndex];
    console.log('🎬 Event:', event);

    switch (event.type) {
      case 'countdown':
        setCountdownStep('ready');
        setTimeout(() => setCountdownStep('steady'), 1000);
        setTimeout(() => setCountdownStep('fight'), 2000);
        setTimeout(() => {
          setCountdownStep(null);
          setCurrentEventIndex(prev => prev + 1);
        }, 3000);
        break;

      case 'round-start':
        setShowRoundText(true);
        setTimeout(() => {
          setShowRoundText(false);
          setCurrentEventIndex(prev => prev + 1);
        }, 1000);
        break;

      case 'card-appear':
        setUsedWeightClasses(prev => [...prev, event.weightClass!]);
        const cardIndex = event.round! - 1;
        setFlippedCards(prev => {
          const newFlipped = [...prev];
          newFlipped[cardIndex] = true;
          return newFlipped;
        });
        const currentPlayerDamage = userActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0);
        const currentRivalDamage = rivalActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0);
        const newPlayerDamage = (event.userActiveCards || []).reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0);
        const newRivalDamage = (event.rivalActiveCards || []).reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0);
        const playerDamageIncreased = newPlayerDamage > currentPlayerDamage;
        const rivalDamageIncreased = newRivalDamage > currentRivalDamage;
        setTimeout(() => {
          setUserActiveCards(event.userActiveCards || []);
          setRivalActiveCards(event.rivalActiveCards || []);
          setAnimatedDamage({ player: newPlayerDamage, rival: newRivalDamage });
          setShowDamageIncrease({ player: playerDamageIncreased, rival: rivalDamageIncreased });
          setTimeout(() => setShowDamageIncrease({ player: false, rival: false }), 500);
          setTimeout(() => setCurrentEventIndex(prev => prev + 1), 1200);
        }, 300);
        break;

      case 'damage':
        const playerDamageDealt = event.userDamage || 0;
        const rivalDamageDealt = event.rivalDamage || 0;
        setRivalHealth(event.rivalHealthAfter!);
        if (playerDamageDealt > 0) {
          setShowDamageNumber({ player: null, rival: playerDamageDealt });
          setHealthFlash('rival');
          applyHitEffect('rival', playerDamageDealt);
          if (playerDamageDealt > 50) {
            setShakeScreen(true);
            setTimeout(() => setShakeScreen(false), 400);
          }
        }
        setTimeout(() => {
          setUserHealth(event.userHealthAfter!);
          if (rivalDamageDealt > 0) {
            setShowDamageNumber({ player: rivalDamageDealt, rival: null });
            setHealthFlash('player');
            applyHitEffect('player', rivalDamageDealt);
            if (rivalDamageDealt > 50) {
              setShakeScreen(true);
              setTimeout(() => setShakeScreen(false), 400);
            }
          }
          setTimeout(() => {
            setShowDamageNumber({ player: null, rival: null });
            setHealthFlash(null);
          }, 1000);
          setTimeout(() => setCurrentEventIndex(prev => prev + 1), 750);
        }, 750);
        break;

      case 'round-end':
        setCurrentRound(prev => prev + 1);
        setTimeout(() => setCurrentEventIndex(prev => prev + 1), 400);
        break;

      case 'battle-end':
        // Награды уже установлены из ответа сервера (для PvP) или будут рассчитаны (для обычного режима)
        setBattleResult(event.result);
        break;
    }
  };

  useEffect(() => {
    if (!isLoading && battleScript.length > 0) {
      playNextEvent();
    }
  }, [currentEventIndex, isLoading, battleScript]);

  const handleResultClose = () => {
    setBattleResult(null);
    onSurrender();
  };

  const handleSurrender = () => {
    setBattleResult({ isOpen: true, result: 'tech-loss' });
  };

  const getCountdownText = () => {
    if (countdownStep === 'ready') return 'READY?';
    if (countdownStep === 'steady') return 'STEADY';
    if (countdownStep === 'fight') return 'FIGHT!';
    return null;
  };

  if (!isOpen) return null;

  const countdownText = getCountdownText();
  const displayRivalData = rivalData;
  const displayWeightClasses = weightClasses;

  if (isLoading || !displayRivalData || displayWeightClasses.length === 0) {
    return (
      <div className="arena-modal-overlay">
        <div className="arena-modal">
          <div className="arena-octagon">
            <img src={`${BASE_URL}/backgrounds/Arena_1_bg.webp`} alt="Octagon" className="octagon-image" />
          </div>
          <div className="arena-loading">
            <div className="arena-loading-text">LOADING ARENA...</div>
            <div className="arena-loading-spinner"></div>
            <div className="arena-loading-tip-container">
              <div className="arena-loading-tip">{currentLoadingTip}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="arena-modal-overlay">
      <div className={`arena-modal ${shakeScreen ? 'shake' : ''} ${isBattleLoaded ? 'battle-loaded' : ''}`}>
        <div className="arena-octagon">
          <img src={`${BASE_URL}/backgrounds/Arena_1_bg.webp`} alt="Octagon" className="octagon-image" />
        </div>
        {countdownText && <div className="battle-overlay-text">{countdownText}</div>}
        {showRoundText && <div className="battle-overlay-text">ROUND {currentRound}</div>}
        <div className="arena-header">
          <div className="arena-header-left">{tournament.name}</div>
          <div className="arena-header-right">
            <button className="arena-surrender-button" onClick={handleSurrender}>SURRENDER</button>
          </div>
        </div>

        <div className="arena-top">
          <div className="arena-avatar-container">
            <div className="arena-avatar-left">
              <div className="arena-damage-display rival-damage">
                <div className="damage-username">{displayRivalData.username}</div>
                <div className="damage-divider"></div>
                <span className="damage-label">DAMAGE</span>
                <span className={`damage-value ${showDamageIncrease.rival ? 'damage-increase' : ''}`}>
                  {animatedDamage.rival > 0 ? animatedDamage.rival : rivalActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
                </span>
              </div>
            </div>
            <div className="arena-avatar-center">
              <div className="arena-avatar">
                <img src={displayRivalData.photoUrl || `${BASE_URL}/default-avatar.png`} alt="rival" onError={(e) => { (e.target as HTMLImageElement).src = `${BASE_URL}/default-avatar.png`; }} />
              </div>
            </div>
            <div className="arena-avatar-right"></div>
          </div>
          {showDamageNumber.rival && <div className="damage-number rival-damage">-{showDamageNumber.rival}</div>}
          <div className="arena-rival-health">
            <div className={`arena-health-bar ${healthFlash === 'rival' ? 'damage-flash' : ''}`}>
              <div className="arena-health-fill" style={{ width: `${(rivalHealth / 1000) * 100}%` }}></div>
              <span className="arena-health-text">HP {rivalHealth}/1000</span>
            </div>
          </div>
          <div className="arena-rival-fighters">
            {rivalActiveCards.map((card, index) => {
              const style = getFighterStyle(card);
              const styleIcon = getStyleIconFilename(style);
              return (
                <div key={index} className="arena-fighter-card" data-weight={card.weightClass} style={{ backgroundColor: getWeightClassColor(card.weightClass) }}>
                  <div className="fighter-damage-block">{Math.round(card.fighter['Total Damage'])}</div>
                  <div className="fighter-card-inner">
                    <div className="fighter-icon-container">
                      <img src={`${BASE_URL}/icons/${styleIcon}`} alt={style} className="fighter-style-icon" onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) { parent.innerHTML = style === 'Striker' ? '👊' : style === 'Grappler' ? '🤼' : style === 'Universal' ? '⚡' : '👤'; parent.style.fontSize = '24px'; }
                      }} />
                    </div>
                    <div className="fighter-divider" style={{ color: getWeightClassColor(card.weightClass) }}></div>
                    <div className="fighter-name-container">{card.fighter.Fighter}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="arena-middle">
          {[0, 1, 2, 3, 4].map((roundIndex) => {
            const roundNumber = roundIndex + 1;
            const isUsed = roundNumber <= usedWeightClasses.length;
            const weightClass = isUsed ? usedWeightClasses[roundIndex] : null;
            const isFlipped = flippedCards[roundIndex];
            const getWeightCardClass = (wc: string | null): string => {
              if (!wc) return '';
              const m: { [k: string]: string } = {
                'Flyweight': 'weight-card-flyweight', 'Bantamweight': 'weight-card-bantamweight', 'Featherweight': 'weight-card-featherweight',
                'Lightweight': 'weight-card-lightweight', 'Welterweight': 'weight-card-welterweight', 'Middleweight': 'weight-card-middleweight',
                'Light Heavyweight': 'weight-card-light-heavyweight', 'Heavyweight': 'weight-card-heavyweight',
                "Women's Strawweight": 'weight-card-womens-strawweight', "Women's Flyweight": 'weight-card-womens-flyweight',
                "Women's Bantamweight": 'weight-card-womens-bantamweight', "Catch Weight": 'weight-card-catch-weight'
              };
              return m[wc] || '';
            };
            const getWeightClassIcon = (wc: string | null): string => {
              if (!wc) return '';
              const i: { [k: string]: string } = {
                'Flyweight': 'Flyweight_icon.webp', 'Bantamweight': 'Bantamweight_icon.webp', 'Featherweight': 'Featherweight_icon.webp',
                'Lightweight': 'Lightweight_icon.webp', 'Welterweight': 'Welterweight_icon.webp', 'Middleweight': 'Middleweight_icon.webp',
                'Light Heavyweight': 'Ligh_Heavyweight_icon.webp', 'Heavyweight': 'Heavyweight_icon.webp',
                "Women's Strawweight": "Women's_Strawweight_icon.webp", "Women's Flyweight": "Women's_Flyweight_icon.webp",
                "Women's Bantamweight": "Women's_Bantamweight_icon.webp", "Catch Weight": 'Catch_weight_icon.webp'
              };
              return i[wc] || 'default_icon.webp';
            };
            return (
              <div key={roundIndex} className={`arena-round-card ${isFlipped ? 'flipped' : ''}`}>
                <div className="arena-round-card-inner">
                  <div className="arena-round-card-front">
                    <div className="arena-round-number">
                      <div className="arena-round-digit">{roundNumber}</div>
                      <div className="arena-round-text">ROUND</div>
                    </div>
                  </div>
                  <div className={`arena-round-card-back ${getWeightCardClass(weightClass)}`}>
                    <div className="weight-card-inner">
                      <div className="weight-card-icon-container">
                        {weightClass && <img src={`${BASE_URL}/icons/${getWeightClassIcon(weightClass)}`} alt={weightClass} className="weight-card-icon" onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) { parent.innerHTML = weightClass.substring(0, 2); parent.style.fontSize = '20px'; parent.style.fontWeight = 'bold'; }
                        }} />}
                      </div>
                      <div className="weight-card-divider"></div>
                      <div className="weight-card-name">{weightClass || 'TBD'}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="arena-bottom">
          <div className="arena-player-fighters">
            {userActiveCards.map((card, index) => {
              const style = getFighterStyle(card);
              const styleIcon = getStyleIconFilename(style);
              return (
                <div key={index} className="arena-fighter-card" data-weight={card.weightClass} style={{ backgroundColor: getWeightClassColor(card.weightClass) }}>
                  <div className="fighter-damage-block">{Math.round(card.fighter['Total Damage'])}</div>
                  <div className="fighter-card-inner">
                    <div className="fighter-icon-container">
                      <img src={`${BASE_URL}/icons/${styleIcon}`} alt={style} className="fighter-style-icon" onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) { parent.innerHTML = style === 'Striker' ? '👊' : style === 'Grappler' ? '🤼' : style === 'Universal' ? '⚡' : '👤'; parent.style.fontSize = '24px'; }
                      }} />
                    </div>
                    <div className="fighter-divider" style={{ color: getWeightClassColor(card.weightClass) }}></div>
                    <div className="fighter-name-container">{card.fighter.Fighter}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="arena-player-health">
            <div className={`arena-health-bar ${healthFlash === 'player' ? 'damage-flash' : ''}`}>
              <div className="arena-health-fill" style={{ width: `${(userHealth / 1000) * 100}%` }}></div>
              <span className="arena-health-text">HP {userHealth}/1000</span>
            </div>
          </div>
          <div className="arena-avatar-container">
            <div className="arena-avatar-left">
              <div className="arena-damage-display player-damage">
                <div className="damage-username">{userName}</div>
                <div className="damage-divider"></div>
                <span className="damage-label">DAMAGE</span>
                <span className={`damage-value ${showDamageIncrease.player ? 'damage-increase' : ''}`}>
                  {animatedDamage.player > 0 ? animatedDamage.player : userActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
                </span>
              </div>
            </div>
            <div className="arena-avatar-center">
              <div className="arena-avatar">
                <img src={userAvatar || `${BASE_URL}/Home_button.png`} alt="player" onError={(e) => { (e.target as HTMLImageElement).src = `${BASE_URL}/Home_button.png`; }} />
              </div>
            </div>
            <div className="arena-avatar-right"></div>
          </div>
          {showDamageNumber.player && <div className="damage-number player-damage">-{showDamageNumber.player}</div>}
        </div>
      </div>
      {battleResult && (
        <BattleResultModal
          isOpen={battleResult.isOpen}
          result={battleResult.result}
          resultType={battleResult.resultType}
          rewards={battleRewards || undefined}
          betAmount={pvpMode ? (pvpBetAmount || 0) : 0}
          winningRound={currentRound}
          userAvatar={userAvatar}
          rivalAvatar={displayRivalData?.photoUrl}
          userName={userName}
          rivalName={displayRivalData?.username}
          onClose={handleResultClose}
        />
      )}
    </div>
  );
};

export default ArenaModal;