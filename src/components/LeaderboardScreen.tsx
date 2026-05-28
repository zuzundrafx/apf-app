// src/components/LeaderboardScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { getAvatarWrapperStyle, getAvatarInnerStyle } from '../utils/styleUtils';
import { getWeightClassColor } from '../utils/weightUtils';
import { getFighterStyleFromSelected, getStyleIconFilename } from '../utils/fighterUtils';

const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

const LeaderboardItem: React.FC<{ 
  entry: any; 
  currentUserId?: string; 
  currentUserPhoto?: string; 
  profile?: any; 
  userStyle?: 'striker' | 'grappler' | null;
  tier: 'base' | 'pro' | 'elite' | 'legend';
  isExpanded: boolean;
  onToggle: (userId: string) => void;
  tournamentId: string;
  authToken?: string;
}> = ({ entry, currentUserId, currentUserPhoto, profile, userStyle, tier, isExpanded, onToggle, tournamentId, authToken }) => {
  const [selections, setSelections] = useState<any[]>([]);
  const [loadingSelections, setLoadingSelections] = useState(false);

  const getAvatarSource = (): string | null => {
    if (profile?.photoUrl) return profile.photoUrl;
    if (entry.userId === currentUserId && currentUserPhoto) return currentUserPhoto;
    return null;
  };

  const avatarUrl = getAvatarSource();
  const entryStyle = entry.userId === currentUserId ? userStyle : entry.style;
  
  const getRpIcon = () => {
    if (tier === 'pro') return `${BASE_URL}/icons/ProRP_icon.webp`;
    if (tier === 'elite') return `${BASE_URL}/icons/EliteRP_icon.webp`;
    if (tier === 'legend') return `${BASE_URL}/icons/LegendRP_icon.webp`;
    return null;
  };
  
  const rpIcon = getRpIcon();

  // Загрузка бойцов при раскрытии панели
  useEffect(() => {
    if (isExpanded && selections.length === 0 && !loadingSelections && authToken) {
      const loadUserFighters = async () => {
        setLoadingSelections(true);
        try {
          const response = await fetch(
            `${API_BASE}/api/bets/user/${entry.userId}/tournament/${tournamentId}`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
          );
          if (response.ok) {
            const bet = await response.json();
            if (bet && bet.selections) {
              setSelections(bet.selections);
              // Определяем тип урона для карточек
              if (tier !== 'base' && entry.pvpDamage && bet.selections.length > 0) {
                // Рассчитываем PvP урон на каждого бойца пропорционально их Base урону
                const totalBaseDamage = bet.selections.reduce((sum: number, sel: any) => sum + (sel.fighter['Total Damage'] || 0), 0);
                if (totalBaseDamage > 0) {
                  const updatedSelections = bet.selections.map((sel: any) => ({
                    ...sel,
                    fighter: {
                      ...sel.fighter,
                      'PvP Damage': Math.round((sel.fighter['Total Damage'] || 0) / totalBaseDamage * entry.pvpDamage)
                    }
                  }));
                  setSelections(updatedSelections);
                }
              }
            }
          }
        } catch (err) {
          console.error('Failed to load user fighters:', err);
        } finally {
          setLoadingSelections(false);
        }
      };
      loadUserFighters();
    }
  }, [isExpanded, entry.userId, tournamentId, authToken, selections.length, loadingSelections, tier, entry.pvpDamage]);

  const handleRowClick = () => {
    onToggle(entry.userId);
  };

  const getDamageForFighter = (sel: any): number => {
    if (tier === 'base') {
      return sel.fighter['Total Damage'] || 0;
    }
    // Для рейтинговых лиг — используем PvP Damage
    return sel.fighter['PvP Damage'] || sel.fighter['Total Damage'] || 0;
  };

  return (
    <>
      <div className="leaderboard-item" onClick={handleRowClick} style={{ cursor: 'pointer' }}>
        <span className="leaderboard-rank">#{entry.rank}</span>
        <div className="leaderboard-user-info">
          <div className="leaderboard-avatar" style={getAvatarWrapperStyle(entryStyle)}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={entry.username} 
                style={getAvatarInnerStyle()} 
                onError={(e) => { 
                  (e.target as HTMLImageElement).style.display = 'none'; 
                  const parent = (e.target as HTMLImageElement).parentElement; 
                  if (parent) parent.innerHTML = '👤'; 
                }} 
              />
            ) : (
              <span>👤</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="leaderboard-username">{entry.username}</span>
            <span style={{ fontSize: 'clamp(8px, 2vw, 10px)', color: '#FFFFFF' }}>Lvl {entry.level}</span>
          </div>
        </div>
        
        {/* P.dmg / B.dmg внутри leaderboard-score (градиентный фон) */}
        <div className="leaderboard-score" style={{ display: 'flex', alignItems: 'center' }}>
          {tier === 'base' ? (
            <span>B.dmg: {entry.totalDamage}</span>
          ) : (
            <span>P.dmg: {entry.pvpDamage || entry.totalDamage}</span>
          )}
        </div>
        
        {/* RP блок отдельно, на чёрном фоне (только для рейтинговых лиг) */}
        {tier !== 'base' && (
          <div style={{ 
            background: '#1C1D1F', 
            padding: 'clamp(3px, 1vh, 6px) clamp(6px, 1.5vw, 10px)', 
            borderRadius: 'clamp(3px, 1vw, 6px)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'clamp(2px, 0.8vw, 4px)',
            marginLeft: 'clamp(6px, 2vw, 12px)'
          }}>
            <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 'clamp(11px, 3vw, 14px)' }}>
              {entry.totalDamage}
            </span>
            {rpIcon && <img src={rpIcon} alt="RP" style={{ width: 'auto', height: 'clamp(10px, 4.0vw, 16px)' }} />}
          </div>
        )}
      </div>

      {/* Раскрывающаяся панель с карточками бойцов */}
      {isExpanded && (
        <div className="leaderboard-expanded-panel" style={{ 
          marginLeft: 'clamp(30px, 10vw, 40px)',
          marginRight: 'clamp(8px, 2vw, 16px)',
          marginBottom: 'clamp(8px, 2vh, 12px)',
          padding: 'clamp(8px, 2vh, 12px)',
          background: '#2A2A2A',
          borderRadius: 'clamp(8px, 2vw, 12px)'
        }}>
          {loadingSelections ? (
            <div style={{ color: '#FFFFFF', textAlign: 'center', padding: 'clamp(10px, 3vh, 20px)' }}>
              LOADING FIGHTERS...
            </div>
          ) : selections.length > 0 ? (
            <div className="selected-fighters-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(5, 1fr)', 
              gap: 'clamp(4px, 1vw, 8px)',
              width: '100%'
            }}>
              {selections.map((sel: any, idx: number) => {
                const style = getFighterStyleFromSelected(sel.fighter);
                const styleIcon = getStyleIconFilename(style);
                const damageValue = getDamageForFighter(sel);
                
                return (
                  <div 
                    key={idx} 
                    className="selected-fighter-card" 
                    data-weight={sel.weightClass} 
                    style={{ 
                      backgroundColor: getWeightClassColor(sel.weightClass),
                      aspectRatio: '1 / 1.4'
                    }}
                  >
                    <div className="selected-fighter-damage-box">{damageValue}</div>
                    <div className="selected-fighter-inner">
                      <div className="selected-fighter-icon-container">
                        <img 
                          src={`${BASE_URL}/icons/${styleIcon}`} 
                          alt={style} 
                          className="selected-fighter-icon" 
                          onError={(e) => { 
                            (e.target as HTMLImageElement).style.display = 'none'; 
                            const p = (e.target as HTMLImageElement).parentElement; 
                            if (p) { 
                              p.innerHTML = style === 'Striker' ? '👊' : style === 'Grappler' ? '🤼' : style === 'Universal' ? '⚡' : '👤'; 
                              p.style.fontSize = 'clamp(16px, 4vw, 20px)'; 
                            } 
                          }} 
                        />
                      </div>
                      <div className="selected-fighter-divider" style={{ color: getWeightClassColor(sel.weightClass) }}></div>
                      <div className="selected-fighter-name">{sel.fighter.Fighter}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#FFFFFF', textAlign: 'center', padding: 'clamp(10px, 3vh, 20px)' }}>
              NO BETS FOUND
            </div>
          )}
        </div>
      )}
    </>
  );
};

