// Personen verwalten: hinzufügen, umbenennen, auswählen, löschen.
// Jede Person hat eigenen Einstufungstest, Lernplan und eigene Vokabeln mit Lernstand.
import { useState } from "react";
import { Check, Trash2, UserPlus } from "lucide-react";

import type { EnglishProfile } from "../../storage/db";
import { useEnglish } from "./EnglishContext";

export function PeopleView({ onStartTest }: { onStartTest: () => void }) {
  const { profiles, profileId, selectProfile, addProfile, deleteProfile } = useEnglish();

  return (
    <>
      <p className="muted">
        Jede Person hat ihren eigenen Einstufungstest, Lernplan und eigene Vokabeln mit Lernstand. Wer gerade
        lernt, wählst du oben in der Leiste.
      </p>
      <div className="english-card english-people">
        {profiles.map((profile) => (
          <PersonRow
            key={profile.id}
            profile={profile}
            active={profile.id === profileId}
            canDelete={profiles.length > 1}
            onSelect={() => selectProfile(profile.id)}
            onDelete={() => {
              const ok = window.confirm(
                `„${profile.name}“ löschen?\n\nDabei werden auch Einstufungstest, Lernplan und alle Vokabeln dieser Person gelöscht.`,
              );
              if (ok) deleteProfile(profile.id);
            }}
          />
        ))}
      </div>
      <button
        className="primary-button"
        onClick={() => {
          addProfile();
          onStartTest(); // neue Person beginnt mit dem Einstufungstest
        }}
      >
        <UserPlus size={15} /> Person hinzufügen
      </button>
    </>
  );
}

function PersonRow(props: {
  profile: EnglishProfile;
  active: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { renameProfile } = useEnglish();
  const [name, setName] = useState(props.profile.name);
  const save = () => {
    if (name.trim()) renameProfile(props.profile.id, name);
    else setName(props.profile.name); // leer gelassen: alten Namen behalten
  };

  return (
    <div className={`english-person-row ${props.active ? "active" : ""}`}>
      <input
        className="english-person-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label="Name"
        title="Zum Umbenennen hineinklicken"
      />
      {props.active ? (
        <span className="english-person-current">
          <Check size={14} /> lernt gerade
        </span>
      ) : (
        <button className="text-button" onClick={props.onSelect}>
          Auswählen
        </button>
      )}
      <button
        className="icon-button"
        title={props.canDelete ? "Person löschen" : "Mindestens eine Person bleibt"}
        disabled={!props.canDelete}
        onClick={props.onDelete}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
