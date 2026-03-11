// src/components/ArenaModal.tsx

import React, { useEffect, useState } from 'react';
import { Tournament, SelectedFighter } from '../types';

interface ArenaModalProps {
  tournament: Tournament;
  userSelections: SelectedFighter[];
  userAvatar?: string;
  userDamage: number;
  userName: string;
  rivalData: {
    username: string;
    photoUrl?: string;
    totalDamage: number;
    selections: SelectedFighter[];
  };
  weightClasses: string[];
  isOpen: boolean;
  onSurrender: () => void;
}

// Функция для получения имени файла аватарки по весовой категории
const getAvatarFilename = (weightClass: string): string => {
  const map: { [key: string]: string } = {
    'Flyweight': 'Flyweight_avatar.png',
    'Bantamweight': 'Bantamweight_avatar.png',
    'Featherweight': 'Featherweight_avatar.png',
    'Lightweight': 'Lightweight_avatar.png',
    'Welterweight': 'Welterweight_avatar.png',
    'Middleweight': 'Middleweight_avatar.png',
    'Light Heavyweight': 'Light_Heavyweight_avatar.png',
    'Heavyweight': 'Heavyweight_avatar.png',
    "Women's Strawweight": "Women's_Strawweight_avatar.png",
    "Women's Flyweight": "Women's_Flyweight_avatar.png",
    "Women's Bantamweight": "Women's_Bantamweight_avatar.png",
    "Catch Weight": 'default-avatar.png'
  };
  return map[weightClass] || 'default-avatar.png';
};

// Функция для получения цвета весовой категории
const getWeightClassColor = (weightClass: string): string => {
  const colors: { [key: string]: string } = {
    'Flyweight': '#168760',
    'Bantamweight': '#446E87',
    'Featherweight': '#424A87',
    'Lightweight': '#5F3A87',
    'Welterweight': '#813D87',
    'Middleweight': '#87863B',
    'Light Heavyweight': '#876A0B',
    'Heavyweight': '#870000',
    "Women's Strawweight": '#A6125F',
    "Women's Flyweight": '#58C467',
    "Women's Bantamweight": '#66A4C9',
    "Catch Weight": '#666666'
  };
  return colors[weightClass] || '#666666';
};

