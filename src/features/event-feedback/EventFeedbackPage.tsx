import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  Clock3,
  ClipboardCheck,
  GraduationCap,
  Church,
  Building2,
  Utensils,
  BedDouble,
  Heart,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import logo from "@/assets/logo-coros-preto.png";
import {
  FEEDBACK_ASPECTS,
  RATING_LABELS,
  eventFeedbackSchema,
  feedbackIdentitySchema,
  feedbackAccessTokenSchema,
  formatFeedbackIdentityInput,
  type FeedbackAccess,
  type EventFeedbackStats,
  type AspectKey,
  type AspectRating,
  type EventFeedback,
  type Rating,
} from "./eventFeedback.domain";
import "./event-feedback.css";
import { FeedbackSurprise } from "./FeedbackSurprise";
import surpriseVideo from "./feedback-surprise.json";

type Props = {
  onSubmit: (feedback: EventFeedback) => Promise<{ saved: true }>;
  loadStats?: () => Promise<EventFeedbackStats>;
  onPrepareAccess: (identity: string) => Promise<FeedbackAccess>;
  onResumeAccess: (token: string, claimId?: string) => Promise<FeedbackAccess>;
  onClaimVideo: (token: string, claimId: string) => Promise<{ allowed: boolean }>;
};
const aspectIcons = {
  organization: ClipboardCheck,
  formation: GraduationCap,
  celebrations: Church,
  venue: Building2,
  food: Utensils,
  lodging: BedDouble,
};
const ratingEmojis = ["😞", "🙁", "🙂", "😄", "🥰"];
const STORAGE_KEY = "encontro-coros:feedback:2026";
const ACCESS_KEY = "encontro-coros:feedback-access:2026";
const CLAIM_KEY = "encontro-coros:feedback-video-claim:2026";
const titles = [
  "Vamos começar?",
  "Como foi o encontro para você?",
  "Vamos olhar para os detalhes?",
  "O que podemos fazer melhor?",
];
const descriptions = [
  "Antes de avaliar, confirme sua inscrição.",
  "Pense na sua experiência como um todo.",
  "Toque em uma nota de 1 a 5 para avaliar cada aspecto.",
  "Deixe uma sugestão para a próxima edição. Este campo é opcional.",
];

