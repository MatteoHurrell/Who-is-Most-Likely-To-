"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { nominees, questions } from "../data/survey";

type View = "survey" | "results" | "host";
type BallotMode = "real" | "test";
type ResultsDataset = "real" | "test";

type NomineeResult = {
  name: string;
  votes: number;
  percentage: number;
};

type QuestionResult = {
  questionId: number;
  totalVotes: number;
  winnerNames: string[];
  nominees: NomineeResult[];
};

type PublicState = {
  votingOpen: boolean;
  resultsPublic: boolean;
};

type HostState = PublicState & {
  liveBallots: number;
  testBallots: number;
  archiveBatches: number;
  archivedBallots: number;
  updatedAt: number;
};

type HostAction =
  | "publish_results"
  | "hide_results"
  | "open_voting"
  | "close_voting"
  | "reset_test_data"
  | "delete_real_ballots"
  | "restore_real_ballots";

const nomineeColors: Record<string, string> = {
  Aadit: "#224B8F",
  Ainsley: "#F28E2B",
  Alex: "#E15759",
  Brooke: "#4E9D91",
  Caitlin: "#7A5AA6",
  Chris: "#59A14F",
  Cole: "#EDC948",
  Dani: "#B07AA1",
  Emery: "#FF9DA7",
  Ethan: "#9C755F",
  Griffin: "#2F7FAD",
  Isaiah: "#D66BA0",
  Jackson: "#6A994E",
  Jake: "#E76F51",
  Jenny: "#3A86A8",
  John: "#845EC2",
  Katie: "#C49A00",
  Luciano: "#00876C",
  Matteo: "#C44536",
  Merwan: "#6C5B7B",
  Miles: "#1D7874",
  "Noah H": "#BC6C25",
  "Noah T": "#577590",
  Rachel: "#D1495B",
  Sam: "#43AA8B",
  Sophia: "#8F5D5D",
  Vincent: "#5C6F68",
};

