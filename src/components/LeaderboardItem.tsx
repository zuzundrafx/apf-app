import React from 'react';
import { LeaderboardEntry } from '../api/yandexUpload';
import { UserProfile } from '../api/userProfiles';

interface LeaderboardItemProps {
  entry: LeaderboardEntry;
  currentUserId?: string;
  currentUserPhoto?: string;
  profile?: UserProfile; // Профиль из кэша
  userStyle?: 'striker' | 'grappler' | null;
}

const LeaderboardItem: React.FC<LeaderboardItemProps> = ({ 
  entry, 
  currentUserId,
  currentUserPhoto,
  profile,
  userStyle
}) => {
  // Определяем источник аватарки
  const getAvatarSource = (): string | null => {
    // 1. Если есть фото в профиле из кэша
    if (profile?.photoUrl) {
      return profile.photoUrl;
    }
    // 2. Если это текущий пользователь и у него есть фото
    if (entry.userId === currentUserId && currentUserPhoto) {
      return currentUserPhoto;
    }
    // 3. Нет фото
    return null;
  };

  const avatarUrl = getAvatarSource();
  
  // Определяем стиль для обводки
  const entryStyle = entry.userId === currentUserId ? userStyle : entry.style;
  const hasStyle = entryStyle === 'striker' || entryStyle === 'grappler';

  return (
    <div className="leaderboard-item">
      <span className="leaderboard-rank">#{entry.rank}</span>
      <div className="leaderboard-user-info">
        <div className="leaderboard-avatar" style={{
          background: hasStyle
            ? (entryStyle === 'striker' 
                ? 'linear-gradient(180deg, #FF0000 0%, #8C1519 100%)' 
                : 'linear-gradient(180deg, #FF9933 0%, #663300 100%)')
            : '#3D3D3B',
          borderRadius: '10%',
          padding: hasStyle ? '3%' : '0',
          boxShadow: hasStyle ? '0 0 0 0.2vw #000000' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={entry.username}
              onError={(e) => {
                // Если фото не загрузилось, показываем заглушку
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

export default LeaderboardItem;