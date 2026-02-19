
import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Audit } from './views/Audit';
import { Generate } from './views/Generate';
import { Code } from './views/Code';
import { Subscription } from './views/Subscription';
import { Documentation } from './views/Documentation';
import { Privacy } from './views/Privacy';
import { Terms } from './views/Terms';
import { Affiliate } from './views/Affiliate';
import { Analytics } from './views/Analytics';
import { UpgradeModal } from './components/UpgradeModal';
import { LoginModal } from './components/LoginModal';
import { ProfileSheet } from './components/ProfileSheet';
import { ViewState, UserPlan, User } from './types';

const MAX_FREE_USES_PER_TOOL = 3;

export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.AUDIT);
  const [user, setUser] = useState<User | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  
  // State for passing context from Audit to Generate
  const [genPrompt, setGenPrompt] = useState('');
  
  // Free Trial Usage State
  const [usage, setUsage] = useState({ gen: 0, code: 0, audit: 0 });

  const handleLogin = () => {
    // New user starts as FREE with Mock Stats
    setUser({ 
        name: 'Designer', 
        email: 'user@gmail.com', 
        avatar: 'D', 
        plan: 'FREE',
        stats: {
            maxHealthScore: 98,
            wireframesGenerated: 100,
            wireframesModified: 200,
            analyzedA11y: 100,
            analyzedUX: 200,
            analyzedProto: 400,
            syncedStorybook: 100,
            syncedGithub: 200,
            syncedBitbucket: 0,
            affiliatesCount: 3
        }
    });
    setShowLogin(false);
  };

  const handleLogout = () => {
    setUser(null);
    setShowProfile(false);
    setShowLogin(true);
    setView(ViewState.AUDIT);
    setUsage({ gen: 0, code: 0, audit: 0 }); // Reset local session usage on logout
    setGenPrompt('');
  };

  const handleUpgrade = (tier: string) => {
    if (user) setUser({ ...user, plan: 'PRO', tier });
    setShowUpgrade(false);
  };

  const handleUnlockRequest = () => {
    setShowUpgrade(true);
  };

  const handleOpenPrivacy = () => {
    setShowLogin(false);
    setView(ViewState.PRIVACY);
  };

  // Calculate global credits for Profile Menu
  const totalCredits = (MAX_FREE_USES_PER_TOOL - usage.audit) + (MAX_FREE_USES_PER_TOOL - usage.gen) + (MAX_FREE_USES_PER_TOOL - usage.code);
  const creditsLabel = user?.plan === 'PRO' ? '∞' : `${Math.max(0, totalCredits)}`;

  // If showing login but view is Privacy, don't show modal
  if (showLogin && view !== ViewState.PRIVACY) {
      return <LoginModal
        onLogin={handleLogin}
        onOpenPrivacy={handleOpenPrivacy}
      />;
  }

  return (
    <>
      <Layout 
        current={view} 
        setView={(v) => {
           // If user goes back from Privacy and was not logged in, show login again
           if (view === ViewState.PRIVACY && !user && v !== ViewState.PRIVACY) {
             setShowLogin(true);
           }
           setView(v);
        }} 
        user={user}
        onOpenProfile={() => setShowProfile(true)}
      >
        {view === ViewState.AUDIT && (
           <Audit 
              plan={user?.plan || 'FREE'} 
              userTier={user?.tier}
              onUnlockRequest={handleUnlockRequest}
              usageCount={usage.audit}
              onUse={() => setUsage(p => ({ ...p, audit: p.audit + 1 }))}
              onNavigateToGenerate={(prompt) => {
                  setGenPrompt(prompt);
                  setView(ViewState.GENERATE);
              }}
           />
        )}
        
        {view === ViewState.GENERATE && (
          <Generate 
            plan={user?.plan || 'FREE'} 
            userTier={user?.tier}
            onUnlockRequest={handleUnlockRequest} 
            usageCount={usage.gen}
            onUse={() => setUsage(p => ({ ...p, gen: p.gen + 1 }))}
            initialPrompt={genPrompt}
          />
        )}
        
        {view === ViewState.CODE && (
          <Code 
            plan={user?.plan || 'FREE'} 
            userTier={user?.tier}
            onUnlockRequest={handleUnlockRequest}
            usageCount={usage.code}
            onUse={() => setUsage(p => ({ ...p, code: p.code + 1 }))}
          />
        )}
        
        {view === ViewState.ANALYTICS && user && <Analytics stats={user.stats} />}
        
        {view === ViewState.SUBSCRIPTION && <Subscription user={user} onUpgrade={() => setShowUpgrade(true)} />}
        {view === ViewState.DOCUMENTATION && <Documentation />}
        {view === ViewState.PRIVACY && <Privacy />}
        {view === ViewState.TERMS && <Terms />}
        {view === ViewState.AFFILIATE && <Affiliate />}

        {showUpgrade && (
          <UpgradeModal onClose={() => setShowUpgrade(false)} onUpgrade={handleUpgrade} />
        )}

        {showProfile && user && (
          <ProfileSheet 
            user={user} 
            creditsLabel={creditsLabel}
            onClose={() => setShowProfile(false)} 
            onLogout={handleLogout}
            onManageSub={() => {
              setView(ViewState.SUBSCRIPTION);
              setShowProfile(false);
            }}
            onOpenDocs={() => {
              setView(ViewState.DOCUMENTATION);
              setShowProfile(false);
            }}
            onOpenPrivacy={() => {
              setView(ViewState.PRIVACY);
              setShowProfile(false);
            }}
            onOpenTerms={() => {
              setView(ViewState.TERMS);
              setShowProfile(false);
            }}
            onOpenAffiliate={() => {
              setView(ViewState.AFFILIATE);
              setShowProfile(false);
            }}
          />
        )}
      </Layout>
    </>
  );
}
