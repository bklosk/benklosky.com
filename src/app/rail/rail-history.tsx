"use client";

// Every meaningful transmission the home SDR heard, newest first, with the event Jev extracted from it.
// Renders nothing until the rail hub answers (and nothing if it can't be reached).
import { useEffect, useRef, useState } from "react";
import { categoryColors, clipTime, humanize, type RailClip } from "./rail";
import { rail, useRail } from "./rail-store";

function EventCell({ clip }: { clip: RailClip }) {
  const event = clip.event;
  if (!event) return <span className="rail-muted">…</span>;
  if (event.clip_kind && event.clip_kind !== "operational") return <span className="rail-muted">{humanize(event.clip_kind)}</span>;
  return (
    <span className="rail-event">
      <span className="rail-swatch" style={{ background: categoryColors[event.event_category ?? ""] ?? categoryColors.communication }} />
      <span>
        {humanize(event.primary_event)}
        {event.speaker_role && event.speaker_role !== "unknown" ? (
          <span className="rail-muted"> · {humanize(event.speaker_role).toLowerCase()}</span>
        ) : null}
        {clip.run_id ? <span className="rail-run">{clip.run_id}</span> : null}
      </span>
    </span>
  );
}

function where(clip: RailClip) {
  const event = clip.event;
  return [event?.track, event?.location, event?.direction ? `${event.direction}bound` : null].filter(Boolean).join(" · ");
}

export function RailHistory() {
  const state = useRail();
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const today = new Date().toDateString();

  // Server-side full-text search, a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (q !== rail.get().filters.q) rail.setFilters({ q: q.trim() });
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  if (state.status !== "on") return null;

  const play = (clip: RailClip) => {
    const element = audio.current;
    if (!element || !clip.audio) return;
    if (playing === clip.name) {
      element.pause();
      return;
    }
    element.src = rail.url(clip.audio);
    element.play().then(() => setPlaying(clip.name), () => setPlaying(null));
  };

  const channels = [...state.channels].filter((channel) => channel.label).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="rail-history" aria-label="Radio history">
      <header className="rail-history-head">
        <h2>Radio log</h2>
        <p className="rail-muted">From a home RTL-SDR: Parakeet transcripts, events from Jev, runs from Luna.</p>
      </header>
      <div className="rail-controls">
        <input type="search" placeholder="Search transcripts" value={q} onChange={(event) => setQ(event.target.value)} />
        <select value={state.filters.channel} onChange={(event) => rail.setFilters({ channel: event.target.value })}>
          <option value="">All channels</option>
          {channels.map((channel) => (
            <option key={channel.name} value={channel.name}>
              {channel.name} · {channel.label}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={state.filters.eventsOnly}
            onChange={(event) => rail.setFilters({ eventsOnly: event.target.checked })}
          />
          Operational only
        </label>
        {state.loading ? <span className="rail-muted">Loading…</span> : null}
      </div>
      <div className="rail-table-wrap">
        <table className="rail-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Channel</th>
              <th>Transcript</th>
              <th>Event</th>
              <th>Train</th>
              <th>Where</th>
              <th aria-label="Audio" />
            </tr>
          </thead>
          <tbody>
            {state.history.map((clip) => (
              <tr
                key={clip.name}
                className={state.selected === clip.name ? "rail-selected" : undefined}
                onClick={() => rail.select(clip.name)}
              >
                <td className="rail-time">{clipTime(clip, new Date(clip.t).toDateString() !== today)}</td>
                <td className="rail-channel">
                  <span>{clip.channel}</span>
                  <span className="rail-muted">{clip.label || clip.freq}</span>
                </td>
                <td className="rail-text">{clip.text}</td>
                <td>
                  <EventCell clip={clip} />
                </td>
                <td>{clip.event?.train_ref ?? ""}</td>
                <td>{where(clip)}</td>
                <td>
                  {clip.audio ? (
                    <button
                      type="button"
                      className="rail-play"
                      aria-label={playing === clip.name ? "Pause" : "Play"}
                      onClick={(event) => {
                        event.stopPropagation();
                        play(clip);
                      }}
                    >
                      {playing === clip.name ? "❚❚" : "▶"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!state.history.length && !state.loading ? <p className="rail-muted rail-empty">No transmissions match.</p> : null}
      </div>
      {state.more ? (
        <button type="button" className="rail-more" onClick={() => rail.loadMore()} disabled={state.loading}>
          Older
        </button>
      ) : null}
      <audio ref={audio} preload="none" onPause={() => setPlaying(null)} onEnded={() => setPlaying(null)} />
    </section>
  );
}
