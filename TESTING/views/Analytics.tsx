
import React, { useState } from 'react';
import { BRUTAL, COLORS } from '../constants';
import { UserStats } from '../types_test';
import { UserStatsWidget } from '../components/UserStatsWidget';
import { Confetti } from '../components/Confetti';

interface Props {
  stats: UserStats;
}

// Icons for Badges (Unique Pixel Art Style)
const Icons = {
  Sprout: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21V19H10V17H8V15H6V11H8V9H10V7H12V5H14V2H16V5H18V9H20V13H18V17H16V19H14V21H12Z" fill="#4ADE80"/>
      <path d="M12 7V21" stroke="black" strokeWidth="2" strokeLinecap="square"/>
    </svg>
  ),
  Rock: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="12" width="16" height="8" fill="#9CA3AF" stroke="black" strokeWidth="2"/>
      <rect x="8" y="8" width="8" height="4" fill="#9CA3AF" stroke="black" strokeWidth="2"/>
      <rect x="6" y="14" width="2" height="2" fill="black" />
      <rect x="16" y="16" width="2" height="2" fill="black" />
    </svg>
  ),
  IronIngot: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8H22V18H2V8Z" fill="#94A3B8" stroke="black" strokeWidth="2"/>
      <path d="M4 8L6 18" stroke="black" strokeWidth="2"/>
      <path d="M20 8L18 18" stroke="black" strokeWidth="2"/>
      <rect x="8" y="11" width="8" height="2" fill="white" />
    </svg>
  ),
  BronzeMedal: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="14" r="7" fill="#CD7F32" stroke="black" strokeWidth="2"/>
      <path d="M12 14L9 8H15L12 14Z" fill="black"/>
      <path d="M9 2L12 8" stroke="black" strokeWidth="2"/>
      <path d="M15 2L12 8" stroke="black" strokeWidth="2"/>
      <rect x="8" y="2" width="8" height="2" fill="#CD7F32" stroke="black" strokeWidth="2"/>
    </svg>
  ),
  Diamond: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 10L12 22L21 10L12 2Z" fill="#60A5FA" stroke="black" strokeWidth="2"/>
      <path d="M3 10H21" stroke="black" strokeWidth="2"/>
      <path d="M7.5 10L12 2" stroke="black" strokeWidth="1"/>
      <path d="M16.5 10L12 2" stroke="black" strokeWidth="1"/>
      <path d="M12 22L12 10" stroke="black" strokeWidth="1"/>
    </svg>
  ),
  // Updated: Single Blue Wave
  Surfboard: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 16C6 11 10 11 14 16C17 19 20 18 22 14V22H2V16Z" fill="#60A5FA" stroke="black" strokeWidth="2"/>
    </svg>
  ),
  GoldBar: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 14H20L18 20H2L4 14Z" fill="#FCD34D" stroke="black" strokeWidth="2"/>
      <path d="M6 8H22L20 14H4L6 8Z" fill="#FDE047" stroke="black" strokeWidth="2"/>
      <path d="M22 8L20 14L18 20" stroke="black" strokeWidth="2"/>
    </svg>
  ),
  PlatinumDisc: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" fill="#E2E8F0" stroke="black" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" fill="#94A3B8" stroke="black" strokeWidth="2"/>
      <path d="M12 2V8" stroke="black" strokeWidth="2"/>
      <path d="M12 16V22" stroke="black" strokeWidth="2"/>
      <path d="M2 12H8" stroke="black" strokeWidth="2"/>
      <path d="M16 12H22" stroke="black" strokeWidth="2"/>
    </svg>
  ),
  ObsidianBlock: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="16" height="16" fill="#1E293B" stroke="black" strokeWidth="2"/>
      <path d="M4 4L20 20" stroke="#475569" strokeWidth="2"/>
      <path d="M20 4L4 20" stroke="#475569" strokeWidth="2"/>
      <rect x="10" y="10" width="4" height="4" fill="#7C3AED" stroke="black" strokeWidth="2"/>
    </svg>
  ),
  PixelGrid: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" fill="white" stroke="black" strokeWidth="2"/>
      <path d="M2 12H22" stroke="black" strokeWidth="2"/>
      <path d="M12 2V22" stroke="black" strokeWidth="2"/>
      <rect x="12" y="2" width="10" height="10" fill="#FF90E8" stroke="black" strokeWidth="2"/>
    </svg>
  ),
  TokenCoin: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" fill="#FBBF24" stroke="black" strokeWidth="2"/>
      <text x="12" y="16" fontSize="12" fontWeight="900" textAnchor="middle" fill="black">T</text>
      <circle cx="12" cy="12" r="7" stroke="black" strokeWidth="2" strokeDasharray="2 2"/>
    </svg>
  ),
  // Updated: Just Crown
  Crown: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 18H22V14L18 4L12 14L6 4L2 14V18Z" fill="#FCD34D" stroke="black" strokeWidth="2"/>
      <circle cx="6" cy="14" r="1.5" fill="red" stroke="black"/>
      <circle cx="12" cy="10" r="1.5" fill="blue" stroke="black"/>
      <circle cx="18" cy="14" r="1.5" fill="green" stroke="black"/>
    </svg>
  ),
  Beetle: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 8H17V20C17 20 17 22 12 22C7 22 7 20 7 20V8Z" fill="#F87171" stroke="black" strokeWidth="2"/>
      <rect x="9" y="3" width="6" height="5" fill="black" />
      <path d="M7 10H2" stroke="black" strokeWidth="2"/>
      <path d="M17 10H22" stroke="black" strokeWidth="2"/>
      <path d="M7 14H2" stroke="black" strokeWidth="2"/>
      <path d="M17 14H22" stroke="black" strokeWidth="2"/>
      <path d="M12 8V22" stroke="black" strokeWidth="1"/>
    </svg>
  ),
  Wrench: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="8" width="16" height="12" fill="#EF4444" stroke="black" strokeWidth="2"/>
      <path d="M9 8V5H15V8" stroke="black" strokeWidth="2" fill="none"/>
      <rect x="11" y="12" width="2" height="4" fill="white" />
      <rect x="9" y="13" width="6" height="2" fill="white" />
    </svg>
  ),
  Lightning: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#FFFF00" stroke="black" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  ),
  YinYang: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" fill="white" stroke="black" strokeWidth="2"/>
      <path d="M12 3C7 3 7 12 12 12C17 12 17 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3Z" fill="black"/>
      <circle cx="12" cy="7.5" r="1.5" fill="black"/>
      <circle cx="12" cy="16.5" r="1.5" fill="white"/>
    </svg>
  ),
  Chat: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15C21 15.5523 20.5523 16 20 16H9L4 21V6C4 5.44772 4.44772 5 5 5H20C20.5523 5 21 5.44772 21 6V15Z" fill="#F472B6" stroke="black" strokeWidth="2"/>
      <path d="M8 10H17" stroke="black" strokeWidth="2"/>
      <path d="M8 13H14" stroke="black" strokeWidth="2"/>
    </svg>
  ),
  Megaphone: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 8L12 5V19L4 16H2V8H4Z" fill="#60A5FA" stroke="black" strokeWidth="2"/>
      <path d="M16 8C17 9 17 15 16 16" stroke="black" strokeWidth="2"/>
      <path d="M19 6C21 8 21 16 19 18" stroke="black" strokeWidth="2"/>
    </svg>
  ),
  Trophy: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6H18V10C18 13.3137 15.3137 16 12 16C8.68629 16 6 13.3137 6 10V6Z" fill="#FCD34D" stroke="black" strokeWidth="2"/>
      <path d="M6 7H2V9H6" stroke="black" strokeWidth="2"/>
      <path d="M18 7H22V9H18" stroke="black" strokeWidth="2"/>
      <rect x="10" y="16" width="4" height="4" fill="black"/>
      <rect x="8" y="20" width="8" height="2" fill="black"/>
    </svg>
  ),
  Eye: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" fill="white" stroke="black" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" fill="#818CF8" stroke="black" strokeWidth="2"/>
      <circle cx="12" cy="12" r="1.5" fill="black"/>
      <path d="M12 2V5" stroke="black" strokeWidth="2"/>
      <path d="M12 19V22" stroke="black" strokeWidth="2"/>
      <path d="M2 12H0" stroke="black" strokeWidth="2"/>
      <path d="M24 12H22" stroke="black" strokeWidth="2"/>
    </svg>
  )
};

