// src/components/BattleResultModal.tsx

import React from 'react';

interface BattleResultModalProps {
  isOpen: boolean;
  result: 'win' | 'loss' | 'draw' | 'tech-loss';
  resultType?: 'ko' | 'decision-unanimous' | 'decision-split';
  onClose: () => void;
}

const BattleResultModal: React.FC<BattleResultModalProps> = ({
  isOpen,
  result,
  resultType,
  onClose
}) => {
  if (!isOpen) return null;

  const getTitle = () => {
    if (result === 'win') {
      if (resultType === 'ko') return '🏆 VICTORY! 🏆';
      if (resultType === 'decision-unanimous') return '🏆 WIN by Unanimous Decision! 🏆';
      if (resultType === 'decision-split') return '🏆 WIN by Split Decision! 🏆';
      return '🏆 YOU WIN! 🏆';
    }
    if (result === 'loss') {
      if (resultType === 'ko') return '💔 DEFEAT 💔';
      if (resultType === 'decision-unanimous') return '💔 LOSS by Unanimous Decision 💔';
      if (resultType === 'decision-split') return '💔 LOSS by Split Decision 💔';
      return '💔 YOU LOSE 💔';
    }
    if (result === 'draw') return '🤝 DRAW 🤝';
    if (result === 'tech-loss') return '⚠️ TECHNICAL DEFEAT ⚠️';
    return '';
  };

  const getMessage = () => {
    if (result === 'tech-loss') {
      return 'You surrendered the fight. Better luck next time!';
    }
    if (result === 'draw') {
      return 'The battle was evenly matched. Both fighters gave it their all!';
    }
    return '';
  };

  return (
    <div className="battle-result-modal-overlay">
      <div className="battle-result-modal">
        <h2 className="battle-result-title">{getTitle()}</h2>
        {getMessage() && <p className="battle-result-message">{getMessage()}</p>}
        <button className="battle-result-button" onClick={onClose}>
          BACK TO PVP
        </button>
      </div>
    </div>
  );
};

export default BattleResultModal;