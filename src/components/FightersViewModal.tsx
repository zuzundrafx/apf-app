// src/components/FightersViewModal.tsx
import React, { useState, useEffect } from 'react';
import { SelectedFighter } from '../types';
import { getWeightClassColor } from '../utils/weightUtils';
import { getStyleDisplayName, getStyleIconFilename, getFighterStyleFromDetail } from '../utils/fighterUtils';

interface FightersViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName?: string;
  selections: SelectedFighter[];
  authToken?: string;
  coefficients: Record<string, number>;
}

interface FighterDetail {
  fighter: {
    name: string;
    weightClass: string;
    wl: string;
    method: string;
    kd: number;
    td: number;
    sub: number;
    head: number;
    body: number;
    leg: number;
    str: number;
    totalDamage: number;
  };
  style: string;
  baseDamage: {
    total: number;
    components: {
      weightCoef: number;
      wkCoef: number;
      kdBonus: number;
      subBonus: number;
      kdDamage: number;
      tdDamage: number;
      subDamage: number;
      headDamage: number;
      bodyDamage: number;
      legDamage: number;
    };
  };
  pvpDamage: {
    total: number;
    components: {
      weightCoef: number;
      wkCoef: number;
      kdBonus: number;
      subBonus: number;
      kdDamage: number;
      tdDamage: number;
      subDamage: number;
      headDamage: number;
      bodyDamage: number;
      legDamage: number;
    };
  };
}

interface TournamentFighter {
  fighter_name: string;
  weight_class: string;
  wl: string | null;
  method: string;
  kd: number;
  td: number;
  sub: number;
  head: number;
  body: number;
  leg: number;
  str: number;
  total_damage: number;
}

