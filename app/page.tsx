"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "prize-check-theme";
const THEME_CHANGE_EVENT = "prize-check-theme-change";

function getThemeSnapshot(): Theme {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeToTheme(onChange: () => void): () => void {
  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  colorScheme.addEventListener("change", onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    colorScheme.removeEventListener("change", onChange);
  };
}

function getServerThemeSnapshot(): Theme {
  return "light";
}

type PrizeCategory = {
  id: string;
  name: string;
  drawType: "FULL_TICKET" | "LAST_3_DIGITS";
};

type PublicDraw = {
  id: string;
  drawnNumber: string;
  winnersCount: number;
  announcedAt: string | null;
  prizeCategory: PrizeCategory;
  prizeResults: { ticket: { number: string } }[];
};

type PublicEvent = {
  id: string;
  name: string;
  description: string | null;
  ticketCount: number;
  status: "ACTIVE" | "COMPLETED";
  createdAt: string;
  prizeCategories: PrizeCategory[];
  drawHistories: PublicDraw[];
};

type TicketLookup = {
  ticketNumber: string;
  ticketExists: boolean;
  won: boolean;
  demo?: boolean;
  wins: {
    wonAt: string;
    prizeCategory: PrizeCategory;
    drawHistory: { drawnNumber: string; announcedAt: string | null };
  }[];
};

async function getApiData<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "ไม่สามารถโหลดข้อมูลได้";
    throw new Error(message);
  }
  return payload as T;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "รอประกาศ";
  }
  return new Date(value).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Home() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [lookup, setLookup] = useState<TicketLookup | null>(null);
  const [celebration, setCelebration] = useState<TicketLookup | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [checkingTicket, setCheckingTicket] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const celebrationCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!celebration) {
      return;
    }

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const timeout = window.setTimeout(() => setCelebration(null), 10_000);
    document.body.style.overflow = "hidden";
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCelebration(null);
        return;
      }
      if (event.key === "Tab") {
        const focusableElements = document.querySelectorAll<HTMLElement>(
          ".celebration-card button",
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleDialogKeys);
    celebrationCloseRef.current?.focus();
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("keydown", handleDialogKeys);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [celebration]);

  useEffect(() => {
    let active = true;
    getApiData<{ events: PublicEvent[]; demo?: boolean }>("/api/public/events")
      .then(({ events: loadedEvents, demo }) => {
        if (!active) {
          return;
        }
        setEvents(loadedEvents);
        setDemoMode(Boolean(demo));
        const activeEvent = loadedEvents.find((event) => event.status === "ACTIVE");
        setSelectedEventId(activeEvent?.id ?? loadedEvents[0]?.id ?? "");
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "ไม่สามารถโหลดข้อมูลได้");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingEvents(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId],
  );

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  async function checkTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookup(null);
    setCelebration(null);
    setLookupError("");
    setError("");

    if (!selectedEvent) {
      setLookupError("ขณะนี้ยังไม่มีกิจกรรมให้ตรวจสอบ");
      return;
    }
    if (!/^(?!00000)\d{5}$/.test(ticketNumber)) {
      setLookupError("กรุณากรอกหมายเลขสลาก 5 หลัก ตั้งแต่ 00001 ถึง 99999");
      return;
    }

    setCheckingTicket(true);
    try {
      const result = await getApiData<TicketLookup>(
        `/api/public/events/${encodeURIComponent(selectedEvent.id)}/tickets/${ticketNumber}`,
      );
      setLookup(result);
      if (result.won) {
        setCelebration(result);
      }
    } catch (cause) {
      setLookupError(cause instanceof Error ? cause.message : "ตรวจสอบสลากไม่สำเร็จ");
    } finally {
      setCheckingTicket(false);
    }
  }

  return (
    <div className="site-shell" data-theme={theme}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="ตรวจสอบรางวัล หน้าหลัก">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>
            <span className="brand-title">PRIZE CHECK</span>
            <span className="brand-subtitle">เว็บตรวจสอบรางวัล</span>
          </span>
        </Link>
        <div className="topbar-actions">
          <button
            aria-label={`เปลี่ยนเป็นโหมด${theme === "light" ? "มืด" : "สว่าง"}`}
            aria-pressed={theme === "dark"}
            className="theme-toggle"
            onClick={toggleTheme}
            type="button"
          >
            <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
            {theme === "light" ? "โหมดมืด" : "โหมดสว่าง"}
          </button>
          <Link className="topbar-link" href="/admin">
            <span aria-hidden="true">▦</span>
            สำหรับผู้ดูแล
          </Link>
        </div>
      </header>

      <main className="home-main">
        <section className="panel results-panel" aria-labelledby="latest-results-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Winning numbers</span>
              <h2 id="latest-results-title">ผลรางวัลประจำงวด</h2>
              <p>เลขรางวัลและรายชื่อผู้โชคดี อัปเดตจากผลที่ประกาศแล้ว</p>
            </div>
            {selectedEvent && <span className="draw-type-pill">{selectedEvent.drawHistories.length} รอบ</span>}
          </div>

          {!selectedEvent ? (
            <div className="empty-state">
              {loadingEvents ? "กำลังโหลดผลรางวัล..." : "ยังไม่มีกิจกรรมที่เปิดให้ตรวจสอบ"}
            </div>
          ) : (
            <div className="draw-board">
              {selectedEvent.prizeCategories.length > 0 ? (
                selectedEvent.prizeCategories.map((prize, index) => {
                  const draws = selectedEvent.drawHistories.filter(
                    (draw) => draw.prizeCategory.id === prize.id,
                  );
                  const winnerCount = draws.reduce(
                    (total, draw) => total + draw.winnersCount,
                    0,
                  );
                  const isLastThree = prize.drawType === "LAST_3_DIGITS";

                  return (
                    <article
                      className={`prize-board-card ${index === 0 ? "featured" : ""}`}
                      key={prize.id}
                    >
                      <div className="prize-board-heading">
                        <span className="prize-rank">{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <h3>{prize.name}</h3>
                          <span className="prize-kind">
                            {isLastThree ? "เลขท้าย 3 ตัว" : "รางวัลเลข 5 หลัก"}
                          </span>
                        </div>
                        {draws.length > 0 && (
                          <span className="prize-winner-count">{winnerCount} รางวัล</span>
                        )}
                      </div>

                      {draws.length > 0 ? (
                        <>
                          <div className={`prize-number-list ${isLastThree ? "last-three-list" : ""}`}>
                            {draws.map((draw) => (
                              <span className="prize-number-tile" key={draw.id}>
                                {draw.drawnNumber}
                              </span>
                            ))}
                          </div>
                          {isLastThree && draws.map((draw) => (
                            <div className="last-three-winners" key={`${draw.id}-winners`}>
                              <span>สลากที่ถูกรางวัล</span>
                              <div className="winner-chips">
                                {draw.prizeResults.map(({ ticket }) => (
                                  <span className="winner-chip" key={ticket.number}>
                                    {ticket.number}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                          <p className="prize-announced">
                            ประกาศล่าสุด {formatDate(draws[0].announcedAt)}
                          </p>
                        </>
                      ) : (
                        <div className="prize-pending">รอประกาศผลรางวัล</div>
                      )}
                    </article>
                  );
                })
              ) : (
                <div className="empty-state">
                  {loadingEvents ? "กำลังโหลดผลรางวัล..." : "กิจกรรมนี้ยังไม่มีประเภทรางวัล"}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="content-grid">
          <div className="stack">
            <section className="panel" aria-labelledby="ticket-lookup-title">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Prize checker</span>
                  <h2 id="ticket-lookup-title">ตรวจสอบรางวัลของฉัน</h2>
                  <p>เลือกกิจกรรม กรอกหมายเลขสลาก 5 หลัก แล้วกดตรวจผล</p>
                </div>
                {selectedEvent && (
                  <span className={`status-pill ${selectedEvent.status}`}>
                    {selectedEvent.status === "ACTIVE" ? "กำลังดำเนินการ" : "ปิดกิจกรรม"}
                  </span>
                )}
              </div>

              {demoMode && (
                <div className="notice demo-notice" role="status">
                  กำลังแสดงข้อมูลตัวอย่าง ลองตรวจหมายเลข <strong>30656</strong>,{" "}
                  <strong>38335</strong>, <strong>74388</strong> หรือ <strong>30690</strong>{" "}
                  — เชื่อมต่อฐานข้อมูลเพื่อใช้ผลรางวัลจริง
                </div>
              )}
              {error && <div className="notice" role="alert">{error}</div>}
              <form className="lookup-form" onSubmit={checkTicket}>
                <div>
                  <label className="field-label" htmlFor="event-select">กิจกรรม</label>
                  <select
                    className="select-field"
                    id="event-select"
                    value={selectedEventId}
                    onChange={(event) => {
                      setSelectedEventId(event.target.value);
                      setLookup(null);
                      setCelebration(null);
                      setLookupError("");
                    }}
                    disabled={loadingEvents || events.length === 0}
                  >
                    {events.length === 0 && <option value="">ยังไม่มีกิจกรรม</option>}
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="ticket-number">หมายเลขสลาก</label>
                  <div className="ticket-input-row">
                    <input
                      autoComplete="off"
                      className="field ticket-number"
                      id="ticket-number"
                      inputMode="numeric"
                      maxLength={5}
                      onChange={(event) => {
                        setTicketNumber(event.target.value.replace(/\D/g, "").slice(0, 5));
                        setLookup(null);
                        setCelebration(null);
                      }}
                      placeholder="00000"
                      value={ticketNumber}
                    />
                    <button
                      className="primary-button"
                      disabled={checkingTicket || loadingEvents || events.length === 0}
                      type="submit"
                    >
                      {checkingTicket ? "กำลังตรวจ..." : "ตรวจผล"}
                    </button>
                  </div>
                </div>
              </form>

              {lookupError && <div className="notice" role="alert">{lookupError}</div>}
              {lookup && (
                <div
                  className={`result-card ${lookup.won ? "is-winner" : ""}`}
                  role="status"
                >
                  <div className="result-status">
                    {lookup.won ? (
                      <span className="result-trophy" aria-hidden="true">★</span>
                    ) : (
                      <span className="status-dot" aria-hidden="true" />
                    )}
                    {lookup.ticketExists
                      ? lookup.won
                        ? `ยินดีด้วย! สลาก ${lookup.ticketNumber} ถูกรางวัล`
                        : `สลาก ${lookup.ticketNumber} ยังไม่ถูกรางวัล`
                      : `ไม่พบสลากหมายเลข ${lookup.ticketNumber} ในกิจกรรมนี้`}
                  </div>
                  {lookup.wins.map((win) => (
                    <p className="result-detail" key={`${win.wonAt}-${win.prizeCategory.name}`}>
                      ประเภทรางวัล <strong>{win.prizeCategory.name}</strong>
                      {" · "}เลขที่ออก {win.drawHistory.drawnNumber}
                      {" · "}ประกาศเมื่อ {formatDate(win.wonAt)}
                    </p>
                  ))}
                </div>
              )}
            </section>

          </div>

          <aside className="stack">
            <section className="panel" aria-labelledby="event-overview-title">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Event overview</span>
                  <h2 id="event-overview-title">ข้อมูลกิจกรรม</h2>
                </div>
                <span aria-hidden="true">◈</span>
              </div>
              {selectedEvent ? (
                <>
                  {selectedEvent.description && (
                    <p className="muted-copy">{selectedEvent.description}</p>
                  )}
                  <div className="event-summary">
                    <div className="event-summary-item">
                      <span>จำนวนสลาก</span>
                      <strong>{selectedEvent.ticketCount.toLocaleString("th-TH")} ใบ</strong>
                    </div>
                    <div className="event-summary-item">
                      <span>ประเภทรางวัล</span>
                      <strong>{selectedEvent.prizeCategories.length} ประเภท</strong>
                    </div>
                    <div className="event-summary-item">
                      <span>สถานะ</span>
                      <strong>
                        {selectedEvent.status === "ACTIVE" ? "กำลังดำเนินการ" : "ปิดกิจกรรม"}
                      </strong>
                    </div>
                  </div>
                  {selectedEvent.prizeCategories.length > 0 && (
                    <div className="prize-list">
                      {selectedEvent.prizeCategories.map((prize) => (
                        <div className="prize-row" key={prize.id}>
                          <strong>{prize.name}</strong>
                          <span className="draw-type-pill">
                            {prize.drawType === "FULL_TICKET" ? "เลข 5 หลัก" : "เลขท้าย 3 ตัว"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  {loadingEvents ? "กำลังโหลดกิจกรรม..." : "ยังไม่มีข้อมูลกิจกรรม"}
                </div>
              )}
            </section>

            <section className="panel">
              <span className="eyebrow">How it works</span>
              <div className="event-summary">
                <div className="event-summary-item">
                  <span>01</span><strong>เลือกกิจกรรมและกรอกหมายเลขสลาก</strong>
                </div>
                <div className="event-summary-item">
                  <span>02</span><strong>กดตรวจผลเพื่อดูรางวัลของคุณ</strong>
                </div>
                <div className="event-summary-item">
                  <span>03</span><strong>ดูเลขที่ออกและผู้โชคดีทั้งหมด</strong>
                </div>
              </div>
              <p className="muted-copy">
                สลากหนึ่งใบมีสิทธิ์รับรางวัลได้ครั้งเดียวต่อกิจกรรม
              </p>
            </section>
          </aside>
        </div>
      </main>

      <footer className="site-footer">
        <span>PRIZE CHECK · เว็บตรวจสอบรางวัล</span>
        <span>ตรวจผลรางวัลได้ทุกหมายเลข โปร่งใส และตรวจสอบย้อนหลังได้</span>
      </footer>

      {celebration && (
        <div
          aria-labelledby="celebration-title"
          aria-modal="true"
          className="celebration-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setCelebration(null);
            }
          }}
          role="dialog"
        >
          <div aria-hidden="true" className="confetti">
            {Array.from({ length: 36 }, (_, index) => (
              <span
                className="confetti-piece"
                key={index}
                style={{
                  left: `${(index * 37) % 100}%`,
                  animationDelay: `${(index % 9) * 0.08}s`,
                }}
              />
            ))}
          </div>
          <section className="celebration-card">
            <button
              aria-label="ปิดหน้าต่างแสดงความยินดี"
              className="celebration-close"
              onClick={() => setCelebration(null)}
              ref={celebrationCloseRef}
              type="button"
            >
              ×
            </button>
            <div aria-hidden="true" className="celebration-medal">★</div>
            <span className="celebration-kicker">LUCKY WINNER</span>
            <h2 id="celebration-title">ยินดีด้วย! คุณถูกรางวัล</h2>
            <p className="celebration-ticket">{celebration.ticketNumber}</p>
            <div className="celebration-prizes">
              {celebration.wins.map((win) => (
                <div className="celebration-prize" key={`${win.wonAt}-${win.prizeCategory.id}`}>
                  <strong>{win.prizeCategory.name}</strong>
                  <span>เลขที่ออก {win.drawHistory.drawnNumber}</span>
                </div>
              ))}
            </div>
            <p className="celebration-caption">ขอให้วันนี้เป็นวันดี ๆ ของคุณ ✨</p>
            <button
              className="celebration-button"
              onClick={() => setCelebration(null)}
              type="button"
            >
              สุดยอด!
            </button>
            <span aria-hidden="true" className="celebration-progress" />
          </section>
        </div>
      )}
    </div>
  );
}
