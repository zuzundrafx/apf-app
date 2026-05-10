// src/components/Pvp.tsx (исправлен)
import { useState, forwardRef, useImperativeHandle, useEffect, useCallback, useRef } from 'react';
import { Tournament, SelectedFighter, Fighter, UserResult } from '../types';
import { UserProfile } from '../api/userProfiles';
import ArenaModal from './ArenaModal';

interface PvpProps {
  pastTournaments: Tournament[];
  userBets: Map<number, any>;
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
  authToken?: string;
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
  authToken,
  onUpdateExperience,
}, ref) => {
  const [arenaData, setArenaData] = useState<{
    tournament: Tournament;
    pvpBetAmount: number;
  } | null>(null);
  
  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState('');

  const [selectedTier, setSelectedTier] = useState<string>('ufc_contenders');
  const [tiersConfig, setTiersConfig] = useState<any[]>([]);
  const [tiersProgress, setTiersProgress] = useState<Map<string, any>>(new Map());
  
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

  useEffect(() => {
    const loadTiersData = async () => {
      if (!authToken || pastTournaments.length === 0) return;
      try {
        const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';
        
        const configResponse = await fetch(`${API_BASE}/api/ranking-tiers/config`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (configResponse.ok) {
          const configs = await configResponse.json();
          setTiersConfig(configs);
          
          for (const tournament of pastTournaments) {
            const progressResponse = await fetch(
              `${API_BASE}/api/ranking-tiers/progress?tournament_id=${tournament.id}`,
              { headers: { 'Authorization': `Bearer ${authToken}` } }
            );
            if (progressResponse.ok) {
              const data = await progressResponse.json();
              setTiersProgress(prev => {
                const newMap = new Map(prev);
                data.progress?.forEach((p: any) => {
                  newMap.set(`${p.tournament_id}_${p.tier_name}`, p);
                });
                return newMap;
              });
            }
          }
        }
      } catch (e) {
        console.error('Failed to load tiers data:', e);
      }
    };
    loadTiersData();
  }, [authToken, pastTournaments]);

  const getUserDamageForTournament = (tournament: Tournament): number | null => {
    const bet = userBets.get(Number(tournament.id));
    if (!bet) return null;
    return bet.total_damage || 0;
  };

  const checkCanJoinPvp = (tournament: Tournament): { canJoin: boolean; reason: string } => {
    const hasBet = userBets.has(Number(tournament.id));
    if (!hasBet) return { canJoin: false, reason: '' };
    if (userCoins < 5 && userTickets < 1) return { canJoin: false, reason: 'Not enough coins & tickets' };
    if (userCoins < 5) return { canJoin: false, reason: 'Not enough coins' };
    if (userTickets < 1) return { canJoin: false, reason: 'Not enough tickets' };
    return { canJoin: true, reason: '' };
  };

  const isTierUnlocked = (tierName: string, tournamentId: string): boolean => {
    if (tierName.endsWith('_contenders')) return true;
    const progress = tiersProgress.get(`${tournamentId}_${tierName}`);
    if (!progress) return false;
    return progress.tier_levels_remaining === 0;
  };

  const handlePvpClick = (tournament: Tournament) => {
    console.log('🖱️ Pvp button clicked for tournament:', tournament.name);
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

  const handleEngage = async (tournament: Tournament, betAmount: number): Promise<void> => {
    console.log('⚔️ engage called with tournament:', tournament.name, 'betAmount:', betAmount);
    if (!userId) return;
    if (arenaData) return;
    startTipRotation();
    setArenaData({ tournament, pvpBetAmount: betAmount });
  };

  const handleSurrender = async () => {
    stopTipRotation();
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
  const completedTournaments = pastTournaments.filter(t => t.status === 'completed');

  return (
    <div className="pvp-screen">
      <div className="pvp-header">
        <div className="pvp-header-title">ACTIVE TOURNAMENTS</div>
      </div>

      <div className="pvp-list">
        {completedTournaments.map((tournament) => {
          const hasBet = userBets.has(Number(tournament.id));
          const isDisabled = !!arenaData || !hasBet;
          const selectedConfig = tiersConfig.find(c => c.tier_name === selectedTier);
          const selectedUnlocked = isTierUnlocked(selectedTier, tournament.id);
          
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
                <div style={{
                  display: 'grid',
                  gridTemplateRows: '100%',
                  gridTemplateColumns: 'repeat(4, 25%)',
                  width: '100%',
                  height: '100%',
                }}>
                  
                  {/* ===== Contenders League ===== */}
                  {(() => {
                    const unlocked = isTierUnlocked('ufc_contenders', tournament.id);
                    const isSelected = selectedTier === 'ufc_contenders';
                    return (
                      <div style={{
                        position: 'relative',
                        width: '85%',
                        aspectRatio: '1/1',
                        margin: 'auto',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                        transition: 'transform 0.2s ease',
                      }} onClick={() => setSelectedTier('ufc_contenders')}>
                        <img 
                          src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                          alt="base league"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            filter: 'saturate(0) brightness(0.7)',
                            opacity: isSelected ? 1 : 1,
                            position: 'relative',
                            zIndex: 1,
                          }}
                        />
                        
                        <img 
                          src={`${BASE_URL}/icons/ContenderLeague_icon.webp`}
                          alt="contender league"
                          style={{
                            width: '70%',
                            aspectRatio: '1/1',
                            objectFit: 'contain',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            opacity: isSelected ? 1 : 1,
                            zIndex: 2,
                          }}
                        />

                        <div style={{
                          position: 'absolute',
                          right: '-10%',
                          bottom: '-5%',
                          width: '40%',
                          aspectRatio: '1/1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 3,
                        }}>
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: '-8%',
                              left: '-8%',
                              width: '116%',
                              height: '116%',
                              borderRadius: '10%',
                              background: 'rgba(255, 255, 255, 0.25)',
                              boxShadow: '0 0 15px rgba(255, 255, 255, 0.5)',
                              zIndex: 0,
                            }} />
                          )}
                          <img 
                            src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                            alt="small base league"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              filter: 'saturate(0) brightness(0.7)',
                              position: 'relative',
                              zIndex: 1,
                            }}
                          />
                          
                          <div style={{
                            position: 'absolute',
                            width: '78%',
                            aspectRatio: '1/1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <img 
                              src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                              alt="black small base league"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                filter: 'brightness(0)',
                              }}
                            />
                            <span style={{
                              position: 'absolute',
                              color: '#FFFFFF',
                              fontSize: 'clamp(10px, 4vw, 20px)',
                              fontWeight: 700,
                            }}>
                              {(() => {
                                const progress = tiersProgress.get(`${tournament.id}_ufc_contenders`);
                                if (!progress) return '';
                                return progress.tier_levels_remaining === 0 ? '✓' : progress.tier_levels_remaining;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ===== Pro League ===== */}
                  {(() => {
                    const unlocked = isTierUnlocked('ufc_pro', tournament.id);
                    const isSelected = selectedTier === 'ufc_pro';
                    return (
                      <div style={{
                        position: 'relative',
                        width: '85%',
                        aspectRatio: '1/1',
                        margin: 'auto',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                        transition: 'transform 0.2s ease',
                      }} onClick={() => setSelectedTier('ufc_pro')}>
                        <img 
                          src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                          alt="base league"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            filter: 'saturate(0) brightness(0.7)',
                            opacity: isSelected ? 1 : (unlocked ? 1 : 0.4),
                            position: 'relative',
                            zIndex: 1,
                          }}
                        />
                        
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '70%',
                          aspectRatio: '1/1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          fontSize: 'clamp(10px, 3vw, 16px)',
                          fontWeight: 700,
                          opacity: isSelected ? 1 : (unlocked ? 1 : 0.4),
                          zIndex: 2,
                        }}>
                          PRO
                        </div>

                        {!unlocked && (
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: 'clamp(20px, 6vw, 30px)',
                            opacity: 0.8,
                            zIndex: 10,
                          }}>🔒</div>
                        )}

                        <div style={{
                          position: 'absolute',
                          right: '-10%',
                          bottom: '-5%',
                          width: '40%',
                          aspectRatio: '1/1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 3,
                        }}>
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: '-8%',
                              left: '-8%',
                              width: '116%',
                              height: '116%',
                              borderRadius: '10%',
                              background: 'rgba(255, 255, 255, 0.25)',
                              boxShadow: '0 0 15px rgba(255, 255, 255, 0.5)',
                              zIndex: 0,
                            }} />
                          )}
                          <img 
                            src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                            alt="small base league"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              filter: 'saturate(0) brightness(0.7)',
                              position: 'relative',
                              zIndex: 1,
                            }}
                          />
                          
                          <div style={{
                            position: 'absolute',
                            width: '78%',
                            aspectRatio: '1/1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <img 
                              src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                              alt="black small base league"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                filter: 'brightness(0)',
                              }}
                            />
                            <span style={{
                              position: 'absolute',
                              color: unlocked ? '#FFFFFF' : '#FF6B6B',
                              fontSize: 'clamp(10px, 4vw, 20px)',
                              fontWeight: 700,
                            }}>
                              {(() => {
                                const progress = tiersProgress.get(`${tournament.id}_ufc_pro`);
                                if (!progress) return '';
                                return progress.tier_levels_remaining === 0 ? '✓' : progress.tier_levels_remaining;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ===== Elite League ===== */}
                  {(() => {
                    const unlocked = isTierUnlocked('ufc_elite', tournament.id);
                    const isSelected = selectedTier === 'ufc_elite';
                    return (
                      <div style={{
                        position: 'relative',
                        width: '85%',
                        aspectRatio: '1/1',
                        margin: 'auto',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                        transition: 'transform 0.2s ease',
                      }} onClick={() => setSelectedTier('ufc_elite')}>
                        <img 
                          src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                          alt="base league"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            filter: 'saturate(0) brightness(0.7)',
                            opacity: isSelected ? 1 : (unlocked ? 1 : 0.4),
                            position: 'relative',
                            zIndex: 1,
                          }}
                        />
                        
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '70%',
                          aspectRatio: '1/1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          fontSize: 'clamp(10px, 3vw, 16px)',
                          fontWeight: 700,
                          opacity: isSelected ? 1 : (unlocked ? 1 : 0.4),
                          zIndex: 2,
                        }}>
                          ELITE
                        </div>

                        {!unlocked && (
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: 'clamp(20px, 6vw, 30px)',
                            opacity: 0.8,
                            zIndex: 10,
                          }}>🔒</div>
                        )}

                        <div style={{
                          position: 'absolute',
                          right: '-10%',
                          bottom: '-5%',
                          width: '40%',
                          aspectRatio: '1/1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 3,
                        }}>
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: '-8%',
                              left: '-8%',
                              width: '116%',
                              height: '116%',
                              borderRadius: '10%',
                              background: 'rgba(255, 255, 255, 0.25)',
                              boxShadow: '0 0 15px rgba(255, 255, 255, 0.5)',
                              zIndex: 0,
                            }} />
                          )}
                          <img 
                            src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                            alt="small base league"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              filter: 'saturate(0) brightness(0.7)',
                              position: 'relative',
                              zIndex: 1,
                            }}
                          />
                          
                          <div style={{
                            position: 'absolute',
                            width: '78%',
                            aspectRatio: '1/1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <img 
                              src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                              alt="black small base league"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                filter: 'brightness(0)',
                              }}
                            />
                            <span style={{
                              position: 'absolute',
                              color: unlocked ? '#FFFFFF' : '#FF6B6B',
                              fontSize: 'clamp(10px, 4vw, 20px)',
                              fontWeight: 700,
                            }}>
                              {(() => {
                                const progress = tiersProgress.get(`${tournament.id}_ufc_elite`);
                                if (!progress) return '';
                                return progress.tier_levels_remaining === 0 ? '✓' : progress.tier_levels_remaining;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ===== Legend League ===== */}
                  {(() => {
                    const unlocked = isTierUnlocked('ufc_legend', tournament.id);
                    const isSelected = selectedTier === 'ufc_legend';
                    return (
                      <div style={{
                        position: 'relative',
                        width: '85%',
                        aspectRatio: '1/1',
                        margin: 'auto',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                        transition: 'transform 0.2s ease',
                      }} onClick={() => setSelectedTier('ufc_legend')}>
                        <img 
                          src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                          alt="base league"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            filter: 'saturate(0) brightness(0.7)',
                            opacity: isSelected ? 1 : (unlocked ? 1 : 0.4),
                            position: 'relative',
                            zIndex: 1,
                          }}
                        />
                        
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '70%',
                          aspectRatio: '1/1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          fontSize: 'clamp(10px, 3vw, 16px)',
                          fontWeight: 700,
                          opacity: isSelected ? 1 : (unlocked ? 1 : 0.4),
                          zIndex: 2,
                        }}>
                          LEGEND
                        </div>

                        {!unlocked && (
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: 'clamp(20px, 6vw, 30px)',
                            opacity: 0.8,
                            zIndex: 10,
                          }}>🔒</div>
                        )}

                        <div style={{
                          position: 'absolute',
                          right: '-10%',
                          bottom: '-5%',
                          width: '40%',
                          aspectRatio: '1/1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 3,
                        }}>
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: '-8%',
                              left: '-8%',
                              width: '116%',
                              height: '116%',
                              borderRadius: '10%',
                              background: 'rgba(255, 255, 255, 0.25)',
                              boxShadow: '0 0 15px rgba(255, 255, 255, 0.5)',
                              zIndex: 0,
                            }} />
                          )}
                          <img 
                            src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                            alt="small base league"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              filter: 'saturate(0) brightness(0.7)',
                              position: 'relative',
                              zIndex: 1,
                            }}
                          />
                          
                          <div style={{
                            position: 'absolute',
                            width: '78%',
                            aspectRatio: '1/1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <img 
                              src={`${BASE_URL}/icons/BaseLeague_icon.webp`}
                              alt="black small base league"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                filter: 'brightness(0)',
                              }}
                            />
                            <span style={{
                              position: 'absolute',
                              color: unlocked ? '#FFFFFF' : '#FF6B6B',
                              fontSize: 'clamp(10px, 4vw, 20px)',
                              fontWeight: 700,
                            }}>
                              {(() => {
                                const progress = tiersProgress.get(`${tournament.id}_ufc_legend`);
                                if (!progress) return '';
                                return progress.tier_levels_remaining === 0 ? '✓' : progress.tier_levels_remaining;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>

              <div className="pvp-card-bottom" style={{ display: 'flex', width: '100%', background: '#484d52', borderTop: '1px solid #4A4A48' }}>
                <div style={{
                  width: '65%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '2px 6px',
                  gap: '2px',
                }}>
                  {(() => {
                    const config = selectedConfig;
                    const progress = tiersProgress.get(`${tournament.id}_${selectedTier}`);
                    const rpName = config?.ranking_points_name || '';
                    const rpValue = progress?.ranking_points || 0;
                    
                    const awardsParts = [];
                    if (config?.exp_multiplier) {
                      awardsParts.push(
                        <span key="exp" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          x{config.exp_multiplier} <span style={{ color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>EXP</span>
                        </span>
                      );
                    }
                    if (config?.coin_reward) {
                      awardsParts.push(
                        <span key="coins" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          , <img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="coins" style={{ width: 'auto', height: '1em', objectFit: 'contain' }} />
                        </span>
                      );
                    }
                    if (config?.ticket_rewards) {
                      awardsParts.push(
                        <span key="tickets" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          , x2 <img src={`${BASE_URL}/icons/Ticket_icon.webp`} alt="tickets" style={{ width: 'auto', height: '1em', objectFit: 'contain' }} />
                        </span>
                      );
                    }
                    if (config?.ton_reward) {
                      awardsParts.push(
                        <span key="ton" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          , <img src={`${BASE_URL}/icons/Ton_icon.webp`} alt="TON" style={{ width: 'auto', height: '1em', objectFit: 'contain' }} />
                        </span>
                      );
                    }
                    if (rpName) {
                      awardsParts.push(
                        <span key="rp" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          , {rpName}
                        </span>
                      );
                    }
                    
                    return (
                      <>
                        <div style={{ color: '#FFFFFF', fontSize: 'clamp(10px, 2.5vw, 12px)', lineHeight: 1.3 }}>
                          <div>Tier Awards:</div>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
                            {awardsParts}
                          </div>
                        </div>
                        <div style={{ color: '#FFD966', fontSize: 'clamp(10px, 2.5vw, 12px)' }}>
                          {rpName ? `${rpName}: ${rpValue}` : 'Training'}
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div style={{ width: '35%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                  <button 
                    className={`pvp-engage-button ${(isDisabled || !selectedUnlocked) ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!selectedUnlocked) return;
                      const config = selectedConfig;
                      if (!config || !hasBet) return;
                      
                      if (selectedTier === 'ufc_contenders') {
                        handleEngage(tournament, config.entry_fee_min);
                      } else {
                        onOpenBetModal(tournament);
                      }
                    }}
                    disabled={isDisabled || !selectedUnlocked}
                    style={{ width: '90%', height: '80%', fontSize: 'clamp(10px, 2.5vw, 12px)', lineHeight: 1.2 }}
                  >
                    {(() => {
                      const config = selectedConfig;
                      if (!config) return 'ENTRY BET';
                      return (
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span>ENTRY Fee:</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {config.entry_fee_min}/{config.entry_fee_max}
                            <img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="coins" style={{ width: 'auto', height: '1em', objectFit: 'contain' }} />
                            {config.tickets_fee > 0 && (
                              <>
                                , {config.tickets_fee}
                                <img src={`${BASE_URL}/icons/Ticket_icon.webp`} alt="tickets" style={{ width: 'auto', height: '1em', objectFit: 'contain' }} />
                              </>
                            )}
                          </span>
                        </span>
                      );
                    })()}
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