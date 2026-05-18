// src/components/LeaderboardScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { getAvatarWrapperStyle, getAvatarInnerStyle } from '../utils/styleUtils';

const LeaderboardItem: React.FC<{ 
  entry: any; 
  currentUserId?: string; 
  currentUserPhoto?: string; 
  profile?: any; 
  userStyle?: 'striker' | 'grappler' | null;
}> = ({ entry, currentUserId, currentUserPhoto, profile, userStyle }) => {
  const getAvatarSource = (): string | null => {
    if (profile?.photoUrl) return profile.photoUrl;
    if (entry.userId === currentUserId && currentUserPhoto) return currentUserPhoto;
    return null;
  };

  const avatarUrl = getAvatarSource();
  const entryStyle = entry.userId === currentUserId ? userStyle : entry.style;

  return (
    <div className="leaderboard-item">
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
        <span className="leaderboard-username">{entry.username}</span>
      </div>
      <span className="leaderboard-score">{entry.totalDamage}</span>
    </div>
  );
};

interface LeaderboardScreenProps {
  tournaments: any[];
  currentUserId?: string;
  currentUserPhoto?: string;
  userStyle?: 'striker' | 'grappler' | null;
  allProfiles: Map<string, any>;
  onLoadLeaderboard: (tournamentId: string, tier: 'base' | 'pro' | 'elite' | 'legend') => Promise<any[]>;
}

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  tournaments,
  currentUserId,
  currentUserPhoto,
  userStyle,
  allProfiles,
  onLoadLeaderboard
}) => {
  const [leaderboardTier, setLeaderboardTier] = useState<'base' | 'pro' | 'elite' | 'legend'>('base');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
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
  <polyline points="6 9 12 15 18 9" /> {/* Всегда одна форма */}
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
          onClick={() => setLeaderboardTier('base')}
        >
          BASE
        </button>
        <button 
          className={`leaderboard-tier-btn ${leaderboardTier === 'pro' ? 'active' : 'inactive'}`}
          onClick={() => setLeaderboardTier('pro')}
        >
          PRO
        </button>
        <button 
          className={`leaderboard-tier-btn ${leaderboardTier === 'elite' ? 'active' : 'inactive'}`}
          onClick={() => setLeaderboardTier('elite')}
        >
          ELITE
        </button>
        <button 
          className={`leaderboard-tier-btn ${leaderboardTier === 'legend' ? 'active' : 'inactive'}`}
          onClick={() => setLeaderboardTier('legend')}
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