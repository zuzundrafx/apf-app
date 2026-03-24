// src/components/ArenaModal.tsx

import React, { useEffect, useState, useRef } from 'react';
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
    'Flyweight': '#00FFA3',
    'Bantamweight': '#00E0FF',
    'Featherweight': '#0075FF',
    'Lightweight': '#AD00FF',
    'Welterweight': '#FF00D6',
    'Middleweight': '#FFD700',
    'Light Heavyweight': '#FF5C00',
    'Heavyweight': '#FF0000',
    "Women's Strawweight": '#FF6B9D',
    "Women's Flyweight": '#5EEAD4',
    "Women's Bantamweight": '#818CF8',
    "Catch Weight": '#94A3B8'
  };
  return colors[weightClass] || '#666666';
};

// Функция для определения стиля бойца
const getFighterStyle = (fighter: SelectedFighter): string => {
  const str = Number(fighter.fighter.Str) || 0;
  const td = Number(fighter.fighter.Td) || 0;
  const sub = Number(fighter.fighter.Sub) || 0;
  const tdSubSum = td + sub;

  if (tdSubSum >= 2 && str < 50) {
    return 'Grappler';
  }
  if (str >= 50 && tdSubSum < 2) {
    return 'Striker';
  }
  if (str >= 50 && tdSubSum >= 2) {
    return 'Universal';
  }
  return 'Simple';
};

