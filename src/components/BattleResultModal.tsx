// src/components/BattleResultModal.tsx

import React from 'react';

interface BattleResultModalProps {
  isOpen: boolean;
  result: 'win' | 'loss' | 'draw' | 'tech-loss';
  resultType?: 'ko' | 'decision-unanimous' | 'decision-split';
  rewards?: {
    coins: number;
    experience: number;
  };
  onClose: () => void;
}

const BattleResultModal: React.FC<BattleResultModalProps> = ({
  isOpen,
  result,
  resultType,
  rewards,
  onClose
}) => {
  if (!isOpen) return null;

  const getTitle = () => {
    if (result === 'win') {
      if (resultType === 'ko') return 'WIN: by K.O.';
      if (resultType === 'decision-unanimous') return 'WIN: by unanimous decision';
      if (resultType === 'decision-split') return 'WIN: by split decision';
      return 'YOU WIN!';
    }
    if (result === 'loss') {
      if (resultType === 'ko') return 'LOSE: by K.O.';
      if (resultType === 'decision-unanimous') return 'LOSE: by unanimous decision';
      if (resultType === 'decision-split') return 'LOSE: by split decision';
      return 'YOU LOSE';
    }
    if (result === 'draw') return 'DRAW';
    if (result === 'tech-loss') return 'TECHNICAL DEFEAT';
    return '';
  };

  const getTitleColor = () => {
    if (result === 'win') return '#FFD966';
    if (result === 'loss') return '#FF0000';
    if (result === 'draw') return '#FFFFFF';
    if (result === 'tech-loss') return '#FF0000';
    return '#FFFFFF';
  };

  const getButtonText = () => {
    if (result === 'win' || result === 'draw') return 'GET ALL';
    return 'BETTER LUCK NEXT TIME';
  };

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  return (
    <div className="battle-result-modal-overlay">
      <div className="battle-result-modal">
        {/* Верхний контейнер - заголовок */}
        <div className="battle-result-header">
          <h2 style={{ color: getTitleColor() }}>{getTitle()}</h2>
        </div>

        {/* Средний контейнер - награды */}
        <div className="battle-result-rewards">
          {rewards && (result === 'win' || result === 'draw') ? (
            <div className="rewards-container">
              {rewards.coins > 0 && (
                <div className="reward-item">
                  <span>+{rewards.coins}</span>
                  <img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="coins" className="reward-icon" />
                </div>
              )}
              {rewards.experience > 0 && (
                <div className="reward-item">
                  <span>+{rewards.experience}</span>
                  <span className="reward-exp-icon">✨</span>
                </div>
              )}
            </div>
          ) : (result === 'loss' || result === 'tech-loss') && rewards?.experience ? (
            <div className="rewards-container">
              <div className="reward-item">
                <span>+{rewards.experience}</span>
                <span className="reward-exp-icon">✨</span>
              </div>
            </div>
          ) : (
            <div className="rewards-container">
              <span className="no-rewards">No rewards</span>
            </div>
          )}
        </div>

        {/* Нижний контейнер - кнопка */}
        <div className="battle-result-footer">
          <button className="battle-result-button" onClick={onClose}>
            {getButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BattleResultModal;