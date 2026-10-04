// src/components/ArenaModal.tsx – ПОЛНАЯ ВЕРСИЯ с COMBO анимацией и всеми обработчиками
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Tournament, SelectedFighter, UserResult, Fighter } from '../types';
import { UserProfile } from '../api/userProfiles';
import BattleResultModal from './BattleResultModal';
import { getAvatarWrapperStyle, getAvatarInnerStyle } from '../utils/styleUtils';
import { getWeightClassColor, getAvatarFilename } from '../utils/weightUtils';
import { getFighterStyleFromSelected, getStyleIconFilename } from '../utils/fighterUtils';


interface ArenaModalProps {
  tournament: Tournament;
  userSelections: SelectedFighter[];
  userAvatar?: string;
  userDamage: number;
  userName: string;
  userStyle?: 'striker' | 'grappler' | null;
  rivalData: {
    username: string;
    photoUrl?: string;
    totalDamage: number;
    selections: SelectedFighter[];
    style?: 'striker' | 'grappler' | null;
  };
  tierName?: string;
  weightClasses: string[];
  isOpen: boolean;
  onSurrender: () => void;
  pvpMode?: boolean;
  pvpBetAmount?: number;
  userId?: string;
  userCoins?: number;
  userTickets?: number;
  allProfiles?: Map<string, UserProfile>;
  onUpdateBalance?: (coins: number, tickets: number) => Promise<void>;
  onClaimRewards?: (rewards: { coins: number; experience: number }) => Promise<void>;
  loadTournamentData?: (tournamentName: string) => Promise<{
    weightClasses: string[];
    results: UserResult[];
    fightersData: Fighter[];
  }>;
  loadingTip?: string;
  authToken?: string;
  onPvpComplete?: (tierProgress: any[]) => void;
  onUpdateExperience?: (expData: { 
    totalExp: number; 
    level: number; 
    currentExp: number; 
    nextLevelExp: number;
    expPoints: number;
  }) => void;
}

const DEFAULT_LOADING_TIPS = [
  "💡 TIP: Bet multipliers by result: KO grants you 2x, Unanimous Decision - 1.5x, Split Decision - 1.25x, DRAW - 1x (refund), LOSS = 0x.",
  "💡 TIP: Higher bet amounts increase your potential rewards, but also the risk. Choose wisely!",
  "💡 TIP: Winning fighters earn you TICKETS, which can be used for special PvP battles with higher rewards!",
  "💡 TIP: Save your coins for upcoming tournaments — the more you bet, the bigger the prize pool!",
  "💡 TIP: Each round features a random weight class, with fighters from that class participating in the tournament!"
];

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
  userHitCount?: number;
  rivalHitCount?: number;
  userCombo?: { name: string; multiplier: number } | null;
  rivalCombo?: { name: string; multiplier: number } | null;
  result?: any;
};

type IntervalId = ReturnType<typeof setInterval>;

