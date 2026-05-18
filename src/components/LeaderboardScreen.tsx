// src/components/LeaderboardScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getAvatarWrapperStyle, getAvatarInnerStyle } from '../utils/styleUtils';

// Вложенный компонент строки рейтинга
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

// Основной компонент
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
  const [leaderboardLeague, setLeaderboardLeague] = useState<'ufc' | ''>('ufc');
  const [localData, setLocalData] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatTournamentName = (name: string): string => {
    if (!name) return '';
    let result = name.replace(/^UFC\s*/i, '');
    result = result.replace(/_/g, ' ');
    return result;
  };

  // Загружаем данные
  const loadData = useCallback(async () => {
    console.log('🔍 loadData called, tournaments:', tournaments.length);
    
    if (tournaments.length === 0) {
      console.log('❌ No tournaments, setting empty data');
      setLocalData([]);
      setLocalLoading(false);
      return;
    }
    
    const tournamentId = tournaments[0].id;
    console.log(`📡 Loading leaderboard for tournament ${tournamentId}, tier ${leaderboardTier}`);
    setLocalLoading(true);
    setError(null);
    
    try {
      const result = await onLoadLeaderboard(tournamentId, leaderboardTier);
      console.log(`✅ Loaded ${result?.length || 0} entries`);
      setLocalData(result || []);
    } catch (err: any) {
      console.error('❌ Failed to load leaderboard:', err);
      setError(err.message);
      setLocalData([]);
    } finally {
      setLocalLoading(false);
    }
  }, [tournaments, leaderboardTier, onLoadLeaderboard]);

  // Загружаем при изменении лиги или турнира
  useEffect(() => {
    console.log('🔄 useEffect triggered, calling loadData');
    loadData();
  }, [leaderboardTier, tournaments]); // убрал loadData из зависимостей

  const currentTournament = tournaments.length > 0 ? tournaments[0] : null;

  return (
    <div className="leaderboard-screen">
      {/* Первая строчка: кнопки лиг */}
      <div className="leaderboard-league-buttons">
        <button 
          className={`leaderboard-league-btn ${leaderboardLeague === 'ufc' ? 'active' : 'inactive'}`}
          onClick={() => setLeaderboardLeague('ufc')}
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
      {localLoading ? (
        <div className="leaderboard-loading">LOADING...</div>
      ) : error ? (
        <div className="leaderboard-empty">Error: {error}</div>
      ) : localData.length > 0 ? (
        <div className="leaderboard-list">
          {localData.map((entry, index) => (
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