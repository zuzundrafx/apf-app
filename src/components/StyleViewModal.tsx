// src/components/StyleViewModal.tsx – обновлённая версия
import React from 'react';

interface StyleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  style: 'striker' | 'grappler';
}

const StyleViewModal: React.FC<StyleViewModalProps> = ({ isOpen, onClose, style }) => {
  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

  if (!isOpen) return null;

  const isStriker = style === 'striker';
  const title = isStriker ? 'STRIKER SKILLS' : 'GRAPPLER SKILLS';

  return (
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
            alignItems: 'center',
            justifyContent: 'center',
            width: '85%',
            padding: '4% 0',
            maxHeight: 'none',
            overflow: 'visible',
            margin: '0 auto',
          }}
        >
          {/* Заглушка */}
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2vh',
          }}>
            <div style={{
              color: '#FFD966',
              fontSize: 'clamp(16px, 4vw, 24px)',
              fontWeight: 600,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Coming Soon
            </div>
            <div style={{
              color: '#FFFFFF',
              fontSize: 'clamp(12px, 3vw, 16px)',
              textAlign: 'center',
              opacity: 0.7,
              padding: '0 10%'
            }}>
              Skill tree for {style} style will be available in the next update.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyleViewModal;