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

// Тип для события в бою
type BattleEvent = {
  type: 'countdown' | 'round-start' | 'card-appear' | 'damage' | 'round-end' | 'battle-end';
  round?: number;
  weightClass?: string;
  userActiveCards?: SelectedFighter[];
  rivalActiveCards?: SelectedFighter[];
  userDamage?: number;
  rivalDamage?: number;
  userHealthAfter?: number;
  rivalHealthAfter?: number;
  result?: any;
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
  const [isLoading, setIsLoading] = useState(true);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [battleScript, setBattleScript] = useState<BattleEvent[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [showRoundText, setShowRoundText] = useState(false);
  const [userHealth, setUserHealth] = useState(1000);
  const [rivalHealth, setRivalHealth] = useState(1000);
  const [userActiveCards, setUserActiveCards] = useState<SelectedFighter[]>([]);
  const [rivalActiveCards, setRivalActiveCards] = useState<SelectedFighter[]>([]);
  const [usedWeightClasses, setUsedWeightClasses] = useState<string[]>([]);
  const [battleResult, setBattleResult] = useState<{
    isOpen: boolean;
    result: 'win' | 'loss' | 'draw' | 'tech-loss';
    resultType?: 'ko' | 'decision-unanimous' | 'decision-split';
  } | null>(null);
  const [countdownStep, setCountdownStep] = useState<'ready' | 'steady' | 'fight' | null>('ready');
  const [damagePhase, setDamagePhase] = useState<'idle' | 'first' | 'second'>('idle');

  // Добавить новое состояние
const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false, false, false]);

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  // Функция для расчета всего сценария боя
  const calculateBattleScript = (): BattleEvent[] => {
    const events: BattleEvent[] = [];
    let currentUserHealth = 1000;
    let currentRivalHealth = 1000;
    let currentUserCards: SelectedFighter[] = [];
    let currentRivalCards: SelectedFighter[] = [];
    let availableClasses = [...weightClasses];
    let usedClasses: string[] = [];

    // Добавляем отсчет
    events.push({ type: 'countdown' });

    // 5 раундов
    for (let round = 1; round <= 5; round++) {
      // Начало раунда
      events.push({ type: 'round-start', round });

      // Выбираем случайную весовую категорию
      if (availableClasses.length === 0) break;
      
      const randomIndex = Math.floor(Math.random() * availableClasses.length);
      const selectedClass = availableClasses[randomIndex];
      usedClasses.push(selectedClass);
      availableClasses = availableClasses.filter((_, i) => i !== randomIndex);

      // Находим новых бойцов
      const newUserFighters = userSelections.filter(
        sel => sel.weightClass === selectedClass && !currentUserCards.includes(sel)
      );
      
      const newRivalFighters = rivalData.selections.filter(
        sel => sel.weightClass === selectedClass && !currentRivalCards.includes(sel)
      );

      // Добавляем новых бойцов
      const userSlots = 5 - currentUserCards.length;
      const userCardsToAdd = newUserFighters.slice(0, userSlots);
      
      const rivalSlots = 5 - currentRivalCards.length;
      const rivalCardsToAdd = newRivalFighters.slice(0, rivalSlots);

      // Обновляем карты
      if (userCardsToAdd.length > 0) {
        currentUserCards = [...currentUserCards, ...userCardsToAdd];
      }
      
      if (rivalCardsToAdd.length > 0) {
        currentRivalCards = [...currentRivalCards, ...rivalCardsToAdd];
      }

      // Событие появления карт
      events.push({
        type: 'card-appear',
        round,
        weightClass: selectedClass,
        userActiveCards: [...currentUserCards],
        rivalActiveCards: [...currentRivalCards]
      });

      // Рассчитываем суммарный урон
      const userTotalDamage = currentUserCards.reduce(
        (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
      );
      
      const rivalTotalDamage = currentRivalCards.reduce(
        (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
      );

      // Наносим урон
      currentRivalHealth = Math.max(0, currentRivalHealth - userTotalDamage);
      currentUserHealth = Math.max(0, currentUserHealth - rivalTotalDamage);

      // Событие нанесения урона
      events.push({
        type: 'damage',
        round,
        userDamage: userTotalDamage,
        rivalDamage: rivalTotalDamage,
        userHealthAfter: currentUserHealth,
        rivalHealthAfter: currentRivalHealth
      });

      // Проверка на досрочное окончание
      if (currentRivalHealth <= 0 && currentUserHealth > 0) {
        events.push({
          type: 'battle-end',
          result: { isOpen: true, result: 'win', resultType: 'ko' }
        });
        return events;
      }
      
      if (currentUserHealth <= 0 && currentRivalHealth > 0) {
        events.push({
          type: 'battle-end',
          result: { isOpen: true, result: 'loss', resultType: 'ko' }
        });
        return events;
      }
      
      if (currentUserHealth <= 0 && currentRivalHealth <= 0) {
        events.push({
          type: 'battle-end',
          result: { isOpen: true, result: 'draw' }
        });
        return events;
      }

      // Конец раунда
      if (round < 5) {
        events.push({ type: 'round-end', round });
      }
    }

    // Если бой дошел до конца, определяем победителя по решению
    const healthDiff = Math.abs(currentUserHealth - currentRivalHealth);
    let result;

    if (currentUserHealth > currentRivalHealth) {
      result = {
        isOpen: true,
        result: 'win',
        resultType: healthDiff >= 100 ? 'decision-unanimous' : 'decision-split'
      };
    } else if (currentRivalHealth > currentUserHealth) {
      result = {
        isOpen: true,
        result: 'loss',
        resultType: healthDiff >= 100 ? 'decision-unanimous' : 'decision-split'
      };
    } else {
      result = { isOpen: true, result: 'draw' };
    }

    events.push({ type: 'battle-end', result });

    return events;
  };

  // Функция для выполнения следующего события
const playNextEvent = () => {
  if (currentEventIndex >= battleScript.length) return;

  const event = battleScript[currentEventIndex];
  console.log('🎬 Событие:', event);

  switch (event.type) {
    case 'countdown':
      setCountdownStep('ready');
      setTimeout(() => setCountdownStep('steady'), 1000);
      setTimeout(() => setCountdownStep('fight'), 2000);
      setTimeout(() => {
        setCountdownStep(null);
        setCurrentEventIndex(prev => prev + 1);
      }, 3000);
      break;

    case 'round-start':
      setShowRoundText(true);
      setTimeout(() => {
        setShowRoundText(false);
        setCurrentEventIndex(prev => prev + 1);
      }, 1000);
      break;

    case 'card-appear':
      // Добавляем весовую категорию в использованные
      setUsedWeightClasses(prev => [...prev, event.weightClass!]);
      
      // Запускаем анимацию переворота для карты этого раунда
      const cardIndex = event.round! - 1;
      setFlippedCards(prev => {
        const newFlipped = [...prev];
        newFlipped[cardIndex] = true;
        return newFlipped;
      });
      
      // Через 300мс показываем лицевую сторону карты и бойцов
      setTimeout(() => {
        // Обновляем карты бойцов
        setUserActiveCards(event.userActiveCards || []);
        setRivalActiveCards(event.rivalActiveCards || []);
        
        // Переходим к следующему событию через оставшееся время
        setTimeout(() => setCurrentEventIndex(prev => prev + 1), 1700);
      }, 300);
      break;

    case 'damage':
  // ШАГ 1: Игрок бьет противника (здоровье противника уменьшается)
  setDamagePhase('first');
  setRivalHealth(event.rivalHealthAfter!);
  
  // Через 0.75 сек - ШАГ 2: Противник бьет игрока
  setTimeout(() => {
    setDamagePhase('second');
    setUserHealth(event.userHealthAfter!);
    
    // Еще через 0.75 сек - переходим к следующему событию
    setTimeout(() => {
      setDamagePhase('idle');
      setCurrentEventIndex(prev => prev + 1);
    }, 750);
  }, 750);
  break;

    case 'round-end':
      setCurrentRound(prev => prev + 1);
      setTimeout(() => setCurrentEventIndex(prev => prev + 1), 500);
      break;

    case 'battle-end':
      setBattleResult(event.result);
      break;
  }
};

  // Эффект для выполнения событий по порядку
  useEffect(() => {
    if (!isLoading && battleScript.length > 0) {
      playNextEvent();
    }
  }, [currentEventIndex, isLoading, battleScript]);

  // Инициализация при открытии
useEffect(() => {
  if (isOpen) {
    console.log('🎮 Арена открыта, рассчитываем сценарий боя...');
    
    setIsLoading(true);
    setCurrentEventIndex(0);
    setUsedWeightClasses([]);
    setFlippedCards([false, false, false, false, false]); // ← добавить
    setUserHealth(1000);
    setRivalHealth(1000);
    setUserActiveCards([]);
    setRivalActiveCards([]);
    setBattleResult(null);
    
    // Рассчитываем весь сценарий заранее
    const script = calculateBattleScript();
    console.log('📜 Сценарий боя:', script);
    setBattleScript(script);
    
    // ПРЕДЗАГРУЗКА: собираем все карты, которые появятся в бою
    const allCardsThatWillAppear = new Set<string>();
    
    // Проходим по всем событиям сценария
    script.forEach(event => {
      if (event.type === 'card-appear') {
        // Добавляем аватарки бойцов, которые появятся
        event.userActiveCards?.forEach(card => {
          allCardsThatWillAppear.add(
            `${BASE_URL}/avatars/${getAvatarFilename(card.weightClass)}`
          );
        });
        event.rivalActiveCards?.forEach(card => {
          allCardsThatWillAppear.add(
            `${BASE_URL}/avatars/${getAvatarFilename(card.weightClass)}`
          );
        });
      }
    });
    
    console.log('🖼️ Предзагружаем карточки:', Array.from(allCardsThatWillAppear));
    
    // Загружаем все изображения параллельно
    const imagePromises = Array.from(allCardsThatWillAppear).map(src => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = resolve;
        img.onerror = reject;
      });
    });
    
    // Ждем загрузки всех изображений (но не больше 3 секунд)
    Promise.allSettled(imagePromises).then(() => {
      console.log('✅ Все карточки загружены');
      setTimeout(() => {
        console.log('✅ Загрузка завершена, запускаем бой');
        setIsLoading(false);
      }, 500); // Небольшая задержка для плавности
    });
    
    // Таймаут на случай очень медленной загрузки
    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  }
}, [isOpen]);

  // Обработчик закрытия результата
  const handleResultClose = () => {
    setBattleResult(null);
    onSurrender();
  };

  // Обработчик SURRENDER
  const handleSurrender = () => {
    setBattleResult({
      isOpen: true,
      result: 'tech-loss'
    });
  };

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
            
            {/* Верхняя шапка арены */}
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

            {/* Верхний контейнер - противник */}
