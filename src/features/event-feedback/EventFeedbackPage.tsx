import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Annoyed,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock3,
  Frown,
  Heart,
  Laugh,
  LoaderCircle,
  Meh,
  Music2,
  ShieldCheck,
  Smile,
  Star,
} from "lucide-react";
import logo from "@/assets/logo-coros-preto.png";
import choirPhoto from "@/assets/hero-choir-focus.jpg";
import {
  FEEDBACK_ASPECTS,
  RATING_LABELS,
  eventFeedbackSchema,
  type AspectKey,
  type AspectRating,
  type EventFeedback,
  type Rating,
} from "./eventFeedback.domain";
import "./event-feedback.css";

type Props = { onSubmit: (feedback: EventFeedback) => Promise<{ saved: true }> };
const faces = [Frown, Annoyed, Meh, Smile, Laugh];
const STORAGE_KEY = "encontro-coros:feedback:2026";
const titles = [
  "Como foi o encontro para você?",
  "Vamos olhar para os detalhes?",
  "O que você leva para o seu coro?",
  "Nos encontramos na próxima?",
  "O que podemos fazer melhor?",
];
const descriptions = [
  "Pense na sua experiência como um todo.",
  "Avalie cada aspecto. Se não participou ou não utilizou, é só indicar.",
  "Quanto o encontro contribuiu para sua atuação no coro?",
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

export function EventFeedbackPage({ onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [overall, setOverall] = useState<Rating | null>(null);
  const [aspects, setAspects] = useState<Partial<Record<AspectKey, AspectRating>>>({});
  const [contribution, setContribution] = useState<number | null>(null);
  const [returnIntent, setReturnIntent] = useState<EventFeedback["returnIntent"] | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(false);
  const submissionId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const main = useRef<HTMLElement>(null);

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
      setStep(4);
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
      main.current?.scrollIntoView?.({ behavior: "instant", block: "start" });
    });
  }

  async function advance(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const missing =
      step === 0
        ? !overall
        : step === 1
          ? FEEDBACK_ASPECTS.some(({ key }) => aspects[key] === undefined)
          : step === 2
            ? !contribution
            : step === 3
              ? !returnIntent
              : false;
    if (missing) {
      setError(
        step === 1
          ? "Avalie todos os aspectos ou marque que não participou / não utilizou."
          : "Escolha uma opção para continuar.",
      );
      return;
    }
    if (step < 4) {
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
    <div className="feedback-page">
      <aside className="feedback-story" aria-label="Encontro de Coros 2026">
        <a href="/" className="feedback-brand" aria-label="Site do encontro">
          <img
            src={logo}
            width="600"
            height="332"
            alt="II Encontro de Coros Diocesanos e Litúrgicos"
          />
        </a>
        <div className="feedback-photo">
          <img
            src={choirPhoto}
            alt="Coristas reunidos no Encontro de Coros"
            width="1600"
            height="900"
            fetchPriority="high"
          />
          <div className="feedback-photo-shade" />
          <div className="feedback-story-copy">
            <Music2 size={24} aria-hidden="true" />
            <p>
              Sua voz
              <br />
              <em>faz a diferença.</em>
            </p>
            <span>Quixadá · 20 a 22 de novembro de 2026</span>
          </div>
        </div>
        <div className="feedback-story-footer">
          <span>Fé que une. Música que transforma.</span>
          <span>II Encontro de Coros · Regional Nordeste 1 – CNBB</span>
        </div>
      </aside>

      <main className="feedback-main" ref={main}>
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
                <span>Etapa {step + 1} de 5</span>
              </div>
              <div
                className="feedback-progress-track"
                role="progressbar"
                aria-label="Etapas da avaliação"
                aria-valuemin={1}
                aria-valuemax={5}
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
                    {RATING_LABELS.map((label, index) => {
                      const Icon = faces[index];
                      return (
                        <Choice
                          key={label}
                          name="overall"
                          value={String(index + 1)}
                          checked={overall === index + 1}
                          onChange={() => {
                            setOverall((index + 1) as Rating);
                            setError("");
                          }}
                        >
                          <Icon
                            className="feedback-face"
                            size={25}
                            strokeWidth={1.6}
                            aria-hidden="true"
                          />
                          <span>{label}</span>
                          <span className="feedback-choice-end">
                            {overall === index + 1 ? (
                              <Check size={20} aria-hidden="true" />
                            ) : (
                              <span className="feedback-radio-mark" />
                            )}
                          </span>
                        </Choice>
                      );
                    })}
                  </fieldset>
                )}

                {step === 1 && (
                  <div className="feedback-aspects">
                    <div className="feedback-scale" aria-label="Escala de avaliação">
                      {RATING_LABELS.map((label, index) => (
                        <span key={label}>
                          <b>{index + 1}</b> {label}
                        </span>
                      ))}
                    </div>
                    {FEEDBACK_ASPECTS.map(({ key, label, description }) => (
                      <fieldset key={key} className="feedback-aspect">
                        <legend>{label}</legend>
                        <p>{description}</p>
                        <div className="feedback-rating-grid">
                          {RATING_LABELS.map((ratingLabel, index) => (
                            <Choice
                              key={ratingLabel}
                              name={key}
                              value={String(index + 1)}
                              label={ratingLabel}
                              checked={aspects[key] === index + 1}
                              onChange={() => {
                                setAspects((current) => ({
                                  ...current,
                                  [key]: (index + 1) as Rating,
                                }));
                                setError("");
                              }}
                            >
                              <span>{index + 1}</span>
                            </Choice>
                          ))}
                        </div>
                        <Choice
                          name={key}
                          value="not_used"
                          checked={aspects[key] === "not_used"}
                          className="feedback-not-used"
                          onChange={() => {
                            setAspects((current) => ({ ...current, [key]: "not_used" }));
                            setError("");
                          }}
                        >
                          <span>Não participei / Não utilizei</span>
                          {aspects[key] === "not_used" && <Check size={16} aria-hidden="true" />}
                        </Choice>
                      </fieldset>
                    ))}
                  </div>
                )}

                {step === 2 && (
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
                        <span className="feedback-contribution-icon" aria-hidden="true">
                          {Array.from({ length: index + 1 }, (_, n) => (
                            <span key={n} />
                          ))}
                        </span>
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
                )}

                {step === 3 && (
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

                {step === 4 && (
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
                      rows={6}
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
                  <button
                    type="button"
                    className="feedback-back"
                    onClick={() => move(step - 1)}
                    disabled={sending}
                  >
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
                  ) : step === 4 ? (
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
        <footer className="feedback-footer">
          <Music2 size={17} aria-hidden="true" />
          <span>Encontro de Coros · Ceará</span>
        </footer>
      </main>
    </div>
  );
}
