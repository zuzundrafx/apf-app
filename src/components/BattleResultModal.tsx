// src/components/BattleResultModal.tsx

import React, { useState, useEffect } from 'react';

interface BattleResultModalProps {
  isOpen: boolean;
  result: 'win' | 'loss' | 'draw' | 'tech-loss';
  resultType?: 'ko' | 'decision-unanimous' | 'decision-split';
  rewards?: {
    coins: number;
    experience: number;
  };
  betAmount: number;
  winningRound?: number;
  userAvatar?: string;
  rivalAvatar?: string;
  userName?: string;
  rivalName?: string;
  onClose: () => void;
}

const BattleResultModal: React.FC<BattleResultModalProps> = ({
  isOpen,
  result,
  resultType,
  rewards,
  betAmount,
  winningRound,
  userAvatar,
  rivalAvatar,
  userName,
  rivalName,
  onClose,
}) => {
  const [isShaking, setIsShaking] = useState(false);
  const [isBagOpen, setIsBagOpen] = useState(false);

  useEffect(() => {
    if (isOpen && result === 'win' && rewards && rewards.coins > 0) {
      // Запускаем тряску
      setIsShaking(true);
      
      // Увеличиваем время тряски на 25% (было ~400ms, стало ~500ms)
      // Через 100ms открываем сумку (до окончания тряски)
      setTimeout(() => {
        setIsBagOpen(true);
      }, 100);
      
      // Останавливаем тряску через 500ms (увеличено на 25%)
      setTimeout(() => {
        setIsShaking(false);
      }, 500);
    }
  }, [isOpen, result, rewards]);

  if (!isOpen) return null;

  // Определяем заголовок и цвет в зависимости от результата
  const getHeaderInfo = () => {
    switch (result) {
      case 'win':
        return { title: 'VICTORY!', color: '#FFD700' };
      case 'loss':
        return { title: 'DEFEAT...', color: '#B20101' };
      case 'draw':
        return { title: 'DRAW!', color: '#FFD966' };
      case 'tech-loss':
        return { title: 'TECHNICAL DEFEAT', color: '#888888' };
      default:
        return { title: 'BATTLE ENDED', color: '#FFFFFF' };
    }
  };

  const getResultText = () => {
    if (result === 'win') {
      if (resultType === 'ko') return 'WIN BY KO/TKO';
      if (resultType === 'decision-unanimous') return 'WIN BY UNANIMOUS DECISION';
      if (resultType === 'decision-split') return 'WIN BY SPLIT DECISION';
      return 'VICTORY!';
    }
    if (result === 'loss') {
      if (resultType === 'ko') return 'LOSS BY KO/TKO';
      if (resultType === 'decision-unanimous') return 'LOSS BY UNANIMOUS DECISION';
      if (resultType === 'decision-split') return 'LOSS BY SPLIT DECISION';
      return 'DEFEAT...';
    }
    if (result === 'draw') return 'DRAW!';
    if (result === 'tech-loss') return 'YOU SURRENDERED';
    return '';
  };

  const headerInfo = getHeaderInfo();
  const resultText = getResultText();

  // Форматируем сумму награды
  const formatReward = (value: number) => {
    return value.toLocaleString();
  };

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  return (
    <div className="battle-result-modal-overlay">
      <div className="battle-result-modal">
        <div className="battle-result-header">
          <h2 style={{ color: headerInfo.color, textShadow: `0 0 5px ${headerInfo.color}` }}>
            {headerInfo.title}
          </h2>
        </div>

        <div className="battle-result-round">
          <span>{resultText}</span>
        </div>

        <div className="battle-result-avatars">
          <div className="battle-result-avatar-left">
            <div className={`battle-result-avatar-wrapper ${result === 'win' ? 'avatar-winner' : result === 'loss' ? 'avatar-loser' : ''}`}>
              <img 
                src={userAvatar || `${BASE_URL}/Home_button.png`} 
                alt="player" 
                className="battle-result-avatar-img"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `${BASE_URL}/Home_button.png`;
                }}
              />
            </div>
            <div className="battle-result-avatar-name">{userName || 'YOU'}</div>
          </div>

          <div className="battle-result-avatar-center">
            <img src={`${BASE_URL}/VS_logo.webp`} alt="VS" className="battle-result-vs-logo" />
          </div>

          <div className="battle-result-avatar-right">
            <div className={`battle-result-avatar-wrapper ${result === 'loss' ? 'avatar-winner' : result === 'win' ? 'avatar-loser' : ''}`}>
              <img 
                src={rivalAvatar || `${BASE_URL}/default-avatar.png`} 
                alt="rival" 
                className="battle-result-avatar-img"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `${BASE_URL}/default-avatar.png`;
                }}
              />
            </div>
            <div className="battle-result-avatar-name">{rivalName || 'OPPONENT'}</div>
          </div>
        </div>

        {result === 'win' && winningRound && (
          <div className="battle-result-exp-octagon">
            <span className="battle-result-exp-arrow">⬆️</span> +{rewards?.experience || 0} EXP
          </div>
        )}

        <div className="battle-result-divider"></div>

        <div className="battle-result-bet">
          <div className="battle-result-bet-label">BET:</div>
          <div className="battle-result-bet-value">
            {betAmount} <img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="coins" className="battle-result-coin-icon" />
          </div>
        </div>

        {result !== 'tech-loss' && (
          <div className="battle-result-coef">
            <div className="battle-result-coef-label">MULTIPLIER:</div>
            <div className="battle-result-coef-value">
              {result === 'win' && resultType === 'ko' && 'x2.0'}
              {result === 'win' && resultType === 'decision-unanimous' && 'x1.5'}
              {result === 'win' && resultType === 'decision-split' && 'x1.25'}
              {result === 'draw' && 'x1.0'}
              {result === 'loss' && 'x0'}
            </div>
          </div>
        )}

        <div className="battle-result-reward-icon">
          {result === 'win' && rewards && rewards.coins > 0 && (
            <div className={`battle-result-reward-icon-wrapper ${isShaking ? 'shake-icon' : ''}`}>
              <img 
                src={`${BASE_URL}/icons/${isBagOpen ? 'Bag_open_icon.webp' : 'Bag_closed_icon.webp'}`}
                alt="reward" 
                className="battle-result-reward-img"
              />
              <div className="battle-result-reward-amount">+{formatReward(rewards.coins)}</div>
            </div>
          )}
          {result === 'draw' && (
            <div className="battle-result-reward-icon-wrapper">
              <img 
                src={`${BASE_URL}/icons/Bag_closed_icon.webp`}
                alt="refund" 
                className="battle-result-reward-img"
              />
              <div className="battle-result-reward-amount">BET REFUNDED</div>
            </div>
          )}
          {result === 'loss' && (
            <div className="battle-result-reward-icon-wrapper">
              <img 
                src={`${BASE_URL}/icons/Bag_closed_icon.webp`}
                alt="loss" 
                className="battle-result-reward-img"
              />
              <div className="battle-result-reward-amount">NO REWARD</div>
            </div>
          )}
          {result === 'tech-loss' && (
            <div className="battle-result-reward-icon-wrapper">
              <img 
                src={`${BASE_URL}/icons/Bag_closed_icon.webp`}
                alt="surrender" 
                className="battle-result-reward-img"
              />
              <div className="battle-result-reward-amount">SURRENDER</div>
            </div>
          )}
        </div>

        <div className="battle-result-footer">
          <button className="battle-result-button" onClick={onClose}>
            CONTINUE
          </button>
        </div>
      </div>
    </div>
  );
};

export default BattleResultModal;