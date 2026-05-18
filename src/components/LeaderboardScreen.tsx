// src/components/LeaderboardScreen.tsx
import React, { useState, useEffect } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  const formatTournamentName = (name: string): string => {
    if (!name) return '';
    let result = name.replace(/^UFC\s*/i, '');
    result = result.replace(/_/g, ' ');
    return result;
  };

  const currentTournament = tournaments.length > 0 ? tournaments[0] : null;

  // Простая загрузка без лишних зависимостей
  useEffect(() => {
    const fetchData = async () => {
      if (!currentTournament) {
        setLoading(false);
        return;
      }
      
      console.log('🟢 Fetching leaderboard for:', currentTournament.id, leaderboardTier);
      setLoading(true);
      setError(null);
      
      try {
        const result = await onLoadLeaderboard(currentTournament.id, leaderboardTier);
        console.log('🟢 Result:', result);
        setData(Array.isArray(result) ? result : []);
      } catch (err: any) {
        console.error('🟢 Error:', err);
        setError(err.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTournament?.id, leaderboardTier]);

  return (
    <div className="leaderboard-screen">
      {/* Первая строчка: кнопки лиг */}
      <div className="leaderboard-league-buttons">
        <button className="leaderboard-league-btn active">UFC</button>
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
      ) : error ? (
        <div className="leaderboard-empty">Error: {error}</div>
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