interface LeaderboardScreenProps {
  tournaments: any[];
  currentUserId?: string;
  currentUserPhoto?: string;
  userStyle?: 'striker' | 'grappler' | null;
  allProfiles: Map<string, any>;
  onLoadLeaderboard: (tournamentId: string, tier: 'base' | 'pro' | 'elite' | 'legend') => Promise<any[]>;
  authToken?: string;
}

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  tournaments,
  currentUserId,
  currentUserPhoto,
  userStyle,
  allProfiles,
  onLoadLeaderboard,
  authToken
}) => {
  const [leaderboardTier, setLeaderboardTier] = useState<'base' | 'pro' | 'elite' | 'legend'>('base');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatTournamentName = (name: string): string => {
    if (!name) return '';
    let result = name.replace(/^UFC\s*/i, '');
    result = result.replace(/_/g, ' ');
    return result;
  };

  const getLeagueColor = (league: string): string => {
    const leagueUpper = (league || 'UFC').toUpperCase();
    if (leagueUpper === 'UFC') return '#B20101';
    if (leagueUpper === 'PFL') return '#0550B2';
    return '#313130';
  };

  const groupedTournaments = {
    UFC: tournaments.filter(t => (t.league || 'UFC').toUpperCase() === 'UFC'),
    PFL: tournaments.filter(t => (t.league || '').toUpperCase() === 'PFL'),
    ONE: tournaments.filter(t => (t.league || '').toUpperCase() === 'ONE')
  };

  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournament) {
      if (groupedTournaments.UFC.length > 0) {
        setSelectedTournament(groupedTournaments.UFC[0]);
      } else if (groupedTournaments.PFL.length > 0) {
        setSelectedTournament(groupedTournaments.PFL[0]);
      } else if (groupedTournaments.ONE.length > 0) {
        setSelectedTournament(groupedTournaments.ONE[0]);
      }
    }
  }, [tournaments]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedTournament) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setExpandedUserId(null); // Сбрасываем раскрытого игрока при смене турнира
      try {
        const result = await onLoadLeaderboard(selectedTournament.id, leaderboardTier);
        setData(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [selectedTournament?.id, leaderboardTier, onLoadLeaderboard]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTournamentSelect = (tournament: any) => {
    setSelectedTournament(tournament);
    setIsDropdownOpen(false);
    setExpandedUserId(null);
  };

  const handleToggleUser = (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
    }
  };

  const currentLeague = (selectedTournament?.league || 'UFC').toUpperCase();
  const leagueColor = getLeagueColor(currentLeague);
  const displayText = `${currentLeague}: ${selectedTournament ? formatTournamentName(selectedTournament.name) : 'NO TOURNAMENT'}`;

  return (
    <div className="leaderboard-screen">
      {/* Блок с выбором турнира */}
      <div className="leaderboard-tournament-selector" ref={dropdownRef}>
        <div 
          className="leaderboard-tournament-header"
          style={{ backgroundColor: leagueColor }}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <span className="leaderboard-tournament-header-text">{displayText}</span>
          <svg 
            className={`leaderboard-dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}
            width="32" 
            height="32" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="#E3C800" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        
        {isDropdownOpen && (
          <div className="leaderboard-dropdown-list">
            {Object.entries(groupedTournaments).map(([league, leagueTournaments]) => {
              if (leagueTournaments.length === 0) return null;
              const leagueColorDropdown = getLeagueColor(league);
              return (
                <div key={league} className="leaderboard-dropdown-group">
                  <div className="leaderboard-dropdown-group-header" style={{ backgroundColor: leagueColorDropdown }}>
                    {league}
                  </div>
                  {leagueTournaments.map((tournament) => (
                    <div 
                      key={tournament.id}
                      className={`leaderboard-dropdown-item ${selectedTournament?.id === tournament.id ? 'active' : ''}`}
                      onClick={() => handleTournamentSelect(tournament)}
                    >
                      {formatTournamentName(tournament.name)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Кнопки тиров (без скругления сверху) */}
      <div className="leaderboard-tier-buttons">
        <button 
          className={`leaderboard-tier-btn ${leaderboardTier === 'base' ? 'active' : 'inactive'}`}
          onClick={() => {
            setLeaderboardTier('base');
            setExpandedUserId(null);
          }}
        >
          BASE
        </button>
        <button 
          className={`leaderboard-tier-btn ${leaderboardTier === 'pro' ? 'active' : 'inactive'}`}
          onClick={() => {
            setLeaderboardTier('pro');
            setExpandedUserId(null);
          }}
        >
          PRO
        </button>
        <button 
          className={`leaderboard-tier-btn ${leaderboardTier === 'elite' ? 'active' : 'inactive'}`}
          onClick={() => {
            setLeaderboardTier('elite');
            setExpandedUserId(null);
          }}
        >
          ELITE
        </button>
        <button 
          className={`leaderboard-tier-btn ${leaderboardTier === 'legend' ? 'active' : 'inactive'}`}
          onClick={() => {
            setLeaderboardTier('legend');
            setExpandedUserId(null);
          }}
        >
          LEGEND
        </button>
      </div>

      {/* Список рейтинга */}
      {loading ? (
        <div className="leaderboard-loading">LOADING...</div>
      ) : data.length > 0 ? (
        <div className="leaderboard-list">
          {data.map((entry, index) => (
            <LeaderboardItem 
              key={entry.userId || index} 
              entry={entry} 
              currentUserId={currentUserId} 
              currentUserPhoto={currentUserPhoto} 
              profile={allProfiles.get(entry.userId)} 
              userStyle={userStyle}
              tier={leaderboardTier}
              isExpanded={expandedUserId === entry.userId}
              onToggle={handleToggleUser}
              tournamentId={selectedTournament?.id || ''}
              authToken={authToken}
            />
          ))}
        </div>
      ) : (
        <div className="leaderboard-empty">NO RESULTS YET</div>
      )}
    </div>
  );
};

export default LeaderboardScreen;