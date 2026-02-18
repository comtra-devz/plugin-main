
import React, { useState } from 'react';
import { BrutalDatePicker } from './Admin/components/Shared';
import { AdminUser, SecurityLog } from './Admin/types';
import { AdminLogin } from './Admin/auth/AdminLogin';
import { AdminBottomNav } from './Admin/components/AdminBottomNav';
import { ALL_COUNTRIES } from '../data/countries';

// Importing Tab Components
import { AdminOverview } from './Admin/tabs/AdminOverview';
import { AdminUsers } from './Admin/tabs/AdminUsers';
import { AdminRequests } from './Admin/tabs/AdminRequests';
import { AdminSecurity } from './Admin/tabs/AdminSecurity';
import { AdminRoles } from './Admin/tabs/AdminRoles';

// --- MOCK DATA (Ideally this comes from an API/Context) ---
const MOCK_USERS: AdminUser[] = [
  { 
      id: 'u1', email: 'alice@design.co', name: 'Alice D.', country: 'Italy', status: 'ACTIVE', subscription: 'PRO_ANNUAL', joinedAt: '2023-01-15', totalSpent: 250, referrals: 12, creditsRemaining: 2450,
      extendedStats: { maxHealthScore: 98, wireframesGenerated: 120, wireframesModified: 45, analyzedA11y: 200, analyzedUX: 150, analyzedProto: 300, syncedStorybook: 80, syncedGithub: 10, syncedBitbucket: 0, affiliatesCount: 12 }
  },
  { 
      id: 'u2', email: 'bob@freelance.net', name: 'Bob F.', country: 'USA', status: 'ACTIVE', subscription: 'FREE', joinedAt: '2023-06-10', totalSpent: 0, referrals: 0, creditsRemaining: 5,
      extendedStats: { maxHealthScore: 65, wireframesGenerated: 10, wireframesModified: 2, analyzedA11y: 5, analyzedUX: 0, analyzedProto: 0, syncedStorybook: 0, syncedGithub: 0, syncedBitbucket: 0, affiliatesCount: 0 }
  },
];

const MOCK_LOGS: SecurityLog[] = [
    { id: 'l1', type: 'LOGIN_FAIL', ip: '192.168.1.1', date: 'Today 10:42', desc: 'Invalid Password (3 attempts)', severity: 'MED' },
    { id: 'l2', type: 'Rate_Limit', ip: '45.33.22.11', date: 'Today 09:15', desc: 'API Spam detected on /generate', severity: 'HIGH' },
    { id: 'l3', type: 'Admin_Action', ip: '10.0.0.5', date: 'Yesterday', desc: 'Blocked User u3 (Charlie K.)', severity: 'LOW' },
];