<div className="arena-top">
  {/* Новый контейнер с тремя колонками */}
  <div className="arena-avatar-container">
    {/* Левый блок - DAMAGE противника (скругление правый нижний) */}
    <div className="arena-avatar-left">
  <div className="arena-damage-display rival-damage">
    <span className="damage-label">DAMAGE</span>
    <span className="damage-value">
      {rivalActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
    </span>
  </div>
</div>
    
    {/* Средний блок - аватарка противника */}
    <div className="arena-avatar-center">
      <div className="arena-avatar">
        <img 
          src={rivalData.photoUrl || `${BASE_URL}/default-avatar.png`}
          alt="rival"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `${BASE_URL}/default-avatar.png`;
          }}
        />
      </div>
    </div>
    
    {/* Правый блок - пустой (резерв) */}
    <div className="arena-avatar-right"></div>
  </div>

              <div className="arena-rival-health">
                <div className="arena-health-bar">
                  <div 
                    className="arena-health-fill" 
                    style={{ width: `${(rivalHealth / 1000) * 100}%` }}
                  ></div>
                  <span className="arena-health-text">{rivalData.username} Health: {rivalHealth}</span>
                </div>
              </div>

               <div className="arena-rival-fighters">
    {rivalActiveCards.map((card, index) => (
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
    ))}
  </div>

              
            </div>

            {/* Средний контейнер (12%) - раунды */}
