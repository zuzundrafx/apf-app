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

        <div 
          className="rewards-winners-list" 
          style={{ 
            flex: 'none',
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            width: '95%',
            height: '95%',
            padding: '0% 0',
            maxHeight: 'none',
            overflowY: 'auto',
            margin: 'auto auto',
            gap: '8px'
          }}
        >
          {loading ? (
            <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '20px' }}>LOADING FIGHTER DATA...</div>
          ) : error ? (
            <div style={{ color: '#FF0000', textAlign: 'center', padding: '20px' }}>Error: {error}</div>
          ) : fightersDetails.length === 0 ? (
            <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '20px' }}>No fighter data available</div>
          ) : (
            <>
              {/* Заголовочная строка */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                width: '100%',
                height: '5%',
                minHeight: '30px',
                background: '#313130',
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>FIGHTER</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>STATS</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>BASE DAMAGE</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966', fontWeight: 600, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>PVP DAMAGE</div>
              </div>

              {/* Блоки бойцов */}
              {fightersDetails.map((fighter, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  background: '#2A2A2A',
                  borderRadius: '8px',
                  border: `1px solid ${getWeightClassColor(fighter.fighter.weightClass)}`,
                  overflow: 'hidden'
                }}>
                  {/* Первая строка */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    width: '100%',
                    minHeight: '80px',
                    padding: '4px'
                  }}>
                    {/* 1-1: Карточка бойца */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '90%',
                        background: '#191a1f',
                        borderRadius: '8px',
                        padding: '4px'
                      }}>
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                          <img 
                            src={`${BASE_URL}/icons/${getStyleIconFilename(fighter.style)}`} 
                            alt={fighter.style}
                            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                          />
                        </div>
                        <div style={{ fontSize: 'clamp(8px, 2vw, 10px)', color: '#FFFFFF', textAlign: 'center', wordBreak: 'break-word' }}>
                          {fighter.fighter.name}
                        </div>
                      </div>
                    </div>

                    {/* 1-2: STATS */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px', gap: '2px' }}>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>Weight Class: {fighter.fighter.weightClass}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: getWLColor(fighter.fighter.wl) }}>W/L: {getWLBadge(fighter.fighter.wl)}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>Method: {fighter.fighter.method || '-'}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>Kd: {fighter.fighter.kd}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>Td: {fighter.fighter.td}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>Sub: {fighter.fighter.sub}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>Head: {fighter.fighter.head}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>Body: {fighter.fighter.body}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>Leg: {fighter.fighter.leg}</div>
                    </div>

                    {/* 1-3: BASE DAMAGE */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px', gap: '2px' }}>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966' }}>Weight Coef: {fighter.baseDamage.components.weightCoef.toFixed(2)}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966' }}>W/L Coef: {fighter.baseDamage.components.wkCoef.toFixed(2)}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966' }}>Bonus: {fighter.baseDamage.components.kdBonus || fighter.baseDamage.components.subBonus || 0}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>KD: {fighter.baseDamage.components.kdDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>TD: {fighter.baseDamage.components.tdDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>SUB: {fighter.baseDamage.components.subDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>HEAD: {fighter.baseDamage.components.headDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>BODY: {fighter.baseDamage.components.bodyDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>LEG: {fighter.baseDamage.components.legDamage}</div>
                    </div>

                    {/* 1-4: PVP DAMAGE */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px', gap: '2px' }}>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966' }}>Weight Coef: {fighter.pvpDamage.components.weightCoef.toFixed(2)}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966' }}>W/L Coef: {fighter.pvpDamage.components.wkCoef.toFixed(2)}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFD966' }}>Bonus: {fighter.pvpDamage.components.kdBonus || fighter.pvpDamage.components.subBonus || 0}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>KD: {fighter.pvpDamage.components.kdDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>TD: {fighter.pvpDamage.components.tdDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>SUB: {fighter.pvpDamage.components.subDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>HEAD: {fighter.pvpDamage.components.headDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>BODY: {fighter.pvpDamage.components.bodyDamage}</div>
                      <div style={{ fontSize: 'clamp(7px, 1.8vw, 9px)', color: '#FFFFFF' }}>LEG: {fighter.pvpDamage.components.legDamage}</div>
                    </div>
                  </div>

                  {/* Вторая строка */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    width: '100%',
                    minHeight: '25px',
                    background: '#1C1D1F',
                    borderTop: '1px solid #3D3D3B',
                    fontSize: 'clamp(8px, 2vw, 10px)',
                    fontWeight: 500
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966' }}>
                      {getStyleDisplayName(fighter.style)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3D3D3B' }}>
                      -
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966' }}>
                      Base Dmg: {fighter.baseDamage.total}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD966' }}>
                      PvP Dmg: {fighter.pvpDamage.total}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FightersViewModal;