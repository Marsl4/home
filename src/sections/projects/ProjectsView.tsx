// Hausarbeiten bzw. Präsentationen (Uni → Planung): Projekte aus GitHub, die in VS Code mit Claude entstehen.
// Drei Ebenen: Liste (Kacheln) → Projekt (Abgabe, Fortschritt, Aufgaben, Änderungen) → Ergebnis-PDF.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  FolderGit2,
  History,
  ListTodo,
  Presentation,
  RefreshCw,
} from "lucide-react";

import { PdfViewer } from "../pdfs/PdfViewer";
import { describeGithubError, useGithubSettings, type Project, type ProjectType } from "./github";
import { loadResultFile, refreshProjects, useProjectDetails, useProjects } from "./projectStore";

const LABELS: Record<ProjectType, { plural: string; one: string; result: string }> = {
  hausarbeit: { plural: "Hausarbeiten", one: "Hausarbeit", result: "Hausarbeit lesen" },
  praesentation: { plural: "Präsentationen", one: "Präsentation", result: "Folien ansehen" },
};

type Props = {
  typ: ProjectType;
  repo: string | null; // geöffnetes Projekt (null = Liste)
  version: string | null; // geöffnetes Ergebnis: "latest" oder ein Stand (sha); null = nicht offen
  onOpen: (repo: string | null, version?: string | null) => void;
  onOpenSettings: () => void;
};

export function ProjectsView({ typ, repo, version, onOpen, onOpenSettings }: Props) {
  const { token } = useGithubSettings();
  const { projects, loading, error } = useProjects();
  const ofType = (projects ?? []).filter((p) => p.typ === typ);
  const project = repo ? projects?.find((p) => p.repo === repo) : undefined;
  const Icon = typ === "hausarbeit" ? FileText : Presentation;

  if (!token) {
    return (
      <Page title={LABELS[typ].plural}>
        <div className="english-card center">
          <FolderGit2 size={32} />
          <h2>Mit GitHub verbinden</h2>
          <p className="muted">
            Deine {LABELS[typ].plural} entstehen in VS Code mit Claude und liegen auf GitHub. Damit die Home-App sie
            anzeigen kann, braucht sie einmalig einen Lese-Schlüssel.
          </p>
          <button className="primary-button" onClick={onOpenSettings}>
            Zu den GitHub-Einstellungen
          </button>
        </div>
      </Page>
    );
  }

  if (repo && version && project) {
    return <ResultView project={project} version={version} onBack={() => onOpen(repo)} onVersion={(v) => onOpen(repo, v)} />;
  }

  if (repo) {
    if (!project) {
      return (
        <Page title={LABELS[typ].one} onBack={() => onOpen(null)} backLabel={LABELS[typ].plural}>
          <p className="muted">{loading || projects === null ? "Wird geladen …" : "Dieses Projekt wurde nicht gefunden."}</p>
        </Page>
      );
    }
    return <ProjectDetail project={project} onBack={() => onOpen(null)} onOpenResult={() => onOpen(repo, "latest")} />;
  }

  return (
    <Page
      title={LABELS[typ].plural}
      actions={
        <button className="secondary-button icon-text" onClick={() => refreshProjects(true)} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Aktualisieren
        </button>
      }
    >
      {error ? <p className="settings-status error">{describeGithubError(error)}</p> : null}
      {projects === null ? (
        <p className="muted">Projekte werden geladen …</p>
      ) : ofType.length === 0 ? (
        <div className="english-card center">
          <Icon size={32} />
          <h2>Noch keine {LABELS[typ].plural}</h2>
          <p className="muted">
            Lege in VS Code ein Projekt nach der Vorlage an (Ordner <code>vorlagen/projekt</code> in diesem Projekt) und
            lass Claude es auf GitHub speichern. Es erscheint dann hier.
          </p>
        </div>
      ) : (
        <div className="project-grid">
          {sortProjects(ofType).map((p) => (
            <ProjectCard key={p.repo} project={p} onOpen={() => onOpen(p.repo)} />
          ))}
        </div>
      )}
    </Page>
  );
}

