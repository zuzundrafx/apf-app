import React from 'react';
import { LeaderboardEntry } from '../api/yandexUpload';
import { UserProfile } from '../api/userProfiles';

interface LeaderboardItemProps {
  entry: LeaderboardEntry;
  currentUserId?: string;
  currentUserPhoto?: string;
  profile?: UserProfile; // Профиль из кэша
}

const LeaderboardItem: React.FC<LeaderboardItemProps> = ({ 
  entry, 
  currentUserId,
  currentUserPhoto,
  profile
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

  return (
    <div className="leaderboard-item">
      <span className="leaderboard-rank">#{entry.rank}</span>
      <div className="leaderboard-user-info">
        <div className="leaderboard-avatar">
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