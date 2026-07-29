"use client";

import { FormEvent, useMemo, useState } from "react";
import { nominees, questions } from "../data/survey";

type View = "survey" | "results";

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

export function SurveyApp() {
  const [view, setView] = useState<View>("survey");
  const [menuOpen, setMenuOpen] = useState(false);
  const [answers, setAnswers] = useState<string[]>(
    Array(questions.length).fill(""),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [pinError, setPinError] = useState("");
  const [results, setResults] = useState<QuestionResult[] | null>(null);

  const answeredCount = useMemo(
    () => answers.filter(Boolean).length,
    [answers],
  );
  const allAnswered = answeredCount === questions.length;
  const progress = Math.round((answeredCount / questions.length) * 100);

  function chooseView(nextView: View) {
    setView(nextView);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error("We couldn’t save your answers. Please try again.");
      }

      setSubmitted(true);
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
            onClick={() => chooseView("survey")}
          >
            <span className="nav-number">01</span>
            <span>
              <strong>Take the survey</strong>
              <small>34 quick questions</small>
            </span>
          </button>
          <button
            type="button"
            className={view === "results" ? "active" : ""}
            onClick={() => chooseView("results")}
          >
            <span className="nav-number">
              <LockIcon />
            </span>
            <span>
              <strong>Survey results</strong>
              <small>PIN required</small>
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
          (submitted ? (
            <section className="thank-you">
              <div className="success-ring">
                <CheckIcon />
              </div>
              <p className="eyebrow">Submission received</p>
              <h1>You’re all set.</h1>
              <p>
                Thanks for voting. Your answers were saved anonymously and
                can’t be traced back to you.
              </p>
              <div className="thank-you-card">
                <span>34 / 34</span>
                <div>
                  <strong>Every question answered</strong>
                  <small>Your ballot is complete</small>
                </div>
              </div>
            </section>
          ) : (
            <>
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

              <form className="survey-form" onSubmit={submitSurvey}>
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
                        <label htmlFor={`question-${index}`}>
                          {question}
                        </label>
                        <div className="select-wrap">
                          <select
                            id={`question-${index}`}
                            value={answers[index]}
                            onChange={(event) =>
                              updateAnswer(index, event.target.value)
                            }
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
                        ? "Your ballot is ready"
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
                    {submitting ? "Submitting…" : "Submit my answers"}
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
          ))}

        {view === "results" &&
          (results ? (
            <ResultsDashboard
              results={results}
              onLock={() => setResults(null)}
            />
          ) : (
            <section className="locked-results">
              <div className="lock-emblem">
                <LockIcon />
              </div>
              <p className="eyebrow">Private results</p>
              <h1>Enter the results PIN</h1>
              <p>
                Vote totals stay hidden until the correct four-digit PIN is
                entered.
              </p>
              <form onSubmit={unlockResults}>
                <label htmlFor="results-pin">4-digit PIN</label>
                <input
                  id="results-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={pin}
                  onChange={(event) =>
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
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
                The survey remains open while results are locked.
              </small>
            </section>
          ))}
      </main>
    </div>
  );
}

function ResultsDashboard({
  results,
  onLock,
}: {
  results: QuestionResult[];
  onLock: () => void;
}) {
  const submissionCount = results[0]?.totalVotes ?? 0;

  return (
    <section className="results-dashboard">
      <header className="results-header">
        <div>
          <p className="eyebrow">Live survey results</p>
          <h1>The votes are in.</h1>
          <p>
            {submissionCount === 0
              ? "No anonymous ballots have been submitted yet."
              : `${submissionCount} anonymous ${
                  submissionCount === 1 ? "ballot" : "ballots"
                } counted across all 34 questions.`}
          </p>
        </div>
        <button type="button" className="lock-button" onClick={onLock}>
          <LockIcon />
          Lock results
        </button>
      </header>

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
                  <small>{result.winnerNames.length > 1 ? "Top vote" : "Winner"}</small>
                  <strong>{winnerCopy}</strong>
                </div>
                <span>
                  {result.totalVotes} {result.totalVotes === 1 ? "vote" : "votes"}
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
