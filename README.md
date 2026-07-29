# Who Is Most Likely To?

An anonymous team-superlatives survey with 34 required questions, 27 nominees,
and a PIN-protected results dashboard.

**Live site:** [most-likely-to-team.vercel.app](https://most-likely-to-team.vercel.app)

## Features

- Anonymous, sign-in-free voting
- Every question must be answered before submission
- Dedicated submission confirmation screen
- PIN-protected results tab
- PIN-protected Host control panel
- Separate test ballots that never affect live totals
- One-click 81-ballot chart stress test covering all 27 nominees
- Persistent voting and results-publication state
- Recoverable real-ballot deletion
- Winner, vote total, count, percentage, and pie chart for every question
- Persistent Turso database storage
- Responsive layout for phones and desktops

The application stores only a random submission ID, timestamp, question number,
and selected nominee. It does not ask for or store a voter name or email.

## Local development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Create a local environment file with:

```text
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
RESULTS_PIN=
HOST_PIN=
HOST_SESSION_SECRET=
```

Run `npm run build` to verify a production build.

## Deployment

The project is connected to Vercel and a Turso Starter database. Production and
preview deployments receive their database credentials and results PIN through
Vercel environment variables.