// Функция для получения имени файла иконки стиля
const getStyleIconFilename = (style: string): string => {
  const icons: { [key: string]: string } = {
    'Grappler': 'Grappler_style_icon.webp',
    'Striker': 'Striker_style_icon.webp',
    'Universal': 'Universal_style_icon.webp',
    'Simple': 'Simple_style_icon.webp'
  };
  return icons[style] || 'Simple_style_icon.webp';
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
  const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false, false, false]);

  const [animatedDamage, setAnimatedDamage] = useState<{ player: number; rival: number }>({ player: 0, rival: 0 });
  const [showDamageIncrease, setShowDamageIncrease] = useState<{ player: boolean; rival: boolean }>({ 
    player: false, 
    rival: false 
  });
  const [showDamageNumber, setShowDamageNumber] = useState<{ 
    player: number | null; 
    rival: number | null 
  }>({ player: null, rival: null });

  const [shakeScreen, setShakeScreen] = useState(false);
  const [healthFlash, setHealthFlash] = useState<'player' | 'rival' | null>(null);

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  const [isBattleLoaded, setIsBattleLoaded] = useState(false);
  
  // Refs для эффектов
  const effectsContainerRef = useRef<HTMLDivElement>(null);

  // Функция создания эффекта удара (летящий удар от линии HP)
  const createHitEffect = (x: number, y: number, damage: number, side: 'player' | 'rival') => {
    const container = effectsContainerRef.current;
    if (!container) return;
    
    // Определяем сторону, откуда прилетает удар
    let startX: number;
    let startY: number;
    
    // Случайный выбор траектории (0-3)
    const trajectoryType = Math.floor(Math.random() * 4);
    
    if (side === 'rival') {
      // Противник (верхняя аватарка) — удар прилетает сверху/снизу/сбоку
      const healthBar = document.querySelector('.arena-rival-health');
      const healthRect = healthBar?.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      if (healthRect) {
        switch (trajectoryType) {
          case 0: // Прямой удар слева/справа
            startX = healthRect.left - containerRect.left + (Math.random() * 60) - 30;
            startY = y - 40 + (Math.random() * 80);
            break;
          case 1: // Удар сверху (дуга)
            startX = x + (Math.random() - 0.5) * 100;
            startY = healthRect.top - containerRect.top - 30 - (Math.random() * 40);
            break;
          case 2: // Удар снизу (дуга)
            startX = x + (Math.random() - 0.5) * 100;
            startY = y + 50 + (Math.random() * 60);
            break;
          default: // Боковой удар
            const fromLeft = Math.random() > 0.5;
            startX = fromLeft 
              ? healthRect.left - containerRect.left - 40 - (Math.random() * 30)
              : healthRect.right - containerRect.left + 40 + (Math.random() * 30);
            startY = y - 30 + (Math.random() * 60);
            break;
        }
      } else {
        startX = x - 80 + (Math.random() * 160);
        startY = y - 60 + (Math.random() * 120);
      }
    } else {
      // Игрок (нижняя аватарка) — удар прилетает снизу/сверху/сбоку
      const healthBar = document.querySelector('.arena-player-health');
      const healthRect = healthBar?.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      if (healthRect) {
        switch (trajectoryType) {
          case 0: // Прямой удар слева/справа
            startX = healthRect.left - containerRect.left + (Math.random() * 60) - 30;
            startY = y - 40 + (Math.random() * 80);
            break;
          case 1: // Удар сверху (дуга)
            startX = x + (Math.random() - 0.5) * 100;
            startY = y - 50 - (Math.random() * 50);
            break;
          case 2: // Удар снизу (дуга)
            startX = x + (Math.random() - 0.5) * 100;
            startY = healthRect.bottom - containerRect.top + 30 + (Math.random() * 50);
            break;
          default: // Боковой удар
            const fromLeft = Math.random() > 0.5;
            startX = fromLeft 
              ? healthRect.left - containerRect.left - 40 - (Math.random() * 30)
              : healthRect.right - containerRect.left + 40 + (Math.random() * 30);
            startY = y - 30 + (Math.random() * 60);
            break;
        }
      } else {
        startX = x - 80 + (Math.random() * 160);
        startY = y - 60 + (Math.random() * 120);
      }
    }
    
    // Точка финиша — центр аватарки (с небольшим случайным смещением)
    const endX = x + (Math.random() - 0.5) * 25;
    const endY = y + (Math.random() - 0.5) * 25;
    
    // Интенсивность эффекта зависит от урона
    const intensity = Math.min(0.7 + damage / 100, 1);
    
    // Цвет эффекта (от красного до золотого при крите)
    const isCritical = damage > 80;
    const mainColor = isCritical ? '#FFD966' : '#FF5030';
    const glowColor = isCritical ? '#FFA500' : '#FF3030';
    
    // Вычисляем параметры для анимации
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // Создаем основной след удара
    const slash = document.createElement('div');
    slash.style.cssText = `
      position: absolute;
      left: ${startX}px;
      top: ${startY}px;
      width: ${length}px;
      height: ${3 + damage / 30}px;
      background: linear-gradient(90deg, ${mainColor} 0%, ${glowColor} 40%, rgba(255, 255, 255, 0.8) 70%, transparent 100%);
      transform-origin: 0 0;
      transform: rotate(${angle}deg);
      border-radius: 4px;
      filter: blur(${isCritical ? 3 : 1}px);
      pointer-events: none;
      z-index: 100;
      opacity: 0.9;
      animation: impactSlash 0.22s ease-out forwards;
      box-shadow: 0 0 ${isCritical ? 12 : 6}px ${mainColor};
    `;
    container.appendChild(slash);
    setTimeout(() => slash.remove(), 220);
    
    // Для дополнительной динамики — добавляем "хвост" (вторичный след, чуть шире)
    if (damage > 30) {
      const tail = document.createElement('div');
      tail.style.cssText = `
        position: absolute;
        left: ${startX - 5}px;
        top: ${startY - 2}px;
        width: ${length + 10}px;
        height: ${1 + damage / 50}px;
        background: linear-gradient(90deg, rgba(255, 100, 50, 0.4) 0%, rgba(255, 255, 200, 0.3) 60%, transparent 100%);
        transform-origin: 0 0;
        transform: rotate(${angle}deg);
        border-radius: 4px;
        filter: blur(3px);
        pointer-events: none;
        z-index: 99;
        opacity: 0.6;
        animation: impactSlash 0.2s ease-out forwards;
      `;
      container.appendChild(tail);
      setTimeout(() => tail.remove(), 200);
    }
    
    // Вспышка в точке удара
    const flashSize = 18 + damage / 15;
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: absolute;
      left: ${endX - flashSize / 2}px;
      top: ${endY - flashSize / 2}px;
      width: ${flashSize}px;
      height: ${flashSize}px;
      background: radial-gradient(circle, ${mainColor} 0%, ${glowColor} 50%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 101;
      animation: impactFlash 0.2s ease-out forwards;
    `;
    container.appendChild(flash);
    setTimeout(() => flash.remove(), 200);
    
    // Для критических ударов — добавляем эффект "разрыва" (несколько мелких искр)
    if (isCritical) {
      for (let i = 0; i < 6; i++) {
        const spark = document.createElement('div');
        const sparkX = endX + (Math.random() - 0.5) * 25;
        const sparkY = endY + (Math.random() - 0.5) * 25;
        spark.style.cssText = `
          position: absolute;
          left: ${sparkX}px;
          top: ${sparkY}px;
          width: ${3 + Math.random() * 5}px;
          height: ${3 + Math.random() * 5}px;
          background: ${mainColor};
          border-radius: 50%;
          pointer-events: none;
          z-index: 102;
          opacity: 0.8;
          animation: sparkFly 0.3s ease-out forwards;
          --tx: ${(Math.random() - 0.5) * 40}px;
          --ty: ${(Math.random() - 0.5) * 40 - 20}px;
        `;
        container.appendChild(spark);
        setTimeout(() => spark.remove(), 300);
      }
    }
  };

  // Функция для определения позиции удара
  const getHitPosition = (side: 'player' | 'rival', damage: number): { x: number, y: number } => {
    const container = effectsContainerRef.current;
    if (!container) return { x: 0, y: 0 };
    
    let avatarElement: Element | null = null;
    
    if (side === 'rival') {
      avatarElement = document.querySelector('.arena-top .arena-avatar');
    } else {
      avatarElement = document.querySelector('.arena-bottom .arena-avatar');
    }
    
    if (!avatarElement) return { x: container.clientWidth / 2, y: container.clientHeight / 2 };
    
    const rect = avatarElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    const randomOffset = damage / 60;
    const offsetX = (Math.random() - 0.5) * randomOffset * 15;
    const offsetY = (Math.random() - 0.5) * randomOffset * 15;
    
    return {
      x: rect.left + rect.width / 2 + offsetX - containerRect.left,
      y: rect.top + rect.height / 2 + offsetY - containerRect.top
    };
  };

  // Функция для анимации аватарки (красная вспышка на самом аватаре)
  const flashAvatar = (side: 'player' | 'rival') => {
    const avatar = side === 'rival' 
      ? document.querySelector('.arena-top .arena-avatar')
      : document.querySelector('.arena-bottom .arena-avatar');
    
    if (avatar) {
      avatar.classList.add('hit');
      setTimeout(() => avatar.classList.remove('hit'), 200);
    }
  };

  // Функция для расчета всего сценария боя
  const calculateBattleScript = (): BattleEvent[] => {
    const events: BattleEvent[] = [];
    let currentUserHealth = 1000;
    let currentRivalHealth = 1000;
    let currentUserCards: SelectedFighter[] = [];
    let currentRivalCards: SelectedFighter[] = [];
    let availableClasses = [...weightClasses];
    let usedClasses: string[] = [];

    events.push({ type: 'countdown' });

    for (let round = 1; round <= 5; round++) {
      events.push({ type: 'round-start', round });

      if (availableClasses.length === 0) break;
      
      const randomIndex = Math.floor(Math.random() * availableClasses.length);
      const selectedClass = availableClasses[randomIndex];
      usedClasses.push(selectedClass);
      availableClasses = availableClasses.filter((_, i) => i !== randomIndex);

      const newUserFighters = userSelections.filter(
        sel => sel.weightClass === selectedClass && !currentUserCards.includes(sel)
      );
      
      const newRivalFighters = rivalData.selections.filter(
        sel => sel.weightClass === selectedClass && !currentRivalCards.includes(sel)
      );

      const userSlots = 5 - currentUserCards.length;
      const userCardsToAdd = newUserFighters.slice(0, userSlots);
      
      const rivalSlots = 5 - currentRivalCards.length;
      const rivalCardsToAdd = newRivalFighters.slice(0, rivalSlots);

      if (userCardsToAdd.length > 0) {
        currentUserCards = [...currentUserCards, ...userCardsToAdd];
      }
      
      if (rivalCardsToAdd.length > 0) {
        currentRivalCards = [...currentRivalCards, ...rivalCardsToAdd];
      }

      events.push({
        type: 'card-appear',
        round,
        weightClass: selectedClass,
        userActiveCards: [...currentUserCards],
        rivalActiveCards: [...currentRivalCards]
      });

      const userTotalDamage = currentUserCards.reduce(
        (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
      );
      
      const rivalTotalDamage = currentRivalCards.reduce(
        (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
      );

      currentRivalHealth = Math.max(0, currentRivalHealth - userTotalDamage);
      currentUserHealth = Math.max(0, currentUserHealth - rivalTotalDamage);

      events.push({
        type: 'damage',
        round,
        userDamage: userTotalDamage,
        rivalDamage: rivalTotalDamage,
        userHealthAfter: currentUserHealth,
        rivalHealthAfter: currentRivalHealth
      });

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

      if (round < 5) {
        events.push({ type: 'round-end', round });
      }
    }

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
        setUsedWeightClasses(prev => [...prev, event.weightClass!]);
        
        const cardIndex = event.round! - 1;
        setFlippedCards(prev => {
          const newFlipped = [...prev];
          newFlipped[cardIndex] = true;
          return newFlipped;
        });
        
        const currentPlayerDamage = userActiveCards.reduce(
          (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
        );
        const currentRivalDamage = rivalActiveCards.reduce(
          (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
        );
        
        const newPlayerDamage = (event.userActiveCards || []).reduce(
          (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
        );
        const newRivalDamage = (event.rivalActiveCards || []).reduce(
          (sum, card) => sum + Math.round(card.fighter['Total Damage']), 0
        );
        
        const playerDamageIncreased = newPlayerDamage > currentPlayerDamage;
        const rivalDamageIncreased = newRivalDamage > currentRivalDamage;
        
        setTimeout(() => {
          setUserActiveCards(event.userActiveCards || []);
          setRivalActiveCards(event.rivalActiveCards || []);
          
          setAnimatedDamage({ player: newPlayerDamage, rival: newRivalDamage });
          
          setShowDamageIncrease({ 
            player: playerDamageIncreased, 
            rival: rivalDamageIncreased 
          });
          
          setTimeout(() => {
            setShowDamageIncrease({ player: false, rival: false });
          }, 500);
          
          setTimeout(() => setCurrentEventIndex(prev => prev + 1), 1200);
        }, 300);
        break;

      case 'damage':
        const playerDamageDealt = event.userDamage || 0;
        const rivalDamageDealt = event.rivalDamage || 0;
        
        console.log('💥 Урон:', { playerDamageDealt, rivalDamageDealt });
        
        setDamagePhase('first');
        setRivalHealth(event.rivalHealthAfter!);
        
        if (playerDamageDealt > 0) {
          setShowDamageNumber({ player: null, rival: playerDamageDealt });
          setHealthFlash('rival');
          
          if (playerDamageDealt > 50) {
            setShakeScreen(true);
            setTimeout(() => setShakeScreen(false), 400);
          }
          
          const rivalPos = getHitPosition('rival', playerDamageDealt);
          createHitEffect(rivalPos.x, rivalPos.y, playerDamageDealt, 'rival');
          flashAvatar('rival');
        }
        
        setTimeout(() => {
          setDamagePhase('second');
          setUserHealth(event.userHealthAfter!);
          
          if (rivalDamageDealt > 0) {
            setShowDamageNumber({ player: rivalDamageDealt, rival: null });
            setHealthFlash('player');
            
            if (rivalDamageDealt > 50) {
              setShakeScreen(true);
              setTimeout(() => setShakeScreen(false), 400);
            }
            
            const playerPos = getHitPosition('player', rivalDamageDealt);
            createHitEffect(playerPos.x, playerPos.y, rivalDamageDealt, 'player');
            flashAvatar('player');
          }
          
          setTimeout(() => {
            setShowDamageNumber({ player: null, rival: null });
            setHealthFlash(null);
          }, 1000);
          
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

  useEffect(() => {
    if (!isLoading && battleScript.length > 0) {
      playNextEvent();
    }
  }, [currentEventIndex, isLoading, battleScript]);

  useEffect(() => {
    if (isOpen) {
      console.log('🎮 Арена открыта, рассчитываем сценарий боя...');
      
      setIsLoading(true);
      
      setCurrentEventIndex(0);
      setUsedWeightClasses([]);
      setFlippedCards([false, false, false, false, false]);
      setUserHealth(1000);
      setRivalHealth(1000);
      setUserActiveCards([]);
      setRivalActiveCards([]);
      setBattleResult(null);
      
      const script = calculateBattleScript();
      console.log('📜 Сценарий боя:', script);
      setBattleScript(script);
      
      const allCardsThatWillAppear = new Set<string>();
      
      script.forEach(event => {
        if (event.type === 'card-appear') {
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
      
      const imagePromises = Array.from(allCardsThatWillAppear).map(src => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = src;
          img.onload = resolve;
          img.onerror = reject;
        });
      });
      
      Promise.allSettled(imagePromises).then(() => {
        console.log('✅ Все карточки загружены');
        setTimeout(() => {
          console.log('✅ Загрузка завершена, запускаем бой');
          setIsLoading(false);
          setIsBattleLoaded(true);
        }, 500);
      });
      
      setTimeout(() => {
        setIsLoading(false);
        setIsBattleLoaded(true);
      }, 3000);
    }
  }, [isOpen]);

  const handleResultClose = () => {
    setBattleResult(null);
    onSurrender();
  };

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
      <div className={`arena-modal ${shakeScreen ? 'shake' : ''} ${isBattleLoaded ? 'battle-loaded' : ''}`}>
        {/* Контейнер для эффектов */}
        <div 
          ref={effectsContainerRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 100,
            overflow: 'hidden'
          }}
        />
        
        <div className="arena-octagon">
          <img src={`${BASE_URL}/backgrounds/Arena_1_bg.webp`} alt="Octagon" className="octagon-image" />
        </div>
        
        {isLoading ? (
          <div className="arena-loading">Loading arena data...</div>
        ) : (
          <>
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

            <div className="arena-top">
              <div className="arena-avatar-container">
                <div className="arena-avatar-left">
                  <div className="arena-damage-display rival-damage">
                    <div className="damage-username">{rivalData.username}</div>
                    <div className="damage-divider"></div>
                    <span className="damage-label">DAMAGE</span>
                    <span className={`damage-value ${showDamageIncrease.rival ? 'damage-increase' : ''}`}>
                      {animatedDamage.rival > 0 ? animatedDamage.rival : 
                        rivalActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
                    </span>
                  </div>
                </div>
                
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
                
                <div className="arena-avatar-right"></div>
              </div>

              {showDamageNumber.rival && (
                <div className="damage-number rival-damage">
                  -{showDamageNumber.rival}
                </div>
              )}

              <div className="arena-rival-health">
                <div className={`arena-health-bar ${healthFlash === 'rival' ? 'damage-flash' : ''}`}>
                  <div 
                    className="arena-health-fill" 
                    style={{ width: `${(rivalHealth / 1000) * 100}%` }}
                  ></div>
                  <span className="arena-health-text">HP {rivalHealth}/1000</span>
                </div>
              </div>

              <div className="arena-rival-fighters">
                {rivalActiveCards.map((card, index) => {
                  const style = getFighterStyle(card);
                  const styleIcon = getStyleIconFilename(style);
                  
                  return (
                    <div 
                      key={index} 
                      className="arena-fighter-card"
                      data-weight={card.weightClass}
                      style={{ backgroundColor: getWeightClassColor(card.weightClass) }}
                    >
                      <div className="fighter-damage-block">
                        {Math.round(card.fighter['Total Damage'])}
                      </div>
                      
                      <div className="fighter-card-inner">
                        <div className="fighter-icon-container">
                          <img 
                            src={`${BASE_URL}/icons/${styleIcon}`}
                            alt={style}
                            className="fighter-style-icon"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                parent.innerHTML = style === 'Striker' ? '👊' : 
                                                  style === 'Grappler' ? '🤼' : 
                                                  style === 'Universal' ? '⚡' : '👤';
                                parent.style.fontSize = '24px';
                              }
                            }}
                          />
                        </div>
                        
                        <div 
                          className="fighter-divider"
                          style={{ color: getWeightClassColor(card.weightClass) }}
                        ></div>
                        
                        <div className="fighter-name-container">
                          {card.fighter.Fighter}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="arena-middle">
              {[0, 1, 2, 3, 4].map((roundIndex) => {
                const roundNumber = roundIndex + 1;
                const isUsed = roundNumber <= usedWeightClasses.length;
                const weightClass = isUsed ? usedWeightClasses[roundIndex] : null;
                const isFlipped = flippedCards[roundIndex];
                
                const getWeightCardClass = (weightClass: string | null): string => {
                  if (!weightClass) return '';
                  
                  const classMap: { [key: string]: string } = {
                    'Flyweight': 'weight-card-flyweight',
                    'Bantamweight': 'weight-card-bantamweight',
                    'Featherweight': 'weight-card-featherweight',
                    'Lightweight': 'weight-card-lightweight',
                    'Welterweight': 'weight-card-welterweight',
                    'Middleweight': 'weight-card-middleweight',
                    'Light Heavyweight': 'weight-card-light-heavyweight',
                    'Heavyweight': 'weight-card-heavyweight',
                    "Women's Strawweight": 'weight-card-womens-strawweight',
                    "Women's Flyweight": 'weight-card-womens-flyweight',
                    "Women's Bantamweight": 'weight-card-womens-bantamweight',
                    "Catch Weight": 'weight-card-catch-weight'
                  };
                  
                  return classMap[weightClass] || '';
                };
                
                const getWeightClassIcon = (weightClass: string | null): string => {
                  if (!weightClass) return '';
                  
                  const iconMap: { [key: string]: string } = {
                    'Flyweight': 'Flyweight_icon.webp',
                    'Bantamweight': 'Bantamweight_icon.webp',
                    'Featherweight': 'Featherweight_icon.webp',
                    'Lightweight': 'Lightweight_icon.webp',
                    'Welterweight': 'Welterweight_icon.webp',
                    'Middleweight': 'Middleweight_icon.webp',
                    'Light Heavyweight': 'Ligh_Heavyweight_icon.webp',
                    'Heavyweight': 'Heavyweight_icon.webp',
                    "Women's Strawweight": "Women's_Strawweight_icon.webp",
                    "Women's Flyweight": "Women's_Flyweight_icon.webp",
                    "Women's Bantamweight": "Women's_Bantamweight_icon.webp",
                    "Catch Weight": 'Catch_weight_icon.webp'
                  };
                  
                  return iconMap[weightClass] || 'default_icon.webp';
                };
                
                return (
                  <div 
                    key={roundIndex} 
                    className={`arena-round-card ${isFlipped ? 'flipped' : ''}`}
                  >
                    <div className="arena-round-card-inner">
                      <div className="arena-round-card-front">
                        <div className="arena-round-number">
                          <div className="arena-round-digit">{roundNumber}</div>
                          <div className="arena-round-text">ROUND</div>
                        </div>
                      </div>
                      
                      <div 
                        className={`arena-round-card-back ${getWeightCardClass(weightClass)}`}
                      >
                        <div className="weight-card-inner">
                          <div className="weight-card-icon-container">
                            {weightClass && (
                              <img 
                                src={`${BASE_URL}/icons/${getWeightClassIcon(weightClass)}`}
                                alt={weightClass}
                                className="weight-card-icon"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  const parent = (e.target as HTMLImageElement).parentElement;
                                  if (parent) {
                                    parent.innerHTML = weightClass.substring(0, 2);
                                    parent.style.fontSize = '20px';
                                    parent.style.fontWeight = 'bold';
                                  }
                                }}
                              />
                            )}
                          </div>
                          
                          <div className="weight-card-divider"></div>
                          
                          <div className="weight-card-name">
                            {weightClass || 'TBD'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="arena-bottom">
              <div className="arena-player-fighters">
                {userActiveCards.map((card, index) => {
                  const style = getFighterStyle(card);
                  const styleIcon = getStyleIconFilename(style);
                  
                  return (
                    <div 
                      key={index} 
                      className="arena-fighter-card"
                      data-weight={card.weightClass}
                      style={{ backgroundColor: getWeightClassColor(card.weightClass) }}
                    >
                      <div className="fighter-damage-block">
                        {Math.round(card.fighter['Total Damage'])}
                      </div>
                      
                      <div className="fighter-card-inner">
                        <div className="fighter-icon-container">
                          <img 
                            src={`${BASE_URL}/icons/${styleIcon}`}
                            alt={style}
                            className="fighter-style-icon"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                parent.innerHTML = style === 'Striker' ? '👊' : 
                                                  style === 'Grappler' ? '🤼' : 
                                                  style === 'Universal' ? '⚡' : '👤';
                                parent.style.fontSize = '24px';
                              }
                            }}
                          />
                        </div>
                        
                        <div 
                          className="fighter-divider"
                          style={{ color: getWeightClassColor(card.weightClass) }}
                        ></div>
                        
                        <div className="fighter-name-container">
                          {card.fighter.Fighter}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="arena-player-health">
                <div className={`arena-health-bar ${healthFlash === 'player' ? 'damage-flash' : ''}`}>
                  <div 
                    className="arena-health-fill" 
                    style={{ width: `${(userHealth / 1000) * 100}%` }}
                  ></div>
                  <span className="arena-health-text">HP {userHealth}/1000</span>
                </div>
              </div>

              <div className="arena-avatar-container">
                <div className="arena-avatar-left">
                  <div className="arena-damage-display player-damage">
                    <div className="damage-username">{userName}</div>
                    <div className="damage-divider"></div>
                    <span className="damage-label">DAMAGE</span>
                    <span className={`damage-value ${showDamageIncrease.player ? 'damage-increase' : ''}`}>
                      {animatedDamage.player > 0 ? animatedDamage.player : 
                        userActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
                    </span>
                  </div>
                </div>
                
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
                
                <div className="arena-avatar-right"></div>
              </div>

              {showDamageNumber.player && (
                <div className="damage-number player-damage">
                  -{showDamageNumber.player}
                </div>
              )}
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