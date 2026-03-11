// src/components/PvpBattleModal.tsx

import React from 'react';
import { Tournament } from '../types';

interface PvpBattleModalProps {
  tournament: Tournament;
  userAvatar?: string;
  userDamage: number | null;
  isOpen: boolean;
  onSurrender: () => void;
  searchStatus: 'searching' | 'found' | 'no-rivals';
  rivalData?: {
    username: string;
    photoUrl?: string;
    totalDamage: number;
  } | null;
}

const PvpBattleModal: React.FC<PvpBattleModalProps> = ({
  tournament,
  userAvatar,
  userDamage,
  isOpen,
  onSurrender,
  searchStatus,
  rivalData
}) => {
  if (!isOpen) return null;

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  // Получаем текст статуса
  const getStatusText = () => {
    switch (searchStatus) {
      case 'searching':
        return 'Searching for Rivals...';
      case 'no-rivals':
        return 'There are no Rivals... Try Later';
      case 'found':
        return rivalData ? `Rival found: ${rivalData.username}` : '';
      default:
        return '';
    }
  };

  return (
    <div className="pvp-battle-modal-overlay">
      <div className="pvp-battle-modal">
        <button className="pvp-surrender-button" onClick={onSurrender}>
          SURRENDER
        </button>
        
        <div className="pvp-battle-card">
          {/* Верхняя часть - лига и название */}
          <div className="pvp-card-top">
            <div className="pvp-card-league" style={{ backgroundColor: '#B20101' }}>
              <span>{tournament.league || 'UFC'}</span>
            </div>
            <div className="pvp-card-name">
              {tournament.name}
            </div>
          </div>

          {/* Средняя часть - аватарки и VS */}
          <div className="pvp-card-middle">
            {/* Левый игрок (наш) */}
            <div className="pvp-middle-left">
              <div className="pvp-player-avatar">
                <img 
                  src={userAvatar || `${BASE_URL}/Home_button.png`} 
                  alt="player"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${BASE_URL}/Home_button.png`;
                  }}
                />
              </div>
              <div className="pvp-player-damage">
                <div className="pvp-damage-label">Dmg:</div>
                <div className="pvp-damage-value">{userDamage || 0}</div>
              </div>
            </div>

            {/* Центр - VS */}
            <div className="pvp-middle-center">
              <span className="pvp-vs-text">VS</span>
            </div>

            {/* Правый игрок (соперник) */}
            <div className="pvp-middle-right">
              <div className="pvp-rival-avatar">
                <img 
                  src={rivalData?.photoUrl || `${BASE_URL}/default-avatar.png`} 
                  alt="rival"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${BASE_URL}/default-avatar.png`;
                  }}
                />
              </div>
              <div className="pvp-rival-damage">
                {searchStatus === 'found' && rivalData ? (
                  <div className="pvp-damage-value">{rivalData.totalDamage}</div>
                ) : searchStatus === 'no-rivals' ? (
                  <div className="pvp-no-rivals-text">No rivals</div>
                ) : (
                  <div className="pvp-searching-text">???</div>
                )}
              </div>
            </div>
          </div>

          {/* Нижняя часть - стоимость (оставляем для единства дизайна) */}
          <div className="pvp-card-bottom">
            <div className="pvp-card-cost">
              Entry pass: <span className="pvp-cost-icon">🪙</span>50
            </div>
          </div>
        </div>

        {/* Статус поиска под карточкой */}
        <div className="pvp-search-status">
          {getStatusText()}
        </div>
      </div>
    </div>
  );
};

export default PvpBattleModal;