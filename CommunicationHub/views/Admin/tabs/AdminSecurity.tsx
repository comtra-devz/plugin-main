
import React, { useState } from 'react';
import { BRUTAL, SecurityLog } from '../types';

interface Props {
    logs: SecurityLog[];
    dateFrom: string;
    dateTo: string;
    countryFilter: string;
}

const SEVERITY_FILTERS: { id: 'ALL' | 'HIGH' | 'MED' | 'LOW', label: string, color: string }[] = [
    { id: 'ALL', label: 'All Events', color: 'bg-black text-white' },
    { id: 'HIGH', label: 'High Risk', color: 'bg-red-600 text-white' },
    { id: 'MED', label: 'Medium', color: 'bg-yellow-400 text-black' },
    { id: 'LOW', label: 'Low', color: 'bg-gray-200 text-black' }
];

export const AdminSecurity: React.FC<Props> = ({ logs, countryFilter }) => {
  const [showBanModal, setShowBanModal] = useState<string | null>(null);
  const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set());
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'HIGH' | 'MED' | 'LOW'>('ALL');

  const handleToggleBan = (ip: string) => {
      const newBlocked = new Set(blockedIps);
      if (newBlocked.has(ip)) {
          newBlocked.delete(ip); // Unban
      } else {
          newBlocked.add(ip); // Ban
      }
      setBlockedIps(newBlocked);
      setShowBanModal(null);
  };

  const filteredLogs = logs.filter(log => {
      const matchesBlocked = showBlockedOnly ? blockedIps.has(log.ip) : true;
      const matchesSeverity = severityFilter === 'ALL' || log.severity === severityFilter;
      // Mock Country Filter on Logs (Assuming logs originate from regions)
      const matchesCountry = countryFilter === 'All World' ? true : true; 
      
      return matchesBlocked && matchesSeverity && matchesCountry;
  });

  return (
    <div className="p-6 w-full overflow-y-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                {/* Removed small title as requested */}
                {/* Severity Chips */}
                <div className="flex gap-2">
                    {SEVERITY_FILTERS.map(chip => (
                        <button
                            key={chip.id}
                            onClick={() => setSeverityFilter(chip.id)}
                            className={`px-3 py-1 text-[10px] font-bold uppercase border-2 border-black rounded-full transition-all ${severityFilter === chip.id ? chip.color + ' shadow-[2px_2px_0_0_#999]' : 'bg-white text-black hover:bg-gray-100'}`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 border border-black/10">
                <input 
                    type="checkbox" 
                    id="blockedOnly" 
                    checked={showBlockedOnly} 
                    onChange={(e) => setShowBlockedOnly(e.target.checked)}
                    className="w-4 h-4 accent-black"
                />
                <label htmlFor="blockedOnly" className="text-xs font-bold uppercase cursor-pointer select-none">Show Blocked Only</label>
            </div>
        </div>

        <div className="border-2 border-black bg-white shadow-[4px_4px_0_0_#000] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-black text-white">
                        <tr>
                            <th className="p-3 text-xs font-bold uppercase">Severity</th>
                            <th className="p-3 text-xs font-bold uppercase">Type</th>
                            <th className="p-3 text-xs font-bold uppercase">IP Address</th>
                            <th className="p-3 text-xs font-bold uppercase">Description</th>
                            <th className="p-3 text-xs font-bold uppercase">Time</th>
                            <th className="p-3 text-xs font-bold uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map(log => {
                            const isBanned = blockedIps.has(log.ip);
                            return (
                                <tr key={log.id} className={`border-b-2 border-black hover:bg-gray-50 ${isBanned ? 'bg-red-50' : ''}`}>
                                    <td className="p-3 border-r-2 border-black text-center">
                                        <span className={`text-[9px] font-black px-1 ${log.severity === 'HIGH' ? 'bg-black text-white' : 'bg-gray-200 text-black'}`}>
                                            {log.severity}
                                        </span>
                                    </td>
                                    <td className="p-3 text-xs font-bold border-r-2 border-black text-black">{log.type}</td>
                                    <td className="p-3 text-xs font-mono border-r-2 border-black text-black">
                                        {log.ip}
                                        {isBanned && <span className="ml-2 text-[8px] bg-red-600 text-white px-1 uppercase font-bold">BANNED</span>}
                                    </td>
                                    <td className="p-3 text-xs border-r-2 border-black text-black">{log.desc}</td>
                                    <td className="p-3 text-xs font-mono border-r-2 border-black text-black">{log.date}</td>
                                    <td className="p-3 text-xs">
                                        <button 
                                            onClick={() => isBanned ? handleToggleBan(log.ip) : setShowBanModal(log.ip)}
                                            className={`font-black underline px-1 border border-transparent ${isBanned ? 'text-green-600 hover:border-green-600' : 'text-red-600 hover:border-red-600'}`}
                                        >
                                            {isBanned ? 'UNBLOCK IP' : 'BAN IP'}
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>

        {/* BAN CONFIRMATION MODAL */}
        {showBanModal && (
            <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6" onClick={() => setShowBanModal(null)}>
                <div onClick={(e) => e.stopPropagation()} className={`${BRUTAL.card} max-w-sm w-full bg-white text-center animate-in zoom-in-95`}>
                    <div className="text-4xl mb-2">🚫</div>
                    <h3 className="text-2xl font-black uppercase mb-2 text-black">Confirm Block</h3>
                    <p className="text-sm font-medium mb-4 text-black">
                        Are you sure you want to blacklist IP <strong>{showBanModal}</strong>?<br/>
                        This will block all future requests.
                    </p>
                    <input type="text" placeholder="Reason (Optional)" className={BRUTAL.input + " mb-4"} />
                    <div className="flex gap-2">
                        <button onClick={() => setShowBanModal(null)} className="flex-1 border-2 border-black py-2 font-bold hover:bg-gray-100">CANCEL</button>
                        <button onClick={() => handleToggleBan(showBanModal!)} className="flex-1 bg-black text-white border-2 border-black py-2 font-bold hover:bg-gray-800 shadow-[4px_4px_0_0_#000]">CONFIRM BAN</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
