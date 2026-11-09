"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [lookup, setLookup] = useState<TicketLookup | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [checkingTicket, setCheckingTicket] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");

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

  async function checkTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookup(null);
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
    } catch (cause) {
      setLookupError(cause instanceof Error ? cause.message : "ตรวจสอบสลากไม่สำเร็จ");
    } finally {
      setCheckingTicket(false);
    }
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="ตรวจสอบรางวัล หน้าหลัก">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>
            <span className="brand-title">PRIZE CHECK</span>
            <span className="brand-subtitle">เว็บตรวจสอบรางวัล</span>
          </span>
        </Link>
        <Link className="topbar-link" href="/admin">
          <span aria-hidden="true">▦</span>
          สำหรับผู้ดูแล
        </Link>
      </header>

      <main className="home-main">
        <section className="hero">
          <div className="hero-copy">
            <span className="hero-kicker">Check your lucky number</span>
            <h1>ตรวจสอบรางวัล<br />ได้ทันที</h1>
            <p>
              กรอกหมายเลขสลาก 5 หลักของคุณ แล้วดูผลรางวัลได้ทันที
              พร้อมรายชื่อผู้โชคดีและประวัติการประกาศผลที่ตรวจสอบได้
            </p>
          </div>
          <div className="hero-emblem" aria-hidden="true"><span>✦</span></div>
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
                  กำลังแสดงข้อมูลตัวอย่าง ลองตรวจหมายเลข <strong>01287</strong>,{" "}
                  <strong>01942</strong>, <strong>00128</strong> หรือ <strong>01128</strong>{" "}
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
                <div className={`result-card ${lookup.won ? "is-winner" : ""}`} role="status">
                  <div className="result-status">
                    <span className="status-dot" aria-hidden="true" />
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

            <section className="panel" aria-labelledby="latest-results-title">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Winning numbers</span>
                  <h2 id="latest-results-title">ประกาศผลรางวัล</h2>
                  <p>เลขที่ออกและรายชื่อผู้ถูกรางวัลที่ประกาศแล้ว</p>
                </div>
                {selectedEvent && <span className="draw-type-pill">{selectedEvent.drawHistories.length} รอบ</span>}
              </div>

              {!selectedEvent && !loadingEvents ? (
                <div className="empty-state">ยังไม่มีกิจกรรมที่เปิดให้ตรวจสอบ</div>
              ) : selectedEvent?.drawHistories.length ? (
                <div className="result-list">
                  {selectedEvent.drawHistories.map((draw) => (
                    <article className="history-row" key={draw.id}>
                      <span className="history-icon" aria-hidden="true">✦</span>
                      <span>
                        <span className="history-name">{draw.prizeCategory.name}</span>
                        <span className="history-meta">
                          {formatDate(draw.announcedAt)} · ผู้ถูกรางวัล {draw.winnersCount} ใบ
                        </span>
                        {draw.prizeResults.length > 0 && (
                          <span className="winner-chips">
                            {draw.prizeResults.map(({ ticket }) => (
                              <span className="winner-chip" key={ticket.number}>{ticket.number}</span>
                            ))}
                          </span>
                        )}
                      </span>
                      <span className="history-number">{draw.drawnNumber}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  {loadingEvents ? "กำลังโหลดผลรางวัล..." : "กิจกรรมนี้ยังไม่มีผลประกาศ"}
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
    </div>
  );
}
