# Validation Record

This repository was reconstructed as a clean Next.js App Router project. It does not contain the old Vite application, a `RouterCompat` layer, or a legacy page wrapper.

## Completed in the generation environment

- Required project structure check
- Resolution of every local import
- Static import/export contract verification
- Parsing of all 71 JavaScript and JSX source modules
- Client dependency-graph check for accidental Firebase Admin, Node built-in, or Resend imports
- Node syntax checks for `next.config.mjs` and every administrative/import script
- Manual review of Firestore ownership, publication, reservation, modification, completion, review, Q&A, signup, verification, and claim rules

## Must be completed on the destination computer

The generation environment could not download npm dependencies: its internal registry did not contain Firebase, and a direct public-registry install timed out. For that reason, the real Next.js compiler could not be run here.

Run these commands from the folder containing `package.json`:

```powershell
npm install
npm run check
npm run build
npm run dev
```

After the development server starts, run in a second terminal:

```powershell
npm run test:smoke
```

Do not deploy until `npm run build` completes successfully and the role-by-role checklist in `TESTING.md` passes against a Firebase test project.