function buildPieGradient(items: NomineeResult[]) {
  let cursor = 0;
  const segments = items.map((item) => {
    const start = cursor;
    cursor += item.percentage;
    return `${nomineeColors[item.name]} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 10V7a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6M6 14v6" />
    </svg>
  );
}

export function SurveyApp() {
  const [view, setView] = useState<View>("survey");
  const [menuOpen, setMenuOpen] = useState(false);
  const [ballotMode, setBallotMode] = useState<BallotMode>("real");
  const [answers, setAnswers] = useState<string[]>(
    Array(questions.length).fill(""),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [publicState, setPublicState] = useState<PublicState | null>(null);

  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [pinError, setPinError] = useState("");
  const [results, setResults] = useState<QuestionResult[] | null>(null);
  const [resultsDataset, setResultsDataset] =
    useState<ResultsDataset>("real");
  const [resultsLoading, setResultsLoading] = useState(false);

  const [hostPin, setHostPin] = useState("");
  const [hostAuthenticated, setHostAuthenticated] = useState(false);
  const [hostState, setHostState] = useState<HostState | null>(null);
  const [hostLoading, setHostLoading] = useState(false);
  const [hostError, setHostError] = useState("");
  const [activeHostAction, setActiveHostAction] = useState<HostAction | null>(
    null,
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const answeredCount = useMemo(
    () => answers.filter(Boolean).length,
    [answers],
  );
  const allAnswered = answeredCount === questions.length;
  const progress = Math.round((answeredCount / questions.length) * 100);

  useEffect(() => {
    void refreshPublicState();
  }, []);

  async function refreshPublicState() {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) return;
      setPublicState((await response.json()) as PublicState);
    } catch {
      // The submission endpoint still enforces the authoritative state.
    }
  }

  function clearPrivateResults() {
    setResults(null);
    setResultsDataset("real");
    setPin("");
    setPinError("");
  }

  async function chooseView(nextView: View) {
    if (view === "results" && nextView !== "results") {
      clearPrivateResults();
    }

    setView(nextView);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (nextView === "survey") {
      if (ballotMode === "test") {
        resetBallot("real");
      } else {
        setBallotMode("real");
      }
      await refreshPublicState();
    }
    if (nextView === "results") {
      await openPublicResults();
    }
    if (nextView === "host") {
      await loadHostState();
    }
  }

  function resetBallot(mode: BallotMode) {
    setAnswers(Array(questions.length).fill(""));
    setSubmitted(false);
    setSubmitError("");
    setBallotMode(mode);
  }

  function updateAnswer(index: number, value: string) {
    setAnswers((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setSubmitError("");
  }

  async function submitSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allAnswered || submitting) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, mode: ballotMode }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(
          payload.error ?? "We couldn’t save your answers. Please try again.",
        );
      }

      setSubmitted(true);
      if (ballotMode === "real") await refreshPublicState();
      if (ballotMode === "test" && hostAuthenticated) await loadHostState();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We couldn’t save your answers. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function openPublicResults() {
    setResultsLoading(true);
    setPinError("");
    setResults(null);
    setResultsDataset("real");

    try {
      const response = await fetch("/api/results", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as {
          results: QuestionResult[];
        };
        setResults(payload.results);
      }
    } finally {
      setResultsLoading(false);
    }
  }

  async function unlockResults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pin.length !== 4 || unlocking) return;

    setUnlocking(true);
    setPinError("");

    try {
      const response = await fetch("/api/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (response.status === 401) {
        setPinError("That PIN isn’t right. Try again.");
        return;
      }
      if (!response.ok) {
        throw new Error("Results are unavailable right now. Please try again.");
      }

      const payload = (await response.json()) as {
        results: QuestionResult[];
      };
      setResults(payload.results);
      setResultsDataset("real");
      setPin("");
    } catch (error) {
      setPinError(
        error instanceof Error
          ? error.message
          : "Results are unavailable right now. Please try again.",
      );
    } finally {
      setUnlocking(false);
    }
  }

  async function loadHostState() {
    setHostLoading(true);
    setHostError("");
    try {
      const response = await fetch("/api/host", { cache: "no-store" });
      if (response.status === 401) {
        setHostAuthenticated(false);
        setHostState(null);
        return;
      }
      if (!response.ok) throw new Error("Host controls are unavailable.");
      const state = (await response.json()) as HostState;
      setHostAuthenticated(true);
      setHostState(state);
    } catch (error) {
      setHostError(
        error instanceof Error ? error.message : "Host controls are unavailable.",
      );
    } finally {
      setHostLoading(false);
    }
  }

  async function loginHost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hostPin.length !== 5 || hostLoading) return;

    setHostLoading(true);
    setHostError("");
    try {
      const response = await fetch("/api/host/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: hostPin }),
      });
      if (response.status === 401) {
        setHostError("That host PIN isn’t right.");
        return;
      }
      if (!response.ok) throw new Error("Host access is unavailable.");
      setHostPin("");
      setHostAuthenticated(true);
      await loadHostState();
    } catch (error) {
      setHostError(
        error instanceof Error ? error.message : "Host access is unavailable.",
      );
    } finally {
      setHostLoading(false);
    }
  }

  async function logoutHost() {
    await fetch("/api/host/logout", { method: "POST" });
    setHostAuthenticated(false);
    setHostState(null);
    setHostPin("");
  }

  async function runHostAction(
    action: HostAction,
    confirmation?: string,
  ) {
    setActiveHostAction(action);
    setHostError("");
    try {
      const response = await fetch("/api/host", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, confirmation }),
      });
      const payload = (await response.json()) as HostState & { error?: string };

      if (response.status === 401) {
        setHostAuthenticated(false);
        setHostState(null);
        throw new Error("Your host session expired. Enter the PIN again.");
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "The host action failed.");
      }

      setHostState(payload);
      setPublicState({
        votingOpen: payload.votingOpen,
        resultsPublic: payload.resultsPublic,
      });
      if (action === "delete_real_ballots") setDeleteConfirmation("");
    } catch (error) {
      setHostError(
        error instanceof Error ? error.message : "The host action failed.",
      );
    } finally {
      setActiveHostAction(null);
    }
  }

  function startTestBallot() {
    resetBallot("test");
    setView("survey");
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function previewHostResults(dataset: ResultsDataset) {
    setResultsLoading(true);
    setHostError("");
    try {
      const response = await fetch(`/api/host/results?dataset=${dataset}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        setHostAuthenticated(false);
        setHostState(null);
        throw new Error("Your host session expired. Enter the PIN again.");
      }
      if (!response.ok) throw new Error("Results are unavailable.");
      const payload = (await response.json()) as {
        results: QuestionResult[];
      };
      setResults(payload.results);
      setResultsDataset(dataset);
      setView("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setHostError(
        error instanceof Error ? error.message : "Results are unavailable.",
      );
    } finally {
      setResultsLoading(false);
    }
  }

  const votingOpen = publicState?.votingOpen ?? true;

  return (
    <div className="app-shell">
      <button
        className="mobile-menu"
        type="button"
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
      </button>

      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">ML</span>
          <div>
            <strong>Most Likely To</strong>
            <small>Team superlatives</small>
          </div>
        </div>

        <nav aria-label="Survey navigation">
          <button
            type="button"
            className={view === "survey" ? "active" : ""}
            onClick={() => void chooseView("survey")}
          >
            <span className="nav-number">01</span>
            <span>
              <strong>Take the survey</strong>
              <small>{votingOpen ? "34 questions" : "Voting closed"}</small>
            </span>
          </button>
          <button
            type="button"
            className={view === "results" ? "active" : ""}
            onClick={() => void chooseView("results")}
          >
            <span className="nav-number">
              <LockIcon />
            </span>
            <span>
              <strong>Survey results</strong>
              <small>
                {publicState?.resultsPublic ? "Published" : "PIN required"}
              </small>
            </span>
          </button>
          <button
            type="button"
            className={view === "host" ? "active" : ""}
            onClick={() => void chooseView("host")}
          >
            <span className="nav-number">
              <SlidersIcon />
            </span>
            <span>
              <strong>Host controls</strong>
              <small>Host PIN required</small>
            </span>
          </button>
        </nav>

        <div className="anonymous-note">
          <span className="status-dot" />
          <div>
            <strong>Completely anonymous</strong>
            <p>No names, emails, or sign-ins are collected.</p>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="menu-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main>
        {view === "survey" &&
          (ballotMode === "real" && !votingOpen && !submitted ? (
            <section className="closed-state">
              <div className="lock-emblem">
                <LockIcon />
              </div>
              <p className="eyebrow">Voting closed</p>
              <h1>Submissions are closed.</h1>
              <p>The host has finished collecting ballots.</p>
            </section>
          ) : submitted ? (
            <section className="thank-you">
              <div className="success-ring">
                <CheckIcon />
              </div>
              <p className="eyebrow">
                {ballotMode === "test" ? "Test ballot saved" : "Submission received"}
              </p>
              <h1>{ballotMode === "test" ? "Test complete." : "You’re all set."}</h1>
              <p>
                {ballotMode === "test"
                  ? "This ballot is separate from the live totals."
                  : "Your anonymous ballot has been saved."}
              </p>
              <div className="thank-you-card">
                <span>34 / 34</span>
                <div>
                  <strong>Every question answered</strong>
                  <small>
                    {ballotMode === "test"
                      ? "Open Host controls to preview or reset it"
                      : "Your ballot is complete"}
                  </small>
                </div>
              </div>
              {ballotMode === "test" && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void chooseView("host")}
                >
                  Return to Host controls
                </button>
              )}
            </section>
          ) : (
            <SurveyForm
              answers={answers}
              answeredCount={answeredCount}
              allAnswered={allAnswered}
              progress={progress}
              submitting={submitting}
              submitError={submitError}
              ballotMode={ballotMode}
              onAnswer={updateAnswer}
              onSubmit={submitSurvey}
            />
          ))}

        {view === "results" &&
          (results ? (
            <ResultsDashboard
              results={results}
              dataset={resultsDataset}
            />
          ) : resultsLoading ? (
            <section className="loading-state" role="status">
              Loading results…
            </section>
          ) : (
            <LockedResults
              pin={pin}
              pinError={pinError}
              unlocking={unlocking}
              onPinChange={setPin}
              onSubmit={unlockResults}
            />
          ))}

        {view === "host" &&
          (hostAuthenticated && hostState ? (
            <HostDashboard
              state={hostState}
              activeAction={activeHostAction}
              error={hostError}
              deleteConfirmation={deleteConfirmation}
              onDeleteConfirmation={setDeleteConfirmation}
              onAction={runHostAction}
              onStartTest={startTestBallot}
              onPreview={previewHostResults}
              onLogout={logoutHost}
            />
          ) : (
            <HostLogin
              pin={hostPin}
              loading={hostLoading}
              error={hostError}
              onPinChange={setHostPin}
              onSubmit={loginHost}
            />
          ))}
      </main>
    </div>
  );
}

