import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Check,
  CheckCheck,
  ChevronLeft,
  Clock3,
  ClipboardCheck,
  GraduationCap,
  Church,
  Users,
  Building2,
  Utensils,
  BedDouble,
  Heart,
  LoaderCircle,
  Music2,
  ShieldCheck,
  Star,
} from "lucide-react";
import logo from "@/assets/logo-coros-preto.png";
import {
  FEEDBACK_ASPECTS,
  RATING_LABELS,
  eventFeedbackSchema,
  type EventFeedbackStats,
  type AspectKey,
  type AspectRating,
  type EventFeedback,
  type Rating,
} from "./eventFeedback.domain";
import "./event-feedback.css";

type Props = {
  onSubmit: (feedback: EventFeedback) => Promise<{ saved: true }>;
  loadStats?: () => Promise<EventFeedbackStats>;
};
const aspectIcons = {
  organization: ClipboardCheck,
  formation: GraduationCap,
  celebrations: Church,
  fellowship: Users,
  venue: Building2,
  food: Utensils,
  lodging: BedDouble,
};
const STORAGE_KEY = "encontro-coros:feedback:2026";
const titles = [
  "Como foi o encontro para você?",
  "Vamos olhar para os detalhes?",
  "Nos encontramos na próxima?",
  "O que podemos fazer melhor?",
];
const descriptions = [
  "Pense na sua experiência como um todo.",
  "Toque nas estrelas para avaliar cada aspecto.",
  "Você participaria de uma próxima edição do encontro?",
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

function StarRating({
  name,
  value,
  onChange,
  unratedLabel = "Toque nas estrelas",
}: {
  name: string;
  value?: Rating | null;
  onChange: (rating: Rating) => void;
  unratedLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value ?? 0;
  return (
    <div className={`feedback-stars ${name === "overall" ? "feedback-stars-overall" : ""}`}>
      <div className="feedback-star-options" onPointerLeave={() => setHovered(null)}>
        {RATING_LABELS.map((label, index) => (
          <label
            key={label}
            className="feedback-star-option"
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setHovered(index + 1);
            }}
          >
            <input
              type="radio"
              name={name}
              value={index + 1}
              checked={value === index + 1}
              aria-label={label}
              aria-description={`${index + 1} ${index === 0 ? "estrela" : "estrelas"}`}
              onChange={() => {
                setHovered(null);
                onChange((index + 1) as Rating);
              }}
            />
            <span className="feedback-star-face">
              <Star size={32} strokeWidth={1.6} data-filled={index < active} aria-hidden="true" />
            </span>
          </label>
        ))}
      </div>
      <p className="feedback-star-caption" aria-live="polite">
        {value ? RATING_LABELS[value - 1] : unratedLabel}
      </p>
    </div>
  );
}

