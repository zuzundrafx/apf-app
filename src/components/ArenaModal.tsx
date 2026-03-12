// src/components/ArenaModal.tsx

import React, { useEffect, useState } from 'react';
import { Tournament, SelectedFighter } from '../types';
import BattleResultModal from './BattleResultModal';

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

// Типы для состояния боя
type BattlePhase = 'countdown' | 'round-start' | 'round-processing' | 'round-end' | 'finished';
type CountdownStep = 'ready' | 'steady' | 'fight' | null;

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
  // Состояние загрузки
  const [isLoading, setIsLoading] = useState(true);
  
  // Состояния для боя
  const [battlePhase, setBattlePhase] = useState<BattlePhase>('countdown');
  const [countdownStep, setCountdownStep] = useState<CountdownStep>('ready');
  const [currentRound, setCurrentRound] = useState(1);
  const [showRoundText, setShowRoundText] = useState(false);
  
  // Здоровье
  const [userHealth, setUserHealth] = useState(1000);
  const [rivalHealth, setRivalHealth] = useState(1000);
  
  // Карты бойцов в игре
  const [userActiveCards, setUserActiveCards] = useState<SelectedFighter[]>([]);
  const [rivalActiveCards, setRivalActiveCards] = useState<SelectedFighter[]>([]);
  
  // Использованные весовые категории
  const [usedWeightClasses, setUsedWeightClasses] = useState<string[]>([]);
  
  // Результат боя
  const [battleResult, setBattleResult] = useState<{
    isOpen: boolean;
    result: 'win' | 'loss' | 'draw' | 'tech-loss';
    resultType?: 'ko' | 'decision-unanimous' | 'decision-split';
  } | null>(null);

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  // Инициализация при открытии - СНАЧАЛА ЗАГРУЗКА, ПОТОМ БОЙ
  useEffect(() => {
    if (isOpen) {
      console.log('🎮 Арена открыта, начинаем загрузку...');
      console.log('📦 Весовые категории турнира:', weightClasses);
      
      // Сброс всех состояний
      setIsLoading(true);
      setUsedWeightClasses([]);
      setUserHealth(1000);
      setRivalHealth(1000);
      setUserActiveCards([]);
      setRivalActiveCards([]);
      setBattleResult(null);
      
      // Симуляция загрузки данных (1 секунда)
      setTimeout(() => {
        console.log('✅ Загрузка завершена, запускаем бой');
        setIsLoading(false);
        setBattlePhase('countdown');
        setCountdownStep('ready');
        setCurrentRound(1);
        startCountdown();
      }, 1000);
    }
  }, [isOpen]);

  // Обратный отсчет
  const startCountdown = () => {
    setTimeout(() => {
      setCountdownStep('steady');
      setTimeout(() => {
        setCountdownStep('fight');
        setTimeout(() => {
          setCountdownStep(null);
          setBattlePhase('round-start');
          startRound(1);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  // Начало раунда
  const startRound = (round: number) => {
    setShowRoundText(true);
    setTimeout(() => {
      setShowRoundText(false);
      processRound(round);
    }, 1000);
  };

  // Обработка раунда
const processRound = (round: number) => {
  setBattlePhase('round-processing');
  
  // Вычисляем доступные категории (все - использованные)
  const currentAvailable = weightClasses.filter(
    wc => !usedWeightClasses.includes(wc)
  );
  
  console.log(`🎯 Раунд ${round}, доступные категории:`, currentAvailable);
  console.log(`📦 Использованные категории:`, usedWeightClasses);
  
  // Проверяем, есть ли доступные категории
  if (currentAvailable.length === 0) {
    console.error('❌ Нет доступных весовых категорий!');
    return;
  }
  
  // Выбираем случайную весовую категорию из доступных
  const randomIndex = Math.floor(Math.random() * currentAvailable.length);
  const selectedWeightClass = currentAvailable[randomIndex];
  
  console.log(`🎲 Раунд ${round}: выбрана категория ${selectedWeightClass}`);
  
  // Добавляем в использованные (используем функциональное обновление)
  setUsedWeightClasses(prev => {
    const newUsed = [...prev, selectedWeightClass];
    console.log(`📝 Обновленные использованные:`, newUsed);
    return newUsed;
  });
  
  // Находим бойцов игрока с этой весовой категорией
  const userFightersWithWeight = userSelections.filter(
    sel => sel.weightClass === selectedWeightClass
  );
  
  // Находим бойцов противника с этой весовой категорией
  const rivalFightersWithWeight = rivalData.selections.filter(
    sel => sel.weightClass === selectedWeightClass
  );
  
  console.log(`👥 Найдено бойцов у игрока: ${userFightersWithWeight.length}, у противника: ${rivalFightersWithWeight.length}`);
  
  // Сохраняем текущие карты до обновления
  const currentUserCards = [...userActiveCards];
  const currentRivalCards = [...rivalActiveCards];
  
  // Рассчитываем, сколько новых карт добавится
  const userSlots = 5 - currentUserCards.length;
  const userCardsToAdd = userFightersWithWeight.slice(0, userSlots);
  
  const rivalSlots = 5 - currentRivalCards.length;
  const rivalCardsToAdd = rivalFightersWithWeight.slice(0, rivalSlots);
  
  console.log(`📊 Добавляется карт игроку: ${userCardsToAdd.length}, противнику: ${rivalCardsToAdd.length}`);
  
  // Обновляем карты
  let updatedUserCards = currentUserCards;
  let updatedRivalCards = currentRivalCards;
  
  if (userCardsToAdd.length > 0) {
    updatedUserCards = [...currentUserCards, ...userCardsToAdd];
    setUserActiveCards(updatedUserCards);
  }
  
  if (rivalCardsToAdd.length > 0) {
    updatedRivalCards = [...currentRivalCards, ...rivalCardsToAdd];
    setRivalActiveCards(updatedRivalCards);
  }
  
  // РАССЧИТЫВАЕМ СУММАРНЫЙ УРОН ВСЕХ АКТИВНЫХ КАРТ!!!
  const userTotalDamage = updatedUserCards.reduce(
    (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
  );
  
  const rivalTotalDamage = updatedRivalCards.reduce(
    (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
  );
  
  console.log(`💰 СУММАРНЫЙ урон игрока: ${userTotalDamage}, СУММАРНЫЙ урон противника: ${rivalTotalDamage}`);
  
  // Наносим урон
  setTimeout(() => {
    // Сначала игрок бьет противника
    setRivalHealth(prev => {
      const newHealth = Math.max(0, prev - userTotalDamage);
      console.log(`💔 Здоровье противника: ${prev} -> ${newHealth} (урон ${userTotalDamage})`);
      return newHealth;
    });
    
    setTimeout(() => {
      // Потом противник бьет игрока
      setUserHealth(prev => {
        const newHealth = Math.max(0, prev - rivalTotalDamage);
        console.log(`💔 Здоровье игрока: ${prev} -> ${newHealth} (урон ${rivalTotalDamage})`);
        return newHealth;
      });
      
      setTimeout(() => {
        // Получаем актуальные значения здоровья
        const newUserHealth = Math.max(0, userHealth - rivalTotalDamage);
        const newRivalHealth = Math.max(0, rivalHealth - userTotalDamage);
        
        console.log(`🏥 После раунда ${round}: Игрок ${newUserHealth}, Противник ${newRivalHealth}`);
        
        // Досрочная победа/поражение
        if (newRivalHealth <= 0 && newUserHealth > 0) {
          console.log('🏆 Досрочная победа!');
          setBattleResult({
            isOpen: true,
            result: 'win',
            resultType: 'ko'
          });
          setBattlePhase('finished');
          return;
        }
        
        if (newUserHealth <= 0 && newRivalHealth > 0) {
          console.log('💔 Досрочное поражение!');
          setBattleResult({
            isOpen: true,
            result: 'loss',
            resultType: 'ko'
          });
          setBattlePhase('finished');
          return;
        }
        
        if (newUserHealth <= 0 && newRivalHealth <= 0) {
          console.log('🤝 Ничья!');
          setBattleResult({
            isOpen: true,
            result: 'draw'
          });
          setBattlePhase('finished');
          return;
        }
        
        // Если бой не закончен и это не последний раунд
        if (round < 5) {
          console.log(`⏳ Переход к раунду ${round + 1}`);
          setBattlePhase('round-end');
          setTimeout(() => {
            const nextRound = round + 1;
            setCurrentRound(nextRound);
            setBattlePhase('round-start');
            startRound(nextRound);
          }, 2000);
        } else {
          // Бой закончен, определяем победителя по решению
          console.log('⚖️ Бой завершен, определение победителя по решению');
          const healthDiff = Math.abs(newUserHealth - newRivalHealth);
          
          if (newUserHealth > newRivalHealth) {
            if (healthDiff >= 100) {
              setBattleResult({
                isOpen: true,
                result: 'win',
                resultType: 'decision-unanimous'
              });
            } else {
              setBattleResult({
                isOpen: true,
                result: 'win',
                resultType: 'decision-split'
              });
            }
          } else if (newRivalHealth > newUserHealth) {
            if (healthDiff >= 100) {
              setBattleResult({
                isOpen: true,
                result: 'loss',
                resultType: 'decision-unanimous'
              });
            } else {
              setBattleResult({
                isOpen: true,
                result: 'loss',
                resultType: 'decision-split'
              });
            }
          } else {
            setBattleResult({
              isOpen: true,
              result: 'draw'
            });
          }
          
          setBattlePhase('finished');
        }
      }, 2000);
    }, 2000);
  }, 2000);
};

  // Обработчик закрытия результата
  const handleResultClose = () => {
    setBattleResult(null);
    onSurrender(); // Возвращаемся на экран PvP
  };

  // Обработчик SURRENDER
  const handleSurrender = () => {
    setBattleResult({
      isOpen: true,
      result: 'tech-loss'
    });
    setBattlePhase('finished');
  };

  // Получение надписи для отсчета
  const getCountdownText = () => {
    if (countdownStep === 'ready') return 'READY?';
    if (countdownStep === 'steady') return 'STEADY';
    if (countdownStep === 'fight') return 'FIGHT!';
    return null;
  };

  if (!isOpen) return null;

  const countdownText = getCountdownText();

  return (
    <div className="arena-modal-overlay">
      <div className="arena-modal">
        {isLoading ? (
          <div className="arena-loading">Loading arena data...</div>
        ) : (
          <>
            {/* Всплывающие надписи */}
            {countdownText && (
              <div className="battle-overlay-text">
                {countdownText}
              </div>
            )}
            
            {showRoundText && (
              <div className="battle-overlay-text">
                ROUND {currentRound}
              </div>
            )}
            
            {/* Верхняя шапка арены (8%) */}
            <div className="arena-header">
              <div className="arena-header-left">
                {tournament.name}
              </div>
              <div className="arena-header-right">
                <button className="arena-surrender-button" onClick={handleSurrender}>
                  SURRENDER
                </button>
              </div>
            </div>

            {/* Верхний контейнер (40%) - противник */}
            <div className="arena-top">
              {/* Аватарка противника (31%) */}
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
                  <div 
                    className="arena-health-fill" 
                    style={{ width: `${(rivalHealth / 1000) * 100}%` }}
                  ></div>
                  <span className="arena-health-text">{rivalData.username} Health: {rivalHealth}</span>
                </div>
              </div>

              {/* Карточки бойцов противника (53%) */}
              <div className="arena-rival-fighters">
                {Array(5).fill(null).map((_, index) => {
                  const card = rivalActiveCards[index];
                  return card ? (
                    <div 
                      key={index} 
                      className="arena-fighter-card"
                      style={{ backgroundColor: getWeightClassColor(card.weightClass) }}
                    >
                      <div className="arena-fighter-damage">
                        {Math.round(card.fighter['Total Damage'])}
                      </div>
                      <div className="arena-fighter-avatar">
                        <img 
                          src={`${BASE_URL}/avatars/${getAvatarFilename(card.weightClass)}`}
                          alt={card.fighter.Fighter}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) parent.innerHTML = card.weightClass.includes("Women") ? "👩" : "👤";
                          }}
                        />
                      </div>
                      <div className="arena-fighter-name">{card.fighter.Fighter}</div>
                    </div>
                  ) : (
                    <div key={index} className="arena-fighter-card empty" />
                  );
                })}
              </div>

              {/* Текущий урон противника (8%) */}
              <div className="arena-rival-damage">
                <div className="arena-damage-box">
                  CURRENT DAMAGE: {rivalActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
                </div>
              </div>
            </div>

            {/* Средний контейнер (12%) - раунды */}
            <div className="arena-middle">
              {[0, 1, 2, 3, 4].map((roundIndex) => {
                const roundNumber = roundIndex + 1;
                const isUsed = roundNumber <= usedWeightClasses.length;
                const weightClass = isUsed ? usedWeightClasses[roundIndex] : null;
                
                return (
                  <div 
                    key={roundIndex} 
                    className="arena-round-card"
                    style={weightClass ? { 
                      backgroundColor: getWeightClassColor(weightClass) 
                    } : {}}
                  >
                    {weightClass ? (
                      <div className="arena-round-weight">{weightClass}</div>
                    ) : (
                      <div className="arena-round-number">
                        <div className="arena-round-digit">{roundNumber}</div>
                        <div className="arena-round-text">ROUND</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Нижний контейнер (40%) - игрок */}
            <div className="arena-bottom">
              {/* 1. Текущий урон игрока (8%) */}
              <div className="arena-player-damage">
                <div className="arena-damage-box">
                  CURRENT DAMAGE: {userActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
                </div>
              </div>

              {/* 2. Карточки бойцов игрока (53%) */}
              <div className="arena-player-fighters">
                {Array(5).fill(null).map((_, index) => {
                  const card = userActiveCards[index];
                  return card ? (
                    <div 
                      key={index} 
                      className="arena-fighter-card"
                      style={{ backgroundColor: getWeightClassColor(card.weightClass) }}
                    >
                      <div className="arena-fighter-damage">
                        {Math.round(card.fighter['Total Damage'])}
                      </div>
                      <div className="arena-fighter-avatar">
                        <img 
                          src={`${BASE_URL}/avatars/${getAvatarFilename(card.weightClass)}`}
                          alt={card.fighter.Fighter}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) parent.innerHTML = card.weightClass.includes("Women") ? "👩" : "👤";
                          }}
                        />
                      </div>
                      <div className="arena-fighter-name">{card.fighter.Fighter}</div>
                    </div>
                  ) : (
                    <div key={index} className="arena-fighter-card empty" />
                  );
                })}
              </div>

              {/* 3. Шкала здоровья игрока (8%) */}
              <div className="arena-player-health">
                <div className="arena-health-bar">
                  <div 
                    className="arena-health-fill" 
                    style={{ width: `${(userHealth / 1000) * 100}%` }}
                  ></div>
                  <span className="arena-health-text">{userName} Health: {userHealth}</span>
                </div>
              </div>

              {/* 4. Аватарка игрока (31%) */}
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
      
      {/* Модальное окно результата боя */}
      {battleResult && (
        <BattleResultModal
          isOpen={battleResult.isOpen}
          result={battleResult.result}
          resultType={battleResult.resultType}
          onClose={handleResultClose}
        />
      )}
    </div>
  );
};

export default ArenaModal;