// Was zuerst fällig ist, steht vorne; fertige Projekte ans Ende.
function sortProjects(projects: Project[]): Project[] {
  const rank = (p: Project) => (isDone(p) ? 2 : p.abgabe ? 0 : 1);
  return [...projects].sort(
    (a, b) => rank(a) - rank(b) || (a.abgabe ?? "").localeCompare(b.abgabe ?? "") || b.pushedAt - a.pushedAt,
  );
}

const isDone = (p: Project) => /^(fertig|abgegeben|erledigt)/i.test(p.status ?? "");

// ---------- Kachel ----------
function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const now = useNow();
  const open = project.aufgaben.filter((t) => !t.erledigt).length;
  return (
    <button className="project-card" onClick={onOpen}>
      <div className="project-card-top">
        {project.status && <span className={`project-status ${isDone(project) ? "done" : ""}`}>{project.status}</span>}
        {project.fach && <span className="muted">{project.fach}</span>}
      </div>
      <h3>{project.titel}</h3>
      {project.abgabe && <Deadline date={project.abgabe} done={isDone(project)} />}
      <Progress project={project} />
      <div className="project-card-bottom muted">
        {open > 0 ? `${open} offene Aufgabe${open === 1 ? "" : "n"}` : "Keine offenen Aufgaben"} · geändert{" "}
        {relativeTime(project.pushedAt, now)}
      </div>
    </button>
  );
}

