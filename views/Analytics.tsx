
import React, { useState } from 'react';
import { BRUTAL, AUTH_BACKEND_URL, LINKEDIN_TROPHY_SHARE_BASE, LINKEDIN_FOOTER_LINK } from '../constants';
import { Button } from '../components/ui/Button';
import { getCanonicalTrophyId, getLinkedInPostForTrophy } from '../linkedinTrophyPosts';
import { User, UserStats, Trophy } from '../types';
import { UserStatsWidget } from '../components/UserStatsWidget';
import { Confetti } from '../components/Confetti';
import { useToast } from '../contexts/ToastContext';

export interface RecentTransaction {
  action_type: string;
  credits_consumed: number;
  created_at: string;
}

interface Props {
  user?: User | null;
  stats: UserStats;
  trophies?: Trophy[] | null;
  recentTransactions?: RecentTransaction[];
  onLinkedInShare?: () => Promise<void>;
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

const ICON_ID_TO_COMPONENT: Record<string, React.ReactNode> = {
  SPROUT: <Icons.Sprout />,
  ROCK: <Icons.Rock />,
  IRON: <Icons.IronIngot />,
  BRONZE: <Icons.BronzeMedal />,
  DIAMOND: <Icons.Diamond />,
  SILVER: <Icons.Surfboard />,
  GOLD: <Icons.GoldBar />,
  PLATINUM: <Icons.PlatinumDisc />,
  OBSIDIAN: <Icons.ObsidianBlock />,
  PIXEL: <Icons.PixelGrid />,
  TOKEN: <Icons.TokenCoin />,
  SYSTEM: <Icons.Crown />,
  BUG: <Icons.Beetle />,
  FIXER: <Icons.Wrench />,
  SPEED: <Icons.Lightning />,
  HARMONY: <Icons.YinYang />,
  SOCIAL: <Icons.Chat />,
  INFLUENCER: <Icons.Megaphone />,
  LEGEND: <Icons.Trophy />,
  GOD: <Icons.Eye />,
};

const ACTION_LABELS: Record<string, string> = {
  audit: 'Design System Audit',
  scan: 'Design System Scan',
  a11y_audit: 'A11y Audit',
  a11y_check: 'A11y Check',
  ux_audit: 'UX Audit',
  proto_audit: 'Prototype Audit',
  proto_scan: 'Proto Scan',
  generate: 'Generate (AI)',
  enhance_plus: 'Enhance Plus (prompt)',
  wireframe_gen: 'Wireframe generation',
  wireframe_modified: 'Wireframe modified',
  code_gen_free: 'Code export (free)',
  code_gen: 'Code generation',
  code_gen_ai: 'AI Code generation',
  sync_storybook: 'Sync Storybook',
  sync_github: 'Sync GitHub',
  sync_bitbucket: 'Sync Bitbucket',
  scan_sync: 'Sync Scan',
  sync_fix: 'Sync Fix',
  token_css: 'Token CSS',
  token_json: 'Token JSON',
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export const Analytics: React.FC<Props> = ({ user, stats, trophies: trophiesFromApi, recentTransactions = [], onLinkedInShare }) => {
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shareCopyFeedback, setShareCopyFeedback] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardCode, setRewardCode] = useState<string | null>(null);
  const [rewardPercent, setRewardPercent] = useState<number>(0);
  const [rewardLevel, setRewardLevel] = useState<number>(0);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const { showToast, dismissToast } = useToast();

  // Livello e XP: da backend (user) se presenti, altrimenti fallback da stats
  const level = user?.current_level ?? 1;
  const xp = user?.total_xp ?? (
    (stats.wireframesGenerated * 10) +
    ((stats.analyzedA11y + stats.analyzedUX + stats.analyzedProto) * 5) +
    ((stats.syncedStorybook + stats.syncedGithub + stats.syncedBitbucket) * 20) +
    (stats.affiliatesCount * 50)
  );
  const nextLevelXp = user?.xp_for_next_level ?? 100;
  const xpCurrentStart = user?.xp_for_current_level_start ?? 0;
  const xpSegmentSize = nextLevelXp > xpCurrentStart ? nextLevelXp - xpCurrentStart : 1;
  const xpIntoLevel = Math.max(0, xp - xpCurrentStart);
  const progress = nextLevelXp > xpCurrentStart
    ? Math.min(100, (xpIntoLevel / xpSegmentSize) * 100)
    : 100;

  // Discount Logic: 5% every 5 levels, max 20%
  const discountPercent = Math.min(20, Math.floor(level / 5) * 5);

