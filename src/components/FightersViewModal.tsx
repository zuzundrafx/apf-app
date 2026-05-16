// src/components/FightersViewModal.tsx
import React, { useState, useEffect } from 'react';
import { SelectedFighter } from '../types';
import { getWeightClassColor } from '../utils/weightUtils';
import { getStyleDisplayName, getStyleIconFilename, getFighterStyleFromDetail } from '../utils/fighterUtils';

interface FightersViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName?: string;  // ← ДОБАВЛЕНО
  selections: SelectedFighter[];
  authToken?: string;
  userId?: string;
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

const FightersViewModal: React.FC<FightersViewModalProps> = ({
  isOpen,
  onClose,
  tournamentId,
  tournamentName,
  selections,
  authToken,
  userId
}) => {
  const [fightersDetails, setFightersDetails] = useState<FighterDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';
  const API_BASE = import.meta.env.PROD ? 'https://apf-app-backend.onrender.com' : 'http://localhost:3001';

  useEffect(() => {
    if (!isOpen || !tournamentId || !selections.length || !authToken) return;

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
  }, [isOpen, tournamentId, selections, authToken]);

  const getWLBadge = (wl: string): string => {
    if (wl === 'win') return 'WIN';
    if (wl === 'lose') return 'LOSE';
    if (wl === 'draw') return 'DRAW';
    return '-';
  };

  const getWLColor = (wl: string): string => {
    if (wl === 'win') return '#4CAF50';
    if (wl === 'lose') return '#B20101';
    if (wl === 'draw') return '#FFD966';
    return '#FFFFFF';
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

  if (!isOpen) return null;

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

        {/* Новая строка с названием турнира и кнопками */}
<div style={{
  display: 'grid',
  gridTemplateColumns: '46% 22% 22% 10%',
  width: '95%',
  padding: '2% 0',
  borderRadius: '8px',
  marginLeft: '2.5%',
  marginBottom: '1%',
  flexShrink: 0,
  background: '#313130'
}}>
  {/* 1-й столбец: название турнира */}
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
  
  {/* 2-й столбец: кнопка ALL FIGHTERS */}
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center'
  }}>
    <button 
      style={{
        background: 'linear-gradient(180deg, #5b5b5b 0%, #302f30 100%)',
        border: '0.15vh solid #666d75',
        borderRadius: '2vh',
        color: '#FFFFFF',
        fontSize: 'clamp(8px, 2vw, 10px)',
        fontWeight: 600,
        padding: '4% 8%',
        cursor: 'not-allowed',
        opacity: 0.6,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap'
      }}
      disabled
    >
      ALL FIGHTERS
    </button>
  </div>
  
  {/* 3-й столбец: кнопка YOUR CARD */}
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center'
  }}>
    <button 
      style={{
        background: 'linear-gradient(180deg, #5b5b5b 0%, #302f30 100%)',
        border: '0.15vh solid #666d75',
        borderRadius: '2vh',
        color: '#FFFFFF',
        fontSize: 'clamp(8px, 2vw, 10px)',
        fontWeight: 600,
        padding: '4% 8%',
        cursor: 'not-allowed',
        opacity: 0.6,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap'
      }}
      disabled
    >
      YOUR CARD
    </button>
  </div>
  
  {/* 4-й столбец: пустой */}
  <div></div>
</div>

        {/* Фиксированный заголовок */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '24% 32% 22% 22%',
          width: '95%',
          padding: '2% 0',
          borderRadius: '8px',
          marginLeft: '2.5%',
          marginBottom: '2%',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>FIGHTER</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>STATS</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>BASE</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>PVP</div>
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
          ) : fightersDetails.length === 0 ? (
            <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '5%' }}>No fighters data available</div>
          ) : (
            fightersDetails.map((fighter, idx) => {
              const fighterStyle = getFighterStyleFromDetail({ str: fighter.fighter.str, td: fighter.fighter.td, sub: fighter.fighter.sub });
              const styleIcon = getStyleIconFilename(fighterStyle);
              const weightColor = getWeightClassColor(fighter.fighter.weightClass);
              const wkCoefLabel = getWkCoefLabel(fighter.fighter.wl);
              
              return (
                <div key={idx} style={{
                  display: 'grid',
                  gridTemplateColumns: '24% 32% 22% 22%',
                  width: '95%',
                  marginLeft: '2.5%',
                  background: '#2A2A2A',
                  borderRadius: '2vw',
                  border: `2px solid ${weightColor}`,
                  marginBottom: '2%',
                  overflow: 'hidden'
                }}>
                  {/* 1-й столбец: карточка бойца (без блока урона) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4% 2%' }}>
                    <div 
                      style={{ 
                        backgroundColor: weightColor,
                        width: '98%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        aspectRatio: '1 / 1.4',
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
                    justifyContent: 'center',
                    padding: '6% 2%', 
                    gap: '2%'
                  }}>
                    <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3, wordBreak: 'break-word' }}>
                      Class: {fighter.fighter.weightClass}
                    </div>
                    <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', lineHeight: 1.3 }}>
                      <span style={{ color: '#FFFFFF' }}>RESULT: </span>
                      <span style={{ color: getWLColor(fighter.fighter.wl) }}>{getWLBadge(fighter.fighter.wl)}</span>
                    </div>
                    <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3, wordBreak: 'break-word' }}>
                      BY: {fighter.fighter.method || '-'}
                    </div>
                    <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Kd: {fighter.fighter.kd}</div>
                    <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Td: {fighter.fighter.td}</div>
                    <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Sub: {fighter.fighter.sub}</div>
                    <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Head: {fighter.fighter.head}</div>
                    <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Body: {fighter.fighter.body}</div>
                    <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Leg: {fighter.fighter.leg}</div>
                  </div>

                  {/* 3-й столбец: BASE DAMAGE */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
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

                  {/* 4-й столбец: PVP DAMAGE с разницей */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
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

                  {/* Строка со стилем и итоговым уроном (под всеми столбцами) */}
                  <div style={{
                    gridColumn: '1 / -1',
                    display: 'grid',
                    gridTemplateColumns: '24% 32% 22% 22%',
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
          )}
        </div>
      </div>
    </div>
  );
};

export default FightersViewModal;