const FightersViewModal: React.FC<FightersViewModalProps> = ({
  isOpen,
  onClose,
  tournamentId,
  tournamentName,
  selections,
  authToken,
  coefficients
}) => {
  const [fightersDetails, setFightersDetails] = useState<FighterDetail[]>([]);
  const [allFighters, setAllFighters] = useState<TournamentFighter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'yourCard' | 'allFighters'>('yourCard');

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
  const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

  // Загрузка данных для YOUR CARD
  useEffect(() => {
    if (!isOpen || !tournamentId || !selections.length || !authToken) return;
    if (activeTab !== 'yourCard') return;

    const loadFighterDetails = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_BASE}/api/fighters/calculate-details`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            tournamentId,
            selections: selections.map(s => ({
              weightClass: s.weightClass,
              fighter: {
                Fighter: s.fighter.Fighter,
                'Total Damage': s.fighter['Total Damage'],
                'W/L': s.fighter['W/L'],
                Str: s.fighter.Str,
                Td: s.fighter.Td,
                Sub: s.fighter.Sub
              }
            }))
          })
        });

        if (!response.ok) {
          throw new Error('Failed to load fighter details');
        }

        const data = await response.json();
        setFightersDetails(data.fightersDetails);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadFighterDetails();
  }, [isOpen, tournamentId, selections, authToken, activeTab]);

  // Загрузка всех бойцов турнира для ALL FIGHTERS
  useEffect(() => {
    if (!isOpen || !tournamentId || !authToken) return;
    if (activeTab !== 'allFighters') return;

    const loadAllFighters = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_BASE}/api/tournaments/${tournamentId}/fighters`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to load tournament fighters');
        }

        const data = await response.json();
        setAllFighters(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadAllFighters();
  }, [isOpen, tournamentId, authToken, activeTab]);

  const getWLBadge = (wl: string): string => {
    if (wl === 'win') return 'WIN';
    if (wl === 'lose') return 'LOSE';
    if (wl === 'draw') return 'DRAW';
    return '-';
  };

  const getWkCoefLabel = (wl: string): string => {
    if (wl === 'win') return 'WIN Coef:';
    if (wl === 'lose') return 'LOSE Coef:';
    if (wl === 'draw') return 'DRAW Coef:';
    return 'Coef:';
  };

  const getDiff = (pvpValue: number, baseValue: number): string => {
    const diff = pvpValue - baseValue;
    if (diff > 0) return ` (+${diff})`;
    if (diff < 0) return ` (${diff})`;
    return '';
  };

  // Группировка бойцов по весовым категориям
  const getWeightClassOrder = (weightClass: string): number => {
    const order: Record<string, number> = {
      'Flyweight': 1,
      'Bantamweight': 2,
      'Featherweight': 3,
      'Lightweight': 4,
      'Welterweight': 5,
      'Middleweight': 6,
      'Light Heavyweight': 7,
      'Heavyweight': 8,
      "Women's Strawweight": 9,
      "Women's Flyweight": 10,
      "Women's Bantamweight": 11,
      "Catch Weight": 12
    };
    return order[weightClass] || 99;
  };

  const groupedFighters = allFighters.reduce((acc, fighter) => {
    const weightClass = fighter.weight_class;
    if (!acc[weightClass]) {
      acc[weightClass] = [];
    }
    acc[weightClass].push(fighter);
    return acc;
  }, {} as Record<string, TournamentFighter[]>);

  const sortedWeightClasses = Object.keys(groupedFighters).sort((a, b) => 
    getWeightClassOrder(a) - getWeightClassOrder(b)
  );

  // Форматирование строк для ALL FIGHTERS с использованием коэффициентов
  const formatKdTdSub = (fighter: TournamentFighter) => {
    return `Kd: ${fighter.kd}, Td: ${fighter.td}, Sub: ${fighter.sub}`;
  };

  const formatHeadBodyLeg = (fighter: TournamentFighter) => {
    return `Head: ${fighter.head}, Body: ${fighter.body}, Leg: ${fighter.leg}`;
  };

  const formatCoefBonus = (fighter: TournamentFighter) => {
    if (Object.keys(coefficients).length === 0) return 'Loading...';
    
    const wl = (fighter.wl || 'lose').toLowerCase();
    let wkCoef = coefficients.LOSE_COEF || 0.7;
    if (wl === 'win') wkCoef = coefficients.WIN_COEF || 1.0;
    else if (wl === 'draw') wkCoef = coefficients.DRAW_COEF || 0.9;
    
    const wkLabel = getWkCoefLabel(wl);
    return `${wkLabel} ${wkCoef.toFixed(2)}`;
  };

  const formatBonus = (fighter: TournamentFighter) => {
    const wl = (fighter.wl || 'lose').toLowerCase();
    const method = (fighter.method || '').toUpperCase();
    let bonus = 0;
    if (wl === 'win') {
      if (method.includes('KO') || method.includes('TKO')) bonus = coefficients.KD_BONUS_WIN || 40;
      else if (method.includes('SUB')) bonus = coefficients.SUB_BONUS_WIN || 35;
    }
    return `Bonus: ${bonus}`;
  };

  const formatDamageStats = (fighter: TournamentFighter) => {
    if (Object.keys(coefficients).length === 0) {
      return { kdtdsub: 'Loading...', headbodyleg: 'Loading...' };
    }
    
    const weightCoef = coefficients[`weight_${fighter.weight_class}`] || 1.0;
    const wkCoef = (fighter.wl === 'win') ? (coefficients.WIN_COEF || 1.0) : (fighter.wl === 'draw') ? (coefficients.DRAW_COEF || 0.9) : (coefficients.LOSE_COEF || 0.7);
    const KD_COEF = coefficients.KD_COEF || 25;
    const TD_COEF = coefficients.TD_COEF || 10;
    const SUB_COEF = coefficients.SUB_COEF || 15;
    const HEAD_COEF = coefficients.HEAD_COEF || 1;
    const BODY_COEF = coefficients.BODY_COEF || 0.9;
    const LEG_COEF = coefficients.LEG_COEF || 0.8;
    
    const kdDamage = Math.round(fighter.kd * KD_COEF * weightCoef * wkCoef);
    const tdDamage = Math.round(fighter.td * TD_COEF * weightCoef * wkCoef);
    const subDamage = Math.round(fighter.sub * SUB_COEF * weightCoef * wkCoef);
    const headDamage = Math.round(fighter.head * HEAD_COEF * weightCoef * wkCoef);
    const bodyDamage = Math.round(fighter.body * BODY_COEF * weightCoef * wkCoef);
    const legDamage = Math.round(fighter.leg * LEG_COEF * weightCoef * wkCoef);
    
    return {
      kdtdsub: `KD: ${kdDamage}, TD: ${tdDamage}, SUB: ${subDamage}`,
      headbodyleg: `HEAD: ${headDamage}, BODY: ${bodyDamage}, LEG: ${legDamage}`
    };
  };

  if (!isOpen) return null;

  const isYourCardActive = activeTab === 'yourCard';
  const isAllFightersActive = activeTab === 'allFighters';

  // Ширина столбцов в зависимости от активной вкладки
  const gridColumns = isYourCardActive 
    ? '24% 32% 22% 22%'
    : '20% 43% 35% 2%';

  return (
    <div className="rewards-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        className="rewards-modal no-summary" 
        style={{ 
          flex: 'none',
          height: '90%',
          width: '95%',
          display: 'flex', 
          flexDirection: 'column',
          margin: 'auto auto',
          padding: '0',
          position: 'relative'
        }}
      >
        <div className="rewards-header" style={{ top: '-8%', zIndex: 100 }}>
          <h2>FIGHTERS DETAILS</h2>
          <button 
            className="cancelled-modal-close" 
            style={{ top: '100%', zIndex: 101, cursor: 'pointer' }} 
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Строка с названием турнира и кнопками */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '46% 22% 22% 10%',
          width: '98%',
          padding: '2% 0',
          borderRadius: '8px',
          marginLeft: '1%',
          flexShrink: 0,
          background: '#313130'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-start', 
            paddingLeft: '4%',
            color: '#FFFFFF', 
            fontWeight: 500, 
            fontSize: 'clamp(9px, 2.2vw, 11px)',
            wordBreak: 'break-word'
          }}>
            {tournamentName || 'Tournament'}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              style={{
                background: 'linear-gradient(180deg, #5b5b5b 0%, #302f30 100%)',
                border: isAllFightersActive ? '2px solid #FFD966' : '0.15vh solid #666d75',
                borderRadius: '2vh',
                color: '#FFFFFF',
                fontSize: 'clamp(8px, 2vw, 10px)',
                fontWeight: 600,
                padding: '6% 8%',
                cursor: 'pointer',
                opacity: isAllFightersActive ? 1 : 0.6,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setActiveTab('allFighters')}
            >
              ALL FIGHTERS
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              style={{
                background: 'linear-gradient(180deg, #5b5b5b 0%, #302f30 100%)',
                border: isYourCardActive ? '2px solid #FFD966' : '0.15vh solid #666d75',
                borderRadius: '2vh',
                color: '#FFFFFF',
                fontSize: 'clamp(8px, 2vw, 10px)',
                fontWeight: 600,
                padding: '6% 8%',
                cursor: 'pointer',
                opacity: isYourCardActive ? 1 : 0.6,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap'
              }}
              onClick={() => setActiveTab('yourCard')}
            >
              YOUR CARD
            </button>
          </div>
          
          <div></div>
        </div>

        {/* Заголовки столбцов */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
          width: '95%',
          padding: '1% 0',
          borderRadius: '8px',
          marginLeft: '2.5%',
          marginBottom: '0%',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>FIGHTER</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>STATS</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>BASE</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>{isYourCardActive ? 'PVP' : ''}</div>
        </div>

        {/* Контейнер для списка бойцов с прокруткой */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
        }}>
          {loading ? (
            <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '5%' }}>LOADING FIGHTERS DATA...</div>
          ) : error ? (
            <div style={{ color: '#FF0000', textAlign: 'center', padding: '5%' }}>Error: {error}</div>
          ) : isYourCardActive ? (
            // YOUR CARD режим
            fightersDetails.length === 0 ? (
              <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '5%' }}>No fighters data available</div>
            ) : (
              fightersDetails.map((fighter, idx) => {
                const fighterStyle = getFighterStyleFromDetail({ str: fighter.fighter.str, td: fighter.fighter.td, sub: fighter.fighter.sub });
                const styleIcon = getStyleIconFilename(fighterStyle);
                const weightColor = getWeightClassColor(fighter.fighter.weightClass);
                const wkCoefLabel = getWkCoefLabel(fighter.fighter.wl);
                
                const getWLColor = (wl: string): string => {
                  if (wl === 'win') return '#B29403';
                  if (wl === 'lose') return '#B20101';
                  if (wl === 'draw') return '#666D74';
                  return 'transparent';
                };
                
                const getTextColor = (wl: string): string => {
                  if (wl === 'draw') return '#000000';
                  return '#FFFFFF';
                };
                
                return (
                  <div key={idx} style={{
                    display: 'grid',
                    gridTemplateColumns: gridColumns,
                    width: '95%',
                    marginLeft: '2.5%',
                    background: '#2A2A2A',
                    borderRadius: '2vw',
                    border: `2px solid ${weightColor}`,
                    marginBottom: '2%',
                    overflow: 'hidden'
                  }}>
                    {/* 1-й столбец: карточка бойца */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4% 2%' }}>
                      <div 
                        style={{ 
                          backgroundColor: weightColor,
                          width: '98%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          aspectRatio: '1 / 1.5',
                          borderRadius: '2vw',
                          position: 'relative',
                          overflow: 'visible',
                          margin: '0 auto'
                        }}
                      >
                        <div style={{
                          width: '96%',
                          height: '94%',
                          background: '#191a1f',
                          borderRadius: '1.5vw',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          margin: 'auto auto',
                        }}>
                          <div style={{
                            height: '75%',
                            aspectRatio: '1 / 1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <img 
                              src={`${BASE_URL}/icons/${styleIcon}`} 
                              alt={fighterStyle} 
                              style={{ width: '90%', height: 'auto', objectFit: 'contain' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent) {
                                  parent.innerHTML = fighterStyle === 'striker' ? '👊' : fighterStyle === 'grappler' ? '🤼' : fighterStyle === 'universal' ? '⚡' : '👤';
                                  parent.style.fontSize = 'clamp(16px, 5vw, 24px)';
                                }
                              }}
                            />
                          </div>
                          <div style={{
                            width: '100%',
                            height: '2%',
                            background: `linear-gradient(90deg, transparent 0%, ${weightColor} 20%, ${weightColor} 80%, transparent 100%)`
                          }}></div>
                          <div style={{
                            width: '100%',
                            height: '23%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'clamp(6px, 1.8vw, 9px)',
                            fontWeight: 500,
                            color: '#FFFFFF',
                            textAlign: 'center',
                            padding: '2% 4%',
                            wordBreak: 'break-word',
                            lineHeight: 1.2
                          }}>
                            {fighter.fighter.name}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2-й столбец: STATS */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'flex-end',
                      padding: '4% 2%', 
                      gap: '2%'
                    }}>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3, wordBreak: 'break-word' }}>
                        Class: {fighter.fighter.weightClass}
                      </div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', lineHeight: 1.3 }}>
                        <span style={{ color: '#FFFFFF' }}>RESULT: </span>
                        <span style={{ 
                          backgroundColor: getWLColor(fighter.fighter.wl),
                          color: getTextColor(fighter.fighter.wl),
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: 'clamp(7px, 1.8vw, 9px)',
                          display: 'inline-block'
                        }}>
                          {getWLBadge(fighter.fighter.wl)}
                        </span>
                      </div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3, wordBreak: 'break-word' }}>
                        BY: {fighter.fighter.method || '-'}
                      </div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>KD: {fighter.fighter.kd}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>TD: {fighter.fighter.td}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>SUB: {fighter.fighter.sub}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>HEAD: {fighter.fighter.head}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>BODY: {fighter.fighter.body}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>LEG: {fighter.fighter.leg}</div>
                    </div>

                    {/* 3-й столбец: BASE DAMAGE */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'flex-end', 
                      padding: '4% 2%', 
                      gap: '2%'
                    }}>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>W.Coef: {fighter.baseDamage.components.weightCoef.toFixed(2)}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>{wkCoefLabel} {fighter.baseDamage.components.wkCoef.toFixed(2)}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Bonus: {fighter.baseDamage.components.kdBonus || fighter.baseDamage.components.subBonus || 0}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>KD: {fighter.baseDamage.components.kdDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>TD: {fighter.baseDamage.components.tdDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>SUB: {fighter.baseDamage.components.subDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>HEAD: {fighter.baseDamage.components.headDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>BODY: {fighter.baseDamage.components.bodyDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>LEG: {fighter.baseDamage.components.legDamage}</div>
                    </div>

                    {/* 4-й столбец: PVP DAMAGE */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'flex-end', 
                      padding: '4% 2%', 
                      gap: '2%'
                    }}>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>W.Coef: {fighter.pvpDamage.components.weightCoef.toFixed(2)}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>{wkCoefLabel} {fighter.pvpDamage.components.wkCoef.toFixed(2)}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Bonus: {fighter.pvpDamage.components.kdBonus || fighter.pvpDamage.components.subBonus || 0}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                        KD: {fighter.pvpDamage.components.kdDamage}
                        <span style={{ color: '#90EE90' }}>{getDiff(fighter.pvpDamage.components.kdDamage, fighter.baseDamage.components.kdDamage)}</span>
                      </div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                        TD: {fighter.pvpDamage.components.tdDamage}
                        <span style={{ color: '#90EE90' }}>{getDiff(fighter.pvpDamage.components.tdDamage, fighter.baseDamage.components.tdDamage)}</span>
                      </div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                        SUB: {fighter.pvpDamage.components.subDamage}
                        <span style={{ color: '#90EE90' }}>{getDiff(fighter.pvpDamage.components.subDamage, fighter.baseDamage.components.subDamage)}</span>
                      </div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                        HEAD: {fighter.pvpDamage.components.headDamage}
                        <span style={{ color: '#90EE90' }}>{getDiff(fighter.pvpDamage.components.headDamage, fighter.baseDamage.components.headDamage)}</span>
                      </div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                        BODY: {fighter.pvpDamage.components.bodyDamage}
                        <span style={{ color: '#90EE90' }}>{getDiff(fighter.pvpDamage.components.bodyDamage, fighter.baseDamage.components.bodyDamage)}</span>
                      </div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                        LEG: {fighter.pvpDamage.components.legDamage}
                        <span style={{ color: '#90EE90' }}>{getDiff(fighter.pvpDamage.components.legDamage, fighter.baseDamage.components.legDamage)}</span>
                      </div>
                    </div>

                    {/* Строка со стилем и итоговым уроном */}
                    <div style={{
                      gridColumn: '1 / -1',
                      display: 'grid',
                      gridTemplateColumns: gridColumns,
                      width: '100%',
                      background: '#1C1D1F',
                      borderTop: '1px solid #3D3D3B',
                      fontSize: 'clamp(9px, 2.2vw, 11px)',
                      fontWeight: 500,
                      padding: '2% 0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966' }}>
                        {getStyleDisplayName(fighter.style)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D3D3B' }}>
                        -
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', color: '#FFD966' }}>
                        Base Dmg: {fighter.baseDamage.total}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', color: '#FFD966' }}>
                        PvP Dmg: {fighter.pvpDamage.total}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            // ALL FIGHTERS режим
            sortedWeightClasses.length === 0 ? (
              <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '5%' }}>No fighters data available</div>
            ) : (
              sortedWeightClasses.map((weightClass) => {
                const fighters = groupedFighters[weightClass];
                const weightColor = getWeightClassColor(weightClass);
                
                const getWLColorForFighter = (wl: string | null): string => {
                  if (wl === 'win') return '#B29403';
                  if (wl === 'lose') return '#B20101';
                  if (wl === 'draw') return '#666D74';
                  return 'transparent';
                };
                
                const getTextColorForFighter = (wl: string | null): string => {
                  if (wl === 'draw') return '#000000';
                  return '#FFFFFF';
                };
                
                return (
                  <div key={weightClass} style={{ marginBottom: '4%' }}>
                    {/* Заголовок весовой категории */}
                    <div style={{
                      backgroundColor: weightColor,
                      padding: '0.5% 4%',
                      borderRadius: '1vw',
                      marginBottom: '2%',
                      marginLeft: '2.5%',
                      width: '95%'
                    }}>
                      <span style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)', textShadow: '0 0 2px #000000', letterSpacing: '0.5px' }}>{weightClass}</span>
                    </div>
                    
                    {fighters.map((fighter, idx) => {
                      const fighterStyle = getFighterStyleFromDetail({ str: fighter.str, td: fighter.td, sub: fighter.sub });
                      const styleIcon = getStyleIconFilename(fighterStyle);
                      const damageStats = formatDamageStats(fighter);
                      
                      return (
                        <div key={idx} style={{
                          display: 'grid',
                          gridTemplateColumns: gridColumns,
                          width: '95%',
                          marginLeft: '2.5%',
                          background: '#2A2A2A',
                          borderRadius: '2vw',
                          border: `2px solid ${weightColor}`,
                          marginBottom: '2%',
                          overflow: 'hidden'
                        }}>
                          {/* 1-й столбец: упрощённая карточка бойца */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4% 2%' }}>
                            <div 
                              style={{ 
                                backgroundColor: weightColor,
                                width: '96%',
                                aspectRatio: '1 / 1',
                                borderRadius: '2vw',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto'
                              }}
                            >
                              <div style={{
                                width: '90%',
                                height: '90%',
                                background: '#191a1f',
                                borderRadius: '1.5vw',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                              }}>
                                <img 
                                  src={`${BASE_URL}/icons/${styleIcon}`} 
                                  alt={fighterStyle} 
                                  style={{ width: '80%', height: 'auto', objectFit: 'contain' }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent) {
                                      parent.innerHTML = fighterStyle === 'striker' ? '👊' : fighterStyle === 'grappler' ? '🤼' : fighterStyle === 'universal' ? '⚡' : '👤';
                                      parent.style.fontSize = 'clamp(16px, 5vw, 24px)';
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* 2-й столбец: STATS (имя бойца + статистика) */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            justifyContent: 'flex-end',
                            padding: '4% 2%', 
                            gap: '2%'
                          }}>
                            <div style={{ fontSize: 'clamp(9px, 2.2vw, 12px)', color: '#FFD966', fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>
                              {fighter.fighter_name}
                            </div>
                            <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', lineHeight: 1.3, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ color: '#FFFFFF' }}>RESULT: </span>
                              <span style={{ 
                                backgroundColor: getWLColorForFighter(fighter.wl),
                                color: getTextColorForFighter(fighter.wl),
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                fontSize: 'clamp(7px, 1.8vw, 9px)',
                                display: 'inline-block',
                                marginLeft: '4px'
                              }}>
                                {getWLBadge(fighter.wl || '')}
                              </span>
                            </div>
                            <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3, wordBreak: 'break-word' }}>
                              BY: {fighter.method || '-'}
                            </div>
                            <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                              {formatKdTdSub(fighter)}
                            </div>
                            <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                              {formatHeadBodyLeg(fighter)}
                            </div>
                          </div>

                          {/* 3-й столбец: BASE DAMAGE */}
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            justifyContent: 'flex-end', 
                            padding: '4% 2%', 
                            gap: '2%'
                          }}>
                            <div></div>
                            <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>
                              {formatCoefBonus(fighter)}
                            </div>
                            <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                              {formatBonus(fighter)}
                            </div>
                            <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                              {damageStats.kdtdsub}
                            </div>
                            <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>
                              {damageStats.headbodyleg}
                            </div>
                          </div>

                          {/* 4-й столбец: пустой */}
                          <div></div>

                          {/* Строка со стилем и итоговым уроном */}
                          <div style={{
                            gridColumn: '1 / -1',
                            display: 'grid',
                            gridTemplateColumns: gridColumns,
                            width: '100%',
                            background: '#1C1D1F',
                            borderTop: '1px solid #3D3D3B',
                            fontSize: 'clamp(9px, 2.2vw, 11px)',
                            fontWeight: 500,
                            padding: '2% 0'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966' }}>
                              {getStyleDisplayName(fighterStyle)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D3D3B' }}>
                              -
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', color: '#FFD966' }}>
                              Base Dmg: {fighter.total_damage}
                            </div>
                            <div></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default FightersViewModal;