// src/components/FightersViewModal.tsx
import React, { useState, useEffect } from 'react';
import { SelectedFighter } from '../types';
import { getWeightClassColor } from '../utils/weightUtils';
import { getStyleDisplayName, getStyleIconFilename, getFighterStyleFromSelected } from '../utils/fighterUtils';

interface FightersViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
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

        {/* Контейнер с прокруткой */}
        <div 
          style={{ 
            flex: 1,
            overflowY: 'auto',
            padding: '2%',
            marginTop: '2%'
          }}
        >
          {loading ? (
            <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '5%' }}>LOADING FIGHTER DATA...</div>
          ) : error ? (
            <div style={{ color: '#FF0000', textAlign: 'center', padding: '5%' }}>Error: {error}</div>
          ) : fightersDetails.length === 0 ? (
            <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '5%' }}>No fighter data available</div>
          ) : (
            <>
              {/* Заголовочная строка - фиксированная */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                width: '100%',
                background: '#313130',
                borderRadius: '8px',
                marginBottom: '2%',
                padding: '2% 0',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>FIGHTER</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>STATS</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>BASE DAMAGE</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>PVP DAMAGE</div>
              </div>

              {/* Блоки бойцов - динамическая высота */}
              {fightersDetails.map((fighter, idx) => {
                const fighterStyle = getFighterStyleFromSelected({ Str: fighter.fighter.str, Td: fighter.fighter.td, Sub: 0 });
                const styleIcon = getStyleIconFilename(fighterStyle);
                const weightColor = getWeightClassColor(fighter.fighter.weightClass);
                
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    background: '#2A2A2A',
                    borderRadius: '2vw',
                    border: `2px solid ${weightColor}`,
                    overflow: 'hidden',
                    marginBottom: '2%'
                  }}>
                    {/* Первая строка - высота зависит от контента */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      width: '100%',
                      padding: '2%'
                    }}>
                      {/* 1-1: Полная карточка бойца */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2%' }}>
                        <div 
                          style={{ 
                            backgroundColor: weightColor,
                            width: '95%',
                            aspectRatio: '1 / 1.2',
                            borderRadius: '2vw',
                            position: 'relative',
                            overflow: 'visible',
                            margin: '0 auto'
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '50%',
                            height: '15%',
                            background: '#3e3e3e',
                            border: `1px solid ${weightColor}`,
                            borderRadius: '0 2vw 0 2vw',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'clamp(8px, 2vw, 10px)',
                            fontWeight: 700,
                            color: '#FFD966'
                          }}>
                            {fighter.baseDamage.total}
                          </div>
                          <div style={{
                            width: '97%',
                            height: '90%',
                            background: '#191a1f',
                            borderRadius: '1.5vw',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            marginTop: '4%'
                          }}>
                            <div style={{
                              width: '95%',
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

                      {/* 1-2: STATS */}
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'flex-start', 
                        padding: '0 4%', 
                        gap: '2%'
                      }}>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3, wordBreak: 'break-word' }}>Weight: {fighter.fighter.weightClass}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: getWLColor(fighter.fighter.wl), lineHeight: 1.3 }}>W/L: {getWLBadge(fighter.fighter.wl)}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3, wordBreak: 'break-word' }}>Method: {fighter.fighter.method || '-'}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Kd: {fighter.fighter.kd}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Td: {fighter.fighter.td}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Sub: {fighter.fighter.sub}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Head: {fighter.fighter.head}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Body: {fighter.fighter.body}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>Leg: {fighter.fighter.leg}</div>
                      </div>

                      {/* 1-3: BASE DAMAGE */}
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'flex-start', 
                        padding: '0 4%', 
                        gap: '2%'
                      }}>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>Weight: {fighter.baseDamage.components.weightCoef.toFixed(2)}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>W/L: {fighter.baseDamage.components.wkCoef.toFixed(2)}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>Bonus: {fighter.baseDamage.components.kdBonus || fighter.baseDamage.components.subBonus || 0}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>KD: {fighter.baseDamage.components.kdDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>TD: {fighter.baseDamage.components.tdDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>SUB: {fighter.baseDamage.components.subDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>HEAD: {fighter.baseDamage.components.headDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>BODY: {fighter.baseDamage.components.bodyDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>LEG: {fighter.baseDamage.components.legDamage}</div>
                      </div>

                      {/* 1-4: PVP DAMAGE */}
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'flex-start', 
                        padding: '0 4%', 
                        gap: '2%'
                      }}>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>Weight: {fighter.pvpDamage.components.weightCoef.toFixed(2)}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>W/L: {fighter.pvpDamage.components.wkCoef.toFixed(2)}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966', lineHeight: 1.3 }}>Bonus: {fighter.pvpDamage.components.kdBonus || fighter.pvpDamage.components.subBonus || 0}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>KD: {fighter.pvpDamage.components.kdDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>TD: {fighter.pvpDamage.components.tdDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>SUB: {fighter.pvpDamage.components.subDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>HEAD: {fighter.pvpDamage.components.headDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>BODY: {fighter.pvpDamage.components.bodyDamage}</div>
                        <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF', lineHeight: 1.3 }}>LEG: {fighter.pvpDamage.components.legDamage}</div>
                      </div>
                    </div>

                    {/* Вторая строка */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      width: '100%',
                      background: '#1C1D1F',
                      borderTop: '1px solid #3D3D3B',
                      fontSize: 'clamp(8px, 2vw, 10px)',
                      fontWeight: 500,
                      padding: '2% 0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966' }}>
                        {getStyleDisplayName(fighter.style)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D3D3B' }}>
                        -
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966' }}>
                        Base: {fighter.baseDamage.total}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966' }}>
                        PvP: {fighter.pvpDamage.total}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FightersViewModal;