function Choice({
  name,
  value,
  checked,
  onChange,
  children,
  className = "",
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <label className={`feedback-choice ${className}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-label={label}
      />
      <span className="feedback-choice-content">{children}</span>
    </label>
  );
}

function NumericRating({
  name,
  value,
  onChange,
  unratedLabel = "Toque para avaliar",
}: {
  name: string;
  value?: Rating | null;
  onChange: (rating: Rating) => void;
  unratedLabel?: string;
}) {
  return (
    <div className={`feedback-scores ${name === "overall" ? "feedback-scores-overall" : ""}`}>
      <div className="feedback-score-options">
        {RATING_LABELS.map((label, index) => (
          <label key={label} className="feedback-score-option">
            <input
              type="radio"
              name={name}
              value={index + 1}
              checked={value === index + 1}
              aria-label={label}
              aria-description={`Nota ${index + 1} de 5`}
              onChange={() => onChange((index + 1) as Rating)}
            />
            <span
              className="feedback-score-face"
              data-selected={value === index + 1}
              aria-hidden="true"
            >
              <span className="feedback-rating-emoji">{ratingEmojis[index]}</span>
              <span className="feedback-rating-number">{index + 1}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="feedback-score-caption" aria-live="polite">
        {value ? RATING_LABELS[value - 1] : unratedLabel}
      </p>
    </div>
  );
}

export function EventFeedbackPage({
  onSubmit,
  loadStats,
  onPrepareAccess,
  onResumeAccess,
  onClaimVideo,
}: Props) {
  const [step, setStep] = useState(0);
  const [overall, setOverall] = useState<Rating | null>(null);
  const [identity, setIdentity] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [pendingClaim, setPendingClaim] = useState<string | undefined>();
  const [aspects, setAspects] = useState<Partial<Record<AspectKey, AspectRating>>>({});
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState<EventFeedbackStats>({ registrations: null, responses: null });
  const submissionId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    loadStats?.()
      .then((value) => {
        if (active) setStats(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [loadStats, saved]);

  useEffect(() => {
    let active = true;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? eventFeedbackSchema.safeParse(JSON.parse(raw).feedback) : null;
      if (parsed?.success) {
        const feedback = parsed.data;
        submissionId.current = feedback.submissionId;
        setOverall(feedback.overall as Rating);
        setAspects(feedback.aspects as Record<AspectKey, AspectRating>);
        setSuggestion(feedback.suggestion);
        setStep(titles.length - 1);
      }
      const token =
        sessionStorage.getItem(ACCESS_KEY) ?? (parsed?.success ? parsed.data.accessToken : null);
      if (token && feedbackAccessTokenSchema.safeParse(token).success) {
        let pending: string | undefined;
        try {
          const data = JSON.parse(sessionStorage.getItem(CLAIM_KEY) ?? "null");
          if (data?.token === token && /^[0-9a-f-]{36}$/.test(data.claimId)) {
            pending = data.claimId;
            setPendingClaim(pending);
          }
        } catch {}
        setAccessToken(token);
        void onResumeAccess(token, pending)
          .then((access) => {
            if (active) {
              setAccessToken(access.token);
              setSaved(access.responded);
              setVideoUrl(access.videoUrl);
            }
          })
          .catch(() => {
            if (active) {
              setAccessToken(null);
              setStep(0);
              setSaved(false);
              setError("Confira seu CPF ou e-mail para continuar.");
            }
          });
      }
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
    return () => {
      active = false;
    };
  }, [onResumeAccess]);

  function remember(feedback: EventFeedback, saved: boolean) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ feedback, saved }));
    } catch {
      /* Keep the in-memory retry available when browser storage is blocked. */
    }
  }

  function move(next: number) {
    setError("");
    setStep(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
    });
  }

  function back() {
    move(step - 1);
  }

  async function advance(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const missingAspect =
      step === 2 && FEEDBACK_ASPECTS.some(({ key }) => aspects[key] === undefined);
    const missing = step === 1 ? !overall : step === 2 ? missingAspect : false;
    if (missing) {
      setError(
        missingAspect
          ? "Avalie todos os aspectos ou marque que não participou / não utilizou."
          : "Escolha uma opção para continuar.",
      );
      return;
    }
    if (step < titles.length - 1) {
      if (step === 0 && !accessToken) {
        const parsed = feedbackIdentitySchema.safeParse(identity);
        if (!parsed.success) {
          setError("Informe um CPF ou e-mail válido para continuar.");
          return;
        }
        inFlight.current = true;
        setSending(true);
        setError("");
        try {
          const access = await onPrepareAccess(parsed.data);
          setAccessToken(access.token);
          setVideoUrl(access.videoUrl);
          setSaved(access.responded);
          try {
            sessionStorage.setItem(ACCESS_KEY, access.token);
          } catch {}
          if (!access.responded) move(1);
          else requestAnimationFrame(() => heading.current?.focus());
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível conferir sua inscrição. Tente novamente.",
          );
        } finally {
          inFlight.current = false;
          setSending(false);
        }
        return;
      }
      move(step + 1);
      return;
    }
    if (!accessToken) {
      setStep(0);
      setError("Confira seu CPF ou e-mail para continuar.");
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError("");
    try {
      submissionId.current ??= crypto.randomUUID();
      const feedback: EventFeedback = {
        submissionId: submissionId.current,
        accessToken,
        overall: overall!,
        aspects: aspects as EventFeedback["aspects"],
        suggestion,
      };
      remember(feedback, false);
      const response = await onSubmit(feedback);
      if (!response.saved)
        throw new Error("Não foi possível enviar sua avaliação. Tente novamente.");
      setSaved(true);
      remember(feedback, true);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes("Confira novamente seu CPF")) {
        setAccessToken(null);
        setStep(0);
        try {
          sessionStorage.removeItem(ACCESS_KEY);
        } catch {}
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enviar sua avaliação. Suas respostas foram mantidas. Tente novamente.",
      );
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  function anotherParticipant() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(ACCESS_KEY);
    } catch {}
    setAccessToken(null);
    setVideoUrl(null);
    setIdentity("");
    setSaved(false);
    setOverall(null);
    setAspects({});
    setSuggestion("");
    submissionId.current = null;
    move(0);
  }

  return (
    <div className="feedback-page" data-step={step}>
      <header className="feedback-header">
        <div className="feedback-masthead">
          <a href="/" className="feedback-brand" aria-label="Site do encontro">
            <img
              src={logo}
              width="600"
              height="332"
              alt="II Encontro de Coros Diocesanos e Litúrgicos"
            />
          </a>
          <p>
            Sua voz <span>faz a diferença.</span>
          </p>
        </div>
        <div className="feedback-stats" aria-label="Participação na avaliação" aria-live="polite">
          <span>
            <strong>
              {stats.registrations === null ? "—" : stats.registrations.toLocaleString("pt-BR")}
            </strong>{" "}
            inscritos
          </span>
          <span>
            <strong>
              {stats.responses === null ? "—" : stats.responses.toLocaleString("pt-BR")}
            </strong>{" "}
            respostas
          </span>
        </div>
      </header>
      <main className="feedback-main">
        {saved ? (
          <section className="feedback-thanks" aria-live="polite">
            <span className="feedback-thanks-mark">
              <CheckCheck size={38} aria-hidden="true" />
            </span>
            <h1 ref={heading} tabIndex={-1}>
              Sua voz faz parte deste encontro.
            </h1>
            <p>
              Sua avaliação foi enviada. Obrigado por nos ajudar a preparar os próximos encontros
              com ainda mais cuidado.
            </p>
            <div className="feedback-thanks-note">
              <Heart size={20} aria-hidden="true" />
              <span>Que a música continue nos unindo.</span>
            </div>
            <a className={videoUrl ? "feedback-back" : "feedback-submit"} href="/">
              Voltar ao site do encontro
            </a>
            <button
              type="button"
              className="feedback-change-participant"
              onClick={anotherParticipant}
            >
              Outro coralista
            </button>
          </section>
        ) : (
          <>
            <div className="feedback-intro">
              <span>
                <Clock3 size={16} aria-hidden="true" /> Cerca de 1 minuto
              </span>
              <span>
                <ShieldCheck size={16} aria-hidden="true" /> Resposta anônima
              </span>
            </div>
            <nav className="feedback-progress" aria-label="Progresso da avaliação">
              <div className="feedback-progress-heading">
                <span>Avaliação do encontro</span>
                <span>
                  Etapa {step + 1} de {titles.length}
                </span>
              </div>
              <div
                className="feedback-progress-track"
                role="progressbar"
                aria-label="Etapas da avaliação"
                aria-valuemin={1}
                aria-valuemax={titles.length}
                aria-valuenow={step + 1}
              >
                {titles.map((title, index) => (
                  <span key={title} data-active={index <= step} />
                ))}
              </div>
            </nav>
            <form onSubmit={advance} className="feedback-form" noValidate>
              <div className="feedback-question" key={step}>
                <h1 ref={heading} tabIndex={-1}>
                  {titles[step]}
                </h1>
                <p className="feedback-description" id="feedback-description">
                  {descriptions[step]}
                </p>

                {step === 0 && (
                  <>
                    {!accessToken ? (
                      <div className="feedback-identity">
                        <label htmlFor="feedback-identity">CPF ou e-mail da inscrição</label>
                        <input
                          id="feedback-identity"
                          type="text"
                          value={identity}
                          onChange={(event) => {
                            const next = event.target.value;
                            setIdentity((current) => formatFeedbackIdentityInput(next, current));
                            setError("");
                          }}
                          autoCapitalize="none"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={254}
                          placeholder="000.000.000-00 ou seu@email.com"
                          aria-describedby="feedback-identity-help"
                          required
                        />
                        <p id="feedback-identity-help">
                          Informe o CPF ou e-mail usado na inscrição. Suas opiniões serão entregues
                          à organização sem identificação.
                        </p>
                      </div>
                    ) : (
                      <p className="feedback-registration-checked">
                        Inscrição conferida.{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setAccessToken(null);
                            setVideoUrl(null);
                            try {
                              sessionStorage.removeItem(ACCESS_KEY);
                            } catch {}
                          }}
                        >
                          Alterar CPF ou e-mail
                        </button>
                      </p>
                    )}
                    <p className="feedback-description">
                      Suas respostas são anônimas e ajudarão a melhorar o encontro. Elas serão
                      encaminhadas à equipe organizadora do próximo encontro.
                    </p>
                  </>
                )}

                {step === 1 && (
                  <fieldset
                    className="feedback-options"
                    aria-label="Avaliação geral"
                    aria-describedby="feedback-description"
                  >
                    <NumericRating
                      name="overall"
                      value={overall}
                      onChange={(rating) => {
                        setOverall(rating);
                        setError("");
                      }}
                    />
                  </fieldset>
                )}

                {step === 2 && (
                  <div className="feedback-aspects">
                    {FEEDBACK_ASPECTS.map(({ key, label, description }) => {
                      const Icon = aspectIcons[key];
                      const canBeUnused = key === "food" || key === "lodging";
                      return (
                        <fieldset key={key} className="feedback-aspect">
                          <legend>
                            <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                            <span>{label}</span>
                          </legend>
                          <p>{description}</p>
                          <NumericRating
                            name={key}
                            value={
                              typeof aspects[key] === "number" ? (aspects[key] as Rating) : null
                            }
                            unratedLabel={
                              aspects[key] === "not_used" ? "Não utilizei" : "Toque para avaliar"
                            }
                            onChange={(rating) => {
                              setAspects((current) => ({ ...current, [key]: rating }));
                              setError("");
                            }}
                          />
                          {canBeUnused && (
                            <Choice
                              name={key}
                              value="not_used"
                              label="Não utilizei"
                              checked={aspects[key] === "not_used"}
                              className="feedback-not-used"
                              onChange={() => {
                                setAspects((current) => ({ ...current, [key]: "not_used" }));
                                setError("");
                              }}
                            >
                              <span>Não utilizei</span>
                              {aspects[key] === "not_used" && (
                                <Check size={16} aria-hidden="true" />
                              )}
                            </Choice>
                          )}
                        </fieldset>
                      );
                    })}
                  </div>
                )}

                {step === 3 && (
                  <div className="feedback-suggestion">
                    <label htmlFor="feedback-suggestion">
                      Sua sugestão <span>(opcional)</span>
                    </label>
                    <textarea
                      id="feedback-suggestion"
                      value={suggestion}
                      onChange={(event) => setSuggestion(event.target.value)}
                      maxLength={1000}
                      placeholder="O que faria a próxima edição ainda melhor?"
                      rows={3}
                    />
                    <span className="feedback-character-count">{suggestion.length} / 1.000</span>
                    <p>
                      <ShieldCheck size={18} aria-hidden="true" />
                      Não é preciso informar nome, e-mail ou telefone.
                    </p>
                  </div>
                )}
              </div>
              {error && (
                <p className="feedback-error" role="alert">
                  {error}
                </p>
              )}
              <div className="feedback-actions">
                {step > 0 && (
                  <button type="button" className="feedback-back" onClick={back} disabled={sending}>
                    <ChevronLeft size={18} aria-hidden="true" />
                    Voltar
                  </button>
                )}
                <button type="submit" className="feedback-submit" disabled={sending}>
                  {sending ? (
                    <>
                      <LoaderCircle size={18} className="feedback-spinner" aria-hidden="true" />
                      {step === 0 ? "Conferindo inscrição…" : "Enviando…"}
                    </>
                  ) : step === titles.length - 1 ? (
                    "Enviar avaliação"
                  ) : (
                    "Continuar"
                  )}
                </button>
              </div>
              <p className="feedback-privacy">Sua opinião ajuda a cuidar dos próximos encontros.</p>
            </form>
          </>
        )}
        <FeedbackSurprise
          key={accessToken ?? "pending"}
          url={videoUrl}
          posterUrl={surpriseVideo.posterUrl}
          completed={saved}
          onClaim={(claimId) => {
            try {
              sessionStorage.setItem(CLAIM_KEY, JSON.stringify({ token: accessToken, claimId }));
            } catch {}
            return onClaimVideo(accessToken!, claimId);
          }}
          initialClaimId={pendingClaim}
          onPlaybackStarted={() => {
            try {
              sessionStorage.removeItem(CLAIM_KEY);
            } catch {}
          }}
          onConsumed={() => {
            try {
              sessionStorage.removeItem(CLAIM_KEY);
            } catch {}
            setVideoUrl(null);
            requestAnimationFrame(() => heading.current?.focus());
          }}
        />
      </main>
    </div>
  );
}
