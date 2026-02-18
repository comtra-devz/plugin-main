import React, { useState, useEffect } from 'react';
import { INITIAL_EDITORIAL_POSTS } from '../data';
import { EditorialPost, PostStatus, SocialPlatform } from '../types';

const BRUTAL = {
  input: `w-full border-2 border-black p-2 font-mono text-sm focus:bg-[#ffc900] outline-none transition-colors bg-white text-black`,
  label: `block text-[10px] font-bold uppercase mb-1 text-black`,
  tab: `px-4 py-2 text-xs font-bold uppercase border-2 border-black border-b-0 transition-all hover:bg-gray-100`
};

const STATUS_TABS: { id: string; label: string }[] = [
  { id: 'ALL', label: 'All Tasks' },
  { id: 'ANALYSIS', label: 'Proposals' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'DONE', label: 'Completed' },
  { id: 'SCHEDULED', label: 'Scheduled' }
];

const SOCIALS: { id: SocialPlatform; label: string; icon: string }[] = [
  { id: 'LINKEDIN', label: 'LinkedIn', icon: '💼' },
  { id: 'TWITTER', label: 'X / Twitter', icon: '🐦' },
  { id: 'INSTAGRAM', label: 'Instagram', icon: '📸' },
  { id: 'YOUTUBE', label: 'YouTube', icon: '▶️' }
];