// ---------- Projekt ----------
function ProjectDetail({ project, onBack, onOpenResult }: { project: Project; onBack: () => void; onOpenResult: () => void }) {
  const { details, error, loading } = useProjectDetails(project);
  const label = LABELS[project.typ];

  return (
    <Page
      title={project.titel}
      onBack={onBack}
      backLabel={label.plural}
      actions={
        <a className="secondary-button icon-text" href={project.url} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> GitHub
        </a>
      }
    >
      <div className="project-facts">
        {project.fach && <span className="muted">{project.fach}</span>}
        {project.status && <span className={`project-status ${isDone(project) ? "done" : ""}`}>{project.status}</span>}
      </div>

      <div className="english-card">
        {project.abgabe ? <Deadline date={project.abgabe} done={isDone(project)} big /> : <p className="muted">Kein Abgabetermin eingetragen.</p>}
        <Progress project={project} />
        {project.ergebnis ? (
          <button className="primary-button icon-text" onClick={onOpenResult}>
            {project.typ === "hausarbeit" ? <FileText size={15} /> : <Presentation size={15} />} {label.result}
          </button>
        ) : (
          <p className="muted">Noch kein Ergebnis-PDF eingetragen („ergebnis“ in home.json).</p>
        )}
      </div>

      {project.aufgaben.length > 0 && (
        <div className="english-card">
          <h2 className="project-heading">
            <ListTodo size={17} /> Aufgaben
          </h2>
          <ul className="project-tasks">
            {project.aufgaben.map((task, i) => (
              <li key={i} className={task.erledigt ? "done" : ""}>
                {task.erledigt ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                <span>{task.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="english-card">
        <h2 className="project-heading">
          <History size={17} /> Letzte Änderungen
        </h2>
        {error ? <p className="settings-status error">{describeGithubError(error)}</p> : null}
        {!details ? (
          <p className="muted">{loading ? "Wird geladen …" : "Keine Änderungen gefunden."}</p>
        ) : (
          <ul className="project-changes">
            {details.changes.map((change) => (
              <li key={change.sha}>
                <span>{change.message}</span>
                <span className="muted">
                  {formatDateTime(change.date)} · {change.author}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}

// ---------- Ergebnis-PDF ----------
function ResultView(props: { project: Project; version: string; onBack: () => void; onVersion: (sha: string) => void }) {
  const { project, version, onBack, onVersion } = props;
  const { details, error } = useProjectDetails(project);
  const versions = details?.versions ?? [];
  const sha = version === "latest" ? versions[0]?.sha : version;
  const path = project.ergebnis!;

  // Eigene ID je Projekt + Stand: So gehören Stift-Notizen immer zu genau dieser Fassung
  // und verrutschen nicht, wenn Claude den Text später ändert.
  const pdf = useMemo(
    () =>
      sha
        ? { id: `gh:${project.repo}@${sha}`, name: project.titel, addedAt: 0, lastOpenedAt: null, favorite: false }
        : null,
    [project.repo, project.titel, sha],
  );

  if (!pdf || !sha) {
    return (
      <Page title={project.titel} onBack={onBack} backLabel="Projekt">
        {error ? (
          <p className="settings-status error">{describeGithubError(error)}</p>
        ) : (
          <p className="muted">{details ? `Die Datei „${path}“ gibt es (noch) nicht im Projekt.` : "Wird geladen …"}</p>
        )}
      </Page>
    );
  }

  const versionPicker = (
    <select
      className="project-version-select"
      value={sha}
      onChange={(e) => onVersion(e.target.value === versions[0]?.sha ? "latest" : e.target.value)}
      title="Fassung wählen"
    >
      {(versions.some((v) => v.sha === sha) ? versions : [{ sha, message: "", date: 0, author: "" }, ...versions]).map(
        (v, i) => (
          <option key={v.sha} value={v.sha}>
            {i === 0 && v.sha === versions[0]?.sha ? "Neueste" : v.date ? formatDateTime(v.date) : "Fassung"}
            {v.message ? ` – ${v.message.slice(0, 40)}` : ""}
          </option>
        ),
      )}
    </select>
  );

  const breadcrumb = (
    <button className="breadcrumb-link" onClick={onBack}>
      {LABELS[project.typ].one}
    </button>
  );

  return (
    <PdfViewer
      key={pdf.id}
      pdf={pdf}
      breadcrumb={breadcrumb}
      external={{ loadFile: () => loadResultFile(project.repo, path, sha), headerExtra: versionPicker }}
    />
  );
}

// ---------- Bausteine ----------
function Page(props: { title: string; children: ReactNode; actions?: ReactNode; onBack?: () => void; backLabel?: string }) {
  return (
    <div className="english">
      <div className="english-inner">
        {props.onBack && (
          <button className="breadcrumb-link project-back" onClick={props.onBack}>
            ‹ {props.backLabel ?? "Zurück"}
          </button>
        )}
        <div className="project-title-row">
          <h1 className="browser-title">{props.title}</h1>
          {props.actions}
        </div>
        {props.children}
      </div>
    </div>
  );
}

// Aktuelle Zeit, jede Minute neu (für „Abgabe in 3 Tagen“, „vor 5 Min.“).
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function Deadline({ date, done, big }: { date: string; done: boolean; big?: boolean }) {
  const now = useNow();
  // Kalendertage zählen (heute → Abgabe), nicht Stunden.
  const due = new Date(`${date}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const valid = !Number.isNaN(days);
  const urgent = valid && !done && days <= 7;
  const text = !valid
    ? date
    : done
      ? `Abgabe ${due.toLocaleDateString("de-DE")}`
      : days < 0
        ? `Abgabe war am ${due.toLocaleDateString("de-DE")}`
        : days === 0
          ? "Abgabe heute!"
          : `Abgabe in ${days} Tag${days === 1 ? "" : "en"} (${due.toLocaleDateString("de-DE")})`;
  return (
    <div className={`project-deadline ${urgent ? "urgent" : ""} ${big ? "big" : ""}`}>
      <CalendarClock size={big ? 18 : 14} /> {text}
    </div>
  );
}

function Progress({ project }: { project: Project }) {
  const { ist, ziel, einheit } = project.umfang ?? {};
  if (ist === undefined) return null;
  const unit = einheit ?? (project.typ === "hausarbeit" ? "Wörter" : "Folien");
  const share = ziel ? Math.min(1, ist / ziel) : null;
  return (
    <div className="project-progress">
      <span>
        {ist.toLocaleString("de-DE")}
        {ziel ? ` / ${ziel.toLocaleString("de-DE")}` : ""} {unit}
      </span>
      {share !== null && (
        <div className="project-progress-bar">
          <div style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function relativeTime(time: number, now: number): string {
  const minutes = Math.round((now - time) / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return days === 1 ? "gestern" : `vor ${days} Tagen`;
}

function formatDateTime(time: number): string {
  return new Date(time).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
