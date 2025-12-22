import { useMemo } from 'react';

interface GaugeChartProps {
  value: number; // 0-1 range
  min?: number;
  max?: number;
  thresholds?: { value: number; color: string }[];
  targetLine?: number;
  size?: number;
  label?: string;
  sublabel?: string;
}

export function GaugeChart({
  value,
  min = 0,
  max = 1,
  thresholds = [
    { value: 0.25, color: 'hsl(var(--destructive))' },
    { value: 0.32, color: 'hsl(var(--warning))' },
    { value: 1, color: 'hsl(var(--success))' },
  ],
  targetLine = 0.28,
  size = 160,
  label,
  sublabel,
}: GaugeChartProps) {
  const normalizedValue = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const normalizedTarget = (targetLine - min) / (max - min);
  
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // semicircle
  const center = size / 2;
  
  const currentColor = useMemo(() => {
    for (const threshold of thresholds) {
      if (value <= threshold.value) return threshold.color;
    }
    return thresholds[thresholds.length - 1]?.color || 'hsl(var(--primary))';
  }, [value, thresholds]);

  // Arc for gauge background (semicircle)
  const bgPath = `M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${center}`;
  
  // Calculate filled arc
  const fillAngle = normalizedValue * 180;
  const fillRadians = (fillAngle * Math.PI) / 180;
  const fillX = center + radius * Math.cos(Math.PI - fillRadians);
  const fillY = center - radius * Math.sin(fillRadians);
  const largeArc = fillAngle > 90 ? 1 : 0;
  const fillPath = `M ${strokeWidth / 2} ${center} A ${radius} ${radius} 0 ${largeArc} 1 ${fillX} ${fillY}`;
  
  // Target line position
  const targetAngle = normalizedTarget * 180;
  const targetRadians = (targetAngle * Math.PI) / 180;
  const targetX1 = center + (radius - strokeWidth) * Math.cos(Math.PI - targetRadians);
  const targetY1 = center - (radius - strokeWidth) * Math.sin(targetRadians);
  const targetX2 = center + (radius + strokeWidth) * Math.cos(Math.PI - targetRadians);
  const targetY2 = center - (radius + strokeWidth) * Math.sin(targetRadians);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Filled arc */}
        <path
          d={fillPath}
          fill="none"
          stroke={currentColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        
        {/* Target line */}
        <line
          x1={targetX1}
          y1={targetY1}
          x2={targetX2}
          y2={targetY2}
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
          strokeLinecap="round"
        />
        
        {/* Center text */}
        <text
          x={center}
          y={center - 10}
          textAnchor="middle"
          className="text-2xl font-bold fill-foreground"
        >
          {(value * 100).toFixed(1)}%
        </text>
        
        {/* Labels */}
        <text
          x={strokeWidth / 2}
          y={center + 15}
          textAnchor="start"
          className="text-xs fill-muted-foreground"
        >
          {(min * 100).toFixed(0)}%
        </text>
        <text
          x={size - strokeWidth / 2}
          y={center + 15}
          textAnchor="end"
          className="text-xs fill-muted-foreground"
        >
          {(max * 100).toFixed(0)}%
        </text>
      </svg>
      
      {label && (
        <p className="text-sm font-medium text-foreground mt-1">{label}</p>
      )}
      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}
