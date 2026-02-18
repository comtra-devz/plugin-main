
import React, { useState, useEffect } from 'react';
import { BRUTAL } from '../types';

interface Props {
    onLoginSuccess: () => void;
}

export const AdminLogin: React.FC<Props> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        if (attempts >= 3) {
            setIsLocked(true);
        }
    }, [attempts]);

    const handleLogin = () => {
        if (isLocked) return;

        // Mock Credentials
        if (email === 'admin' && password === 'admin') {
            onLoginSuccess();
        } else {
            setAttempts(prev => prev + 1);
            setError(`Invalid credentials. ${2 - attempts} attempts remaining.`);
        }
    };

    if (isLocked) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-red-600 text-white p-6 text-center animate-in zoom-in-95 duration-300">
                <div className="text-6xl mb-4">🚫</div>
                <h1 className="text-4xl font-black uppercase mb-2">System Locked</h1>
                <p className="font-mono text-sm max-w-xs">
                    Too many failed attempts. Access from this IP has been suspended for security reasons.
                </p>
                <div className="mt-8 border-2 border-white p-4 font-mono text-xs">
                    Error Code: SEC_LOCK_003
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full bg-[#fdfdfd] p-6">
            <div className={`${BRUTAL.card} w-full max-w-sm`}>
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-black uppercase tracking-tighter">Admin OS</h1>
                    <div className="bg-[#ffc900] text-black text-[10px] font-bold uppercase px-2 py-1 inline-block border border-black mt-2">
                        Restricted Access
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className={BRUTAL.label}>Admin ID</label>
                        <input 
                            type="text" 
                            className={BRUTAL.input} 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin"
                        />
                    </div>
                    <div>
                        <label className={BRUTAL.label}>Password</label>
                        <input 
                            type="password" 
                            className={BRUTAL.input} 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="•••••"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-100 border-2 border-red-500 text-red-600 p-2 text-xs font-bold uppercase text-center animate-pulse">
                            {error}
                        </div>
                    )}

                    <button 
                        onClick={handleLogin}
                        className={`${BRUTAL.btn} w-full bg-black text-white hover:bg-gray-800`}
                    >
                        Authenticate
                    </button>
                </div>

                <div className="mt-6 pt-4 border-t-2 border-dashed border-black text-center">
                    <p className="text-[10px] text-gray-400 font-mono">
                        Demo Credentials: admin / admin
                    </p>
                </div>
            </div>
        </div>
    );
};
