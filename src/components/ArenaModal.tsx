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

  console.log('🔍 ArenaModal - Боец:', fighter.fighter.Fighter);
  console.log('   Str:', fighter.fighter.Str, '→ число:', str);
  console.log('   Td:', fighter.fighter.Td, '→ число:', td);
  console.log('   Sub:', fighter.fighter.Sub, '→ число:', sub);
  
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

// Тип для следа крови
type BloodTrail = {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  timestamp: number;
};

// Тип для капли крови
type BloodDroplet = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
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
  
  // Состояния для крови
  const bloodCanvasRef = useRef<HTMLCanvasElement>(null);
  const [bloodTrails, setBloodTrails] = useState<BloodTrail[]>([]);
  const [bloodDroplets, setBloodDroplets] = useState<BloodDroplet[]>([]);
  let nextDropletId = 0;

  // Функция для определения позиции удара
  const getHitPosition = (side: 'player' | 'rival', damage: number): { x: number, y: number } => {
    const canvas = bloodCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    let avatarElement: Element | null = null;
    
    if (side === 'rival') {
      avatarElement = document.querySelector('.arena-top .arena-avatar');
    } else {
      avatarElement = document.querySelector('.arena-bottom .arena-avatar');
    }
    
    if (!avatarElement) return { x: canvas.width / 2, y: canvas.height / 2 };
    
    const rect = avatarElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    const randomOffset = damage / 50;
    const offsetX = (Math.random() - 0.5) * randomOffset * 20;
    const offsetY = (Math.random() - 0.5) * randomOffset * 20;
    
    return {
      x: rect.left + rect.width / 2 + offsetX - canvasRect.left,
      y: rect.top + rect.height / 2 + offsetY - canvasRect.top
    };
  };

  // Функция добавления следа крови
  const addBloodTrail = (x: number, y: number, damage: number) => {
    const intensity = Math.min(0.4 + damage / 80, 0.9);
    const radius = Math.min(12 + damage / 8, 45);
    
    setBloodTrails(prev => [...prev, {
      x, y, radius, intensity,
      timestamp: Date.now()
    }]);
    
    if (bloodTrails.length > 50) {
      setBloodTrails(prev => prev.slice(-50));
    }
  };

  // Функция создания капель крови
  const createBloodDroplets = (x: number, y: number, damage: number, side: 'player' | 'rival') => {
    const dropletCount = Math.min(8 + Math.floor(damage / 15), 25);
    const newDroplets: BloodDroplet[] = [];
    
    for (let i = 0; i < dropletCount; i++) {
      let angle: number;
      if (side === 'rival') {
        angle = -Math.PI / 4 + (Math.random() - 0.5) * Math.PI / 2;
      } else {
        angle = Math.PI * 3 / 4 + (Math.random() - 0.5) * Math.PI / 2;
      }
      
      const speed = 3 + Math.random() * 8;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 2 + Math.random() * 4;
      
      newDroplets.push({
        id: nextDropletId++,
        x: x + (Math.random() - 0.5) * 15,
        y: y + (Math.random() - 0.5) * 15,
        vx: vx,
        vy: vy,
        size: 3 + Math.random() * 8,
        opacity: 0.9,
        life: 1
      });
    }
    
    setBloodDroplets(prev => [...prev, ...newDroplets]);
  };

  // Анимация капель
  useEffect(() => {
    if (!isOpen) return;
    
    let animationId: number;
    let lastTime = 0;
    
    const animateDroplets = (currentTime: number) => {
      if (!isOpen) return;
      
      const deltaTime = Math.min(16, currentTime - lastTime);
      if (deltaTime > 0) {
        setBloodDroplets(prev => {
          const newDroplets = prev
            .map(droplet => ({
              ...droplet,
              x: droplet.x + droplet.vx * (deltaTime / 16),
              y: droplet.y + droplet.vy * (deltaTime / 16),
              vy: droplet.vy + 0.3 * (deltaTime / 16),
              life: droplet.life - 0.02 * (deltaTime / 16),
              opacity: droplet.opacity - 0.02 * (deltaTime / 16)
            }))
            .filter(droplet => droplet.life > 0 && droplet.opacity > 0);
          
          return newDroplets;
        });
      }
      
      lastTime = currentTime;
      animationId = requestAnimationFrame(animateDroplets);
    };
    
    animationId = requestAnimationFrame(animateDroplets);
    return () => cancelAnimationFrame(animationId);
  }, [isOpen]);

  // Инициализация канваса
  useEffect(() => {
    const canvas = bloodCanvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Отрисовка крови
  useEffect(() => {
    const canvas = bloodCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Рисуем пятна крови
    bloodTrails.forEach(trail => {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(trail.x, trail.y, trail.radius, trail.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139, 0, 0, ${trail.intensity})`;
      ctx.fill();
      
      const splatterCount = Math.floor(trail.radius / 5);
      for (let i = 0; i < splatterCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = trail.radius * (0.5 + Math.random() * 1.2);
        const splatterX = trail.x + Math.cos(angle) * distance;
        const splatterY = trail.y + Math.sin(angle) * distance;
        const splatterRadius = trail.radius * (0.2 + Math.random() * 0.4);
        
        ctx.beginPath();
        ctx.ellipse(splatterX, splatterY, splatterRadius, splatterRadius * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 0, 0, ${trail.intensity * 0.6})`;
        ctx.fill();
      }
      
      ctx.beginPath();
      ctx.ellipse(trail.x, trail.y, trail.radius * 0.4, trail.radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 0, 0, ${trail.intensity * 0.9})`;
      ctx.fill();
      ctx.restore();
    });
    
    // Рисуем капли крови
    bloodDroplets.forEach(droplet => {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(droplet.x, droplet.y, droplet.size / 2, droplet.size / 1.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139, 0, 0, ${droplet.opacity * 0.9})`;
      ctx.fill();
      
      ctx.beginPath();
      ctx.ellipse(droplet.x - droplet.size * 0.2, droplet.y - droplet.size * 0.2, droplet.size * 0.2, droplet.size * 0.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 100, 100, ${droplet.opacity * 0.5})`;
      ctx.fill();
      ctx.restore();
    });
  }, [bloodTrails, bloodDroplets]);

  // Очистка при закрытии
  useEffect(() => {
    if (!isOpen) {
      setBloodTrails([]);
      setBloodDroplets([]);
    }
  }, [isOpen]);

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
          addBloodTrail(rivalPos.x, rivalPos.y, playerDamageDealt);
          createBloodDroplets(rivalPos.x, rivalPos.y, playerDamageDealt, 'rival');
          
          const rivalAvatar = document.querySelector('.arena-top .arena-avatar');
          if (rivalAvatar) {
            rivalAvatar.classList.add('damage-taken');
            setTimeout(() => rivalAvatar.classList.remove('damage-taken'), 300);
          }
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
            addBloodTrail(playerPos.x, playerPos.y, rivalDamageDealt);
            createBloodDroplets(playerPos.x, playerPos.y, rivalDamageDealt, 'player');
            
            const playerAvatar = document.querySelector('.arena-bottom .arena-avatar');
            if (playerAvatar) {
              playerAvatar.classList.add('damage-taken');
              setTimeout(() => playerAvatar.classList.remove('damage-taken'), 300);
            }
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
        <canvas 
          ref={bloodCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 2
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