<div className="arena-middle">
  {[0, 1, 2, 3, 4].map((roundIndex) => {
    const roundNumber = roundIndex + 1;
    const isUsed = roundNumber <= usedWeightClasses.length;
    const weightClass = isUsed ? usedWeightClasses[roundIndex] : null;
    const isFlipped = flippedCards[roundIndex];
    
    return (
      <div 
        key={roundIndex} 
        className={`arena-round-card ${isFlipped ? 'flipped' : ''}`}
      >
        <div className="arena-round-card-inner">
          {/* Лицевая сторона - исходный вид */}
          <div className="arena-round-card-front">
            <div className="arena-round-number">
              <div className="arena-round-digit">{roundNumber}</div>
              <div className="arena-round-text">ROUND</div>
            </div>
          </div>
          
          {/* Задняя сторона - цвет весовой категории */}
          <div 
            className="arena-round-card-back"
            style={weightClass ? { 
              backgroundColor: getWeightClassColor(weightClass) 
            } : {}}
          >
            {weightClass && (
              <div className="arena-round-weight">{weightClass}</div>
            )}
          </div>
        </div>
      </div>
    );
  })}
</div>

            {/* Нижний контейнер - игрок */}
<div className="arena-bottom">
  
  {/* 2. Карточки бойцов игрока (53%) - ТОЖЕ ДИНАМИЧЕСКИЕ */}
  <div className="arena-player-fighters">
    {userActiveCards.map((card, index) => (
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
    ))}
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

  {/* Новый контейнер с тремя колонками */}
  <div className="arena-avatar-container">
    {/* Левый блок - DAMAGE игрока (скругление правый верхний) */}
    <div className="arena-avatar-left">
  <div className="arena-damage-display player-damage">
    <span className="damage-label">DAMAGE</span>
    <span className="damage-value">
      {userActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
    </span>
  </div>
</div>
    
    {/* Средний блок - аватарка игрока */}
    <div className="arena-avatar-center">
      <div className="arena-avatar">
        <img 
          src={userAvatar || `${BASE_URL}/Home_button.png`}
          alt="player"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `${BASE_URL}/Home_button.png`;
          }}
        />
      </div>
    </div>
    
    {/* Правый блок - пустой (резерв) */}
    <div className="arena-avatar-right"></div>
  </div>
</div>
          </>
        )}
      </div>
      
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