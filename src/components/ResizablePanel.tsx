import React, { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface ResizablePanelProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
  initialLeftWidth?: string;
  minLeftWidth?: number;
  maxLeftWidth?: number;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  leftContent,
  rightContent,
  initialLeftWidth = '64%',
  minLeftWidth = 30, // percentage
  maxLeftWidth = 80, // percentage
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState<string>(initialLeftWidth);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number>(0);
  const startLeftWidth = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent | TouchEvent) => {
    let clientX: number;
    
    if ('touches' in e) {
      clientX = (e as TouchEvent).touches[0].clientX;
    } else if ('clientX' in e) {
      clientX = (e as MouseEvent).clientX;
    } else {
      return;
    }
    
    setIsResizing(true);
    startX.current = clientX;
    
    if (leftPanelRef.current) {
      startLeftWidth.current = leftPanelRef.current.getBoundingClientRect().width;
      
      // Eliminar la transición durante el redimensionamiento para mayor fluidez
      leftPanelRef.current.style.transition = 'none';
      if (rightPanelRef.current) {
        rightPanelRef.current.style.transition = 'none';
      }
    }
    
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    
    // Prevenir el comportamiento predeterminado y la propagación
    e.preventDefault();
    if ('stopPropagation' in e) e.stopPropagation();
  }, []);
  
  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing) return;
    
    let clientX: number;
    if (e instanceof TouchEvent) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    
    const delta = clientX - startX.current;
    if (leftPanelRef.current && leftPanelRef.current.parentElement) {
      const containerWidth = leftPanelRef.current.parentElement.offsetWidth;
      const newLeftWidth = (startLeftWidth.current + delta) / containerWidth * 100;
      
      // Aplicar límites
      if (newLeftWidth >= minLeftWidth && newLeftWidth <= maxLeftWidth) {
        setLeftPanelWidth(`${newLeftWidth}%`);
      }
    }
  }, [isResizing, minLeftWidth, maxLeftWidth]);
  
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Restaurar las transiciones
    if (leftPanelRef.current) {
      leftPanelRef.current.style.transition = '';
    }
    if (rightPanelRef.current) {
      rightPanelRef.current.style.transition = '';
    }
  }, []);
  
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col lg:flex-row gap-3 xl:gap-0 flex-grow overflow-hidden">
      {/* Panel izquierdo */}
      <div 
        ref={leftPanelRef}
        className="h-full overflow-auto" 
        style={{ 
          width: leftPanelWidth,
          transition: isResizing ? 'none' : 'width 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {leftContent}
      </div>
      
      {/* Elemento para redimensionar */}
      <div
        ref={resizerRef}
        className="cursor-ew-resize w-4 lg:flex flex-col items-center justify-center hidden group select-none touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => {
          const touchEvent = e as unknown as TouchEvent;
          handleMouseDown(touchEvent);
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isResizing ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
        }}
      >
        <div className="h-16 w-1 bg-gray-700/50 rounded group-hover:bg-blue-500/80 transition-all"></div>
      </div>
      
      {/* Panel derecho */}
      <div 
        ref={rightPanelRef}
        className="h-full overflow-auto flex-1"
        style={{
          transition: isResizing ? 'none' : 'width 0.3s ease',
        }}
      >
        {rightContent}
      </div>
    </div>
  );
};

export default ResizablePanel; 