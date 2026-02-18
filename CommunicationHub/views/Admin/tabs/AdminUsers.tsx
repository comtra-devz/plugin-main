
import React, { useState, useEffect } from 'react';
import { BRUTAL, AdminUser } from '../types';
import { StatWidget, StrictConfirmationModal } from '../components/Shared';
import { Confetti } from '../../../../TESTING/components/Confetti';

interface Props {
    users: AdminUser[];
    dateFrom: string;
    dateTo: string;
    countryFilter: string;
}

export const AdminUsers: React.FC<Props> = ({ users, countryFilter }) => {
  const [localUsers, setLocalUsers] = useState<AdminUser[]>(users);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'BLOCK' | 'DELETE', userId: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Sync props to state if props change
  useEffect(() => {
      setLocalUsers(users);
  }, [users]);

  const selectedUser = localUsers.find(u => u.id === selectedUserId);
  
  const filteredUsers = localUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesCountry = countryFilter === 'All World' || u.country === countryFilter;
    return matchesSearch && matchesCountry;
  });

  const handleExecuteAction = () => {
      if (confirmAction) {
          console.log(`Executing ${confirmAction.type} on user ${confirmAction.userId}`);
          
          if (confirmAction.type === 'BLOCK') {
              // Toggle Status
              setLocalUsers(prev => prev.map(u => {
                  if (u.id === confirmAction.userId) {
                      const newStatus = u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
                      return { ...u, status: newStatus };
                  }
                  return u;
              }));
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 2000);
          } else if (confirmAction.type === 'DELETE') {
              // Delete Logic
              setLocalUsers(prev => prev.filter(u => u.id !== confirmAction.userId));
              setSelectedUserId(null); // Close panel
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 2000);
          }

          setConfirmAction(null);
      }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative max-w-[100vw] overflow-x-hidden">
        {showConfetti && <Confetti />}
        
        {/* Toolbar */}
        <div className="p-4 bg-white flex flex-col md:flex-row justify-between items-start md:items-center shrink-0 gap-4 w-full">
            <div className="relative w-full md:w-96">
                <input 
                    type="text" 
                    placeholder="Search users by name or email..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={BRUTAL.input}
                />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <button className={`${BRUTAL.btn} w-full md:w-auto`}>Export CSV</button>
            </div>
        </div>

        {/* Table Container with Padding and Outline - Ensures scroll only happens here */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full max-w-full">
            <div className="border-2 border-black shadow-[4px_4px_0_0_#000] bg-white overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="px-3 py-3 text-xs font-black uppercase border-r border-gray-700">User</th>
                                <th className="px-3 py-3 text-xs font-black uppercase border-r border-gray-700">Status</th>
                                <th className="px-3 py-3 text-xs font-black uppercase border-r border-gray-700">Plan</th>
                                <th className="px-3 py-3 text-xs font-black uppercase border-r border-gray-700">Country</th>
                                <th className="px-3 py-3 text-xs font-black uppercase border-r border-gray-700">Spent</th>
                                <th className="px-3 py-3 text-xs font-black uppercase">Credits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-xs font-bold uppercase text-gray-400">
                                        No users found matching filters
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr 
                                        key={user.id} 
                                        onClick={() => setSelectedUserId(user.id)}
                                        className={`bg-white hover:bg-[#fff9e6] transition-colors border-b-2 border-black cursor-pointer group ${user.status === 'BLOCKED' ? 'bg-red-50' : ''}`}
                                    >
                                        <td className={BRUTAL.tableCell}>
                                            <div>
                                                <div className="font-bold text-xs group-hover:underline">{user.name}</div>
                                                <div className="font-mono text-[10px] text-gray-500">{user.email}</div>
                                            </div>
                                        </td>
                                        <td className={BRUTAL.tableCell}>
                                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${user.status === 'ACTIVE' ? 'bg-green-300 text-black' : 'bg-red-600 text-white'}`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className={BRUTAL.tableCell}>
                                            <span className="font-mono text-xs font-bold">{user.subscription}</span>
                                        </td>
                                        <td className={BRUTAL.tableCell}>{user.country}</td>
                                        <td className={BRUTAL.tableCell}>€{user.totalSpent}</td>
                                        <td className={BRUTAL.tableCell}>{user.creditsRemaining}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* STRICT CONFIRMATION MODAL - Z-Index updated in Shared.tsx to cover sidebars */}
        {confirmAction && (
            <StrictConfirmationModal 
                title={confirmAction.type === 'BLOCK' ? 
                    (selectedUser?.status === 'ACTIVE' ? 'Block User Account' : 'Unblock User Account') : 
                    'Delete User Account'
                }
                actionWord={confirmAction.type === 'BLOCK' ? 
                    (selectedUser?.status === 'ACTIVE' ? 'block' : 'unblock') : 
                    'delete'
                }
                onConfirm={handleExecuteAction}
                onCancel={() => setConfirmAction(null)}
            />
        )}

        {/* USER DETAIL PANEL OVERLAY - Z-INDEX 100000 for Mobile Visibility */}
        {selectedUser && (
            <>
            <div className="fixed inset-0 bg-black/60 z-[99999] backdrop-blur-sm" onClick={() => setSelectedUserId(null)}></div>
            <div 
                className="fixed inset-0 md:inset-y-0 md:right-0 md:left-auto w-full md:w-[600px] h-[100dvh] bg-white md:border-l-4 border-black z-[100000] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-300"
            >
                {/* Panel Header */}
                <div className="p-6 border-b-4 border-black bg-[#fdfdfd] flex justify-between items-start shrink-0">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-gray-400">User Profile</span>
                        <div className="flex items-center gap-2">
                            <h3 className="text-3xl font-black uppercase leading-none mb-2 mt-1 tracking-tighter">{selectedUser.name}</h3>
                            {selectedUser.status === 'BLOCKED' && (
                                <span className="bg-red-600 text-white text-xs font-black px-2 py-1 uppercase rotate-12 border border-black shadow-sm">BLOCKED</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <span className="bg-black text-white text-[10px] px-2 py-0.5 font-bold uppercase">{selectedUser.id}</span>
                            <span className="bg-[#ff90e8] text-black text-[10px] px-2 py-0.5 font-bold uppercase border border-black">{selectedUser.subscription}</span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedUserId(null)} className="text-xl font-bold hover:bg-black hover:text-white w-8 h-8 flex items-center justify-center border-2 border-transparent hover:border-black transition-all">✕</button>
                </div>

                {/* Panel Content (Scrollable) - Added overscroll-behavior: contain for Mobile */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24 custom-scrollbar bg-white overscroll-contain">
                    
                    {/* Basic Info */}
                    <div className={`${BRUTAL.card} bg-gray-50`}>
                        <h4 className="font-black uppercase text-sm mb-3 border-b-2 border-black pb-1">Account Info</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className={BRUTAL.label}>Email</label><p className="font-mono text-sm border-b-2 border-gray-200 pb-1">{selectedUser.email}</p></div>
                            <div><label className={BRUTAL.label}>Country</label><p className="font-bold text-sm border-b-2 border-gray-200 pb-1">{selectedUser.country}</p></div>
                            <div><label className={BRUTAL.label}>Joined</label><p className="font-mono text-sm border-b-2 border-gray-200 pb-1">{selectedUser.joinedAt}</p></div>
                            <div><label className={BRUTAL.label}>Lifetime Value</label><p className="font-black text-lg bg-[#ffc900] inline-block px-2 border border-black shadow-[2px_2px_0_0_#000]">€{selectedUser.totalSpent}</p></div>
                        </div>
                    </div>

                    {/* EXTENDED STATS */}
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b-4 border-black pb-1">
                            <span className="text-xl">📊</span>
                            <h4 className="font-black uppercase text-lg">Performance & Activity</h4>
                        </div>
                        
                        <div className="bg-white border-2 border-black p-4 shadow-[6px_6px_0_0_#ccc]">
                            {/* Hero Stat */}
                            <div className="flex justify-between items-center mb-6 bg-black text-white p-3 border-2 border-black shadow-[4px_4px_0_0_#ff90e8]">
                                <span className="font-bold uppercase text-xs text-[#ff90e8]">Highest Health Score</span>
                                <span className="font-black text-3xl">{selectedUser.extendedStats.maxHealthScore}%</span>
                            </div>
                            
                            {/* Grid of Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <StatWidget label="Wireframes Gen" value={selectedUser.extendedStats.wireframesGenerated} icon="🖼️" />
                                <StatWidget label="Wireframes Mod" value={selectedUser.extendedStats.wireframesModified} icon="✏️" />
                                <StatWidget label="Proto Scans" value={selectedUser.extendedStats.analyzedProto} icon="🕸️" />
                                
                                <StatWidget label="A11y Checks" value={selectedUser.extendedStats.analyzedA11y} icon="♿" />
                                <StatWidget label="UX Audits" value={selectedUser.extendedStats.analyzedUX} icon="🧠" />
                                <StatWidget label="Affiliates" value={selectedUser.extendedStats.affiliatesCount} color="bg-[#ffc900]" icon="🤝" />
                                
                                <div className="col-span-2 md:col-span-3 border-t-2 border-dashed border-black/20 my-2"></div>
                                
                                <StatWidget label="Sync Storybook" value={selectedUser.extendedStats.syncedStorybook} color="bg-pink-100" icon="📕" />
                                <StatWidget label="Sync GitHub" value={selectedUser.extendedStats.syncedGithub} icon="🐙" />
                                <StatWidget label="Sync Bitbucket" value={selectedUser.extendedStats.syncedBitbucket} icon="⚓" />
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="border-t-4 border-red-100 pt-4">
                        <h4 className="font-black uppercase text-sm mb-3 text-red-600">Danger Zone</h4>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setConfirmAction({ type: 'BLOCK', userId: selectedUser.id })}
                                className={`flex-1 border-2 border-black font-bold uppercase text-xs py-3 transition-all ${selectedUser.status === 'ACTIVE' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-500 text-white hover:bg-green-600'}`}
                            >
                                {selectedUser.status === 'ACTIVE' ? 'Block User' : 'Unblock User'}
                            </button>
                            <button 
                                onClick={() => setConfirmAction({ type: 'DELETE', userId: selectedUser.id })}
                                className="flex-1 border-2 border-red-600 text-red-600 font-bold uppercase text-xs py-3 hover:bg-red-50 hover:shadow-[4px_4px_0_0_#fca5a5] transition-all"
                            >
                                Delete User
                            </button>
                        </div>
                    </div>

                </div>

                {/* Panel Footer */}
                <div className="p-4 border-t-2 border-black bg-gray-100 shrink-0">
                    <a 
                        href={`mailto:${selectedUser.email}`} 
                        className={`${BRUTAL.btn} bg-black text-white w-full hover:bg-gray-800 block text-center no-underline`}
                    >
                        Send Message to {selectedUser.name}
                    </a>
                </div>
            </div>
            </>
        )}
    </div>
  );
};