  const BADGES_FALLBACK = [
    { id: 'LEAF', name: 'Novice Sprout', icon: <Icons.Sprout />, unlocked: xp > 0, desc: "Began the journey." },
    { id: 'ROCK', name: 'Solid Rock', icon: <Icons.Rock />, unlocked: xp > 500, desc: "Built a solid foundation (500 XP)." },
    { id: 'IRON', name: 'Iron Frame', icon: <Icons.IronIngot />, unlocked: stats.syncedStorybook > 10, desc: "Synced > 10 components." },
    { id: 'BRONZE', name: 'Bronze Auditor', icon: <Icons.BronzeMedal />, unlocked: (stats.analyzedA11y + stats.analyzedUX) > 50, desc: "Performed > 50 Audits." },
    // Affiliate-related badges postponed for post-MVP; keep core progression only
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
    { id: 'LEGEND', name: 'Design Legend', icon: <Icons.Trophy />, unlocked: xp > 10000, desc: "10,000 XP. Legendary status." },
    { id: 'GOD', name: 'God Mode', icon: <Icons.Eye />, unlocked: xp > 20000, desc: "System singularity achieved." },
  ];

  const BADGES = trophiesFromApi && trophiesFromApi.length > 0
    ? trophiesFromApi.map(t => ({
        id: t.id,
        name: t.name,
        icon: ICON_ID_TO_COMPONENT[t.icon_id] ?? <Icons.Sprout />,
        unlocked: t.unlocked,
        desc: t.description,
      }))
    : BADGES_FALLBACK;

  const currentBadge = BADGES.find(b => b.id === selectedBadge);

  const handleShareBadge = async (badgeId: string) => {
      const canonicalId = getCanonicalTrophyId(badgeId);
      const shareUrl = `${LINKEDIN_TROPHY_SHARE_BASE}${canonicalId}`;
      const postText = getLinkedInPostForTrophy(badgeId, LINKEDIN_FOOTER_LINK);
      try {
        await navigator.clipboard.writeText(postText);
        setShareCopyFeedback(true);
        setTimeout(() => setShareCopyFeedback(false), 4000);
      } catch (_) {}
      if (user?.authToken) {
        fetch(`${AUTH_BACKEND_URL}/api/tracking/linkedin-share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
          body: JSON.stringify({ trophy_id: canonicalId }),
        }).catch(() => {});
      }
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
  };

  const handleAddToLinkedIn = async () => {
      if (onLinkedInShare) await onLinkedInShare();
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const certId = `COMTRA-LVL${level}-${xp}`;
      const name = `Level ${level} Design Engineer`;
      const orgName = 'Comtra AI';
      const url = `https://comtra.dev/verify/user`;

      const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(name)}&organizationName=${encodeURIComponent(orgName)}&issueYear=${year}&issueMonth=${month}&certId=${certId}&certUrl=${encodeURIComponent(url)}`;
      window.open(linkedinUrl, '_blank');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
  };

  const handleOpenRewardModal = async () => {
    if (!user?.authToken) {
      setRewardError('Log in required to load your discount code.');
      setShowRewardModal(true);
      return;
    }
    setRewardLoading(true);
    setRewardError(null);
    setRewardCode(null);
    try {
      const r = await fetch(`${AUTH_BACKEND_URL}/api/discounts/me`, {
        headers: { Authorization: `Bearer ${user.authToken}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      if (data?.locked_until_renewal) {
        setRewardError('You already used a discount. Next code unlocks after your next paid renewal.');
      } else
      if (data?.code) {
        setRewardCode(String(data.code));
        setRewardPercent(Number(data.percent) || discountPercent);
        setRewardLevel(Number(data.level) || level);
      } else {
        setRewardError('No active level discount code found yet.');
      }
    } catch (_) {
      setRewardError('Cannot load your discount code right now. Please retry.');
    } finally {
      setRewardLoading(false);
      setShowRewardModal(true);
    }
  };

  const handleCopyRewardCode = async () => {
    if (!rewardCode) return;
    try {
      await navigator.clipboard.writeText(rewardCode);
      const toastId = showToast({
        title: 'Code copied',
        description: 'Paste it at checkout on your next upgrade — it stays in clipboard until you overwrite it.',
        dismissible: false,
        variant: 'info',
      });
      window.setTimeout(() => dismissToast(toastId), 1100);
    } catch (_) {
      const toastId = showToast({
        title: 'Clipboard blocked',
        description:
          'This environment blocked automatic copy. Select the code in this screen and press ⌘C / Ctrl+C, or type it at checkout.',
        dismissible: false,
        variant: 'warning',
      });
      window.setTimeout(() => dismissToast(toastId), 1400);
    }
  };

