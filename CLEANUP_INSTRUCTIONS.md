# Cleanup Instructions

The project structure has been successfully separated into `PROD` and `TESTING` environments.
The root directory still contains legacy files that have been cloned into these folders.

## Safe to Delete
You can safely delete the following files and folders from the root directory:

**Folders:**
- `components/`
- `views/`
- `services/`
- `docs/` (Content has been moved to `PROD/docs`)
- `components_test/`
- `views_test/`
- `services_test/`

**Files:**
- `App.tsx`
- `AppTest.tsx`
- `constants.ts`
- `types.ts`
- `constants_test.ts`
- `types_test.ts`

## Do Not Delete
Keep these files in the root for the development environment to function:
- `index.tsx`
- `index.html`
- `metadata.json`
- `Launcher.tsx`
- `controller.ts` (Used as the development controller entry point)
- `PROD/`
- `TESTING/`
