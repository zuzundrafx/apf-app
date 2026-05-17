// src/components/LeaderboardScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getAvatarWrapperStyle, getAvatarInnerStyle } from '../utils/styleUtils';

// ===== ВЛОЖЕННЫЙ КОМПОНЕНТ СТРОКИ РЕЙТИНГА =====
interface LeaderboardItemProps {
  entry: any;
  currentUserId?: string;
  currentUserPhoto?: string;
  profile?: any;
  userStyle?: 'striker' | 'grappler' | null;
}

const LeaderboardItem: React.FC<LeaderboardItemProps> = ({ 
  entry, 
  currentUserId,
  currentUserPhoto,
  profile,
  userStyle
}) => {
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

// ===== ОСНОВНОЙ КОМПОНЕНТ =====
interface LeaderboardScreenProps {
  tournaments: any[];
  leaderboardData: any[];
  leaderboardLoading: boolean;
  currentUserId?: string;
  currentUserPhoto?: string;
  userStyle?: 'striker' | 'grappler' | null;
  allProfiles: Map<string, any>;
  onLoadLeaderboard: (tournamentId: string, tier: 'base' | 'pro' | 'elite' | 'legend') => Promise<any[]>;
}

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  tournaments,
  leaderboardData,
  leaderboardLoading,
  currentUserId,
  currentUserPhoto,
  userStyle,
  allProfiles,
  onLoadLeaderboard
}) => {
  const [leaderboardTier, setLeaderboardTier] = useState<'base' | 'pro' | 'elite' | 'legend'>('base');
  const [leaderboardLeague, setLeaderboardLeague] = useState<'ufc' | ''>('ufc');
  const [data, setData] = useState<any[]>(leaderboardData);
  const [loading, setLoading] = useState(leaderboardLoading);

  const formatTournamentName = (name: string): string => {
    if (!name) return '';
    let result = name.replace(/^UFC\s*/i, '');
    result = result.replace(/_/g, ' ');
    return result;
  };

  const loadData = useCallback(async () => {
    if (tournaments.length === 0) return;
    const tournamentId = tournaments[0].id;
    setLoading(true);
    const result = await onLoadLeaderboard(tournamentId, leaderboardTier);
    setData(result);
    setLoading(false);
  }, [tournaments, leaderboardTier, onLoadLeaderboard]);

  useEffect(() => {
    loadData();
  }, [leaderboardTier, loadData]);

  const currentTournament = tournaments.length > 0 ? tournaments[0] : null;

  return (
    <div className="leaderboard-screen">
      {/* Первая строчка: кнопки лиг */}
      <div className="leaderboard-league-buttons">
        <button 
          className={`leaderboard-league-btn ${leaderboardLeague === 'ufc' ? 'active' : 'inactive'}`}
          onClick={() => setLeaderboardLeague('ufc')}
          disabled={leaderboardLeague === 'ufc'}
        >
          UFC
        </button>
        <button className="leaderboard-league-btn inactive" disabled>PFL</button>
        <button className="leaderboard-league-btn inactive" disabled>ONE</button>
      </div>

      {/* Вторая строчка: название турнира */}
      <div className="leaderboard-tournament-name">
        {currentTournament ? formatTournamentName(currentTournament.name) : 'NO TOURNAMENT'}
      </div>

      {/* Третья строчка: кнопки тиров */}
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
          {data.map(entry => (
            <LeaderboardItem 
              key={entry.userId} 
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