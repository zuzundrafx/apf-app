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
  betAmount?: number;
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
  onClose
}) => {
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [winIconScale, setWinIconScale] = useState(1);

  useEffect(() => {
    if (isOpen && result === 'win') {
      // Сначала показываем закрытую сумку (уже по умолчанию)
      setShowWinAnimation(false);
      setWinIconScale(1);
      
      // Через 0.15 сек начинаем анимацию увеличения
      const timer1 = setTimeout(() => {
        setWinIconScale(1.2);
      }, 150);
      
      // Через 0.3 сек меняем иконку на открытую и возвращаем размер
      const timer2 = setTimeout(() => {
        setWinIconScale(1);
        setShowWinAnimation(true);
      }, 300);
      
      // Через 0.6 сек снимаем флаг анимации
      const timer3 = setTimeout(() => {
        setShowWinAnimation(false);
      }, 600);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isOpen, result]);

  if (!isOpen) return null;

  const getWinCoefficient = (): number | null => {
    if (result !== 'win') return null;
    
    let baseCoeff = 0;
    if (resultType === 'ko') baseCoeff = 2.0;
    else if (resultType === 'decision-unanimous') baseCoeff = 1.5;
    else if (resultType === 'decision-split') baseCoeff = 1.2;
    else return null;
    
    if (winningRound && winningRound < 5) {
      const roundsNotFought = 5 - winningRound;
      const bonus = roundsNotFought * 0.1;
      return baseCoeff + bonus;
    }
    
    return baseCoeff;
  };

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
    if (result === 'tech-loss') return 'LOSE: by Technical Defeat';
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
    if (result === 'win' || result === 'draw') return 'CLAIM REWARD';
    return 'Try another time';
  };

  const winCoefficient = getWinCoefficient();
  const shouldShowRound = result !== 'tech-loss';
  const shouldShowCoefficient = result === 'win';
  const shouldShowBet = result !== 'tech-loss';
  
  const getRewardIcon = () => {
    if (result === 'win') {
      if (showWinAnimation) {
        return `${BASE_URL}/icons/Open_win_icon.webp`;
      }
      return `${BASE_URL}/icons/Close_win_icon.webp`;
    }
    if (result === 'loss' || result === 'tech-loss') {
      return `${BASE_URL}/icons/Open_lose_icon.webp`;
    }
    if (result === 'draw') {
      return `${BASE_URL}/icons/Open_win_icon.webp`;
    }
    return `${BASE_URL}/icons/default-avatar.png`;
  };

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  return (
    <div className="battle-result-modal-overlay">
      <div className="battle-result-modal">
        
        <div className="battle-result-header">
          <h2 style={{ color: getTitleColor() }}>{getTitle()}</h2>
        </div>

        {shouldShowRound && winningRound && (
          <div className="battle-result-round">
            <span>Round {winningRound}/5</span>
          </div>
        )}

        <div className="battle-result-avatars">
          <div className="battle-result-avatar-left">
            <img 
              src={userAvatar || `${BASE_URL}/Home_button.png`}
              alt="player"
              className="battle-result-avatar-img"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `${BASE_URL}/Home_button.png`;
              }}
            />
            {rewards && rewards.experience > 0 && (
              <div className="battle-result-exp-octagon">
                +{rewards.experience} exp
              </div>
            )}
            <div className="battle-result-avatar-name">{userName}</div>
          </div>
          
          <div className="battle-result-avatar-center">
            <img 
              src={`${BASE_URL}/VS_logo.webp`}
              alt="VS"
              className="battle-result-vs-logo"
            />
          </div>
          
          <div className="battle-result-avatar-right">
            <img 
              src={rivalAvatar || `${BASE_URL}/default-avatar.png`}
              alt="rival"
              className="battle-result-avatar-img"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `${BASE_URL}/default-avatar.png`;
              }}
            />
            <div className="battle-result-avatar-name">{rivalName}</div>
          </div>
        </div>

        <div className="battle-result-divider"></div>

        {shouldShowBet && betAmount !== undefined && (
          <div className="battle-result-bet">
            <div className="battle-result-bet-label">Your bet:</div>
            <div className="battle-result-bet-value">
              {betAmount} <img src={`${BASE_URL}/icons/Coin_icon.webp`} alt="coins" className="battle-result-coin-icon" />
            </div>
          </div>
        )}

        {shouldShowCoefficient && winCoefficient !== null && (
          <div className="battle-result-coef">
            <div className="battle-result-coef-label">W / Koef:</div>
            <div className="battle-result-coef-value">
              x{winCoefficient.toFixed(1)}
            </div>
          </div>
        )}

        <div className="battle-result-reward-icon">
          <div 
            className="battle-result-reward-icon-wrapper"
            style={{ transform: `scale(${winIconScale})` }}
          >
            <img 
              src={getRewardIcon()}
              alt="reward"
              className="battle-result-reward-img"
            />
            {rewards && rewards.coins > 0 && (
              <div className="battle-result-reward-amount">
                +{rewards.coins}
              </div>
            )}
          </div>
        </div>

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