export const AdminView: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS' | 'SECURITY' | 'REQUESTS' | 'ROLES'>('OVERVIEW');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [countryFilter, setCountryFilter] = useState('All World');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  if (!isAuthenticated) {
      return <AdminLogin onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // Determine Title based on active Tab
  const getTitle = () => {
      switch(activeTab) {
          case 'OVERVIEW': return 'Dashboard Overview';
          case 'USERS': return 'User Management';
          case 'SECURITY': return 'Security & Logs';
          case 'REQUESTS': return 'Support Requests';
          case 'ROLES': return 'Team & Roles';
          default: return 'Admin';
      }
  }

  const handleLogout = () => {
      setIsAuthenticated(false);
      setIsAvatarMenuOpen(false);
  };

  const handleNavigateRoles = () => {
      setActiveTab('ROLES');
      setIsAvatarMenuOpen(false);
  };

  const handleClearCountry = (e: React.MouseEvent) => {
      e.stopPropagation();
      setCountryFilter('All World');
      setIsCountryOpen(false);
  };

  // Filter Props Bundle
  const filterProps = { dateFrom, dateTo, countryFilter };

  return (
    <div className="flex flex-col h-full bg-[#fdfdfd] relative max-w-[100vw] overflow-x-hidden">
      
      {/* HEADER BAR */}
      <div className="flex flex-col border-b-2 border-black bg-white sticky top-0 z-40 shadow-sm shrink-0">
        {/* TOP ROW: Title & Avatar - Z-Index 60 to sit above Filters (Z-30) */}
        <div className="flex justify-between items-center p-4 pb-2 md:pb-4 relative z-[60]">
            <div className="flex flex-col">
                {/* Page Title with Branding Font */}
                <div className="flex items-center gap-3">
                    {activeTab === 'ROLES' && (
                        <button onClick={() => setActiveTab('USERS')} className="text-2xl font-black hover:text-[#ff90e8]">←</button>
                    )}
                    <h1 className="text-4xl font-['Tiny5'] uppercase tracking-normal leading-none">{getTitle()}</h1>
                </div>
            </div>
            
            {/* Avatar with Menu */}
            <div className="relative">
                <div 
                    onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded border border-transparent hover:border-black transition-all"
                >
                    <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold border-2 border-black">
                        SA
                    </div>
                </div>

                {isAvatarMenuOpen && (
                    <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsAvatarMenuOpen(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-56 bg-white border-2 border-black shadow-[6px_6px_0_0_#000] z-[100] animate-in fade-in zoom-in-95">
                        <div className="p-3 border-b-2 border-black bg-black text-white">
                            <div className="font-bold text-xs truncate">admin@antigravity.ai</div>
                            <div className="text-[10px] font-mono text-[#ffc900]">SUPER ADMIN</div>
                        </div>
                        <div className="p-1">
                            <button 
                                onClick={handleNavigateRoles}
                                className="w-full text-left px-3 py-2 text-xs font-bold uppercase hover:bg-[#ffc900] hover:text-black flex justify-between items-center"
                            >
                                Manage Roles <span>→</span>
                            </button>
                            <div className="h-px bg-gray-200 my-1"></div>
                            <button 
                                onClick={handleLogout}
                                className="w-full text-left px-3 py-2 text-xs font-bold uppercase hover:bg-red-100 text-red-600"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                    </>
                )}
            </div>
        </div>

        {/* Global Filters - Z-Index 30 - Scrollable on Mobile - Hidden on ROLES tab */}
        {activeTab !== 'ROLES' && (
            <div className="w-full overflow-x-auto md:overflow-visible px-4 pb-4 relative z-30 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="flex justify-start md:justify-end min-w-max">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-1 rounded">
                        
                        {/* Custom Country Dropdown */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsCountryOpen(!isCountryOpen)}
                                className="bg-white border-2 border-black text-xs font-bold uppercase p-2 outline-none hover:bg-[#ffc900] cursor-pointer mr-2 h-10 w-40 flex justify-between items-center"
                            >
                                <span className="truncate">{countryFilter}</span>
                                {countryFilter !== 'All World' ? (
                                    <span onClick={handleClearCountry} className="font-black hover:text-red-600 px-1">✕</span>
                                ) : (
                                    <span>▼</span>
                                )}
                            </button>
                            
                            {isCountryOpen && (
                                <>
                                {/* Overlay to close */}
                                <div className="fixed inset-0 z-[200]" onClick={() => setIsCountryOpen(false)}></div>
                                {/* Dropdown Menu - Fixed Position on Mobile to avoid clipping in overflow container */}
                                <div 
                                    className="fixed inset-x-4 top-[180px] md:absolute md:inset-auto md:top-full md:left-0 mt-1 md:w-56 bg-white border-2 border-black shadow-[6px_6px_0_0_#000] z-[201] max-h-[300px] md:max-h-[200px] overflow-y-auto custom-scrollbar animate-in zoom-in-95 origin-top-left"
                                >
                                    <div className="bg-black text-white p-2 text-xs font-bold uppercase sticky top-0">Select Region</div>
                                    <div 
                                        onClick={() => { setCountryFilter('All World'); setIsCountryOpen(false); }}
                                        className={`p-3 text-xs font-bold uppercase cursor-pointer hover:bg-[#ffc900] border-b border-gray-100 ${countryFilter === 'All World' ? 'bg-gray-100' : ''}`}
                                    >
                                        All World
                                    </div>
                                    {ALL_COUNTRIES.map(c => (
                                        <div 
                                            key={c}
                                            onClick={() => { setCountryFilter(c); setIsCountryOpen(false); }}
                                            className={`p-3 text-xs font-bold uppercase cursor-pointer hover:bg-[#ffc900] border-b border-gray-100 ${countryFilter === c ? 'bg-black text-white' : ''}`}
                                        >
                                            {c}
                                        </div>
                                    ))}
                                </div>
                                </>
                            )}
                        </div>

                        <span className="text-[10px] font-bold uppercase text-gray-400 px-1">Filter:</span>
                        <div>
                            <BrutalDatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" className="w-32" />
                        </div>
                        <span className="text-xs font-bold">-</span>
                        <div>
                            <BrutalDatePicker value={dateTo} onChange={setDateTo} placeholder="To" className="w-32" />
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
      
      {/* CONTENT AREA */}
      <div className="flex-1 overflow-hidden bg-gray-50 flex relative pb-20 w-full">
        {activeTab === 'OVERVIEW' && <AdminOverview users={MOCK_USERS} logs={MOCK_LOGS} {...filterProps} />}
        {activeTab === 'USERS' && <AdminUsers users={MOCK_USERS} {...filterProps} />}
        {activeTab === 'SECURITY' && <AdminSecurity logs={MOCK_LOGS} {...filterProps} />}
        {activeTab === 'REQUESTS' && <AdminRequests {...filterProps} />}
        {activeTab === 'ROLES' && <AdminRoles {...filterProps} />}
      </div>

      {/* BOTTOM NAV BAR */}
      {activeTab !== 'ROLES' && (
          <AdminBottomNav activeTab={activeTab} onChange={setActiveTab} />
      )}

    </div>
  );
};
