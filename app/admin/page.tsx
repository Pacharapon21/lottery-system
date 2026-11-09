"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Admin = { id: string; email: string };
type DrawType = "FULL_TICKET" | "LAST_3_DIGITS";
type PrizeCategory = { id: string; name: string; drawType: DrawType };

type AdminDraw = {
  id: string;
  drawnNumber: string;
  status: "PENDING" | "CONFIRMED" | "ANNOUNCED";
  winnersCount: number;
  startedAt: string;
  confirmedAt: string | null;
  announcedAt: string | null;
  prizeCategory: PrizeCategory;
  prizeResults: { ticket: { number: string } }[];
};

type AdminAuditLog = {
  id: string;
  action: string;
  details: unknown;
  createdAt: string;
  admin: { email: string } | null;
};

type AdminEvent = {
  id: string;
  name: string;
  description: string | null;
  ticketCount: number;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
  createdAt: string;
  prizeCategories: PrizeCategory[];
  drawHistories: AdminDraw[];
  auditLogs: AdminAuditLog[];
};

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers,
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "คำขอไม่สำเร็จ";
    throw new Error(message);
  }
  return payload as T;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: AdminEvent["status"] | AdminDraw["status"]) {
  const labels = {
    DRAFT: "ฉบับร่าง",
    ACTIVE: "กำลังดำเนินการ",
    COMPLETED: "ปิดกิจกรรม",
    PENDING: "รอยืนยัน",
    CONFIRMED: "ยืนยันแล้ว",
    ANNOUNCED: "ประกาศแล้ว",
  };
  return labels[status];
}

function auditLabel(action: string): string {
  const labels: Record<string, string> = {
    EVENT_CREATED: "สร้างกิจกรรม",
    EVENT_UPDATED: "แก้ไขกิจกรรม",
    EVENT_DELETED: "ลบกิจกรรม",
    PRIZE_CATEGORY_CREATED: "เพิ่มประเภทรางวัล",
    DRAW_STARTED: "เริ่มสุ่มผล",
    DRAW_CONFIRMED: "ยืนยันผล",
    DRAW_ANNOUNCED: "ประกาศผล",
    ADMIN_LOGIN: "เข้าสู่ระบบ",
  };
  return labels[action] ?? action;
}