  return (
    <div className="p-4 pb-16 flex flex-col gap-6">
      {showConfetti && <Confetti />}

      {/* Header Level Card - sfondo scuro (non usare BRUTAL.card che include bg-white) */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4 bg-black text-white relative overflow-hidden">
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
              <span className="text-[10px] font-mono text-gray-400">
                {nextLevelXp > xpCurrentStart
                  ? `${xpIntoLevel} / ${xpSegmentSize} XP → L${level + 1}`
                  : `${xp} XP`}
              </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-4 border-2 border-white p-0.5 bg-gray-900 rounded-sm relative z-[1]">
                <div 
                   className="h-full bg-[#ffc900] transition-all duration-500" 
                   style={{ width: `${progress}%` }}
                ></div>
          </div>
          
          {/* Discount reward row: single 24px-tall hit target (text + arrow) */}
          {discountPercent > 0 ? (
              <button
                type="button"
                onClick={handleOpenRewardModal}
                className="mt-2 pt-1 min-h-[24px] w-full text-left text-[9px] font-bold uppercase text-[#ffc900] relative z-[1] flex items-center justify-start gap-1.5 hover:opacity-90 active:opacity-80"
                title="Show discount code"
                aria-label={`Current reward ${discountPercent}% off annual plan — show code`}
              >
                  <span className="leading-tight">Current Reward: {discountPercent}% OFF Annual Plan</span>
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M7 17L17 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
                      <path d="M9 7H17V15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
                    </svg>
                  </span>
              </button>
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

      {/* Recent activity */}
      {recentTransactions.length > 0 && (
        <div className={`${BRUTAL.card} bg-white`}>
          <h3 className="font-black uppercase text-sm mb-4 border-b-2 border-black pb-2">Recent activity</h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
            {recentTransactions.map((tx, i) => (
              <li key={i} className="flex items-center gap-3 text-[10px] border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <span className="font-bold uppercase min-w-0 truncate flex-1">{ACTION_LABELS[tx.action_type] ?? tx.action_type}</span>
                <span className="text-gray-500 font-mono w-10 text-right shrink-0">{tx.credits_consumed} cr</span>
                <span className="text-gray-400 shrink-0 w-14 text-right">{formatRelativeTime(tx.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Badge Modal */}
      {selectedBadge && currentBadge && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6" onClick={() => setSelectedBadge(null)}>
              <div className={`${BRUTAL.card} bg-white max-w-xs w-full text-center relative animate-in zoom-in-95`} onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedBadge(null); }} 
                    className="absolute top-3 right-2 text-2xl font-black hover:text-red-600 w-8 h-8 flex items-center justify-center border-2 border-transparent hover:border-black transition-all"
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
                      <>
                        <Button
                          variant="black"
                          fullWidth
                          layout="row"
                          onClick={() => handleShareBadge(currentBadge.id)}
                          className="!bg-[#0077b5] hover:!bg-[#006097]"
                        >
                          Share on LinkedIn
                        </Button>
                        <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                          We copy the post text for you — paste it in the LinkedIn window (Ctrl+V / Cmd+V). You can tag @Comtra in your post if you’d like.
                        </p>
                        {shareCopyFeedback && (
                          <p className="text-[10px] font-bold text-green-700 mt-1">Copied! Paste in the LinkedIn window.</p>
                        )}
                      </>
                  ) : (
                      <div className="bg-gray-200 text-gray-500 font-bold p-3 text-[10px] uppercase border-2 border-dashed border-gray-400">
                          Locked • Complete task to unlock
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* Discount code quick access modal */}
      {showRewardModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6" onClick={() => setShowRewardModal(false)}>
          <div className={`${BRUTAL.card} bg-white max-w-xs w-full text-left relative animate-in zoom-in-95`} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowRewardModal(false)}
              className="absolute top-2 right-2 text-xl font-black hover:text-red-600 w-8 h-8 flex items-center justify-center"
              aria-label="Close discount code dialog"
            >
              ×
            </button>
            <h3 className="text-lg font-black uppercase pr-8">Your Reward Code</h3>
            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
              Use this code on your next Lemon Squeezy checkout to apply your annual plan discount.
              {rewardCode && rewardPercent > 0 ? ` (Level ${rewardLevel} · ${rewardPercent}% off)` : ''}
            </p>

            <div className="mt-4">
              {rewardLoading ? (
                <div className="text-[10px] font-bold uppercase text-gray-500">Loading code...</div>
              ) : rewardCode ? (
                <div className="flex items-center border-2 border-black bg-white">
                  <input
                    type="text"
                    readOnly
                    value={rewardCode}
                    className="w-full px-2 py-2 text-[12px] font-mono font-bold outline-none"
                    aria-label="Discount code"
                  />
                  <button
                    type="button"
                    onClick={handleCopyRewardCode}
                    className="w-10 h-10 border-l-2 border-black flex items-center justify-center hover:bg-[#ffc900] transition-colors"
                    aria-label="Copy discount code"
                    title="Copy code"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="11" height="11" stroke="black" strokeWidth="2" />
                      <path d="M5 15V5H15" stroke="black" strokeWidth="2" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="text-[10px] font-bold uppercase text-red-600">
                  {rewardError || 'No code available yet.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