export const EditorialView: React.FC = () => {
  // Main State (Source of Truth)
  const [posts, setPosts] = useState<EditorialPost[]>(INITIAL_EDITORIAL_POSTS);
  
  // Selection & Editing State
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  
  // Local Edit State (Buffer)
  const [localPost, setLocalPost] = useState<EditorialPost | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Filter Logic
  const filteredPosts = activeTab === 'ALL' 
    ? posts 
    : posts.filter(p => p.status === activeTab);

  // Effect: When selection changes, load into buffer. Check for unsaved changes first.
  const handleSelectPost = (id: string) => {
    if (hasChanges) {
      const confirmDiscard = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmDiscard) return;
    }
    const post = posts.find(p => p.id === id);
    if (post) {
      setLocalPost({ ...post }); // Deep copyish
      setSelectedPostId(id);
      setHasChanges(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
        const confirmDiscard = window.confirm("You have unsaved changes. Discard them?");
        if (!confirmDiscard) return;
    }
    setSelectedPostId(null);
    setLocalPost(null);
    setHasChanges(false);
  };

  const handleLocalUpdate = (field: keyof EditorialPost, value: any) => {
    if (!localPost) return;
    setLocalPost({ ...localPost, [field]: value });
    setHasChanges(true);
  };

  const toggleSocial = (social: SocialPlatform) => {
    if (!localPost) return;
    const current = localPost.socials || [];
    const updated = current.includes(social)
      ? current.filter(s => s !== social)
      : [...current, social];
    handleLocalUpdate('socials', updated);
  };

  const handleSave = () => {
    if (!localPost) return;
    setPosts(prev => prev.map(p => p.id === localPost.id ? localPost : p));
    setHasChanges(false);
    // Simulation of API Call
    console.log("Saved to DB:", localPost);
  };

  const handleDelete = () => {
      if(window.confirm("Are you sure you want to delete this post?")) {
          setPosts(prev => prev.filter(p => p.id !== selectedPostId));
          setSelectedPostId(null);
          setLocalPost(null);
          setHasChanges(false);
      }
  }

  const handleTabChange = (tabId: string) => {
      if (hasChanges) {
          const confirmDiscard = window.confirm("You have unsaved changes. Switch tab and discard?");
          if (!confirmDiscard) return;
      }
      setActiveTab(tabId);
      // Close sidebar on tab switch to avoid confusion
      setSelectedPostId(null);
      setLocalPost(null);
      setHasChanges(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      
      {/* HEADER: TABS */}
      <div className="flex border-b-2 border-black mb-0 overflow-x-auto no-scrollbar">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`${BRUTAL.tab} ${activeTab === tab.id ? 'bg-black text-white' : 'bg-white text-black'} whitespace-nowrap`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MAIN SPLIT VIEW */}
      <div className="flex flex-1 overflow-hidden border-2 border-black border-t-0 bg-white relative">
        
        {/* LEFT COLUMN: TABLE (Resizes on Desktop) */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 ${selectedPostId ? 'hidden md:block md:w-1/2 lg:w-3/5' : 'w-full'}`}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-black sticky top-0 z-10 border-b-2 border-black">
              <tr>
                <th className="p-3 text-xs font-bold uppercase border-r border-black/10">Status</th>
                <th className="p-3 text-xs font-bold uppercase border-r border-black/10 w-24">Date</th>
                <th className="p-3 text-xs font-bold uppercase border-r border-black/10">Title</th>
                <th className="p-3 text-xs font-bold uppercase border-r border-black/10">Socials</th>
                <th className="p-3 text-xs font-bold uppercase">Format</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map(post => (
                <tr 
                  key={post.id} 
                  onClick={() => handleSelectPost(post.id)}
                  className={`border-b border-black/10 cursor-pointer transition-colors group ${selectedPostId === post.id ? 'bg-[#ff90e8] text-black' : 'hover:bg-gray-50 text-black'}`}
                >
                  <td className="p-3 border-r border-black/10">
                    <span className={`text-[9px] font-bold px-2 py-1 border border-black uppercase bg-white text-black`}>
                      {post.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-[10px] font-mono border-r border-black/10">{post.date || '-'}</td>
                  <td className="p-3 text-sm font-bold border-r border-black/10">{post.title}</td>
                  <td className="p-3 border-r border-black/10">
                      <div className="flex gap-1">
                          {post.socials.slice(0, 2).map(s => (
                              <span key={s} className="text-[10px] bg-black text-white px-1 rounded-sm">{s[0]}</span>
                          ))}
                          {post.socials.length > 2 && <span className="text-[10px] text-gray-500">+{post.socials.length - 2}</span>}
                      </div>
                  </td>
                  <td className="p-3 text-xs font-mono">{post.format}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT COLUMN: SIDEBAR (Full on Mobile, Side on Desktop) */}
        {localPost && (
          <div className={`absolute inset-0 md:static md:w-1/2 lg:w-2/5 bg-white md:border-l-2 md:border-black flex flex-col z-20 md:z-auto animate-in slide-in-from-right duration-300 shadow-[-10px_0_20px_rgba(0,0,0,0.1)] md:shadow-none`}>
            
            {/* Toolbar */}
            <div className="p-4 border-b-2 border-black bg-gray-50 flex justify-between items-center shrink-0">
              <span className="text-xs font-mono bg-black text-white px-2 py-1">ID: {localPost.id}</span>
              <div className="flex gap-2">
                  <button onClick={handleDelete} className="text-[10px] font-bold text-red-600 hover:underline uppercase px-2">Delete</button>
                  <button onClick={handleClose} className="text-sm font-bold border-2 border-black px-2 hover:bg-gray-200 uppercase bg-white">Close</button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 bg-[#fdfdfd]">
              
              <div>
                <label className={BRUTAL.label}>Task Status (Kanban)</label>
                <select 
                  value={localPost.status} 
                  onChange={(e) => handleLocalUpdate('status', e.target.value)}
                  className={`${BRUTAL.input} font-bold uppercase`}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ANALYSIS">Proposal / Analysis</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>

              <div>
                <label className={BRUTAL.label}>Title / Headline</label>
                <input 
                  type="text" 
                  value={localPost.title} 
                  onChange={(e) => handleLocalUpdate('title', e.target.value)}
                  className={`${BRUTAL.input} text-lg font-black`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={BRUTAL.label}>Publish Date</label>
                  <input 
                    type="date" 
                    value={localPost.date} 
                    onChange={(e) => handleLocalUpdate('date', e.target.value)}
                    className={BRUTAL.input}
                  />
                </div>
                <div>
                  <label className={BRUTAL.label}>Format</label>
                  <select 
                    value={localPost.format} 
                    onChange={(e) => handleLocalUpdate('format', e.target.value)}
                    className={BRUTAL.input}
                  >
                    <option value="VIDEO">Video</option>
                    <option value="IMAGE">Image</option>
                    <option value="CAROUSEL">Carousel</option>
                    <option value="TEXT">Text Only</option>
                  </select>
                </div>
              </div>

              {/* Social Multi-Select */}
              <div>
                  <label className={BRUTAL.label}>Destination Channels</label>
                  <div className="flex flex-wrap gap-2">
                      {SOCIALS.map(social => {
                          const isSelected = localPost.socials.includes(social.id);
                          return (
                              <button 
                                key={social.id}
                                onClick={() => toggleSocial(social.id)}
                                className={`text-[10px] px-2 py-1 border border-black font-bold uppercase flex items-center gap-1 transition-all ${isSelected ? 'bg-black text-white shadow-[2px_2px_0_0_#ff90e8]' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                              >
                                  <span>{social.icon}</span>
                                  {social.label}
                              </button>
                          )
                      })}
                  </div>
              </div>

              <div>
                <label className={BRUTAL.label}>English Copy / Prompt</label>
                <div className="relative">
                    <textarea 
                    value={localPost.copy} 
                    onChange={(e) => handleLocalUpdate('copy', e.target.value)}
                    className={`${BRUTAL.input} min-h-[150px] leading-relaxed resize-y`}
                    />
                    <button className="absolute bottom-2 right-2 text-[9px] bg-[#ff90e8] border border-black px-2 py-1 font-bold uppercase hover:bg-white transition-colors" title="Coming Soon: Generate with Gemini">
                        ✨ AI Improve
                    </button>
                </div>
              </div>

              <div>
                <label className={BRUTAL.label}>Reference Material</label>
                <input 
                  type="text" 
                  value={localPost.referenceLink || ''} 
                  onChange={(e) => handleLocalUpdate('referenceLink', e.target.value)}
                  className={BRUTAL.input}
                  placeholder="https://dribbble.com/..."
                />
                {localPost.referenceLink && (
                    <a href={localPost.referenceLink} target="_blank" rel="noreferrer" className="text-[9px] font-bold underline mt-1 block hover:text-blue-600">Open Reference ↗</a>
                )}
              </div>

              <div>
                <label className={BRUTAL.label}>Asset Link</label>
                <input 
                  type="text" 
                  value={localPost.media} 
                  onChange={(e) => handleLocalUpdate('media', e.target.value)}
                  className={BRUTAL.input}
                  placeholder="https://drive.google.com/..."
                />
              </div>

            </div>

            {/* Sticky Footer Action */}
            <div className="p-4 border-t-2 border-black bg-white">
                <button 
                    onClick={handleSave} 
                    disabled={!hasChanges}
                    className={`w-full py-3 text-sm font-black uppercase border-2 border-black shadow-[4px_4px_0_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all flex justify-center items-center gap-2 ${hasChanges ? 'bg-[#ffc900] text-black cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                    {hasChanges ? 'Save Changes' : 'No Changes'}
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};