const ArenaModal: React.FC<ArenaModalProps> = ({
  tournament,
  userSelections,
  userAvatar,
  userDamage,
  userName,
  rivalData,
  weightClasses,
  isOpen,
  onSurrender
}) => {
  const [availableWeightClasses, setAvailableWeightClasses] = useState<string[]>([]);
  const [roundCards, setRoundCards] = useState<(string | null)[]>([null, null, null, null, null]);
  const [isLoading, setIsLoading] = useState(true);

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  // Инициализация при открытии
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setAvailableWeightClasses([...weightClasses]);
      setRoundCards([null, null, null, null, null]);
      
      // Симуляция загрузки (1 секунда)
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }
  }, [isOpen, weightClasses]);

  // Функция для выбора случайной категории для раунда
  const selectRandomWeightClass = (roundIndex: number) => {
    if (availableWeightClasses.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * availableWeightClasses.length);
    const selected = availableWeightClasses[randomIndex];
    
    const newRoundCards = [...roundCards];
    newRoundCards[roundIndex] = selected;
    setRoundCards(newRoundCards);
    
    const newAvailable = [...availableWeightClasses];
    newAvailable.splice(randomIndex, 1);
    setAvailableWeightClasses(newAvailable);
  };

  if (!isOpen) return null;

  return (
    <div className="arena-modal-overlay">
      <div className="arena-modal">
        {isLoading ? (
          <div className="arena-loading">Loading arena...</div>
        ) : (
          <>
            {/* Верхняя шапка арены (8%) */}
            <div className="arena-header">
              <div className="arena-header-left">
                {tournament.name}
              </div>
              <div className="arena-header-right">
                <button className="arena-surrender-button" onClick={onSurrender}>
                  SURRENDER
                </button>
              </div>
            </div>

            {/* Верхний контейнер (36%) - противник */}
            <div className="arena-top">
              {/* Аватарка противника (28%) */}
              <div className="arena-rival-avatar-container">
                <div className="arena-rival-avatar">
                  <img 
                    src={rivalData.photoUrl || `${BASE_URL}/default-avatar.png`}
                    alt="rival"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `${BASE_URL}/default-avatar.png`;
                    }}
                  />
                </div>
              </div>

              {/* Шкала здоровья противника (8%) */}
              <div className="arena-rival-health">
                <div className="arena-health-bar">
                  <div className="arena-health-fill" style={{ width: '100%' }}></div>
                  <span className="arena-health-text">{rivalData.username} Health: 1000</span>
                </div>
              </div>

              {/* Карточки бойцов противника (50%) */}
              <div className="arena-rival-fighters">
                {rivalData.selections.slice(0, 5).map((sel, index) => (
                  <div 
                    key={index} 
                    className="arena-fighter-card"
                    style={{ backgroundColor: getWeightClassColor(sel.weightClass) }}
                  >
                    <div className="arena-fighter-damage">
                      {Math.round(sel.fighter['Total Damage'])}
                    </div>
                    <div className="arena-fighter-avatar">
                      <img 
                        src={`${BASE_URL}/avatars/${getAvatarFilename(sel.weightClass)}`}
                        alt={sel.fighter.Fighter}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) parent.innerHTML = sel.weightClass.includes("Women") ? "👩" : "👤";
                        }}
                      />
                    </div>
                    <div className="arena-fighter-name">{sel.fighter.Fighter}</div>
                  </div>
                ))}
              </div>

              {/* Текущий урон противника (8%) */}
              <div className="arena-rival-damage">
                <div className="arena-damage-box">
                  CURRENT DAMAGE: {rivalData.totalDamage}
                </div>
              </div>
            </div>

            {/* Средний контейнер (20%) - раунды */}
            <div className="arena-middle">
              {[0, 1, 2, 3, 4].map((roundIndex) => (
                <div 
                  key={roundIndex} 
                  className="arena-round-card"
                  onClick={() => roundCards[roundIndex] === null && selectRandomWeightClass(roundIndex)}
                  style={roundCards[roundIndex] ? { 
                    backgroundColor: getWeightClassColor(roundCards[roundIndex]!) 
                  } : {}}
                >
                  {roundCards[roundIndex] ? (
                    <div className="arena-round-weight">{roundCards[roundIndex]}</div>
                  ) : (
                    <div className="arena-round-number">
                      <div className="arena-round-digit">{roundIndex + 1}</div>
                      <div className="arena-round-text">ROUND</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Нижний контейнер (36%) - игрок */}
<div className="arena-bottom">
  {/* 1. Текущий урон игрока (8%) - САМЫЙ ВЕРХНИЙ */}
  <div className="arena-player-damage">
    <div className="arena-damage-box">
      CURRENT DAMAGE: {userDamage}
    </div>
  </div>

  {/* 2. Карточки бойцов игрока (50%) */}
  <div className="arena-player-fighters">
    {userSelections.slice(0, 5).map((sel, index) => (
      <div 
        key={index} 
        className="arena-fighter-card"
        style={{ backgroundColor: getWeightClassColor(sel.weightClass) }}
      >
        <div className="arena-fighter-damage">
          {Math.round(sel.fighter['Total Damage'])}
        </div>
        <div className="arena-fighter-avatar">
          <img 
            src={`${BASE_URL}/avatars/${getAvatarFilename(sel.weightClass)}`}
            alt={sel.fighter.Fighter}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) parent.innerHTML = sel.weightClass.includes("Women") ? "👩" : "👤";
            }}
          />
        </div>
        <div className="arena-fighter-name">{sel.fighter.Fighter}</div>
      </div>
    ))}
  </div>

  {/* 3. Шкала здоровья игрока (8%) */}
  <div className="arena-player-health">
    <div className="arena-health-bar">
      <div className="arena-health-fill" style={{ width: '100%' }}></div>
      <span className="arena-health-text">{userName} Health: 1000</span>
    </div>
  </div>

  {/* 4. Аватарка игрока (28%) - САМЫЙ НИЖНИЙ */}
  <div className="arena-player-avatar-container">
    <div className="arena-player-avatar">
      <img 
        src={userAvatar || `${BASE_URL}/Home_button.png`}
        alt="player"
        onError={(e) => {
          (e.target as HTMLImageElement).src = `${BASE_URL}/Home_button.png`;
        }}
      />
    </div>
  </div>
</div>
          </>
        )}
      </div>
    </div>
  );
};

export default ArenaModal;