export default function AdminPage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginBusy, setLoginBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const session = await apiRequest<{ admin: Admin | null }>(
          "/api/admin/auth/session",
        );
        if (!active) {
          return;
        }
        setAdmin(session.admin);
        if (session.admin) {
          const result = await apiRequest<{ events: AdminEvent[] }>(
            "/api/admin/events",
          );
          if (active) {
            setEvents(result.events);
          }
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  async function refreshEvents() {
    const result = await apiRequest<{ events: AdminEvent[] }>("/api/admin/events");
    setEvents(result.events);
  }

  async function performAction(
    key: string,
    operation: () => Promise<unknown>,
    successMessage: string,
  ): Promise<boolean> {
    setBusyAction(key);
    setError("");
    setSuccess("");
    try {
      await operation();
      await refreshEvents();
      setSuccess(successMessage);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ");
      return false;
    } finally {
      setBusyAction("");
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoginBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ admin: Admin }>("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      setAdmin(result.admin);
      await refreshEvents();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    setBusyAction("logout");
    setError("");
    try {
      await apiRequest("/api/admin/auth/logout", { method: "POST" });
      setAdmin(null);
      setEvents([]);
      setSuccess("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ออกจากระบบไม่สำเร็จ");
    } finally {
      setBusyAction("");
    }
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ticketCount = Number(form.get("ticketCount"));
    const succeeded = await performAction(
      "create",
      () =>
        apiRequest("/api/admin/events", {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            description: form.get("description"),
            ticketCount,
          }),
        }),
      "สร้างกิจกรรมและหมายเลขสลากเรียบร้อยแล้ว",
    );
    if (succeeded) {
      formElement.reset();
    }
  }

  async function addPrize(
    event: FormEvent<HTMLFormElement>,
    eventId: string,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const succeeded = await performAction(
      `prize-${eventId}`,
      () =>
        apiRequest(`/api/admin/events/${eventId}/prizes`, {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            drawType: form.get("drawType"),
          }),
        }),
      "เพิ่มประเภทรางวัลเรียบร้อยแล้ว",
    );
    if (succeeded) {
        formElement.reset();
    }
  }

  async function editEvent(
    event: FormEvent<HTMLFormElement>,
    eventId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await performAction(
      `edit-${eventId}`,
      () =>
        apiRequest(`/api/admin/events/${eventId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.get("name"),
            description: form.get("description"),
          }),
        }),
      "บันทึกข้อมูลกิจกรรมแล้ว",
    );
  }

  async function startDraw(eventId: string, prizeCategoryId: string) {
    await performAction(
      `draw-${eventId}`,
      () =>
        apiRequest(`/api/admin/events/${eventId}/draws`, {
          method: "POST",
          body: JSON.stringify({ prizeCategoryId }),
        }),
      "บันทึกผลการสุ่มแล้ว กรุณาตรวจสอบและยืนยันผล",
    );
  }

  async function updateStatus(
    eventId: string,
    status: "ACTIVE" | "COMPLETED",
  ) {
    await performAction(
      `status-${eventId}`,
      () =>
        apiRequest(`/api/admin/events/${eventId}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      status === "ACTIVE" ? "เปิดกิจกรรมแล้ว" : "ปิดกิจกรรมแล้ว",
    );
  }

  if (loading) {
    return (
      <div className="admin-shell">
        <AdminHeader />
        <main className="admin-main"><div className="panel empty-state">กำลังเชื่อมต่อระบบ...</div></main>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <AdminHeader admin={admin} onLogout={logout} busy={busyAction === "logout"} />
      <main className="admin-main">
        {!admin ? (
          <div className="login-wrap">
            <section className="login-card">
              <span className="eyebrow">Admin access</span>
              <h1>เข้าสู่ระบบผู้ดูแล</h1>
              <p>ใช้บัญชีผู้ดูแลที่ตั้งค่าไว้ในระบบเพื่อจัดการกิจกรรมและผลรางวัล</p>
              {error && <div className="notice" role="alert">{error}</div>}
              <form className="form-stack" onSubmit={login}>
                <div>
                  <label className="field-label" htmlFor="admin-email">อีเมล</label>
                  <input
                    autoComplete="username"
                    className="field"
                    id="admin-email"
                    name="email"
                    required
                    type="email"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="admin-password">รหัสผ่าน</label>
                  <input
                    autoComplete="current-password"
                    className="field"
                    id="admin-password"
                    name="password"
                    required
                    type="password"
                  />
                </div>
                <button className="primary-button full-width" disabled={loginBusy} type="submit">
                  {loginBusy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
                </button>
              </form>
            </section>
          </div>
        ) : (
          <>
            <div className="admin-heading">
              <div>
                <span className="eyebrow">Lucky draw control room</span>
                <h1>จัดการกิจกรรม</h1>
                <p>สร้างสลาก กำหนดรางวัล และตรวจสอบผลก่อนประกาศทุกครั้ง</p>
              </div>
              <span className="draw-type-pill">{admin.email}</span>
            </div>

            {error && <div className="notice" role="alert">{error}</div>}
            {success && <div className="notice success-notice" role="status">{success}</div>}

            <div className="admin-layout">
              <section className="panel create-panel">
                <span className="eyebrow">New event</span>
                <h2 className="section-heading">สร้างกิจกรรม</h2>
                <p className="muted-copy">
                  ระบบสร้างหมายเลขสลากไม่ซ้ำตั้งแต่ 00001 ตามจำนวนที่กำหนด
                </p>
                <form className="form-stack" onSubmit={createEvent}>
                  <div>
                    <label className="field-label" htmlFor="event-name">ชื่อกิจกรรม</label>
                    <input className="field" id="event-name" maxLength={120} name="name" required />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="event-description">รายละเอียด</label>
                    <textarea className="textarea-field" id="event-description" maxLength={5000} name="description" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="ticket-count">จำนวนสลาก</label>
                    <input
                      className="field"
                      id="ticket-count"
                      max={99999}
                      min={1}
                      name="ticketCount"
                      required
                      type="number"
                    />
                    <p className="muted-copy">กำหนดได้ 1–99,999 ใบ หมายเลขเริ่มจาก 00001</p>
                  </div>
                  <button className="primary-button full-width" disabled={busyAction !== ""} type="submit">
                    {busyAction === "create" ? "กำลังสร้างสลาก..." : "สร้างกิจกรรม"}
                  </button>
                </form>
              </section>

              <section className="event-list" aria-label="รายการกิจกรรม">
                {events.length === 0 ? (
                  <div className="panel admin-empty">
                    <h2>ยังไม่มีกิจกรรม</h2>
                    <p>เริ่มต้นด้วยการสร้างกิจกรรมและกำหนดจำนวนสลาก</p>
                  </div>
                ) : events.map((event) => {
                  const pendingDraw = event.drawHistories.some((draw) => draw.status === "PENDING");
                  return (
                    <article className="event-card" key={event.id}>
                      <div className="event-card-top">
                        <div className="event-heading">
                          <div>
                            <h2>{event.name}</h2>
                            <p>{event.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
                          </div>
                          <span className={`status-pill ${event.status}`}>{statusLabel(event.status)}</span>
                        </div>
                        <div className="event-metrics">
                          <span className="metric-chip">{event.ticketCount.toLocaleString("th-TH")} สลาก</span>
                          <span className="metric-chip">{event.prizeCategories.length} ประเภทรางวัล</span>
                          <span className="metric-chip">{event.drawHistories.length} รอบสุ่ม</span>
                          <span className="metric-chip">สร้างเมื่อ {formatDate(event.createdAt)}</span>
                        </div>
                        <div className="event-actions">
                          {event.status === "DRAFT" && (
                            <>
                              <button
                                className="primary-button"
                                disabled={busyAction !== ""}
                                onClick={() => void updateStatus(event.id, "ACTIVE")}
                                type="button"
                              >
                                เปิดกิจกรรม
                              </button>
                              <button
                                className="danger-button"
                                disabled={busyAction !== ""}
                                onClick={() =>
                                  void performAction(
                                    `delete-${event.id}`,
                                    () => apiRequest(`/api/admin/events/${event.id}`, { method: "DELETE" }),
                                    "ลบกิจกรรมฉบับร่างแล้ว",
                                  )
                                }
                                type="button"
                              >
                                ลบฉบับร่าง
                              </button>
                            </>
                          )}
                          {event.status === "ACTIVE" && (
                            <button
                              className="secondary-button"
                              disabled={busyAction !== "" || pendingDraw}
                              onClick={() => void updateStatus(event.id, "COMPLETED")}
                              type="button"
                            >
                              ปิดกิจกรรม
                            </button>
                          )}
                        </div>
                        <details className="edit-details">
                          <summary>แก้ไขชื่อและรายละเอียด</summary>
                          <form onSubmit={(formEvent) => void editEvent(formEvent, event.id)}>
                            <input className="field" defaultValue={event.name} maxLength={120} name="name" required />
                            <textarea className="textarea-field" defaultValue={event.description ?? ""} maxLength={5000} name="description" />
                            <button className="quiet-button" disabled={busyAction !== ""} type="submit">บันทึก</button>
                          </form>
                        </details>
                      </div>

                      <div className="event-body">
                        <section className="event-section">
                          <h3 className="event-section-title">ประเภทรางวัล</h3>
                          {event.status !== "COMPLETED" && (
                            <form className="inline-form" onSubmit={(formEvent) => void addPrize(formEvent, event.id)}>
                              <input className="field" maxLength={120} name="name" placeholder="ชื่อรางวัล เช่น รางวัลที่ 1" required />
                              <select className="select-field" name="drawType" defaultValue="FULL_TICKET">
                                <option value="FULL_TICKET">สลากเต็ม 5 หลัก</option>
                                <option value="LAST_3_DIGITS">เลขท้าย 3 หลัก</option>
                              </select>
                              <button className="secondary-button" disabled={busyAction !== ""} type="submit">เพิ่มรางวัล</button>
                            </form>
                          )}
                          {event.prizeCategories.length > 0 ? (
                            <div className="prize-list">
                              {event.prizeCategories.map((prize) => (
                                <div className="prize-row" key={prize.id}>
                                  <strong>{prize.name}</strong>
                                  <span className="draw-type-pill">
                                    {prize.drawType === "FULL_TICKET" ? "เลข 5 หลัก" : "เลขท้าย 3 ตัว"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : <p className="muted-copy">ยังไม่ได้กำหนดประเภทรางวัล</p>}
                        </section>

                        {event.status === "ACTIVE" && event.prizeCategories.length > 0 && (
                          <section className="event-section">
                            <h3 className="event-section-title">เริ่มสุ่มรางวัล</h3>
                            {pendingDraw ? (
                              <p className="muted-copy">มีผลรอการยืนยัน กิจกรรมจะสุ่มรอบใหม่ไม่ได้จนกว่าจะยืนยันผล</p>
                            ) : (
                              <div className="prize-list">
                                {event.prizeCategories.map((prize) => (
                                  <div className="prize-row" key={prize.id}>
                                    <span>
                                      <strong>{prize.name}</strong>
                                      <span className="history-meta">
                                        {prize.drawType === "FULL_TICKET" ? " สุ่มสลากเต็ม 5 หลัก" : " สุ่มเลขท้าย 3 หลัก"}
                                      </span>
                                    </span>
                                    <button
                                      className="primary-button"
                                      disabled={busyAction !== ""}
                                      onClick={() => void startDraw(event.id, prize.id)}
                                      type="button"
                                    >
                                      {busyAction === `draw-${event.id}` ? "กำลังสุ่ม..." : "เริ่มสุ่ม"}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        )}

                        <section className="event-section">
                          <h3 className="event-section-title">ประวัติการสุ่มและผล</h3>
                          {event.drawHistories.length === 0 ? (
                            <p className="muted-copy">ยังไม่มีประวัติการสุ่ม</p>
                          ) : event.drawHistories.map((draw) => (
                            <div className="draw-box" key={draw.id}>
                              <div className="draw-heading">
                                <strong>{draw.prizeCategory.name}</strong>
                                <span className={`status-pill ${draw.status}`}>{statusLabel(draw.status)}</span>
                              </div>
                              <div className="draw-number">{draw.drawnNumber}</div>
                              <div className="draw-meta">
                                {formatDate(draw.startedAt)} · ผู้ถูกรางวัลจริง {draw.winnersCount} ใบ
                              </div>
                              {draw.prizeResults.length > 0 ? (
                                <div className="draw-results">
                                  {draw.prizeResults.map(({ ticket }) => (
                                    <span className="winner-chip" key={ticket.number}>{ticket.number}</span>
                                  ))}
                                </div>
                              ) : (
                                <p className="muted-copy">ไม่มีสลากที่ยังมีสิทธิ์ตรงกับผลสุ่มนี้</p>
                              )}
                              {draw.status === "PENDING" && (
                                <div className="draw-actions">
                                  <button
                                    className="primary-button"
                                    disabled={busyAction !== ""}
                                    onClick={() =>
                                      void performAction(
                                        `confirm-${draw.id}`,
                                        () => apiRequest(`/api/admin/draws/${draw.id}/confirm`, { method: "POST" }),
                                        "ยืนยันผลการสุ่มแล้ว",
                                      )
                                    }
                                    type="button"
                                  >
                                    ยืนยันผล
                                  </button>
                                </div>
                              )}
                              {draw.status === "CONFIRMED" && (
                                <div className="draw-actions">
                                  <button
                                    className="secondary-button"
                                    disabled={busyAction !== ""}
                                    onClick={() =>
                                      void performAction(
                                        `announce-${draw.id}`,
                                        () => apiRequest(`/api/admin/draws/${draw.id}/announce`, { method: "POST" }),
                                        "ประกาศผลรางวัลแล้ว",
                                      )
                                    }
                                    type="button"
                                  >
                                    ประกาศผล
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </section>

                        <section className="event-section">
                          <h3 className="event-section-title">บันทึกการจัดการล่าสุด</h3>
                          {event.auditLogs.length === 0 ? (
                            <p className="muted-copy">ยังไม่มีบันทึก</p>
                          ) : (
                            <div className="result-list">
                              {event.auditLogs.map((entry) => (
                                <div className="history-row" key={entry.id}>
                                  <span className="history-icon" aria-hidden="true">⌁</span>
                                  <span>
                                    <span className="history-name">{auditLabel(entry.action)}</span>
                                    <span className="history-meta">{entry.admin?.email ?? "ระบบ"} · {formatDate(entry.createdAt)}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    </article>
                  );
                })}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function AdminHeader({
  admin,
  onLogout,
  busy = false,
}: {
  admin?: Admin | null;
  onLogout?: () => void;
  busy?: boolean;
}) {
  return (
    <header className="topbar admin-topbar">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">✦</span>
        <span>
          <span className="brand-title">LUCKY DRAW</span>
          <span className="brand-subtitle">พื้นที่ผู้ดูแลระบบ</span>
        </span>
      </Link>
      <div className="event-actions">
        <Link className="topbar-link" href="/">ดูหน้าสาธารณะ</Link>
        {admin && onLogout && (
          <button className="quiet-button" disabled={busy} onClick={onLogout} type="button">
            ออกจากระบบ
          </button>
        )}
      </div>
    </header>
  );
}