const ArenaModal: React.FC<ArenaModalProps> = ({
  tournament,
  userSelections,
  userAvatar,
  userName,
  isOpen,
  onSurrender,
  pvpMode,
  pvpBetAmount,
  userId,
  userCoins,
  userTickets,
  allProfiles,
  onUpdateBalance,
  onClaimRewards,
  loadTournamentData,
  loadingTip,
  authToken,
  onUpdateExperience,
  userStyle,
  tierName,
  onPvpComplete,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [battleScript, setBattleScript] = useState<BattleEvent[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [showRoundText, setShowRoundText] = useState(false);
  const [userHealth, setUserHealth] = useState(1000);
  const [rivalHealth, setRivalHealth] = useState(1000);
  const [baseUserHealth, setBaseUserHealth] = useState(1000);
  const [baseRivalHealth, setBaseRivalHealth] = useState(1000);
  const [userActiveCards, setUserActiveCards] = useState<SelectedFighter[]>([]);
  const [rivalActiveCards, setRivalActiveCards] = useState<SelectedFighter[]>([]);
  const [usedWeightClasses, setUsedWeightClasses] = useState<string[]>([]);
  const [battleResult, setBattleResult] = useState<{
    isOpen: boolean;
    result: 'win' | 'loss' | 'draw' | 'tech-loss';
    resultType?: 'ko' | 'decision-unanimous' | 'decision-split';
  } | null>(null);
  const [battleRewards, setBattleRewards] = useState<{ coins: number; experience: number } | null>(null);
  const [betAmountWithRake, setBetAmountWithRake] = useState<number | undefined>(undefined);
  const [countdownStep, setCountdownStep] = useState<'ready' | 'steady' | 'fight' | null>('ready');
  const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false, false, false]);
  const [animatedDamage, setAnimatedDamage] = useState<{ player: number; rival: number }>({ player: 0, rival: 0 });
  const [showDamageIncrease, setShowDamageIncrease] = useState<{ player: boolean; rival: boolean }>({ player: false, rival: false });
  const [showDamageNumber, setShowDamageNumber] = useState<{ player: number | null; rival: number | null }>({ player: null, rival: null });
  const [shakeScreen, setShakeScreen] = useState(false);
  const [healthFlash, setHealthFlash] = useState<'player' | 'rival' | null>(null);
  const [isBattleLoaded, setIsBattleLoaded] = useState(false);
  const [userComboText, setUserComboText] = useState<string | null>(null);
  const [rivalComboText, setRivalComboText] = useState<string | null>(null);
  const [currentLoadingTip, setCurrentLoadingTip] = useState<string>(loadingTip || DEFAULT_LOADING_TIPS[0]);
  const tipIntervalRef = useRef<IntervalId | null>(null);
  const [rivalData, setRivalData] = useState<{
    username: string;
    photoUrl?: string;
    totalDamage: number;
    selections: SelectedFighter[];
    style?: 'striker' | 'grappler' | null;
  } | null>(null);
  const [weightClasses, setWeightClasses] = useState<string[]>([]);

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
  const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

  const getRandomTip = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * DEFAULT_LOADING_TIPS.length);
    return DEFAULT_LOADING_TIPS[randomIndex];
  }, []);

  const startTipRotation = useCallback(() => {
    if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    setCurrentLoadingTip(loadingTip || DEFAULT_LOADING_TIPS[0]);
    tipIntervalRef.current = setInterval(() => {
      setCurrentLoadingTip(getRandomTip());
    }, 5000);
  }, [loadingTip, getRandomTip]);

  const stopTipRotation = useCallback(() => {
    if (tipIntervalRef.current) {
      clearInterval(tipIntervalRef.current);
      tipIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTipRotation();
  }, [stopTipRotation]);

      const applyHitEffect = (target: 'player' | 'rival', damage: number) => {
    const avatarElement = document.querySelector(
      target === 'player' ? '.arena-bottom .arena-avatar' : '.arena-top .arena-avatar'
    ) as HTMLElement | null;
    if (!avatarElement) return;

    // Цвет свечения в зависимости от урона
    let glowColor = '';
    if (damage < 50) glowColor = 'rgba(255, 255, 255, 0.3)';
    else if (damage >= 50 && damage < 150) glowColor = 'rgba(255, 0, 0, 0.3)';
    else glowColor = 'rgba(255, 0, 0, 0.3)';

    // Масштаб в зависимости от урона
    let hitScale = 1.05;   // < 50   → +5%
    if (damage >= 200) hitScale = 1.15;   // ≥ 200 → +15%
    else if (damage >= 50) hitScale = 1.10; // 50-199 → +10%

    // === МАСШТАБИРОВАНИЕ через WAAPI ===
    // Отменяем старую анимацию, если она была
    if ((avatarElement as any)._hitAnim) {
      try { (avatarElement as any)._hitAnim.cancel(); } catch {}
    }

    try {
      const anim = avatarElement.animate(
        [
          { transform: 'scale(1)' },
          { transform: `scale(${hitScale})`, offset: 0.3 },
          { transform: `scale(${1 + (hitScale - 1) * 0.5})`, offset: 0.7 },
          { transform: 'scale(1)' },
        ],
        {
          duration: 300,
          easing: 'ease-out',
          fill: 'none',
        }
      );
      (avatarElement as any)._hitAnim = anim;
      anim.onfinish = () => {
        (avatarElement as any)._hitAnim = null;
      };
    } catch (err) {
      console.error('❌ avatar scale animation error:', err);
    }

    // === СВЕЧЕНИЕ через CSS-класс (оставляем как было) ===
    avatarElement.classList.remove('avatar-glow');
    void avatarElement.offsetHeight; // reflow, чтобы анимация перезапустилась
    avatarElement.style.setProperty('--glow-color', glowColor);
    avatarElement.classList.add('avatar-glow');

    setTimeout(() => {
      avatarElement.classList.remove('avatar-glow');
      avatarElement.style.removeProperty('--glow-color');
    }, 300);
  };

  // ========== СИСТЕМА СНАРЯДОВ (WAAPI) ==========

  /**
   * Определяет цвет снаряда по величине урона
   * Белый (<50) / Жёлтый (50-200) / Красный (>=200)
   */
  const getProjectileColor = (damage: number): string => {
    if (damage >= 200) return '#FF3333';
    if (damage >= 50) return '#FFD966';
    return '#FFFFFF';
  };

    /**
   * Возвращает массив уникальных траекторий длиной count.
   * Каждая траектория — случайно выбранная из 3 типов, без повторов.
   *
   * Примеры:
   *   count = 1 → ['arc-left'] (случайная)
   *   count = 2 → ['straight', 'arc-right'] (две разные)
   *   count = 3 → ['straight', 'arc-left', 'arc-right'] (все разные)
   *   count = 4 → ['straight', 'arc-left', 'arc-right', 'arc-left'] (перемешаны, с повторами)
   */
  const getUniqueTrajectories = (
    count: number
  ): Array<'straight' | 'arc-left' | 'arc-right'> => {
    const all: Array<'straight' | 'arc-left' | 'arc-right'> = [
      'straight',
      'arc-left',
      'arc-right',
    ];

    // Перемешиваем (Fisher-Yates shuffle)
    const shuffled = [...all];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Если count <= 3 — берём первые count (все уникальные)
    // Если count > 3 — циклично добавляем из перемешанных
    const result: Array<'straight' | 'arc-left' | 'arc-right'> = [];
    for (let i = 0; i < count; i++) {
      result.push(shuffled[i % 3]);
    }

    return result;
  };

  /**
   * Создаёт keyframes для полёта снаряда через WAAPI
   */
      const createProjectileKeyframes = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    trajectory: 'straight' | 'arc-left' | 'arc-right'
  ): Keyframe[] => {
    const dx = toX - fromX;
    const dy = toY - fromY;

    let controlX = fromX;
    let controlY = fromY;

    if (trajectory === 'straight') {
      controlX = (fromX + toX) / 2;
      controlY = (fromY + toY) / 2;
    } else {
      const arcWidth = Math.abs(dy) * 0.45;

      if (trajectory === 'arc-left') {
        controlX = fromX - arcWidth;
        controlY = (fromY + toY) / 2;
      } else {
        controlX = fromX + arcWidth;
        controlY = (fromY + toY) / 2;
      }
    }

    const bezierPoint = (t: number) => {
      const x =
        (1 - t) * (1 - t) * fromX +
        2 * (1 - t) * t * controlX +
        t * t * toX;
      const y =
        (1 - t) * (1 - t) * fromY +
        2 * (1 - t) * t * controlY +
        t * t * toY;
      return { x, y };
    };

    const STEPS = 20;   // ← увеличили для более плавной кривой opacity
    const keyframes: Keyframe[] = [];

    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const { x, y } = bezierPoint(t);

      // ⬇️ НОВАЯ ЛОГИКА OPACITY ⬇️
      // t = 0.0 → 0    (старт, невидим)
      // t = 0.5 → 1    (середина, полностью видим)
      // t = 1.0 → 1    (финиш, видим до вспышки)
            let opacity: number;

      // 0 → 0.1: НЕВИДИМ (короткий старт)
      if (t < 0.1) {
        opacity = 0;
      }
      // 0.1 → 0.3: плавное проявление (0 → 1)
      else if (t < 0.3) {
        opacity = (t - 0.1) / 0.2;
      }
      // 0.3 → 0.85: полностью видим (долго)
      else if (t < 0.85) {
        opacity = 1;
      }
      // 0.85 → 1: плавное затухание (1 → 0)
      else {
        const fadeProgress = (t - 0.85) / 0.15;
        opacity = 1 - fadeProgress * fadeProgress;
      }

      // Масштаб: снаряд «формируется» — растёт с 0.3 до 1.3
      const scale = 0.3 + t * 1.8;

      // Последняя точка — исчезновение (за кадр до вспышки)
      if (i === STEPS) {
        keyframes.push({
          transform: `translate3d(${x}px, ${y}px, 0) scale(1.4)`,
          opacity: 0,
          offset: 1,
        });
        continue;
      }

      keyframes.push({
        transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        opacity,
        offset: t,
      });
    }

    return keyframes;
  };

  /**
   * Запускает полёт снаряда и резолвит Promise при попадании.
   * Резолв гарантирован через setTimeout — не зависим от onfinish (WAAPI-баг в WebView).
   */
    const flyProjectile = (
    fromEl: HTMLElement,
    toEl: HTMLElement,
    damage: number,
    trajectory: 'straight' | 'arc-left' | 'arc-right' = 'straight',
    duration: number = 200
  ): Promise<void> => {
    return new Promise((resolve) => {
      let resolved = false;
      let rafId: number | null = null;

      const safeResolve = () => {
        if (resolved) return;
        resolved = true;
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        try {
          el.remove();
        } catch {}
        resolve();
      };

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      if (fromRect.width === 0 || toRect.width === 0) {
        resolve();
        return;
      }

      // Размер снаряда = 10vw, половина = 5vw
      const projectileHalfSize = (window.innerWidth * 0.10) / 2;

      const fromX = fromRect.left + fromRect.width / 2 - projectileHalfSize;
      const fromY = fromRect.top + fromRect.height / 2 - projectileHalfSize;
      const toX = toRect.left + toRect.width / 2 - projectileHalfSize;
      const toY = toRect.top + toRect.height / 2 - projectileHalfSize;

            const el = document.createElement('div');
      el.className = 'projectile';
      el.style.color = getProjectileColor(damage);

      el.style.position = 'fixed';
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.transform = `translate3d(${fromX}px, ${fromY}px, 0) scale(1)`;
      el.style.opacity = '0';   // ❗ Не показываем перчатку до старта анимации

            // ❗ Определяем направление полёта: снизу вверх или сверху вниз
      const isDownwardAttack = toY > fromY;

      // ❗ Выбираем картинку в зависимости от траектории
      // Для ответных ударов (сверху вниз) — меняем L и R местами,
      // потому что при повороте на 180° левая перчатка визуально становится правой
      let armImage: string;
      if (trajectory === 'arc-left') {
        armImage = isDownwardAttack ? 'R_Arm_Top.webp' : 'L_Arm_Top.webp';
      } else if (trajectory === 'arc-right') {
        armImage = isDownwardAttack ? 'L_Arm_Top.webp' : 'R_Arm_Top.webp';
      } else {
        // straight — случайно
        const rand = Math.random() < 0.5;
        if (isDownwardAttack) {
          armImage = rand ? 'R_Arm_Top.webp' : 'L_Arm_Top.webp';
        } else {
          armImage = rand ? 'L_Arm_Top.webp' : 'R_Arm_Top.webp';
        }
      }

      // ❗ Вложенный слой для картинки — здесь применяется rotate к цели
      const imgEl = document.createElement('div');
      imgEl.className = 'projectile-image';
      imgEl.style.backgroundImage = `url('${BASE_URL}/items/${armImage}')`;

      el.appendChild(imgEl);

      document.body.appendChild(el);

      // === Вычисляем контрольную точку Безье (как в createProjectileKeyframes) ===
      let controlX = fromX;
      let controlY = fromY;

      if (trajectory === 'straight') {
        controlX = (fromX + toX) / 2;
        controlY = (fromY + toY) / 2;
      } else {
        const arcWidth = Math.abs(toY - fromY) * 0.45;
        controlX = trajectory === 'arc-left'
          ? fromX - arcWidth
          : fromX + arcWidth;
        controlY = (fromY + toY) / 2;
      }

      // === Функция для точки на кривой Безье при параметре t ===
      const bezierPoint = (t: number) => {
        const x =
          (1 - t) * (1 - t) * fromX +
          2 * (1 - t) * t * controlX +
          t * t * toX;
        const y =
          (1 - t) * (1 - t) * fromY +
          2 * (1 - t) * t * controlY +
          t * t * toY;
        return { x, y };
      };

      // === Функция для производной (касательной) в точке t ===
      const bezierTangent = (t: number) => {
        // B'(t) = 2(1-t)(P1 - P0) + 2t(P2 - P1)
        const dx =
          2 * (1 - t) * (controlX - fromX) +
          2 * t * (toX - controlX);
        const dy =
          2 * (1 - t) * (controlY - fromY) +
          2 * t * (toY - controlY);
        return { dx, dy };
      };

            // === Устанавливаем начальный угол хвоста: направление ОТ ЦЕЛИ ===
      // Считаем вектор от снаряда (fromX, fromY) к цели (toX, toY)
      // Хвост должен смотреть ПРОТИВ этого вектора (на 180°)
      const initDirX = toX - fromX;
      const initDirY = toY - fromY;
      let initialAngleDeg = (Math.atan2(initDirY, initDirX) * 180) / Math.PI + 180;
      // Нормализуем в диапазон (-180, 180]
      while (initialAngleDeg > 180) initialAngleDeg -= 360;
      while (initialAngleDeg <= -180) initialAngleDeg += 360;
      el.style.setProperty('--trail-angle', `${initialAngleDeg}deg`);

      // Сохраняем предыдущий угол — для плавного обновления
      let previousTrailAngle = initialAngleDeg;

      // === WAAPI-анимация позиции ===
      const keyframes = createProjectileKeyframes(fromX, fromY, toX, toY, trajectory);

      try {
        el.animate(keyframes, {
          duration,
          easing: 'linear',   // ← было cubic-bezier(0.4, 0, 0.6, 1)
          fill: 'none',
        });
      } catch (err) {
        console.error('❌ Projectile animation error:', err);
      }

             // === rAF-цикл: обновляем угол хвоста И ориентацию перчатки ===
      const startTime = performance.now();
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 33;

      // Предыдущий угол перчатки — для плавной интерполяции
            // ❗ Начальный угол перчатки — считаем сразу, как направление на цель
      const initialSpriteDirX = toX - fromX;
      const initialSpriteDirY = toY - fromY;
      let previousSpriteAngle = (Math.atan2(initialSpriteDirY, initialSpriteDirX) * 180) / Math.PI + 90;

            const tick = () => {
        const now = performance.now();
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);

        if (now - lastUpdateTime >= UPDATE_INTERVAL) {
          lastUpdateTime = now;

          const { x: curX, y: curY } = bezierPoint(t);

          const dirX = toX - curX;
          const dirY = toY - curY;

          // === 1. Угол хвоста (против цели) ===
          let trailAngleDeg = (Math.atan2(dirY, dirX) * 180) / Math.PI + 180;
          let delta1 = trailAngleDeg - previousTrailAngle;
          while (delta1 > 180) delta1 -= 360;
          while (delta1 < -180) delta1 += 360;
          const smoothTrailAngle = previousTrailAngle + delta1;
          previousTrailAngle = smoothTrailAngle;

          try {
            el.style.setProperty('--trail-angle', `${smoothTrailAngle}deg`);
          } catch {}

          // === 2. Угол перчатки (смотрит НА цель) ===
          // Картинка изначально смотрит ВВЕРХ (пальцами вверх) = 0° в CSS
          // При atan2 направление "вверх на экране" = -90°
          // Значит, чтобы перчатка смотрела на цель: atan2 * 180/π + 90
          let spriteAngleDeg = (Math.atan2(dirY, dirX) * 180) / Math.PI + 90;

          let delta2 = spriteAngleDeg - previousSpriteAngle;
          while (delta2 > 180) delta2 -= 360;
          while (delta2 < -180) delta2 += 360;
          const smoothSpriteAngle = previousSpriteAngle + delta2;
          previousSpriteAngle = smoothSpriteAngle;

          try {
            const imageEl = el.firstChild as HTMLElement | null;
            if (imageEl) {
              imageEl.style.transform = `rotate(${smoothSpriteAngle}deg)`;
            }
          } catch {}
        }

        if (t < 1) {
          rafId = requestAnimationFrame(tick);
        }
      };

      rafId = requestAnimationFrame(tick);

      // === Момент попадания — фиксируем позицию и вспышку ===
      const handleImpact = () => {
        try {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          el.style.left = `${toX}px`;
          el.style.top = `${toY}px`;
          el.style.transform = 'none';
          el.style.opacity = '1';

          // ❗ Фиксируем последний корректный угол перчатки
          const imageEl = el.firstChild as HTMLElement | null;
          if (imageEl) {
            imageEl.style.transform = `rotate(${previousSpriteAngle}deg)`;
            imageEl.classList.add('impact');
          }
        } catch {}
        setTimeout(safeResolve, 40);
      };

      // Основной таймер попадания — через duration
      setTimeout(handleImpact, duration);
    });
  };

  // ========== КОНЕЦ СИСТЕМЫ СНАРЯДОВ ==========

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ========== PvP через API ==========
  useEffect(() => {
    if (!isOpen || !pvpMode || !userId || !tournament.id || pvpBetAmount === undefined) return;

    const startPvpBattle = async () => {
      setIsLoading(true);
      startTipRotation();

      try {
        console.log(`🚀 PvP API call: tournamentId=${tournament.id}, betAmount=${pvpBetAmount}, tierName=${tierName}`);
        const response = await fetch(`${API_BASE}/api/pvp/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken || ''}`
          },
          body: JSON.stringify({
            tournamentId: Number(tournament.id),
            betAmount: pvpBetAmount,
            tier_name: tierName || null
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'PvP request failed');
        }

        const data = await response.json();
        console.log('✅ PvP response:', data);

        if (onUpdateBalance && data.updatedBalance) {
          await onUpdateBalance(data.updatedBalance.coins, data.updatedBalance.tickets);
        }

        if (onUpdateExperience) {
          try {
            const profileResponse = await fetch(`${API_BASE}/api/user/profile`, {
              headers: { 'Authorization': `Bearer ${authToken || ''}` }
            });
            if (profileResponse.ok) {
              const profile = await profileResponse.json();
              onUpdateExperience({
                totalExp: profile.experience,
                level: profile.level,
                currentExp: profile.currentExp,
                nextLevelExp: profile.nextLevelExp,
                expPoints: profile.exp_points
              });
            }
          } catch (e) {
            console.error('Failed to update experience:', e);
          }
        }

        if (data.updatedWinner && data.updatedWinner.userId === userId && onUpdateBalance) {
          await onUpdateBalance(data.updatedWinner.coins, userTickets || 0);
        }

        if (data.healthBonuses) {
          const userBaseHealth = 1000;
          const rivalBaseHealth = 1000;
          const userInitialHealth = userBaseHealth + Math.round(userBaseHealth * (data.healthBonuses.user / 100));
          const rivalInitialHealth = rivalBaseHealth + Math.round(rivalBaseHealth * (data.healthBonuses.rival / 100));
          
          setUserHealth(userInitialHealth);
          setRivalHealth(rivalInitialHealth);
          setBaseUserHealth(userInitialHealth);
          setBaseRivalHealth(rivalInitialHealth);
          
          console.log(`❤️ Arena health: User ${userInitialHealth}/${userInitialHealth}, Rival ${rivalInitialHealth}/${rivalInitialHealth}`);
        } else {
          if (data.battleScript && data.battleScript.events) {
            for (const event of data.battleScript.events) {
              if (event.type === 'damage') {
                const userInitialHealth = event.userHealthAfter + (event.rivalDamage || 0);
                const rivalInitialHealth = event.rivalHealthAfter + (event.userDamage || 0);
                setUserHealth(userInitialHealth);
                setRivalHealth(rivalInitialHealth);
                setBaseUserHealth(userInitialHealth);
                setBaseRivalHealth(rivalInitialHealth);
                console.log(`❤️ Arena health (fallback): User ${userInitialHealth}, Rival ${rivalInitialHealth}`);
                break;
              }
            }
          }
        }

        const rival = data.rival;
        const rivalSelections = rival.selections.map((sel: any) => ({
          weightClass: sel.weightClass,
          fighter: {
            Fighter: sel.fighter.Fighter,
            'Total Damage': sel.fighter['Total Damage'],
            'W/L': sel.fighter['W/L'],
            Str: sel.fighter.Str,
            Td: sel.fighter.Td,
            Sub: sel.fighter.Sub,
            Method: sel.fighter.Method,
            Round: sel.fighter.Round,
            Time: sel.fighter.Time,
            'Weight class': sel.weightClass,
          }
        }));

        setRivalData({
          username: rival.username,
          photoUrl: rival.photoUrl,
          style: rival.style || null,
          totalDamage: rivalSelections.reduce((s: number, c: any) => s + c.fighter['Total Damage'], 0),
          selections: rivalSelections
        });

        setBattleRewards(data.rewards);
        setBetAmountWithRake(data.betAmountWithRake);
        console.log('🏆 Rewards received:', data.rewards);

        if (data.tierProgress) {
          onPvpComplete?.(data.tierProgress);
        }

        setWeightClasses(['Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Heavyweight']);

                if (data.battleScript && data.battleScript.events) {
          setBattleScript(data.battleScript.events);
          const allCards = new Set<string>();

          // 1. Аватарки весовых категорий (маленькие карточки)
          data.battleScript.events.forEach((event: any) => {
            if (event.type === 'card-appear') {
              event.userActiveCards?.forEach((card: any) => allCards.add(`${BASE_URL}/avatars/${getAvatarFilename(card.weightClass)}`));
              event.rivalActiveCards?.forEach((card: any) => allCards.add(`${BASE_URL}/avatars/${getAvatarFilename(card.weightClass)}`));
            }
          });

          // 2. Перчатки
          allCards.add(`${BASE_URL}/items/L_Arm_Top.webp`);
          allCards.add(`${BASE_URL}/items/R_Arm_Top.webp`);

          // 3. Иконки стилей бойцов
          allCards.add(`${BASE_URL}/icons/Striker_style_icon.webp`);
          allCards.add(`${BASE_URL}/icons/Grappler_style_icon.webp`);
          allCards.add(`${BASE_URL}/icons/Universal_style_icon.webp`);
          allCards.add(`${BASE_URL}/icons/Simple_style_icon.webp`);

          // 4. Иконки весовых категорий (для карточек раундов)
          const weightClassIcons = [
            'Flyweight_icon.webp', 'Bantamweight_icon.webp', 'Featherweight_icon.webp',
            'Lightweight_icon.webp', 'Welterweight_icon.webp', 'Middleweight_icon.webp',
            'Ligh_Heavyweight_icon.webp', 'Heavyweight_icon.webp',
            "Women's_Strawweight_icon.webp", "Women's_Flyweight_icon.webp",
            "Women's_Bantamweight_icon.webp", 'Catch_weight_icon.webp'
          ];
          weightClassIcons.forEach(icon => allCards.add(`${BASE_URL}/icons/${icon}`));

          // 5. Фон арены
          allCards.add(`${BASE_URL}/backgrounds/Arena_1_bg.webp`);

          // 6. VS-логотип (для модалки результата)
          allCards.add(`${BASE_URL}/VS_logo.webp`);

          // 7. Аватарки игрока/противника (могут быть внешние URL)
          if (userAvatar) allCards.add(userAvatar);
          if (displayRivalData?.photoUrl) allCards.add(displayRivalData.photoUrl);

          await Promise.allSettled(Array.from(allCards).map(src => new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(undefined);
            img.onerror = () => resolve(undefined);   // ← не блокируем на ошибках
          })));
        } else {
          setBattleScript([{ type: 'countdown' }, { type: 'battle-end', result: { isOpen: true, result: 'draw' } }]);
        }

                setIsLoading(false);
        setIsBattleLoaded(true);
        stopTipRotation();
      } catch (error: any) {
        console.error('❌ PvP error:', error);
        alert(error.message || 'Failed to start PvP battle');
        stopTipRotation();
        onSurrender();
      }
    };

    startPvpBattle();
  }, [isOpen, pvpMode, tournament.id, pvpBetAmount, userId, authToken]);

  const playNextEvent = () => {
    if (currentEventIndex >= battleScript.length) return;

    const event = battleScript[currentEventIndex];
    console.log('🎬 Event:', event);

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
        const currentPlayerDamage = userActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0);
        const currentRivalDamage = rivalActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0);
        const newPlayerDamage = (event.userActiveCards || []).reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0);
        const newRivalDamage = (event.rivalActiveCards || []).reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0);
        const playerDamageIncreased = newPlayerDamage > currentPlayerDamage;
        const rivalDamageIncreased = newRivalDamage > currentRivalDamage;
        setTimeout(() => {
          setUserActiveCards(event.userActiveCards || []);
          setRivalActiveCards(event.rivalActiveCards || []);
          setAnimatedDamage({ player: newPlayerDamage, rival: newRivalDamage });
          setShowDamageIncrease({ player: playerDamageIncreased, rival: rivalDamageIncreased });
          setTimeout(() => setShowDamageIncrease({ player: false, rival: false }), 500);
          setTimeout(() => setCurrentEventIndex(prev => prev + 1), 1200);
        }, 300);
        break;

      case 'damage':
        // Запускаем асинхронную анимацию
        (async () => {
          const playerDamageDealt = event.userDamage || 0;
          const rivalDamageDealt = event.rivalDamage || 0;
          const userHitCount = (playerDamageDealt > 0) ? (event.userHitCount || 1) : 0;
          const rivalHitCount = (rivalDamageDealt > 0) ? (event.rivalHitCount || 1) : 0;

          // COMBO текст
          if (event.userCombo) setUserComboText(`🔥 ${event.userCombo.name} COMBO!`);
          if (event.rivalCombo) setRivalComboText(`🛡️ ${event.rivalCombo.name} COMBO!`);
          if (event.userCombo || event.rivalCombo) {
            await delay(1500);
            setUserComboText(null);
            setRivalComboText(null);
          }

                    // ========== УДАРЫ ПО ПРОТИВНИКУ (игрок атакует) ==========
          if (userHitCount > 0) {
            const damagePerHit = Math.round(playerDamageDealt / userHitCount);
            const playerAvatarEl = document.querySelector('.arena-bottom .arena-avatar') as HTMLElement;
            const rivalAvatarEl = document.querySelector('.arena-top .arena-avatar') as HTMLElement;

            // ❗ Заранее генерируем уникальные траектории для всех ударов
            const trajectories = getUniqueTrajectories(userHitCount);
            console.log('🎯 [Player] trajectories:', trajectories);

            let currentHealth = rivalHealth;

            for (let i = 0; i < userHitCount; i++) {
              // 1. СНАРЯД ЛЕТИТ (ждём попадания)
              if (playerAvatarEl && rivalAvatarEl) {
                await flyProjectile(
                  playerAvatarEl,
                  rivalAvatarEl,
                  damagePerHit,
                  trajectories[i],
                  125
                );
              }

              // 2. ТОЛЬКО ПОСЛЕ ПОПАДАНИЯ — наносим урон
              currentHealth = Math.max(0, currentHealth - damagePerHit);
              setRivalHealth(currentHealth);

              await new Promise(resolve => setTimeout(resolve, 0));

              // 3. Эффекты удара
              setShowDamageNumber({ player: null, rival: damagePerHit });
              setHealthFlash('rival');
              applyHitEffect('rival', damagePerHit);

              if (damagePerHit > 50) {
                setShakeScreen(true);
                setTimeout(() => setShakeScreen(false), 400);
              }

              await delay(420);

              setShowDamageNumber({ player: null, rival: null });
              setHealthFlash(null);

              if (i < userHitCount - 1) await delay(80);
            }
          } else {
            setRivalHealth(event.rivalHealthAfter!);
          }

                    // ========== УДАРЫ ПО ИГРОКУ (противник атакует) ==========
          if (rivalHitCount > 0) {
            const damagePerHit = Math.round(rivalDamageDealt / rivalHitCount);
            const playerAvatarEl = document.querySelector('.arena-bottom .arena-avatar') as HTMLElement;
            const rivalAvatarEl = document.querySelector('.arena-top .arena-avatar') as HTMLElement;

            // ❗ Заранее генерируем уникальные траектории для всех ударов
            const trajectories = getUniqueTrajectories(rivalHitCount);
            console.log('🎯 [Rival] trajectories:', trajectories);

            let currentHealth = userHealth;

            for (let i = 0; i < rivalHitCount; i++) {
              // 1. СНАРЯД ЛЕТИТ ОТ ПРОТИВНИКА К ИГРОКУ
              if (playerAvatarEl && rivalAvatarEl) {
                await flyProjectile(
                  rivalAvatarEl,
                  playerAvatarEl,
                  damagePerHit,
                  trajectories[i],
                  125
                );
              }

              // 2. Урон после попадания
              currentHealth = Math.max(0, currentHealth - damagePerHit);
              setUserHealth(currentHealth);

              await new Promise(resolve => setTimeout(resolve, 0));

              // 3. Эффекты
              setShowDamageNumber({ player: damagePerHit, rival: null });
              setHealthFlash('player');
              applyHitEffect('player', damagePerHit);

              if (damagePerHit > 50) {
                setShakeScreen(true);
                setTimeout(() => setShakeScreen(false), 400);
              }

              await delay(420);

              setShowDamageNumber({ player: null, rival: null });
              setHealthFlash(null);

              if (i < rivalHitCount - 1) await delay(80);
            }
          } else {
            setUserHealth(event.userHealthAfter!);
          }

          await delay(200);
          setCurrentEventIndex(prev => prev + 1);
        })();
        break;

      case 'round-end':
        setCurrentRound(prev => prev + 1);
        setTimeout(() => setCurrentEventIndex(prev => prev + 1), 400);
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

  const handleResultClose = () => {
    setBattleResult(null);
    /*setIsBattleLoaded(false);*/
    onSurrender();
  };

  const handleSurrender = () => {
    setBattleResult({ isOpen: true, result: 'tech-loss' });
  };

  const getCountdownText = () => {
    if (countdownStep === 'ready') return 'READY?';
    if (countdownStep === 'steady') return 'STEADY';
    if (countdownStep === 'fight') return 'FIGHT!';
    return null;
  };

  if (!isOpen) return null;

  const countdownText = getCountdownText();
  const displayRivalData = rivalData;
  const rivalStyle = displayRivalData?.style || null;
  const displayWeightClasses = weightClasses;

  if (isLoading || !displayRivalData || displayWeightClasses.length === 0) {
    return (
      <div className="arena-modal-overlay">
        <div className="arena-modal">
          <div className="arena-octagon">
            <img src={`${BASE_URL}/backgrounds/Arena_1_bg.webp`} alt="Octagon" className="octagon-image" />
          </div>
          <div className="arena-loading">
            <div className="arena-loading-text">LOADING ARENA...</div>
            <div className="arena-loading-spinner"></div>
            <div className="arena-loading-tip-container">
              <div className="arena-loading-tip">{currentLoadingTip}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="arena-modal-overlay">
      <div className={`arena-modal ${shakeScreen ? 'shake' : ''} ${isBattleLoaded ? 'battle-loaded' : ''}`}>
        <div className="arena-octagon">
          <img src={`${BASE_URL}/backgrounds/Arena_1_bg.webp`} alt="Octagon" className="octagon-image" />
        </div>
        {countdownText && <div className="battle-overlay-text">{countdownText}</div>}
        {showRoundText && <div className="battle-overlay-text">ROUND {currentRound}</div>}
        <div className="arena-header">
          <div className="arena-header-left">{tournament.name}</div>
          <div className="arena-header-right">
            <button className="arena-surrender-button" onClick={handleSurrender}>SURRENDER</button>
          </div>
        </div>

        <div className="arena-top">
          {rivalComboText && (
            <div style={{
              position: 'absolute',
              top: '32%',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#FFFFFF',
              fontSize: 'clamp(12px, 3.5vw, 18px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
              zIndex: 3000,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              animation: 'fadeInOut 1.5s ease-in-out'
            }}>
              {rivalComboText}
            </div>
          )}
          <div className="arena-avatar-container">
            <div className="arena-avatar-left">
              <div className="arena-damage-display rival-damage">
                <div className="damage-username">{displayRivalData.username}</div>
                <div className="damage-divider"></div>
                <span className="damage-label">DAMAGE</span>
                <span className={`damage-value ${showDamageIncrease.rival ? 'damage-increase' : ''}`}>
                  {animatedDamage.rival > 0 ? animatedDamage.rival : rivalActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
                </span>
              </div>
            </div>
            <div className="arena-avatar-center">
              <div className="arena-avatar" style={getAvatarWrapperStyle(rivalStyle)}>
                <img 
                  src={displayRivalData.photoUrl || `${BASE_URL}/default-avatar.png`} 
                  alt="rival" 
                  style={getAvatarInnerStyle()}
                  onError={(e) => { (e.target as HTMLImageElement).src = `${BASE_URL}/default-avatar.png`; }} 
                />
              </div>
            </div>
            <div className="arena-avatar-right"></div>
          </div>
          {showDamageNumber.rival && <div className="damage-number rival-damage">-{showDamageNumber.rival}</div>}
          <div className="arena-rival-health">
            <div className={`arena-health-bar ${healthFlash === 'rival' ? 'damage-flash' : ''}`}>
              <div className="arena-health-fill" style={{ width: `${baseRivalHealth > 0 ? (rivalHealth / baseRivalHealth) * 100 : 0}%` }}></div>
              <span className="arena-health-text">HP {rivalHealth}/{baseRivalHealth}</span>
            </div>
          </div>
          <div className="arena-rival-fighters">
            {rivalActiveCards.map((card, index) => {
              const style = getFighterStyleFromSelected(card.fighter);
              const styleIcon = getStyleIconFilename(style);
              return (
                <div key={index} className="arena-fighter-card" data-weight={card.weightClass} style={{ backgroundColor: getWeightClassColor(card.weightClass) }}>
                  <div className="fighter-damage-block">{Math.round(card.fighter['Total Damage'])}</div>
                  <div className="fighter-card-inner">
                    <div className="fighter-icon-container">
                      <img src={`${BASE_URL}/icons/${styleIcon}`} alt={style} className="fighter-style-icon" onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) { parent.innerHTML = style === 'Striker' ? '👊' : style === 'Grappler' ? '🤼' : style === 'Universal' ? '⚡' : '👤'; parent.style.fontSize = '24px'; }
                      }} />
                    </div>
                    <div className="fighter-divider" style={{ color: getWeightClassColor(card.weightClass) }}></div>
                    <div className="fighter-name-container">{card.fighter.Fighter}</div>
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
            const getWeightCardClass = (wc: string | null): string => {
              if (!wc) return '';
              const m: { [k: string]: string } = {
                'Flyweight': 'weight-card-flyweight', 'Bantamweight': 'weight-card-bantamweight', 'Featherweight': 'weight-card-featherweight',
                'Lightweight': 'weight-card-lightweight', 'Welterweight': 'weight-card-welterweight', 'Middleweight': 'weight-card-middleweight',
                'Light Heavyweight': 'weight-card-light-heavyweight', 'Heavyweight': 'weight-card-heavyweight',
                "Women's Strawweight": 'weight-card-womens-strawweight', "Women's Flyweight": 'weight-card-womens-flyweight',
                "Women's Bantamweight": 'weight-card-womens-bantamweight', "Catch Weight": 'weight-card-catch-weight'
              };
              return m[wc] || '';
            };
            const getWeightClassIcon = (wc: string | null): string => {
              if (!wc) return '';
              const i: { [k: string]: string } = {
                'Flyweight': 'Flyweight_icon.webp', 'Bantamweight': 'Bantamweight_icon.webp', 'Featherweight': 'Featherweight_icon.webp',
                'Lightweight': 'Lightweight_icon.webp', 'Welterweight': 'Welterweight_icon.webp', 'Middleweight': 'Middleweight_icon.webp',
                'Light Heavyweight': 'Ligh_Heavyweight_icon.webp', 'Heavyweight': 'Heavyweight_icon.webp',
                "Women's Strawweight": "Women's_Strawweight_icon.webp", "Women's Flyweight": "Women's_Flyweight_icon.webp",
                "Women's Bantamweight": "Women's_Bantamweight_icon.webp", "Catch Weight": 'Catch_weight_icon.webp'
              };
              return i[wc] || 'default_icon.webp';
            };
            return (
              <div key={roundIndex} className={`arena-round-card ${isFlipped ? 'flipped' : ''}`}>
                <div className="arena-round-card-inner">
                  <div className="arena-round-card-front">
                    <div className="arena-round-number">
                      <div className="arena-round-digit">{roundNumber}</div>
                      <div className="arena-round-text">ROUND</div>
                    </div>
                  </div>
                  <div className={`arena-round-card-back ${getWeightCardClass(weightClass)}`}>
                    <div className="weight-card-inner">
                      <div className="weight-card-icon-container">
                        {weightClass && <img src={`${BASE_URL}/icons/${getWeightClassIcon(weightClass)}`} alt={weightClass} className="weight-card-icon" onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) { parent.innerHTML = weightClass.substring(0, 2); parent.style.fontSize = '20px'; parent.style.fontWeight = 'bold'; }
                        }} />}
                      </div>
                      <div className="weight-card-divider"></div>
                      <div className="weight-card-name">{weightClass || 'TBD'}</div>
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
              const style = getFighterStyleFromSelected(card.fighter);
              const styleIcon = getStyleIconFilename(style);
              return (
                <div key={index} className="arena-fighter-card" data-weight={card.weightClass} style={{ backgroundColor: getWeightClassColor(card.weightClass) }}>
                  <div className="fighter-damage-block">{Math.round(card.fighter['Total Damage'])}</div>
                  <div className="fighter-card-inner">
                    <div className="fighter-icon-container">
                      <img src={`${BASE_URL}/icons/${styleIcon}`} alt={style} className="fighter-style-icon" onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) { parent.innerHTML = style === 'Striker' ? '👊' : style === 'Grappler' ? '🤼' : style === 'Universal' ? '⚡' : '👤'; parent.style.fontSize = '24px'; }
                      }} />
                    </div>
                    <div className="fighter-divider" style={{ color: getWeightClassColor(card.weightClass) }}></div>
                    <div className="fighter-name-container">{card.fighter.Fighter}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="arena-player-health">
            <div className={`arena-health-bar ${healthFlash === 'player' ? 'damage-flash' : ''}`}>
              <div className="arena-health-fill" style={{ width: `${baseUserHealth > 0 ? (userHealth / baseUserHealth) * 100 : 0}%` }}></div>
              <span className="arena-health-text">HP {userHealth}/{baseUserHealth}</span>
            </div>
          </div>
          <div className="arena-avatar-container">
            <div className="arena-avatar-left">
              <div className="arena-damage-display player-damage">
                <div className="damage-username">{userName}</div>
                <div className="damage-divider"></div>
                <span className="damage-label">DAMAGE</span>
                <span className={`damage-value ${showDamageIncrease.player ? 'damage-increase' : ''}`}>
                  {animatedDamage.player > 0 ? animatedDamage.player : userActiveCards.reduce((sum, card) => sum + Math.round(card.fighter['Total Damage']), 0)}
                </span>
              </div>
            </div>
            <div className="arena-avatar-center">
              <div className="arena-avatar" style={getAvatarWrapperStyle(userStyle)}>
                <img 
                  src={userAvatar || `${BASE_URL}/Home_button.png`} 
                  alt="player" 
                  style={getAvatarInnerStyle()}
                  onError={(e) => { (e.target as HTMLImageElement).src = `${BASE_URL}/Home_button.png`; }} 
                />
              </div>
            </div>
            <div className="arena-avatar-right"></div>
          </div>
          {showDamageNumber.player && <div className="damage-number player-damage">-{showDamageNumber.player}</div>}
          {userComboText && (
            <div style={{
              position: 'absolute',
              bottom: '32%',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#FFFFFF',
              fontSize: 'clamp(12px, 3.5vw, 18px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
              zIndex: 3000,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              animation: 'fadeInOut 1.5s ease-in-out'
            }}>
              {userComboText}
            </div>
          )}
        </div>
      </div>
      {battleResult && (
        <BattleResultModal
          isOpen={battleResult.isOpen}
          result={battleResult.result}
          resultType={battleResult.resultType}
          rewards={battleRewards || undefined}
          betAmount={pvpMode ? (pvpBetAmount || 0) : 0}
          betAmountWithRake={betAmountWithRake}
          winningRound={currentRound}
          userAvatar={userAvatar}
          rivalAvatar={displayRivalData?.photoUrl}
          userName={userName}
          rivalName={displayRivalData?.username}
          onClose={handleResultClose}
          tierName={tierName}
        />
      )}
    </div>
  );
};

export default ArenaModal;