function SurveyForm({
  answers,
  answeredCount,
  allAnswered,
  progress,
  submitting,
  submitError,
  ballotMode,
  onAnswer,
  onSubmit,
}: {
  answers: string[];
  answeredCount: number;
  allAnswered: boolean;
  progress: number;
  submitting: boolean;
  submitError: string;
  ballotMode: BallotMode;
  onAnswer: (index: number, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      {ballotMode === "test" && (
        <div className="test-mode-banner" role="status">
          <strong>Test ballot</strong>
          <span>This submission will not affect live results.</span>
        </div>
      )}

      <section
        className="survey-warnings"
        aria-label="Important survey instructions"
      >
        <div>
          <strong>Final submission</strong>
          <span>You cannot change your answers after you submit.</span>
        </div>
        <div>
          <strong>Complete it in one go</strong>
          <span>Leaving before you submit will erase your progress.</span>
        </div>
      </section>

      <header className="survey-hero">
        <div>
          <h1>Who’s most likely to…?</h1>
        </div>
        <div className="progress-card">
          <div className="progress-topline">
            <span>Your progress</span>
            <strong>{progress}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={answeredCount}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <small>
            {answeredCount} of {questions.length} answered
          </small>
        </div>
      </header>

      <form className="survey-form" onSubmit={onSubmit}>
        <div className="question-list">
          {questions.map((question, index) => (
            <article
              className={`question-card ${
                answers[index] ? "question-answered" : ""
              }`}
              key={question}
            >
              <div className="question-number">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="question-content">
                <label htmlFor={`question-${index}`}>{question}</label>
                <div className="select-wrap">
                  <select
                    id={`question-${index}`}
                    value={answers[index]}
                    onChange={(event) => onAnswer(index, event.target.value)}
                    required
                  >
                    <option value="">Choose a teammate</option>
                    {nominees.map((name) => (
                      <option value={name} key={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <span className="select-arrow" aria-hidden="true">
                    ↓
                  </span>
                </div>
              </div>
              <div className="answered-mark" aria-hidden="true">
                <CheckIcon />
              </div>
            </article>
          ))}
        </div>

        <div className="submit-panel">
          <div>
            <strong>
              {allAnswered
                ? ballotMode === "test"
                  ? "Your test ballot is ready"
                  : "Your ballot is ready"
                : `${questions.length - answeredCount} ${
                    questions.length - answeredCount === 1
                      ? "question"
                      : "questions"
                  } left`}
            </strong>
            <small>
              {allAnswered
                ? "Review your picks, then submit once."
                : "Answer every question to complete your submission."}
            </small>
          </div>
          <button type="submit" disabled={!allAnswered || submitting}>
            {submitting
              ? "Submitting…"
              : ballotMode === "test"
                ? "Submit test ballot"
                : "Submit my answers"}
            {!submitting && <span aria-hidden="true">→</span>}
          </button>
          {submitError && (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          )}
        </div>
      </form>
    </>
  );
}

function LockedResults({
  pin,
  pinError,
  unlocking,
  onPinChange,
  onSubmit,
}: {
  pin: string;
  pinError: string;
  unlocking: boolean;
  onPinChange: (pin: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="locked-results">
      <div className="lock-emblem">
        <LockIcon />
      </div>
      <p className="eyebrow">Results locked</p>
      <h1>Enter the results PIN</h1>
      <p>The host has not published results yet.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="results-pin">4-digit PIN</label>
        <input
          id="results-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(event) =>
            onPinChange(event.target.value.replace(/\D/g, "").slice(0, 4))
          }
          placeholder="••••"
          aria-describedby={pinError ? "pin-error" : undefined}
        />
        <button type="submit" disabled={pin.length !== 4 || unlocking}>
          {unlocking ? "Unlocking…" : "View results"}
        </button>
        {pinError && (
          <p id="pin-error" className="form-error" role="alert">
            {pinError}
          </p>
        )}
      </form>
      <small className="privacy-caption">
        Private access clears when you leave this tab.
      </small>
    </section>
  );
}

function HostLogin({
  pin,
  loading,
  error,
  onPinChange,
  onSubmit,
}: {
  pin: string;
  loading: boolean;
  error: string;
  onPinChange: (pin: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="locked-results host-login">
      <div className="lock-emblem">
        <SlidersIcon />
      </div>
      <p className="eyebrow">Host only</p>
      <h1>Open Host controls</h1>
      <p>Manage testing, voting, publishing, and ballot recovery.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="host-pin">5-digit host PIN</label>
        <input
          id="host-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          value={pin}
          onChange={(event) =>
            onPinChange(event.target.value.replace(/\D/g, "").slice(0, 5))
          }
          placeholder="•••••"
          aria-describedby={error ? "host-pin-error" : undefined}
        />
        <button type="submit" disabled={pin.length !== 5 || loading}>
          {loading ? "Opening…" : "Open controls"}
        </button>
        {error && (
          <p id="host-pin-error" className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

function HostDashboard({
  state,
  activeAction,
  error,
  deleteConfirmation,
  onDeleteConfirmation,
  onAction,
  onStartTest,
  onPreview,
  onLogout,
}: {
  state: HostState;
  activeAction: HostAction | null;
  error: string;
  deleteConfirmation: string;
  onDeleteConfirmation: (value: string) => void;
  onAction: (action: HostAction, confirmation?: string) => Promise<void>;
  onStartTest: () => void;
  onPreview: (dataset: ResultsDataset) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const busy = activeAction !== null;

  return (
    <section className="host-dashboard">
      <header className="host-header">
        <div>
          <p className="eyebrow">Host control panel</p>
          <h1>Survey controls</h1>
          <p>All settings and ballots are stored in the database.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onLogout}>
          Lock Host tab
        </button>
      </header>

      <div className="host-status-grid">
        <StatusCard
          label="Voting"
          value={state.votingOpen ? "Open" : "Closed"}
          tone={state.votingOpen ? "green" : "neutral"}
        />
        <StatusCard
          label="Public results"
          value={state.resultsPublic ? "Published" : "Hidden"}
          tone={state.resultsPublic ? "blue" : "neutral"}
        />
        <StatusCard label="Live ballots" value={String(state.liveBallots)} />
        <StatusCard label="Test ballots" value={String(state.testBallots)} />
      </div>

      {error && (
        <p className="host-alert" role="alert">
          {error}
        </p>
      )}

      <div className="host-sections">
        <section className="host-panel">
          <div className="host-panel-heading">
            <div>
              <span>Testing</span>
              <h2>Test without changing live totals</h2>
              <p>Test ballots use a separate dataset.</p>
            </div>
            <span className="count-badge">{state.testBallots} saved</span>
          </div>
          <div className="host-actions">
            <button type="button" className="primary-button" onClick={onStartTest}>
              Start a test ballot
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={state.testBallots === 0}
              onClick={() => void onPreview("test")}
            >
              Preview test results
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={state.testBallots === 0 || busy}
              onClick={() => void onAction("reset_test_data")}
            >
              {activeAction === "reset_test_data"
                ? "Resetting…"
                : "Reset test data"}
            </button>
          </div>
        </section>

        <section className="host-panel">
          <div className="host-panel-heading">
            <div>
              <span>Launch</span>
              <h2>Voting and public results</h2>
              <p>Publishing results closes voting automatically.</p>
            </div>
          </div>
          <div className="host-actions">
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() =>
                void onAction(
                  state.resultsPublic ? "hide_results" : "publish_results",
                )
              }
            >
              {state.resultsPublic ? "Hide public results" : "Publish results"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                void onAction(state.votingOpen ? "close_voting" : "open_voting")
              }
            >
              {state.votingOpen ? "Close voting" : "Reopen voting"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void onPreview("real")}
            >
              Preview live results
            </button>
          </div>
        </section>

        <section className="host-panel danger-panel">
          <div className="host-panel-heading">
            <div>
              <span>Ballot recovery</span>
              <h2>Delete all real ballots</h2>
              <p>
                Deleted ballots leave live totals but move to a recovery archive.
              </p>
            </div>
            {state.archivedBallots > 0 && (
              <span className="count-badge">
                {state.archivedBallots} archived
              </span>
            )}
          </div>
          <label className="confirmation-field" htmlFor="delete-confirmation">
            Type <strong>DELETE REAL BALLOTS</strong> to confirm
            <input
              id="delete-confirmation"
              value={deleteConfirmation}
              onChange={(event) => onDeleteConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="host-actions">
            <button
              type="button"
              className="danger-button"
              disabled={
                deleteConfirmation !== "DELETE REAL BALLOTS" ||
                state.liveBallots === 0 ||
                busy
              }
              onClick={() =>
                void onAction("delete_real_ballots", deleteConfirmation)
              }
            >
              {activeAction === "delete_real_ballots"
                ? "Archiving and deleting…"
                : "Delete all real ballots"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={state.archiveBatches === 0 || busy}
              onClick={() => void onAction("restore_real_ballots")}
            >
              {activeAction === "restore_real_ballots"
                ? "Restoring…"
                : "Restore last deleted batch"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function StatusCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "blue";
}) {
  return (
    <div className={`status-card status-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultsDashboard({
  results,
  dataset,
}: {
  results: QuestionResult[];
  dataset: ResultsDataset;
}) {
  const submissionCount = results[0]?.totalVotes ?? 0;
  const isTest = dataset === "test";

  return (
    <section className="results-dashboard">
      <header className="results-header">
        <div>
          <p className="eyebrow">
            {isTest ? "Test dataset" : "Survey results"}
          </p>
          <h1>{isTest ? "Test results." : "The votes are in."}</h1>
          <p>
            {submissionCount === 0
              ? `No ${isTest ? "test " : ""}ballots have been submitted yet.`
              : `${submissionCount} ${isTest ? "test " : "anonymous "}${
                  submissionCount === 1 ? "ballot" : "ballots"
                } counted across all 34 questions.`}
          </p>
        </div>
      </header>

      {isTest && (
        <div className="test-results-note">
          These numbers are separate from live results.
        </div>
      )}

      <div className="results-grid">
        {results.map((result, index) => {
          const hasVotes = result.totalVotes > 0;
          const winnerCopy =
            result.winnerNames.length > 1
              ? `Tied: ${result.winnerNames.join(" & ")}`
              : result.winnerNames[0] ?? "No votes yet";

          return (
            <article className="result-card" key={result.questionId}>
              <div className="result-question">
                <span>Question {String(index + 1).padStart(2, "0")}</span>
                <h2>{questions[index]}</h2>
              </div>

              <div className="winner-row">
                <div>
                  <small>
                    {result.winnerNames.length > 1 ? "Top vote" : "Winner"}
                  </small>
                  <strong>{winnerCopy}</strong>
                </div>
                <span>
                  {result.totalVotes}{" "}
                  {result.totalVotes === 1 ? "vote" : "votes"}
                </span>
              </div>

              {hasVotes ? (
                <div className="chart-layout">
                  <div
                    className="pie-chart"
                    style={{
                      background: buildPieGradient(result.nominees),
                    }}
                    role="img"
                    aria-label={`Vote split for question ${index + 1}`}
                  >
                    <span>{result.totalVotes}</span>
                    <small>total</small>
                  </div>
                  <div className="chart-legend">
                    {result.nominees.map((nominee) => (
                      <div className="legend-row" key={nominee.name}>
                        <span
                          className="legend-dot"
                          style={{
                            backgroundColor: nomineeColors[nominee.name],
                          }}
                        />
                        <strong>{nominee.name}</strong>
                        <span>
                          {nominee.votes} · {nominee.percentage.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-result">
                  This chart will appear after the first ballot is submitted.
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
