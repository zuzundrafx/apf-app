// src/components/FightersViewModal.tsx
import React from 'react';

interface FightersViewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FightersViewModal: React.FC<FightersViewModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const BASE_URL = import.meta.env.PROD ? '' : '/reactjs-template';

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
            justifyContent: 'center',
            width: '95%',
            height: '95%',
            padding: '0% 0',
            maxHeight: 'none',
            overflow: 'visible',
            margin: 'auto auto',
          }}
        >
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
              Detailed fighter information will be available in the next update.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FightersViewModal;