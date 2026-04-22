// src/components/StyleViewModal.tsx – с отрисовкой линий дерева способностей
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Ability {
  id: number;
  name: string;
  description: string;
  style: 'striker' | 'grappler';
  type: 'combo' | 'passive';
  min_level: number;
  max_level: number;
  parent_ability_id: number | null;
  row_position: number;
  col_position: number;
  icon_path: string | null;
  levels: AbilityLevel[];
}

interface AbilityLevel {
  level: number;
  description: string;
  damage_multiplier?: number;
  health_bonus?: number;
  damage_bonus?: number;
  cost: number;
}

interface UserAbility {
  ability_id: number;
  current_level: number;
}

interface StyleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  style: 'striker' | 'grappler';
  userLevel: number;
  userExpPoints: number;
  authToken?: string;
}

const StyleViewModal: React.FC<StyleViewModalProps> = ({ 
  isOpen, 
  onClose, 
  style,
  userLevel,
  userExpPoints,
  authToken
}) => {
  const [abilities, setAbilities] = useState<Ability[]>([]);
  const [userAbilities, setUserAbilities] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedAbility, setSelectedAbility] = useState<Ability | null>(null);
  const [showLearnModal, setShowLearnModal] = useState(false);
  
  const gridRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

  useEffect(() => {
    if (isOpen && authToken) {
      loadAbilities();
    }
  }, [isOpen, authToken, style]);

  const loadAbilities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/abilities/${style}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      setAbilities(data.abilities);
      
      const abilityMap = new Map<number, number>();
      data.userAbilities.forEach((ua: UserAbility) => {
        abilityMap.set(ua.ability_id, ua.current_level);
      });
      setUserAbilities(abilityMap);
    } catch (error) {
      console.error('Failed to load abilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAbilityClick = (ability: Ability) => {
    setSelectedAbility(ability);
    setShowLearnModal(true);
  };

  const handleLearn = async () => {
    if (!selectedAbility || !authToken) return;
    
    const currentLevel = userAbilities.get(selectedAbility.id) || 0;
    const nextLevel = currentLevel + 1;
    
    if (nextLevel > selectedAbility.max_level) return;
    
    const cost = selectedAbility.levels.find(l => l.level === nextLevel)?.cost || 0;
    if (userExpPoints < cost) return;

    try {
      const response = await fetch(`${API_BASE}/api/abilities/learn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          ability_id: selectedAbility.id,
          level: nextLevel
        })
      });
      
      if (response.ok) {
        setUserAbilities(prev => new Map(prev).set(selectedAbility.id, nextLevel));
        setShowLearnModal(false);
        setSelectedAbility(null);
      }
    } catch (error) {
      console.error('Failed to learn ability:', error);
    }
  };

  const canLearnAbility = (ability: Ability): boolean => {
    if (userLevel < ability.min_level) return false;
    
    if (ability.parent_ability_id) {
      const parentLevel = userAbilities.get(ability.parent_ability_id) || 0;
      if (parentLevel === 0) return false;
    }
    
    const currentLevel = userAbilities.get(ability.id) || 0;
    return currentLevel < ability.max_level;
  };

  const getAbilityStatus = (ability: Ability): 'locked' | 'available' | 'learned' => {
    const currentLevel = userAbilities.get(ability.id) || 0;
    
    if (currentLevel > 0) return 'learned';
    if (canLearnAbility(ability)) return 'available';
    return 'locked';
  };

  // Отрисовка линий между способностями
  const drawLines = useCallback(() => {
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!canvas || !grid) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Устанавливаем размеры canvas
    const rect = grid.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Очищаем canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Цвета линий в зависимости от стиля
    const lineColor = style === 'striker' ? '#FF4500' : '#FF8C00';
    const inactiveLineColor = '#666666';

    // Для каждой способности с родителем рисуем линию
    abilities.forEach(ability => {
      if (!ability.parent_ability_id) return;

      const childCard = cardRefs.current.get(ability.id);
      const parentCard = cardRefs.current.get(ability.parent_ability_id);

      if (!childCard || !parentCard) return;

      const childRect = childCard.getBoundingClientRect();
      const parentRect = parentCard.getBoundingClientRect();

      // Координаты относительно grid
      const childCenterX = childRect.left + childRect.width / 2 - rect.left;
      const childTopY = childRect.top - rect.top;
      
      const parentCenterX = parentRect.left + parentRect.width / 2 - rect.left;
      const parentBottomY = parentRect.bottom - rect.top;

      // Проверяем, изучена ли родительская способность
      const parentLevel = userAbilities.get(ability.parent_ability_id) || 0;
      const isParentLearned = parentLevel > 0;

      // Настройки линии
      ctx.beginPath();
      ctx.moveTo(parentCenterX, parentBottomY);
      ctx.lineTo(childCenterX, childTopY);
      ctx.strokeStyle = isParentLearned ? lineColor : inactiveLineColor;
      ctx.lineWidth = Math.max(2, rect.width * 0.005);
      ctx.lineCap = 'round';
      
      // Добавляем небольшую стрелку
      const angle = Math.atan2(childTopY - parentBottomY, childCenterX - parentCenterX);
      const arrowSize = rect.width * 0.015;
      
      ctx.stroke();
      
      // Рисуем стрелку
      if (isParentLearned) {
        ctx.beginPath();
        ctx.moveTo(childCenterX, childTopY);
        ctx.lineTo(
          childCenterX - arrowSize * Math.cos(angle - Math.PI / 6),
          childTopY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          childCenterX - arrowSize * Math.cos(angle + Math.PI / 6),
          childTopY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = lineColor;
        ctx.fill();
      }
    });
  }, [abilities, userAbilities, style]);

  // Обновление линий при изменении данных или скролле
  useEffect(() => {
    if (!loading && isOpen) {
      // Небольшая задержка для рендеринга DOM
      setTimeout(() => drawLines(), 50);
    }
  }, [loading, isOpen, drawLines]);

  useEffect(() => {
    if (!isOpen) return;

    const handleUpdate = () => drawLines();
    
    window.addEventListener('resize', handleUpdate);
    
    const scrollContainer = gridRef.current?.closest('.rewards-winners-list');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleUpdate);
    }

    // Наблюдатель за изменениями размеров
    const observer = new ResizeObserver(handleUpdate);
    if (gridRef.current) {
      observer.observe(gridRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleUpdate);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleUpdate);
      }
      observer.disconnect();
    };
  }, [isOpen, drawLines]);

  if (!isOpen) return null;

  const isStriker = style === 'striker';
  const title = isStriker ? 'STRIKER SKILLS' : 'GRAPPLER SKILLS';
  const gradientColors = isStriker 
    ? 'linear-gradient(180deg, #FF0000 0%, #8C1519 100%)'
    : 'linear-gradient(180deg, #FF9933 0%, #663300 100%)';

  // Группируем способности по строкам
  const abilitiesByRow = abilities.reduce((acc, ability) => {
    const row = ability.row_position;
    if (!acc[row]) acc[row] = [];
    acc[row].push(ability);
    return acc;
  }, {} as Record<number, Ability[]>);

  // Сортируем способности в каждой строке по позиции
  Object.values(abilitiesByRow).forEach(row => {
    row.sort((a, b) => a.col_position - b.col_position);
  });

  const rows = Object.keys(abilitiesByRow).map(Number).sort((a, b) => a - b);
  const maxRow = Math.max(...rows, 4);

  return (
    <>
      <div className="rewards-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div 
          className="rewards-modal no-summary" 
          style={{ 
            height: '90%',
            display: 'flex', 
            flexDirection: 'column',
            margin: '0',
            padding: '0',
            position: 'relative'
          }}
        >
          <div className="rewards-header" style={{ top: '-4%' }}>
            <h2>{title}</h2>
            <button className="cancelled-modal-close" style={{ top: '120%' }} onClick={onClose}>✕</button>
          </div>

          <div 
            className="rewards-winners-list" 
            style={{ 
              flex: 1,
              display: 'flex', 
              flexDirection: 'column',
              width: '100%',
              padding: '2% 0',
              maxHeight: 'none',
              overflowY: 'auto',
              overflowX: 'hidden',
              margin: '0',
              gap: '0',
              position: 'relative'
            }}
          >
            {loading ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: '#FFFFFF',
                fontSize: 'clamp(14px, 4vw, 18px)'
              }}>
                Loading abilities...
              </div>
            ) : (
              <div 
                ref={gridRef}
                style={{ 
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Canvas для линий */}
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 1
                  }}
                />

                {Array.from({ length: maxRow }, (_, i) => i + 1).map(rowNum => {
                  const rowAbilities = abilitiesByRow[rowNum] || [];
                  
                  return (
                    <div 
                      key={rowNum}
                      style={{
                        width: '100%',
                        height: `${100 / maxRow}%`,
                        minHeight: `${100 / maxRow}%`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-evenly',
                        padding: '0 2%',
                        position: 'relative',
                        flexShrink: 0,
                        zIndex: 2
                      }}
                    >
                      {rowAbilities.map((ability) => {
                        const status = getAbilityStatus(ability);
                        const currentLevel = userAbilities.get(ability.id) || 0;
                        const isLocked = status === 'locked';
                        
                        return (
                          <AbilityCard
                            key={ability.id}
                            ability={ability}
                            currentLevel={currentLevel}
                            isLocked={isLocked}
                            gradientColors={gradientColors}
                            onClick={() => !isLocked && handleAbilityClick(ability)}
                            cardRef={(el) => {
                              if (el) {
                                cardRefs.current.set(ability.id, el);
                              } else {
                                cardRefs.current.delete(ability.id);
                              }
                            }}
                          />
                        );
                      })}
                      
                      {/* Пустые слоты */}
                      {rowAbilities.length === 0 && (
                        <div style={{ 
                          width: '23%', 
                          aspectRatio: '1/1',
                          opacity: 0.3,
                          background: '#313130',
                          borderRadius: '10%',
                          border: '1px dashed #4A4A48',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#666D74',
                          fontSize: 'clamp(10px, 3vw, 14px)'
                        }}>
                          Empty
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно изучения способности */}
      {showLearnModal && selectedAbility && (
        <LearnAbilityModal
          ability={selectedAbility}
          currentLevel={userAbilities.get(selectedAbility.id) || 0}
          userExpPoints={userExpPoints}
          onLearn={handleLearn}
          onClose={() => {
            setShowLearnModal(false);
            setSelectedAbility(null);
          }}
          gradientColors={gradientColors}
        />
      )}
    </>
  );
};

// Компонент карточки способности
const AbilityCard: React.FC<{
  ability: Ability;
  currentLevel: number;
  isLocked: boolean;
  gradientColors: string;
  onClick: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}> = ({ ability, currentLevel, isLocked, gradientColors, onClick, cardRef }) => {
  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
  
  return (
    <div 
      ref={cardRef}
      onClick={onClick}
      style={{
        width: '23%',
        aspectRatio: '1/1',
        background: gradientColors,
        borderRadius: '10%',
        boxShadow: '0 0 0 0.6vw #000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '3%',
        position: 'relative',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        opacity: isLocked ? 0.5 : 1,
        filter: isLocked ? 'grayscale(0.5)' : 'none',
        transition: 'transform 0.2s ease, opacity 0.2s ease',
      }}
    >
      {/* Верхний контейнер для иконки */}
      <div style={{
        width: '92%',
        height: '66%',
        background: '#091422',
        borderRadius: '10%',
        boxShadow: '0 0 0 0.3vw #000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '2%',
        position: 'relative'
      }}>
        {ability.icon_path ? (
          <img 
            src={`${BASE_URL}/icons/${ability.icon_path}`}
            alt={ability.name}
            style={{ width: '80%', height: '80%', objectFit: 'contain' }}
          />
        ) : (
          <div style={{
            width: '80%',
            height: '80%',
            background: '#3D3D3B',
            borderRadius: '10%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 'clamp(8px, 2vw, 12px)'
          }}>
            {ability.type === 'combo' ? '⚡' : '📈'}
          </div>
        )}
        {isLocked && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 'clamp(20px, 6vw, 30px)',
            opacity: 0.8
          }}>
            🔒
          </div>
        )}
      </div>

      {/* Средний контейнер для названия */}
      <div style={{
        width: '92%',
        height: '13%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: 'clamp(8px, 2vw, 11px)',
        fontWeight: 600,
        textAlign: 'center',
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {ability.name}
      </div>

      {/* Нижний контейнер для типа */}
      <div style={{
        width: '92%',
        height: '13%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFD966',
        fontSize: 'clamp(7px, 1.8vw, 9px)',
        fontWeight: 500,
        textAlign: 'center',
        textTransform: 'uppercase'
      }}>
        {ability.type}
      </div>

      {/* Контейнер уровня */}
      {!isLocked && currentLevel > 0 && (
        <div style={{
          position: 'absolute',
          right: '-8%',
          bottom: '-8%',
          width: '30%',
          height: '12%',
          background: '#000000',
          borderRadius: '10%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontSize: 'clamp(8px, 2vw, 10px)',
          fontWeight: 600,
          border: '1px solid #FFD966',
          boxShadow: '0 0 5px rgba(0,0,0,0.5)',
          zIndex: 10
        }}>
          {currentLevel}/{ability.max_level}
        </div>
      )}
    </div>
  );
};

// Компонент модального окна изучения
const LearnAbilityModal: React.FC<{
  ability: Ability;
  currentLevel: number;
  userExpPoints: number;
  onLearn: () => void;
  onClose: () => void;
  gradientColors: string;
}> = ({ ability, currentLevel, userExpPoints, onLearn, onClose, gradientColors }) => {
  const nextLevel = currentLevel + 1;
  const canLearn = nextLevel <= ability.max_level;
  const levelData = ability.levels.find(l => l.level === nextLevel);
  const cost = levelData?.cost || 0;
  const hasEnoughExp = userExpPoints >= cost;

  return (
    <div className="rewards-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div 
        className="rewards-modal no-summary" 
        style={{ 
          height: '40%',
          display: 'flex', 
          flexDirection: 'column',
          margin: '0',
          padding: '0',
          position: 'relative'
        }}
      >
        <div className="rewards-header" style={{ top: '-10%' }}>
          <h2>{ability.name}</h2>
          <button className="cancelled-modal-close" style={{ top: '130%' }} onClick={onClose}>✕</button>
        </div>

        <div 
          className="rewards-winners-list" 
          style={{ 
            flex: 1,
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '85%',
            padding: '4%',
            margin: '0 auto',
            gap: '4%'
          }}
        >
          <div style={{
            width: '100%',
            color: '#FFFFFF',
            fontSize: 'clamp(12px, 3.5vw, 14px)',
            textAlign: 'center'
          }}>
            {levelData?.description || ability.description}
          </div>

          <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '3%',
            background: '#313130',
            borderRadius: '8px'
          }}>
            <div style={{ color: '#FFD966', fontSize: 'clamp(12px, 3.5vw, 14px)' }}>
              Level {currentLevel} → {nextLevel}
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              color: hasEnoughExp ? '#FFFFFF' : '#FF6B6B'
            }}>
              <span>Cost: {cost} EXP</span>
            </div>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: '2vh',
          marginBottom: '2vh',
          width: '100%'
        }}>
          <button 
            className="rewards-claim-button"
            style={{ 
              width: '60%', 
              height: '6vh',
              opacity: canLearn && hasEnoughExp ? 1 : 0.5,
              cursor: canLearn && hasEnoughExp ? 'pointer' : 'not-allowed'
            }}
            onClick={canLearn && hasEnoughExp ? onLearn : undefined}
            disabled={!canLearn || !hasEnoughExp}
          >
            {!canLearn ? 'MAX LEVEL' : !hasEnoughExp ? 'NOT ENOUGH EXP POINTS' : 'LEARN'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StyleViewModal;