export const Analytics: React.FC<Props> = ({ stats }) => {
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Gamification Logic
  // XP Formula: (Gen * 10) + (Audit * 5) + (Sync * 20) + (Invites * 50)
  const xp = 
    (stats.wireframesGenerated * 10) + 
    ((stats.analyzedA11y + stats.analyzedUX + stats.analyzedProto) * 5) + 
    ((stats.syncedStorybook + stats.syncedGithub + stats.syncedBitbucket) * 20) + 
    (stats.affiliatesCount * 50);

  const level = Math.floor(xp / 500) + 1;
  const nextLevelXp = level * 500;
  const progress = Math.min(100, ((xp - ((level - 1) * 500)) / 500) * 100);

  // Discount Logic: 5% every 5 levels, max 20%
  const discountPercent = Math.min(20, Math.floor(level / 5) * 5);

  const BADGES = [
    { id: 'LEAF', name: 'Novice Sprout', icon: <Icons.Sprout />, unlocked: xp > 0, desc: "Began the journey." },
    { id: 'ROCK', name: 'Solid Rock', icon: <Icons.Rock />, unlocked: xp > 500, desc: "Built a solid foundation (500 XP)." },
    { id: 'IRON', name: 'Iron Frame', icon: <Icons.IronIngot />, unlocked: stats.syncedStorybook > 10, desc: "Synced > 10 components." },
    { id: 'BRONZE', name: 'Bronze Auditor', icon: <Icons.BronzeMedal />, unlocked: (stats.analyzedA11y + stats.analyzedUX) > 50, desc: "Performed > 50 Audits." },
    { id: 'DIAMOND', name: 'Diamond Partner', icon: <Icons.Diamond />, unlocked: stats.affiliatesCount >= 5, desc: "Invited 5+ users." },
    
    { id: 'SILVER', name: 'Silver Surfer', icon: <Icons.Surfboard />, unlocked: xp > 1000, desc: "Crossed 1000 XP threshold." },
    { id: 'GOLD', name: 'Golden Standard', icon: <Icons.GoldBar />, unlocked: xp > 2500, desc: "Aesthetic perfection (2500 XP)." },
    { id: 'PLATINUM', name: 'Platinum Prod', icon: <Icons.PlatinumDisc />, unlocked: xp > 5000, desc: "Elite status achieved (5000 XP)." },
    { id: 'OBSIDIAN', name: 'Obsidian Mode', icon: <Icons.ObsidianBlock />, unlocked: stats.maxHealthScore === 100, desc: "Achieved 100% Health Score." },
    { id: 'PIXEL', name: 'Pixel Perfect', icon: <Icons.PixelGrid />, unlocked: stats.wireframesModified > 100, desc: "Refined 100+ wireframes." },
    
    { id: 'TOKEN', name: 'Token Master', icon: <Icons.TokenCoin />, unlocked: stats.syncedStorybook > 50, desc: "Synced 50+ tokens." },
    { id: 'SYSTEM', name: 'System Lord', icon: <Icons.Crown />, unlocked: xp > 7500, desc: "You rule the design system." },
    { id: 'BUG', name: 'Bug Hunter', icon: <Icons.Beetle />, unlocked: stats.analyzedA11y > 200, desc: "Fixed 200+ A11y issues." },
    { id: 'FIXER', name: 'The Fixer', icon: <Icons.Wrench />, unlocked: stats.wireframesGenerated > 500, desc: "Generated 500+ wireframes." },
    { id: 'SPEED', name: 'Speed Demon', icon: <Icons.Lightning />, unlocked: stats.syncedGithub > 50, desc: "50+ GitHub pushes." },
    
    { id: 'HARMONY', name: 'Harmonizer', icon: <Icons.YinYang />, unlocked: stats.maxHealthScore > 90, desc: "Maintained >90% Health." },
    { id: 'SOCIAL', name: 'Socialite', icon: <Icons.Chat />, unlocked: stats.affiliatesCount >= 10, desc: "Invited 10+ users." },
    { id: 'INFLUENCER', name: 'Influencer', icon: <Icons.Megaphone />, unlocked: stats.affiliatesCount >= 25, desc: "Invited 25+ users." },
    { id: 'LEGEND', name: 'Design Legend', icon: <Icons.Trophy />, unlocked: xp > 10000, desc: "10,000 XP. Legendary status." },
    { id: 'GOD', name: 'God Mode', icon: <Icons.Eye />, unlocked: xp > 20000, desc: "System singularity achieved." },
  ];

  const currentBadge = BADGES.find(b => b.id === selectedBadge);

  const handleShareBadge = (badgeName: string) => {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://comtra.ai')}&summary=${encodeURIComponent(`I just unlocked the ${badgeName} badge on Comtra! Level ${level} Design Engineer.`)}`, '_blank');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
  };

  const handleAddToLinkedIn = () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const certId = `COMTRA-LVL${level}-${xp}`;
      const name = `Level ${level} Design Engineer`;
      const orgName = 'Comtra AI';
      const url = `https://comtra.ai/verify/user`; // Mock URL

      const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(name)}&organizationName=${encodeURIComponent(orgName)}&issueYear=${year}&issueMonth=${month}&certId=${certId}&certUrl=${encodeURIComponent(url)}`;
      
      window.open(linkedinUrl, '_blank');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
  };

  return (
    <div className="p-4 pb-24 flex flex-col gap-6">
      {showConfetti && <Confetti />}

      {/* Header Level Card - Reduced Z-Index to avoid overlapping Navbar */}
      <div className={`${BRUTAL.card} bg-black text-white relative overflow-hidden`}>
          <div className="flex justify-between items-start mb-4 relative z-[1]">
              <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase text-[#ff90e8]">Current Rank</span>
                  <h2 className="text-3xl font-black uppercase leading-none">Level {level}</h2>
              </div>
              
              {/* Share Rank CTA */}
              <button 
                 onClick={handleAddToLinkedIn} 
                 className="bg-white text-black px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-[#ffc900] transition-colors flex items-center gap-1 shadow-[2px_2px_0_0_#fff]"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                 </svg>
                 ADD TO LINKEDIN
              </button>
          </div>
          
          <div className="text-right relative z-[1] mb-1">
              <span className="text-[10px] font-mono text-gray-400">{xp} XP / {nextLevelXp} XP</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-4 border-2 border-white p-0.5 bg-gray-900 rounded-sm relative z-[1]">
                <div 
                   className="h-full bg-[#ffc900] transition-all duration-500" 
                   style={{ width: `${progress}%` }}
                ></div>
          </div>
          
          {/* Discount Reward Text */}
          {discountPercent > 0 ? (
              <div className="mt-2 text-[9px] font-bold uppercase text-[#ffc900] relative z-[1]">
                  Current Reward: {discountPercent}% OFF Annual Plan
              </div>
          ) : (
              <div className="mt-2 text-[9px] font-bold uppercase text-gray-500 relative z-[1]">
                  Reach Level 5 to unlock Annual Plan discounts.
              </div>
          )}

          {/* Background Number - Lowest Z-index */}
          <div className="absolute top-0 right-0 opacity-10 text-9xl pointer-events-none z-[0]">
              {level}
          </div>
      </div>

      {/* Stats Widget */}
      <UserStatsWidget stats={stats} />

      {/* Badges Grid */}
      <div className={`${BRUTAL.card} bg-white`}>
          <h3 className="font-black uppercase text-sm mb-4 border-b-2 border-black pb-2 flex justify-between items-center">
              <span>Trophy Case</span>
              <span className="text-[10px] bg-black text-white px-2 py-0.5">{BADGES.filter(b => b.unlocked).length}/{BADGES.length}</span>
          </h3>
          
          <div className="grid grid-cols-3 gap-3">
              {BADGES.map(badge => (
                  <div 
                    key={badge.id}
                    onClick={() => setSelectedBadge(badge.id)}
                    className={`border-2 border-black p-2 flex flex-col items-center gap-2 text-center transition-all cursor-pointer hover:shadow-[4px_4px_0_0_#000] hover:-translate-y-1 ${badge.unlocked ? 'bg-white' : 'bg-gray-200 opacity-70 grayscale'}`}
                  >
                      <div className="scale-75 origin-center">{badge.icon}</div>
                      <span className="text-[9px] font-bold uppercase leading-tight truncate w-full">{badge.name}</span>
                  </div>
              ))}
          </div>
      </div>

      {/* Badge Modal */}
      {selectedBadge && currentBadge && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6" onClick={() => setSelectedBadge(null)}>
              <div className={`${BRUTAL.card} bg-white max-w-xs w-full text-center relative animate-in zoom-in-95`} onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedBadge(null); }} 
                    className="absolute top-2 right-2 text-2xl font-black hover:text-red-600 w-8 h-8 flex items-center justify-center border-2 border-transparent hover:border-black transition-all"
                  >
                    ×
                  </button>
                  
                  <div className={`flex justify-center mb-4 mt-6 scale-150 ${!currentBadge.unlocked ? 'grayscale opacity-70' : ''}`}>
                      {currentBadge.icon}
                  </div>
                  
                  <h3 className="text-xl font-black uppercase mb-2">{currentBadge.name}</h3>
                  <p className="text-xs font-medium text-gray-600 mb-6 px-4 leading-relaxed">
                      {currentBadge.desc}
                  </p>
                  
                  {currentBadge.unlocked ? (
                      <button 
                        onClick={() => handleShareBadge(currentBadge.name)}
                        className={`${BRUTAL.btn} w-full bg-[#0077b5] text-white border-black flex justify-center items-center gap-2`}
                      >
                          Share on LinkedIn
                      </button>
                  ) : (
                      <div className="bg-gray-200 text-gray-500 font-bold p-3 text-[10px] uppercase border-2 border-dashed border-gray-400">
                          Locked • Complete task to unlock
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
