
import React from 'react';

export type FolderType = 'BRAND' | 'COMPETITORS' | 'EDITORIAL' | 'USP' | 'SUSTAINABILITY';
export type PostStatus = 'DRAFT' | 'ANALYSIS' | 'IN_PROGRESS' | 'DONE' | 'SCHEDULED' | 'PUBLISHED';
export type SocialPlatform = 'LINKEDIN' | 'TWITTER' | 'INSTAGRAM' | 'YOUTUBE' | 'BLOG';

export interface StrategyCard {
  id: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  content: React.ReactNode;
  tags: string[];
}

export interface EditorialPost {
  id: string;
  title: string;
  date: string;
  status: PostStatus;
  goal: string;
  copy: string;
  media: string;
  referenceLink?: string;
  socials: SocialPlatform[];
  format: 'VIDEO' | 'IMAGE' | 'TEXT' | 'CAROUSEL';
}
