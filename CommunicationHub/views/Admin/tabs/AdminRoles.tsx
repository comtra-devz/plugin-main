
import React, { useState, useEffect } from 'react';
import { BRUTAL, AdminTeamMember } from '../types';
import { Confetti } from '../../../../components/Confetti';
import { StrictConfirmationModal } from '../components/Shared';

const MOCK_TEAM: AdminTeamMember[] = [
    { id: 't1', email: 'super@admin.com', role: 'SUPER_ADMIN', joinedAt: '2023-01-01', status: 'ACTIVE' },
    { id: 't2', email: 'editor@design.co', role: 'EDITOR', joinedAt: '2023-06-15', status: 'ACTIVE' },
    { id: 't3', email: 'new@guy.com', role: 'VIEWER', joinedAt: '2023-10-20', status: 'PENDING' },
];

interface Props {
    dateFrom: string;
    dateTo: string;
    countryFilter: string;
}

export const AdminRoles: React.FC<Props> = ({ countryFilter }) => {
    const [team, setTeam] = useState(MOCK_TEAM);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'SUPER_ADMIN' | 'EDITOR' | 'VIEWER'>('VIEWER');
    const [showConfetti, setShowConfetti] = useState(false);
    
    // Sidebar State
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    // Local state for edits
    const [tempRole, setTempRole] = useState<'SUPER_ADMIN' | 'EDITOR' | 'VIEWER' | null>(null);
    
    // Deletion Modal State
    const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

    const selectedMember = team.find(m => m.id === selectedMemberId);

    // Sync temp state when opening
    useEffect(() => {
        if (selectedMember) {
            setTempRole(selectedMember.role);
        }
    }, [selectedMember]);

    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleInvite = () => {
        if (!isValidEmail(email)) return;
        const newMember: AdminTeamMember = {
            id: `t${Date.now()}`,
            email,
            role,
            joinedAt: new Date().toISOString().split('T')[0],
            status: 'PENDING'
        };
        setTeam([...team, newMember]);
        setEmail('');
    };

    const handleSaveChanges = () => {
        if (selectedMemberId && tempRole) {
            setTeam(prev => prev.map(m => m.id === selectedMemberId ? { ...m, role: tempRole } : m));
            setShowConfetti(true);
            setTimeout(() => {
                setShowConfetti(false);
                setSelectedMemberId(null);
            }, 2000);
        }
    };

    const handleDeleteMember = () => {
        if (selectedMemberId) {
            setDeleteConfirmation(selectedMemberId);
        }
    };

    const executeDelete = () => {
        if (deleteConfirmation) {
            setTeam(prev => prev.filter(m => m.id !== deleteConfirmation));
            setSelectedMemberId(null);
            setDeleteConfirmation(null);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 2000);
        }
    };

    const hasUnsavedChanges = selectedMember && tempRole !== selectedMember.role;
    const filteredTeam = team; 

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden p-6 relative">
            {showConfetti && <Confetti />}
            <div className="flex flex-col md:flex-row gap-6 h-full">
                
                {/* Invite Column */}
                <div className="w-full md:w-1/3">
                    <div className={BRUTAL.card}>
                        <h3 className="font-black uppercase text-lg mb-4 bg-black text-white inline-block px-2 tracking-tighter">Invite Member</h3>
                        <div className="space-y-4">
                            <div>
                                <label className={BRUTAL.label}>Email Address</label>
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="colleague@comtra.ai"
                                    className={BRUTAL.input}
                                />
                            </div>
                            <div>
                                <label className={BRUTAL.label}>Role</label>
                                <select 
                                    value={role}
                                    onChange={e => setRole(e.target.value as any)}
                                    className={BRUTAL.input}
                                >
                                    <option value="VIEWER">Viewer (Read Only)</option>
                                    <option value="EDITOR">Editor (Manage Users)</option>
                                    <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
                                </select>
                            </div>
                            <button 
                                onClick={handleInvite}
                                disabled={!isValidEmail(email)}
                                className={`${BRUTAL.btn} w-full ${isValidEmail(email) ? 'bg-[#ffc900] text-black hover:bg-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300'}`}
                            >
                                Send Invitation
                            </button>
                        </div>
                    </div>
                </div>

                {/* List Column */}
                <div className="flex-1 overflow-y-auto">
                    <h3 className="font-black uppercase text-xl mb-4 tracking-tighter">Team Members ({filteredTeam.length})</h3>
                    <div className="space-y-3">
                        {filteredTeam.map(member => (
                            <div 
                                key={member.id} 
                                onClick={() => setSelectedMemberId(member.id)}
                                className={`${BRUTAL.card} flex justify-between items-center p-4 hover:bg-[#fff9e6] cursor-pointer group`}
                            >
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-sm group-hover:underline">{member.email}</h4>
                                        {member.status === 'PENDING' && (
                                            <span className="text-[9px] bg-gray-200 border border-black px-1 font-mono uppercase">Pending</span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-mono">Joined: {member.joinedAt}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black uppercase border border-black px-2 py-0.5 bg-gray-50">{member.role.replace('_', ' ')}</span>
                                    <span className="text-xl">→</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* STRICT CONFIRMATION MODAL FOR DELETION */}
            {deleteConfirmation && (
                <StrictConfirmationModal 
                    title="Remove Team Member"
                    actionWord="delete"
                    onConfirm={executeDelete}
                    onCancel={() => setDeleteConfirmation(null)}
                />
            )}

            {/* MEMBER EDIT SIDEBAR - Z-INDEX 100000 */}
            {selectedMember && (
                <>
                <div className="fixed inset-0 bg-black/60 z-[99999] backdrop-blur-sm" onClick={() => setSelectedMemberId(null)}></div>
                <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white border-l-4 border-black z-[100000] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="p-6 border-b-4 border-black bg-[#fdfdfd] flex justify-between items-center">
                        <div className="flex-1">
                            <h3 className="font-black uppercase text-xl tracking-tighter">Edit Role</h3>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleSaveChanges}
                                disabled={!hasUnsavedChanges}
                                className={`px-4 py-2 text-xs font-black uppercase border-2 border-black transition-all ${
                                    hasUnsavedChanges 
                                        ? 'bg-[#ffc900] text-black shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5' 
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300'
                                }`}
                            >
                                Save
                            </button>
                            <button onClick={() => setSelectedMemberId(null)} className="text-xl font-bold">✕</button>
                        </div>
                    </div>
                    
                    <div className="p-6 flex-1 overflow-y-auto pb-24">
                        <div className="mb-6">
                            <label className={BRUTAL.label}>Member</label>
                            <p className="font-bold text-lg">{selectedMember.email}</p>
                            <p className="text-xs text-gray-500 font-mono">ID: {selectedMember.id}</p>
                        </div>

                        <div className="mb-8">
                            <label className={BRUTAL.label}>Change Role</label>
                            <div className="flex flex-col gap-2">
                                {['VIEWER', 'EDITOR', 'SUPER_ADMIN'].map((r) => (
                                    <button 
                                        key={r}
                                        onClick={() => setTempRole(r as any)}
                                        className={`p-3 text-left border-2 border-black font-bold uppercase text-xs flex justify-between items-center ${tempRole === r ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                                    >
                                        {r.replace('_', ' ')}
                                        {tempRole === r && <span>✓</span>}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="border-t-2 border-red-200 pt-6">
                            <button 
                                onClick={handleDeleteMember}
                                className="w-full border-2 border-red-600 text-red-600 font-black uppercase py-3 hover:bg-red-50"
                            >
                                Remove Member
                            </button>
                        </div>
                    </div>
                </div>
                </>
            )}
        </div>
    );
};
