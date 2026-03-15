-- Trophy descriptions: set all to English (plugin and API show these in UI).
-- Run after 007_admin_recharge.sql (or any previous migration).

UPDATE trophies SET description = 'First action completed (any).' WHERE id = 'NOVICE_SPROUT';
UPDATE trophies SET description = '10 audits completed.' WHERE id = 'SOLID_ROCK';
UPDATE trophies SET description = '50 wireframes generated.' WHERE id = 'IRON_FRAME';
UPDATE trophies SET description = '100 audits completed.' WHERE id = 'BRONZE_AUDITOR';
UPDATE trophies SET description = 'Health Score 95%+ on a file.' WHERE id = 'DIAMOND_PARSER';
UPDATE trophies SET description = '500 total XP earned.' WHERE id = 'SILVER_SURFER';
UPDATE trophies SET description = '50 consecutive fixes accepted without dismissing.' WHERE id = 'GOLDEN_STANDARD';
UPDATE trophies SET description = '2,000 total XP earned.' WHERE id = 'PLATINUM_PRODUCER';
UPDATE trophies SET description = '100 proto scans completed.' WHERE id = 'OBSIDIAN_MODE';
UPDATE trophies SET description = 'Health Score 100% on a file.' WHERE id = 'PIXEL_PERFECT';
UPDATE trophies SET description = '200 tokens/variables fixed via audit.' WHERE id = 'TOKEN_MASTER';
UPDATE trophies SET description = '5,000 total XP earned.' WHERE id = 'SYSTEM_LORD';
UPDATE trophies SET description = '50 bug/error reports submitted.' WHERE id = 'BUG_HUNTER';
UPDATE trophies SET description = '500 total fixes accepted.' WHERE id = 'THE_FIXER';
UPDATE trophies SET description = '10 audits completed in a single day.' WHERE id = 'SPEED_DEMON';
UPDATE trophies SET description = 'Used all 3 sync targets (Storybook + GitHub + Bitbucket).' WHERE id = 'HARMONIZER';
UPDATE trophies SET description = 'Shared profile on LinkedIn.' WHERE id = 'SOCIALITE';
UPDATE trophies SET description = '5 successful affiliate referrals.' WHERE id = 'INFLUENCER';
UPDATE trophies SET description = '10,000 total XP earned.' WHERE id = 'DESIGN_LEGEND';
UPDATE trophies SET description = 'All other 19 trophies unlocked.' WHERE id = 'GOD_MODE';
