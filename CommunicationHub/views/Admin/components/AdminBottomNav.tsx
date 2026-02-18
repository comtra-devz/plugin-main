
import React from 'react';

type Tab = 'OVERVIEW' | 'USERS' | 'SECURITY' | 'REQUESTS';

interface Props {
    activeTab: Tab;
    onChange: (tab: Tab) => void;
}

// Pixelated / Geometric Icons
const Icons = {
    Overview: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
        </svg>
    ),
    Users: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    ),
    Security: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    ),
    Requests: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
        </svg>
    )
};

export const AdminBottomNav: React.FC<Props> = ({ activeTab, onChange }) => {
    return (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t-2 border-black flex justify-around p-2 pb-6 md:pb-2 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            <NavButton label="Dashboard" active={activeTab === 'OVERVIEW'} onClick={() => onChange('OVERVIEW')} icon={<Icons.Overview />} />
            <NavButton label="Users" active={activeTab === 'USERS'} onClick={() => onChange('USERS')} icon={<Icons.Users />} />
            <NavButton label="Requests" active={activeTab === 'REQUESTS'} onClick={() => onChange('REQUESTS')} icon={<Icons.Requests />} />
            <NavButton label="Security" active={activeTab === 'SECURITY'} onClick={() => onChange('SECURITY')} icon={<Icons.Security />} />
        </div>
    );
};

const NavButton = ({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon: React.ReactNode }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1 p-2 transition-all ${active ? 'opacity-100 transform -translate-y-2' : 'opacity-50 hover:opacity-100'}`}
    >
        <div className={`p-2 border-2 border-black shadow-[2px_2px_0_0_#000] ${active ? 'bg-[#ffc900] text-black' : 'bg-white text-black'}`}>
            {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </button>
);
