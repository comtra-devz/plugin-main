
import React, { useState, useEffect, useRef } from 'react';
import { BRUTAL, SecurityLog, AdminUser } from '../types';

interface Props {
    users: AdminUser[];
    logs: SecurityLog[];
    dateFrom: string;
    dateTo: string;
    countryFilter: string;
}

// Mock Data for Chart
const CHART_DATA_SOURCE = [
    { month: 'Jan', conv: 120, rev: 4500 },
    { month: 'Feb', conv: 150, rev: 5200 },
    { month: 'Mar', conv: 180, rev: 6100 },
    { month: 'Apr', conv: 140, rev: 4800 },
    { month: 'May', conv: 220, rev: 7500 },
    { month: 'Jun', conv: 250, rev: 8900 },
    { month: 'Jul', conv: 300, rev: 9500 },
    { month: 'Aug', conv: 280, rev: 9100 },
];

export const AdminOverview: React.FC<Props> = ({ users, dateFrom, dateTo, countryFilter }) => {
  const [hoveredData, setHoveredData] = useState<any | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Dynamic Content based on Filters
  const filteredUsers = users.filter(u => countryFilter === 'All World' || u.country === countryFilter);
  const chartData = CHART_DATA_SOURCE; // In real app, filter this by date/country

  useEffect(() => {
      setTimeout(() => setAnimate(true), 100);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<SVGElement, MouseEvent>, dataPoint: any, index: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
          setTooltipPos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
          });
          setHoveredData(dataPoint);
          setHoveredIndex(index);
      }
  };

  // Simple Normalization for SVG Chart
  const maxVal = 10000;
  const height = 150;
  const width = 1000; 
  const stepX = width / (chartData.length - 1);

  const getY = (val: number) => height - (val / maxVal) * height;
  const pointsRev = chartData.map((d, i) => `${i * stepX},${getY(d.rev)}`).join(' ');
  const pointsConv = chartData.map((d, i) => `${i * stepX},${getY(d.conv * 20)}`).join(' ');

  // Calculate Percentage Change
  const getPctChange = (current: number, prev: number) => {
      if (!prev) return '+0%';
      const diff = ((current - prev) / prev) * 100;
      return (diff > 0 ? '+' : '') + diff.toFixed(1) + '%';
  };

  // Get previous data for tooltip
  const prevData = hoveredIndex !== null && hoveredIndex > 0 ? chartData[hoveredIndex - 1] : null;
  const revChange = hoveredData ? getPctChange(hoveredData.rev, prevData?.rev || 0) : null;
  const convChange = hoveredData ? getPctChange(hoveredData.conv, prevData?.conv || 0) : null;

  return (
    <div className="p-6 w-full overflow-y-auto">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className={`${BRUTAL.card} bg-[#ff90e8]`}>
                <span className="text-xs font-bold uppercase">Total Users</span>
                <h2 className="text-4xl font-black mt-2">{filteredUsers.length}</h2>
            </div>
            <div className={`${BRUTAL.card}`}>
                <span className="text-xs font-bold uppercase">Active Subs</span>
                <h2 className="text-4xl font-black mt-2">{countryFilter === 'All World' ? 8 : 1}</h2>
            </div>
            <div className={`${BRUTAL.card}`}>
                <span className="text-xs font-bold uppercase">MRR</span>
                <h2 className="text-4xl font-black mt-2">€{countryFilter === 'All World' ? 4500 : 250}</h2>
            </div>
            <div className={`${BRUTAL.card} bg-black text-white`}>
                <span className="text-xs font-bold uppercase text-gray-400">Churn Rate</span>
                <h2 className="text-4xl font-black mt-2">2.1%</h2>
            </div>
        </div>

        {/* 2-Column Grid: Left Chart (2/3), Right Updates (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* FULL WIDTH DUAL LINE CHART */}
            <div className={`${BRUTAL.card} p-0 overflow-visible lg:col-span-2 relative z-20`}>
                <div className="flex justify-end items-center p-4 border-b-2 border-black bg-gray-50 h-16">
                    <div className="flex gap-4 text-[10px] font-bold uppercase">
                        <div className="flex items-center gap-1"><span className="w-2 h-2 bg-black"></span> Revenue</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 bg-[#ffc900] border border-black"></span> Conversions</div>
                    </div>
                </div>
                
                <div className="relative h-64 w-full bg-white border-b-2 border-black lg:border-b-0">
                    {chartData.length > 0 ? (
                        <svg 
                            ref={svgRef}
                            viewBox={`0 0 ${width} ${height}`} 
                            preserveAspectRatio="none" 
                            className="w-full h-full overflow-visible"
                            onMouseLeave={() => { setHoveredData(null); setHoveredIndex(null); }}
                        >
                            {/* Grid Lines */}
                            <line x1="0" y1="0" x2={width} y2="0" stroke="#f0f0f0" strokeWidth="1" />
                            <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#f0f0f0" strokeWidth="1" />
                            <line x1="0" y1={height} x2={width} y2={height} stroke="#f0f0f0" strokeWidth="1" />

                            {/* Lines with Animation */}
                            <path 
                                d={`M${pointsRev}`} 
                                fill="none" 
                                stroke="black" 
                                strokeWidth="3" 
                                strokeDasharray={width * 2}
                                strokeDashoffset={animate ? 0 : width * 2}
                                style={{ transition: 'stroke-dashoffset 2s ease-in-out' }}
                            />
                            <path 
                                d={`M${pointsConv}`} 
                                fill="none" 
                                stroke="#ffc900" 
                                strokeWidth="3" 
                                strokeDasharray={width * 2}
                                strokeDashoffset={animate ? 0 : width * 2}
                                style={{ transition: 'stroke-dashoffset 2.5s ease-in-out' }}
                            />

                            {/* Interactive Areas (Invisible Rects) */}
                            {chartData.map((d, i) => (
                                <rect 
                                    key={i}
                                    x={i * stepX - (stepX/2)} 
                                    y="0" 
                                    width={stepX} 
                                    height={height} 
                                    fill="transparent"
                                    onMouseMove={(e) => handleMouseMove(e, d, i)}
                                    className="cursor-crosshair"
                                />
                            ))}
                        </svg>
                    ) : (
                        <div className="h-full flex items-center justify-center text-xs font-bold uppercase text-gray-400">
                            No data for selected period
                        </div>
                    )}

                    {/* Cursor-following Tooltip */}
                    {hoveredData && (
                        <div 
                            className="absolute bg-black text-white p-2 shadow-[4px_4px_0_0_#ccc] text-xs z-10 flex flex-col gap-1 border-2 border-black pointer-events-none transition-transform duration-75 min-w-[140px]"
                            style={{ 
                                left: tooltipPos.x + 15, 
                                top: tooltipPos.y - 15,
                                transform: 'translate(0, -50%)' 
                            }}
                        >
                            <div className="font-black uppercase text-[#ffc900] border-b border-gray-700 pb-1 mb-1">{hoveredData.month}</div>
                            
                            <div className="flex justify-between gap-4 items-center">
                                <span>Rev:</span>
                                <div className="text-right flex flex-col items-end">
                                    <strong>€{hoveredData.rev}</strong>
                                    {prevData && <span className={`text-[8px] font-mono ${revChange?.includes('+') ? 'text-green-400' : 'text-red-400'}`}>{revChange}</span>}
                                </div>
                            </div>
                            
                            <div className="flex justify-between gap-4 items-center">
                                <span>Conv:</span>
                                <div className="text-right flex flex-col items-end">
                                    <strong>{hoveredData.conv}</strong>
                                    {prevData && <span className={`text-[8px] font-mono ${convChange?.includes('+') ? 'text-green-400' : 'text-red-400'}`}>{convChange}</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="flex justify-between px-4 py-2 bg-gray-50 border-t-2 border-black">
                    {chartData.map(d => <span key={d.month} className="text-[10px] font-bold uppercase text-gray-500 w-full text-center">{d.month}</span>)}
                </div>
            </div>

            {/* WEEKLY UPDATES (Right Column) */}
            <div className={`${BRUTAL.card} lg:col-span-1`}>
                <h3 className="font-black uppercase text-xl mb-4 border-b-2 border-black pb-2 bg-yellow-100 inline-block px-2 tracking-tighter">Weekly Updates</h3>
                <div className="space-y-4">
                    <div className="flex gap-3 items-start">
                        <div className="bg-black text-white text-[10px] font-bold px-1 py-0.5 mt-1">V2.1</div>
                        <div>
                            <h4 className="font-bold text-sm">Deep Sync Upgrade</h4>
                            <p className="text-xs text-gray-600">Fixed GitHub polling lag. Added support for Bitbucket drift detection.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start">
                        <div className="bg-[#ff90e8] text-black border border-black text-[10px] font-bold px-1 py-0.5 mt-1">FIX</div>
                        <div>
                            <h4 className="font-bold text-sm">Auth Token Refresh</h4>
                            <p className="text-xs text-gray-600">Resolved session timeout issues for Enterprise users.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start">
                        <div className="bg-white border border-black text-[10px] font-bold px-1 py-0.5 mt-1">DOCS</div>
                        <div>
                            <h4 className="font-bold text-sm">API Documentation</h4>
                            <p className="text-xs text-gray-600">Updated endpoints for User Management and Billing Hooks.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