export function EventFeedbackPage({ onSubmit, loadStats }: Props) {
  const [step, setStep] = useState(0);
  const [overall, setOverall] = useState<Rating | null>(null);
  const [aspects, setAspects] = useState<Partial<Record<AspectKey, AspectRating>>>({});
  const [contribution, setContribution] = useState<number | null>(null);
  const [returnIntent, setReturnIntent] = useState<EventFeedback["returnIntent"] | null>(null);
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
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      const parsed = eventFeedbackSchema.safeParse(stored.feedback);
      if (!parsed.success) return;
      const feedback = parsed.data;
      submissionId.current = feedback.submissionId;
      setOverall(feedback.overall as Rating);
      setAspects(feedback.aspects as Record<AspectKey, AspectRating>);
      setContribution(feedback.contribution);
      setReturnIntent(feedback.returnIntent);
      setSuggestion(feedback.suggestion);
      setStep(titles.length - 1);
      setSaved(stored.saved === true);
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }, []);

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
      step === 1 && FEEDBACK_ASPECTS.some(({ key }) => aspects[key] === undefined);
    const missingContribution = step === 1 && !contribution;
    const missing =
      step === 0
        ? !overall
        : step === 1
          ? missingAspect || missingContribution
          : step === 2
            ? !returnIntent
            : false;
    if (missing) {
      setError(
        missingAspect
          ? "Avalie todos os aspectos ou marque que não participou / não utilizou."
          : missingContribution
            ? "Selecione a contribuição para o seu coro."
            : "Escolha uma opção para continuar.",
      );
      return;
    }
    if (step < titles.length - 1) {
      move(step + 1);
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError("");
    try {
      submissionId.current ??= crypto.randomUUID();
      const feedback: EventFeedback = {
        submissionId: submissionId.current,
        overall: overall!,
        aspects: aspects as EventFeedback["aspects"],
        contribution: contribution!,
        returnIntent: returnIntent!,
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
            <a className="feedback-submit" href="/">
              Voltar ao site do encontro
            </a>
          </section>
        ) : (
          <>
            <div className="feedback-intro">
              <span>
                <Clock3 size={16} aria-hidden="true" /> Cerca de 2 minutos
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
                  <fieldset
                    className="feedback-options"
                    aria-label="Avaliação geral"
                    aria-describedby="feedback-description"
                  >
                    <StarRating
                      name="overall"
                      value={overall}
                      onChange={(rating) => {
                        setOverall(rating);
                        setError("");
                      }}
                    />
                  </fieldset>
                )}

                {step === 1 && (
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
                          <StarRating
                            name={key}
                            value={
                              typeof aspects[key] === "number" ? (aspects[key] as Rating) : null
                            }
                            unratedLabel={
                              aspects[key] === "not_used" ? "Não utilizei" : "Toque nas estrelas"
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

                {step === 1 && (
                  <section
                    className="feedback-contribution"
                    aria-labelledby="feedback-contribution-title"
                  >
                    <h2 id="feedback-contribution-title">
                      Quanto o encontro contribuiu para sua atuação no coro?
                    </h2>
                    <fieldset className="feedback-options" aria-label="Contribuição para o coro">
                      {["Nada", "Pouco", "Razoavelmente", "Muito"].map((label, index) => (
                        <Choice
                          key={label}
                          name="contribution"
                          value={String(index + 1)}
                          checked={contribution === index + 1}
                          onChange={() => {
                            setContribution(index + 1);
                            setError("");
                          }}
                        >
                          <span>{label}</span>
                          <span className="feedback-choice-end">
                            {contribution === index + 1 ? (
                              <Check size={20} aria-hidden="true" />
                            ) : (
                              <span className="feedback-radio-mark" />
                            )}
                          </span>
                        </Choice>
                      ))}
                    </fieldset>
                  </section>
                )}

                {step === 2 && (
                  <fieldset
                    className="feedback-options"
                    aria-label="Participação na próxima edição"
                  >
                    {(
                      [
                        {
                          value: "yes",
                          label: "Sim, quero participar",
                          detail: "Vamos cantar juntos outra vez.",
                          icon: Heart,
                        },
                        {
                          value: "maybe",
                          label: "Talvez",
                          detail: "Ainda preciso decidir.",
                          icon: Star,
                        },
                        {
                          value: "no",
                          label: "Não",
                          detail: "Não pretendo participar.",
                          icon: Music2,
                        },
                      ] as const
                    ).map(({ value, label, detail, icon: Icon }) => (
                      <Choice
                        key={value}
                        name="returnIntent"
                        value={value}
                        label={label}
                        checked={returnIntent === value}
                        onChange={() => {
                          setReturnIntent(value);
                          setError("");
                        }}
                      >
                        <Icon
                          size={24}
                          className="feedback-face"
                          strokeWidth={1.6}
                          aria-hidden="true"
                        />
                        <span className="feedback-choice-copy">
                          <span>{label}</span>
                          <small>{detail}</small>
                        </span>
                        <span className="feedback-choice-end">
                          {returnIntent === value ? (
                            <Check size={20} aria-hidden="true" />
                          ) : (
                            <span className="feedback-radio-mark" />
                          )}
                        </span>
                      </Choice>
                    ))}
                  </fieldset>
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
                      Enviando…
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
      </main>
    </div>
  );
}
