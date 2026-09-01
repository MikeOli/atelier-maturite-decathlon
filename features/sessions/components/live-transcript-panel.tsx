"use client";

import { useEffect, useRef, useState } from "react";
import { setTranscriptionEnabled, syncTranscriptDraft } from "@/features/sessions/actions";

// The Web Speech API isn't part of TypeScript's standard DOM lib — these
// are the minimal shapes this component actually uses, not a full typing
// of the spec.
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SYNC_INTERVAL_MS = 20_000;

/**
 * Story 5.5 (FR48) — toggle before the workshop starts, live capture panel
 * once it has. Two render modes selected by `started`, matching the two
 * places this is used on /facilitate/[code] (before/after
 * StartSessionAsFacilitatorButton's gate).
 */
export function LiveTranscriptPanel(
  props:
    | {
        started: false;
        sessionId: string;
        facilitatorToken: string;
        initialEnabled: boolean;
      }
    | {
        started: true;
        sessionId: string;
        facilitatorToken: string;
        transcriptionEnabled: boolean;
        initialDraft: string | null;
      },
) {
  const supported = getSpeechRecognitionConstructor() !== null;

  // AC#5: never show a control that would fail silently on an unsupported
  // browser (Firefox, mainly).
  if (!supported) return null;

  if (!props.started) {
    return <TranscriptionToggle {...props} />;
  }

  if (!props.transcriptionEnabled) return null;

  return (
    <LiveTranscriptCapture
      sessionId={props.sessionId}
      facilitatorToken={props.facilitatorToken}
      initialDraft={props.initialDraft}
    />
  );
}

function TranscriptionToggle({
  sessionId,
  facilitatorToken,
  initialEnabled,
}: {
  sessionId: string;
  facilitatorToken: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = async (checked: boolean) => {
    setSaving(true);
    setError(null);
    const previous = enabled;
    setEnabled(checked);

    const result = await setTranscriptionEnabled(
      sessionId,
      facilitatorToken,
      checked,
    );

    if (!result.success) {
      setEnabled(previous);
      setError(result.error);
    }
    setSaving(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => handleChange(e.target.checked)}
        />
        Activer la transcription live de la discussion
      </label>
      <p className="text-xs text-muted-foreground">
        Ton navigateur reconnaît la parole en direct (selon le navigateur,
        cela peut passer par un service de reconnaissance vocale externe).
        Aucun fichier audio n&apos;est enregistré ni conservé dans
        l&apos;application — seul le texte reconnu s&apos;affiche pendant
        l&apos;atelier, et il est effacé à la clôture.
      </p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function LiveTranscriptCapture({
  sessionId,
  facilitatorToken,
  initialDraft,
}: {
  sessionId: string;
  facilitatorToken: string;
  initialDraft: string | null;
}) {
  const [text, setText] = useState(initialDraft ?? "");
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;

    let stopped = false;
    let recognition: SpeechRecognitionLike | null = null;
    let restartTimeout: ReturnType<typeof setTimeout> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const flush = () => {
      syncTranscriptDraft(sessionId, facilitatorToken, textRef.current);
    };

    const start = () => {
      if (stopped) return;
      recognition = new Recognition();
      recognition.lang = "fr-FR";
      recognition.continuous = true;
      // Only final results are kept — interim results would make the
      // displayed text rewrite itself constantly, confusing for a passive
      // capture zone.
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        let appended = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            appended += result[0].transcript + " ";
          }
        }
        if (appended) {
          setText((prev) => prev + appended);
        }
      };

      // SpeechRecognition stops itself after a silence or an internal
      // timeout even with continuous=true, on both Chrome and mobile
      // Safari — this is normal operation, not a failure. Restart on a
      // short delay (not synchronously — `recognition.start()` can throw
      // `InvalidStateError` if called too soon after `stop`/`end` fire in
      // quick succession) unless the component has been unmounted or a
      // permission error already halted capture for good.
      recognition.onend = () => {
        if (stopped) return;
        restartTimeout = setTimeout(start, 300);
      };

      recognition.onerror = (event) => {
        // A denied microphone permission would otherwise loop start/end
        // forever, with the sync interval still firing on a buffer that
        // will never grow again.
        if (event.error === "not-allowed") {
          stopped = true;
          if (interval) clearInterval(interval);
        }
      };

      try {
        recognition.start();
      } catch {
        // Overlapping start/stop timing (InvalidStateError) — the onend
        // handler's delayed restart is what actually recovers from this,
        // this just prevents an uncaught exception from killing the
        // restart chain outright.
        if (!stopped) restartTimeout = setTimeout(start, 300);
      }
    };

    start();

    // Best-effort only — not all browsers support the Wake Lock API, and
    // its absence must never block transcription itself.
    let wakeLock: { release: () => void } | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((lock) => {
        wakeLock = lock;
      })
      .catch(() => {});

    interval = setInterval(flush, SYNC_INTERVAL_MS);

    // Best-effort flush right before the tab is hidden/closed/reloaded —
    // the periodic interval alone could otherwise lose up to
    // SYNC_INTERVAL_MS of speech on an untimely navigation.
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);

    return () => {
      stopped = true;
      recognition?.stop();
      if (restartTimeout) clearTimeout(restartTimeout);
      if (interval) clearInterval(interval);
      wakeLock?.release();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [sessionId, facilitatorToken]);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm flex flex-col gap-2">
      <p className="text-sm font-medium">Transcription live</p>
      <textarea
        readOnly
        value={text}
        rows={6}
        className="w-full resize-none border rounded-md px-3 py-2 text-sm bg-transparent text-muted-foreground"
        placeholder="Le texte de la discussion apparaîtra ici au fur et à mesure…"
      />
    </div>
  );
}
