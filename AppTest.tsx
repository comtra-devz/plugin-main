import React, { useState } from 'react';
import { Layout } from './components_test/Layout';
import { Audit } from './views_test/Audit';
import { Generate } from './views_test/Generate';
import { Code } from './views_test/Code';
import { Subscription } from './views_test/Subscription';
import { Documentation } from './views_test/Documentation';
import { Privacy } from './views_test/Privacy';
import { Landing } from './views_test/Landing';
import { UpgradeModal } from './components_test/UpgradeModal';
import { LoginModal } from './components_test/LoginModal';
import { ProfileSheet } from './components_test/ProfileSheet';
import { ViewState, UserPlan, User } from './types_test';

export default function AppTest() {
  const [view, setView] = useState<ViewState>(ViewState.AUDIT);
  const [user, setUser] = useState<User | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  
  // Free Trial Usage State
  const [usage, setUsage] = useState({ gen: 0, code: 0, audit: 0 });

  const handleLogin = () => {
    // New user starts as FREE
    setUser({ name: 'Designer', email: 'user@gmail.com', avatar: 'D', plan: 'FREE' });
    setShowLogin(false);
  };

  const handleLogout = () => {
    setUser(null);
    setShowProfile(false);
    setShowLogin(true);
    setView(ViewState.AUDIT);
    setUsage({ gen: 0, code: 0, audit: 0 }); // Reset local session usage on logout
  };

  const handleUpgrade = () => {
    if (user) setUser({ ...user, plan: 'PRO' });
    setShowUpgrade(false);
  };

  const handleUnlockRequest = () => {
    setShowUpgrade(true);
  };

  const handleOpenPrivacy = () => {
    setShowLogin(false);
    setView(ViewState.PRIVACY);
  };

  // Website Landing Page View (Outside Layout/Auth)
  if (view === ViewState.WEBSITE) {
    return <Landing onBack={() => { setView(ViewState.AUDIT); setShowLogin(true); }} />;
  }

  // If showing login but view is Privacy, don't show modal
  if (showLogin && view !== ViewState.PRIVACY) {
      return <LoginModal 
        onLogin={handleLogin} 
        onOpenPrivacy={handleOpenPrivacy} 
        onGoToWebsite={() => { setShowLogin(false); setView(ViewState.WEBSITE); }}
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
              onUnlockRequest={handleUnlockRequest}
              usageCount={usage.audit}
              onUse={() => setUsage(p => ({ ...p, audit: p.audit + 1 }))}
           />
        )}
        
        {view === ViewState.GENERATE && (
          <Generate 
            plan={user?.plan || 'FREE'} 
            onUnlockRequest={handleUnlockRequest} 
            usageCount={usage.gen}
            onUse={() => setUsage(p => ({ ...p, gen: p.gen + 1 }))}
          />
        )}
        
        {view === ViewState.CODE && (
          <Code 
            plan={user?.plan || 'FREE'} 
            onUnlockRequest={handleUnlockRequest}
            usageCount={usage.code}
            onUse={() => setUsage(p => ({ ...p, code: p.code + 1 }))}
          />
        )}
        
        {view === ViewState.SUBSCRIPTION && <Subscription user={user} onUpgrade={() => setShowUpgrade(true)} />}
        {view === ViewState.DOCUMENTATION && <Documentation />}
        {view === ViewState.PRIVACY && <Privacy />}

        {showUpgrade && (
          <UpgradeModal onClose={() => setShowUpgrade(false)} onUpgrade={handleUpgrade} />
        )}

        {showProfile && user && (
          <ProfileSheet 
            user={user} 
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
          />
        )}
      </Layout>
    </>
  );
}